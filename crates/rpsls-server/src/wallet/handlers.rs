//! Messages WebSocket du portefeuille + crédits serveur (fin de match en ligne,
//! bonus de bienvenue). Toute opération exige une session AUTHENTIFIÉE (player_id
//! posé par Hello/Login) : sinon `auth_needed`.

use std::sync::Arc;

use rand::SeedableRng;
use tracing::warn;

use super::store::{self, now_ms, StoreError};
use super::{PackResult, Wallet, WalletError};
use crate::player_state::PlayerProgress;
use crate::protocol::{CpuReward, DailyClaim, PlayerSlot, ServerMessage};
use crate::session::Session;

/// Opération demandée par le client.
pub enum WalletOp {
    Init,
    OpenPack,
    Craft(String),
    BuyPremiumSet(String),
    ClaimCodex(u32),
    ClaimCpuRewards(Vec<CpuReward>),
    ClaimUnlocks(Vec<String>),
    ClaimSeason,
    ClaimLevel(u32),
    ClaimDailies(Vec<DailyClaim>),
}

impl WalletOp {
    fn name(&self) -> &'static str {
        match self {
            Self::Init => "init",
            Self::OpenPack => "open_pack",
            Self::Craft(_) => "craft",
            Self::BuyPremiumSet(_) => "buy_premium_set",
            Self::ClaimCodex(_) => "claim_codex",
            Self::ClaimCpuRewards(_) => "claim_cpu_rewards",
            Self::ClaimUnlocks(_) => "claim_unlocks",
            Self::ClaimSeason => "claim_season",
            Self::ClaimLevel(_) => "claim_level",
            Self::ClaimDailies(_) => "claim_dailies",
        }
    }
}

/// Ce qu'une opération a produit, renvoyé avec le portefeuille à jour.
#[derive(Default)]
struct Outcome {
    pack: Option<PackResult>,
    eclats: Option<u64>,
    dust: Option<u64>,
    stars: Option<u64>,
    cards: Vec<String>,
}

fn reply(session: &Session, op: &str, wallet: Wallet, o: Outcome) {
    session.send(ServerMessage::WalletUpdate {
        op: op.to_string(),
        wallet,
        pack: o.pack,
        eclats: o.eclats,
        dust: o.dust,
        stars: o.stars,
        cards: o.cards,
    });
}

fn reply_error(session: &Session, op: &str, code: &str) {
    session.send(ServerMessage::WalletError { op: op.to_string(), code: code.to_string() });
}

/// Point d'entrée du dispatch : valide l'auth, puis exécute hors de la boucle de
/// réception (aller-retour Redis).
pub fn handle(session: &Arc<Session>, op: WalletOp) {
    let pid = session.player_id();
    if pid.is_empty() {
        return reply_error(session, op.name(), "auth_needed");
    }
    let session = session.clone();
    tokio::spawn(async move {
        let name = op.name();
        match run(&pid, op).await {
            Ok((o, w)) => reply(&session, name, w, o),
            Err(e) => reply_error(&session, name, e.code()),
        }
    });
}

