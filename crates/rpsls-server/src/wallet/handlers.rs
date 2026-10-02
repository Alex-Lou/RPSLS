//! Messages WebSocket du portefeuille + crédits serveur (fin de match en ligne,
//! bonus de bienvenue). Toute opération exige une session AUTHENTIFIÉE (player_id
//! posé par Hello/Login) : sinon `auth_needed`.

use std::sync::Arc;

use rand::SeedableRng;
use tracing::warn;

use super::store::{self, now_ms, StoreError};
use super::{PackResult, Wallet, WalletError};
use crate::player_state::{self, PlayerProgress};
use crate::protocol::{PlayerSlot, ServerMessage};
use crate::session::Session;

/// Opération demandée par le client.
pub enum WalletOp {
    Init,
    OpenPack,
    Craft(String),
    BuyPremiumSet(String),
    ClaimCodex(u32),
    ClaimCpuReward { mode: String, outcome: String },
    ClaimUnlocks(Vec<String>),
    ClaimSeason,
}

impl WalletOp {
    fn name(&self) -> &'static str {
        match self {
            Self::Init => "init",
            Self::OpenPack => "open_pack",
            Self::Craft(_) => "craft",
            Self::BuyPremiumSet(_) => "buy_premium_set",
            Self::ClaimCodex(_) => "claim_codex",
            Self::ClaimCpuReward { .. } => "claim_cpu_reward",
            Self::ClaimUnlocks(_) => "claim_unlocks",
            Self::ClaimSeason => "claim_season",
        }
    }
}

/// Ce qu'une opération a produit, renvoyé avec le portefeuille à jour.
#[derive(Default)]
struct Outcome {
    pack: Option<PackResult>,
    eclats: Option<u64>,
    dust: Option<u64>,
    cards: Vec<String>,
}

fn reply(session: &Session, op: &str, wallet: Wallet, o: Outcome) {
    session.send(ServerMessage::WalletUpdate {
        op: op.to_string(),
        wallet,
        pack: o.pack,
        eclats: o.eclats,
        dust: o.dust,
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
        WalletOp::ClaimCpuReward { mode, outcome } => {
            store::update(pid, |w| w.claim_cpu_reward(&mode, &outcome, now))
                .await
                .map(|(granted, w)| (Outcome { eclats: Some(granted), ..Default::default() }, w))
        }
        WalletOp::ClaimUnlocks(ids) => {
            let ids: Vec<String> = ids.into_iter().take(64).collect();
            store::update(pid, |w| Ok::<_, WalletError>(w.claim_unlocks(&ids)))
                .await
                .map(|(cards, w)| (Outcome { cards, ..Default::default() }, w))
        }
        WalletOp::ClaimSeason => {
            // LP de la ligne player (client, borné à 5000 par sanitize) : au
            // pire un tricheur touche le palier diamant, une fois par saison.
            let lp = player_state::load(pid)
                .await
                .map_err(|_| StoreError::Backend)?
                .map(|p| p.rank_lp)
                .unwrap_or(0);
            store::update(pid, |w| w.claim_season(lp, now))
                .await
                .map(|((e, d), w)| (Outcome { eclats: Some(e), dust: Some(d), ..Default::default() }, w))
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
/// barème que l'app : le perdant par forfait ne touche rien (sauf Arena, qui
/// paie la défaite comme `recordArenaMatch`).
pub fn credit_match_end(a: &Arc<Session>, b: &Arc<Session>, winner: Option<PlayerSlot>, forfeit: bool, mode: &'static str) {
    for (slot, s) in [(PlayerSlot::A, a), (PlayerSlot::B, b)] {
        let outcome = match winner {
            None => "draw",
            Some(w) if w == slot => "win",
            Some(_) => "loss",
        };
        let amount = match (mode, outcome) {
            ("arena", o) => crate::economy::arena_eclats(o),
            (_, "loss") if forfeit => 0,
            (m, o) => crate::economy::eclats_reward(m, o),
        };
        let pid = s.player_id();
        if amount == 0 || pid.is_empty() {
            continue;
        }
        let session = s.clone();
        tokio::spawn(async move {
            match store::update(&pid, |w| {
                w.credit_eclats(amount);
                Ok::<_, WalletError>(())
            })
            .await {
                Ok(((), w)) => reply(&session, "match_reward", w, Outcome { eclats: Some(amount), ..Default::default() }),
                Err(StoreError::NotInitialized) => {} // ancienne app : elle crédite en local
                Err(e) => warn!(player_id = %pid, code = e.code(), "match reward NOT credited"),
            }
        });
    }
}