async fn run(pid: &str, op: WalletOp) -> Result<(Outcome, Wallet), StoreError> {
    let now = now_ms();
    match op {
        WalletOp::Init => Ok((Outcome::default(), store::init(pid).await?)),
        WalletOp::OpenPack => {
            let mut rng = rand::rngs::StdRng::from_entropy();
            store::update(pid, |w| w.open_pack(&mut rng))
                .await
                .map(|(pack, w)| (Outcome { pack: Some(pack), ..Default::default() }, w))
        }
        WalletOp::Craft(id) => store::update(pid, |w| w.craft(&id))
            .await
            .map(|((), w)| (Outcome { cards: vec![id], ..Default::default() }, w)),
        WalletOp::BuyPremiumSet(set) => store::update(pid, |w| w.buy_premium_set(&set))
            .await
            .map(|((), w)| (Outcome::default(), w)),
        WalletOp::ClaimCodex(t) => store::update(pid, |w| w.claim_codex(t))
            .await
            .map(|((), w)| (Outcome::default(), w)),
        WalletOp::ClaimCpuRewards(rewards) => {
            // Entrées invalides / rejouées ignorées (pas de refus du lot entier :
            // le client la retire de sa file comme les autres).
            let rewards: Vec<CpuReward> = rewards.into_iter().take(50).collect();
            store::update(pid, |w| Ok::<_, WalletError>(w.claim_cpu_batch(&rewards, now)))
                .await
                .map(|(granted, w)| (Outcome { eclats: Some(granted), ..Default::default() }, w))
        }
        WalletOp::ClaimUnlocks(ids) => {
            let ids: Vec<String> = ids.into_iter().take(64).collect();
            // Score SERVEUR (leaderboard) seulement si une carte demandée a une
            // règle de LP (évite une lecture Redis à chaque déblocage CPU).
            let needs_lp = ids
                .iter()
                .any(|id| crate::economy::unlock_rule(id).is_some_and(|r| r.kind == "rankLp"));
            let lp = if needs_lp {
                crate::leaderboard::score_of(pid).await.map_err(|_| StoreError::Backend)?
            } else {
                0
            };
            store::update(pid, |w| Ok::<_, WalletError>(w.claim_unlocks(&ids, lp)))
                .await
                .map(|(cards, w)| (Outcome { cards, ..Default::default() }, w))
        }
        WalletOp::ClaimSeason => {
            // LP = score du leaderboard SERVEUR (plus le rank_lp écrit par le client).
            let lp = crate::leaderboard::score_of(pid).await.map_err(|_| StoreError::Backend)?;
            store::update(pid, |w| w.claim_season(lp, now)).await.map(|((e, d, st), w)| {
                (Outcome { eclats: Some(e), dust: Some(d), stars: Some(st), ..Default::default() }, w)
            })
        }
        WalletOp::ClaimLevel(level) => store::update(pid, |w| Ok::<_, WalletError>(w.claim_level(level, now)))
            .await
            .map(|((e, st), w)| (Outcome { eclats: Some(e), stars: Some(st), ..Default::default() }, w)),
        WalletOp::ClaimDailies(claims) => {
            let claims: Vec<DailyClaim> = claims.into_iter().take(10).collect();
            store::update(pid, |w| {
                let granted = claims
                    .iter()
                    .filter_map(|c| w.claim_daily(&c.date, &c.id, now).ok())
                    .sum::<u64>();
                Ok::<_, WalletError>(granted)
            })
            .await
            .map(|(granted, w)| (Outcome { eclats: Some(granted), ..Default::default() }, w))
        }
    }
}

/// Remplace l'éco d'une progression par le portefeuille, s'il existe. Au mieux :
/// en cas d'erreur la progression part telle quelle (l'app à jour se fie de
/// toute façon à la réponse de `WalletInit`).
pub async fn overlay_best_effort(pid: &str, p: &mut PlayerProgress) {
    match store::get(pid).await {
        Ok(Some(w)) => w.overlay_onto(p),
        Ok(None) => {}
        Err(_) => warn!(player_id = %pid, "wallet overlay skipped (backend error)"),
    }
}

/// ACTIVATION FORCÉE (éco lot 3), appelée au `Hello` : tout joueur qui a déjà
/// une ligne `player:{pid}` reçoit son portefeuille (même règle que
/// `WalletInit` : migration bornée si l'identité précède `WALLET_LAUNCH_MS`,
/// sinon portefeuille neuf), même si son app ne l'a jamais demandé.
///
/// `row_exists = false` (joueur tout neuf) : on ne crée pas ici, `WalletInit`
/// s'en charge (portefeuille neuf : la ligne poussée par l'app n'est jamais lue).
/// Au mieux : en cas d'erreur, la progression part telle quelle.
pub async fn ensure_and_overlay(pid: &str, p: &mut PlayerProgress, row_exists: bool) {
    match store::get(pid).await {
        Ok(Some(w)) => w.overlay_onto(p),
        Ok(None) if row_exists => match store::init(pid).await {
            Ok(w) => w.overlay_onto(p),
            Err(e) => warn!(player_id = %pid, code = e.code(), "forced wallet activation failed"),
        },
        Ok(None) => {}
        Err(_) => warn!(player_id = %pid, "wallet overlay skipped (backend error)"),
    }
}

/// Bonus de bienvenue versé dans le portefeuille s'il existe déjà. Sinon rien :
/// la ligne player le porte et la migration le reprendra.
pub async fn grant_welcome(pid: &str) {
    let cards = crate::account::WELCOME_CARDS;
    match store::update(pid, |w| {
        w.apply_welcome(cards);
        Ok::<_, WalletError>(())
    })
    .await {
        Ok(_) | Err(StoreError::NotInitialized) => {}
        Err(e) => warn!(player_id = %pid, code = e.code(), "welcome bonus NOT credited to wallet"),
    }
}

/// Éclats de fin de match EN LIGNE, crédités par le serveur (qui connaît le
/// résultat) aux joueurs dont le portefeuille existe. `mode` : "online"
/// (classique), "constellation" (lanes) ou "arena" (Constellation Pro). Même
/// barème que l'app : le perdant par forfait ne touche rien (Arena compris :
/// la défaite « normale » y paie comme `recordArenaMatch`, pas l'abandon).
///
/// `sweep` : le vainqueur n'a concédé aucune manche. Une victoire en
/// Constellation / Arena compte aussi pour les déblocages (`count_constell_win`,
/// même borne quotidienne que le CPU) — miroir de rankedUnlocks.ts, qui compte
/// toute entrée d'historique « constellation » gagnée (Arena comprise, toujours
/// journalisée en 1-0 → blanchissage).
pub fn credit_match_end(
    a: &Arc<Session>,
    b: &Arc<Session>,
    winner: Option<PlayerSlot>,
    forfeit: bool,
    mode: &'static str,
    sweep: bool,
) {
    for (slot, s) in [(PlayerSlot::A, a), (PlayerSlot::B, b)] {
        let outcome = match winner {
            None => "draw",
            Some(w) if w == slot => "win",
            Some(_) => "loss",
        };
        let amount = match_reward(mode, outcome, forfeit);
        let counts_win = outcome == "win" && matches!(mode, "constellation" | "arena");
        let pid = s.player_id();
        if (amount == 0 && !counts_win) || pid.is_empty() {
            continue;
        }
        let swept = sweep || mode == "arena";
        let session = s.clone();
        tokio::spawn(async move {
            let now = now_ms();
            match store::update(&pid, |w| {
                w.credit_eclats(amount);
                if counts_win {
                    w.count_constell_win(swept, now);
                }
                Ok::<_, WalletError>(())
            })
            .await {
                Ok(((), w)) => reply(&session, "match_reward", w, Outcome { eclats: Some(amount), ..Default::default() }),
                // Joueur jamais passé par un Hello authentifié avec une ligne
                // existante (rarissime depuis l'activation forcée) : rien à créditer.
                Err(StoreError::NotInitialized) => {}
                Err(e) => warn!(player_id = %pid, code = e.code(), "match reward NOT credited"),
            }
        });
    }
}

/// Éclats d'une fin de match pour un camp (`outcome` : win / loss / draw).
pub(crate) fn match_reward(mode: &str, outcome: &str, forfeit: bool) -> u64 {
    match (mode, outcome) {
        ("arena", "loss") if forfeit => 0,
        ("arena", o) => crate::economy::arena_eclats(o),
        (_, "loss") if forfeit => 0,
        (m, o) => crate::economy::eclats_reward(m, o),
    }
}
