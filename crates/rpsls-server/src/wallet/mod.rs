//! Économie SERVEUR-AUTORITAIRE (HANDOFF §9-B) — le « portefeuille » d'un joueur.
//!
//! Le portefeuille (éclats, poussière, étoiles, collection, sets premium, paliers
//! codex) vit dans sa PROPRE clé Redis `wallet:{pid}`, écrite UNIQUEMENT par le
//! serveur (cf. `store.rs`). `SyncState` continue d'écrire `player:{pid}` pour le
//! reste (XP, decks, cosmétiques…) ; une fois le portefeuille créé, les champs
//! d'éco de cette ligne sont ignorés et remplacés au chargement.
//!
//! Ce fichier est PUR : chaque opération valide puis mute un `Wallet` en mémoire,
//! sans I/O. Barèmes : `crate::economy` (générés depuis le client, zéro dérive).
//!
//! Matchs vs CPU : invérifiables par nature (ils tournent sur le téléphone). Leur
//! gain est donc réclamé au serveur, qui applique le barème officiel ET un
//! plafond quotidien (`cpu_eclats_daily_cap`) : un tricheur gagne au pire le
//! plafond, un joueur normal ne le sent pas.

pub mod handlers;
pub mod store;
#[cfg(test)]
mod tests;

use rand::Rng;
use serde::{Deserialize, Serialize};

use crate::economy;
use crate::player_state::PlayerProgress;

/// Même borne que `PlayerProgress::sanitize` (ids courts, coût Redis négligeable).
const MAX_COLLECTION: usize = 256;
const MS_PER_DAY: u64 = 86_400_000;

/// Plafonds de la MIGRATION (première init d'une ligne ANTÉRIEURE au lancement,
/// cf. `WALLET_LAUNCH_MS`) : la ligne player a toujours été écrite par le
/// client, donc un solde gonflé ne doit pas devenir officiel.
/// - éclats / poussière : 1500 / 500 (Alex 2026-10) ;
/// - étoiles : on ne pouvait en gagner QUE via le bonus de bienvenue ;
/// - sets premium : retirés ;
/// - collection : bornée à départ ∪ bienvenue ∪ cartes de déblocage.
pub const MIGRATION_MAX_ECLATS: u64 = 1_500;
pub const MIGRATION_MAX_DUST: u64 = 500;

/// LANCEMENT du portefeuille « fermé » (2026-10-04 00:00 UTC). Une identité
/// créée APRÈS cette date (horodatage SERVEUR `born:{pid}`, posé à la création
/// du jeton d'identité, cf. `player_state::try_create_claim_token`) reçoit un
/// portefeuille NEUF (cartes de départ + bonus de bienvenue si le parcours
/// compte l'a accordé) : sa ligne player, écrite par le client, n'est JAMAIS
/// reprise. Une identité sans `born:` existait avant (les appareils d'Alex) →
/// migration bornée ci-dessus.
pub const WALLET_LAUNCH_MS: u64 = 1_791_072_000_000;

/// Victoires Constellation/Arena comptées au plus par jour UTC pour les
/// déblocages (une réclamation CPU n'est pas vérifiable).
pub const MAX_CONSTELL_WINS_PER_DAY: u32 = 10;
/// Ids de réclamations CPU mémorisés (anti-rejeu).
pub const RECENT_CLAIM_IDS: usize = 100;
/// Niveau maximal accepté dans `claim_level` (borne de calcul).
pub const MAX_LEVEL: u32 = 1_000;

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Wallet {
    #[serde(default)]
    pub eclats: u64,
    #[serde(default)]
    pub dust: u64,
    #[serde(default)]
    pub stars: u64,
    #[serde(default)]
    pub card_collection: Vec<String>,
    #[serde(default)]
    pub owned_premium_sets: Vec<String>,
    #[serde(default)]
    pub codex_claimed: Vec<u32>,
    /// Jour UTC (`now_ms / 86_400_000`) du compteur d'éclats CPU.
    #[serde(default)]
    pub cpu_day: u64,
    #[serde(default)]
    pub cpu_eclats_today: u64,
    /// Saison, cadencée par l'horloge SERVEUR (plus celle du téléphone).
    #[serde(default)]
    pub season_number: u32,
    #[serde(default)]
    pub season_started_at: u64,
    /// Dernier niveau PAYÉ (✦ + 💎 de passage de niveau). `None` = portefeuille
    /// antérieur à la règle : la 1re réclamation pose la base sans rien payer.
    #[serde(default)]
    pub level_rewarded: Option<u32>,
    /// Jour UTC du compteur `levels_today`.
    #[serde(default)]
    pub level_day: u64,
    #[serde(default)]
    pub levels_today: u32,
    /// Défis quotidiens réclamés, « AAAA-MM-JJ:id » (quelques jours glissants).
    #[serde(default)]
    pub daily_claims: Vec<String>,
    /// Victoires Constellation/Arena comptées par le SERVEUR (déblocages).
    #[serde(default)]
    pub constell_wins: u64,
    /// Victoires « blanchissage » (adversaire à 0 manche) comptées.
    #[serde(default)]
    pub constell_sweeps: u64,
    #[serde(default)]
    pub constell_day: u64,
    #[serde(default)]
    pub constell_today: u32,
    /// Derniers ids de réclamations CPU acceptées (anti-rejeu, FIFO).
    #[serde(default)]
    pub recent_claim_ids: Vec<String>,
    /// Bonus de bienvenue déjà versé dans CE portefeuille (anti double don).
    #[serde(default)]
    pub welcomed: bool,
}

/// Refus d'une opération. Codes stables, renvoyés tels quels au client.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WalletError {
    /// Solde insuffisant.
    Funds,
    /// Déjà possédé (carte, set premium).
    Owned,
    /// Id inconnu (carte, set, palier, mode).
    Unknown,
    /// Condition non remplie (taille de collection, saison pas finie).
    NotEligible,
    /// Déjà réclamé.
    Claimed,
}

impl WalletError {
    pub fn code(self) -> &'static str {
        match self {
            Self::Funds => "insufficient_funds",
            Self::Owned => "already_owned",
            Self::Unknown => "unknown_item",
            Self::NotEligible => "not_eligible",
            Self::Claimed => "already_claimed",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackResult {
    pub cards: Vec<String>,
    pub is_new: Vec<bool>,
    pub dust_gained: u64,
}

impl Wallet {
    /// Migration d'une ligne ANTÉRIEURE au lancement : le portefeuille part de la
    /// ligne Redis du joueur, nettoyée (ids inconnus retirés, doublons
    /// fusionnés), PLAFONNÉE (cf. `MIGRATION_MAX_*`) et dont la collection est
    /// bornée à départ ∪ bienvenue ∪ déblocages (pas d'amnistie pour une ligne
    /// forgée). Le niveau n'a pas de base : posée à la 1re `claim_level`.
    pub fn from_progress(p: &PlayerProgress, now_ms: u64) -> Self {
        let mut w = Wallet {
            eclats: p.eclats.min(MIGRATION_MAX_ECLATS),
            dust: p.dust.min(MIGRATION_MAX_DUST),
            stars: p.stars.min(economy::welcome_stars()),
            season_number: p.season_number.max(1),
            season_started_at: if p.season_started_at == 0 { now_ms } else { p.season_started_at.min(now_ms) },
            ..Default::default()
        };
        for id in &p.card_collection {
            if migratable_card(id) {
                w.add_card(id);
            }
        }
        for &t in &p.codex_claimed {
            if economy::codex_tiers().iter().any(|c| c.threshold == t as usize) && !w.codex_claimed.contains(&t) {
                w.codex_claimed.push(t);
            }
        }
        w
    }

    /// Portefeuille NEUF (identité créée après `WALLET_LAUNCH_MS`) : cartes de
    /// départ seulement ; la ligne player n'est pas lue. Niveau de base 0 : tous
    /// les passages de niveau seront payés (au rythme du plafond quotidien).
    pub fn fresh(now_ms: u64) -> Self {
        let mut w = Wallet {
            season_number: 1,
            season_started_at: now_ms,
            level_rewarded: Some(0),
            ..Default::default()
        };
        for id in economy::starter_cards() {
            w.add_card(id);
        }
        w
    }

    /// Écrit les champs d'éco du portefeuille dans une progression (réponses
    /// `StateLoaded` / `AuthOk`) : le serveur gagne toujours sur l'éco.
    pub fn overlay_onto(&self, p: &mut PlayerProgress) {
        p.eclats = self.eclats;
        p.dust = self.dust;
        p.stars = self.stars;
        p.card_collection = self.card_collection.clone();
        p.owned_premium_sets = self.owned_premium_sets.clone();
        p.codex_claimed = self.codex_claimed.clone();
        p.season_number = self.season_number;
        p.season_started_at = self.season_started_at;
    }

    fn owns(&self, id: &str) -> bool {
        self.card_collection.iter().any(|c| c == id)
    }

    /// Ajoute une carte collectionnable non possédée. True si ajoutée.
    fn add_card(&mut self, id: &str) -> bool {
        if !economy::is_collectible(id) || self.owns(id) || self.card_collection.len() >= MAX_COLLECTION {
            return false;
        }
        self.card_collection.push(id.to_string());
        true
    }

    /// Ouvre un pack : le SERVEUR tire les cartes (poids de rareté officiels,
    /// jamais de Finisher), débite le prix, convertit les doublons en poussière.
    pub fn open_pack(&mut self, rng: &mut impl Rng) -> Result<PackResult, WalletError> {
        let cost = economy::pack_cost();
        if self.eclats < cost {
            return Err(WalletError::Funds);
        }
        self.eclats -= cost;
        let cards: Vec<String> = (0..economy::pack_size()).map(|_| roll_card(rng)).collect();
        let mut is_new = Vec::with_capacity(cards.len());
        let mut dust_gained = 0;
        for id in &cards {
            let added = self.add_card(id);
            if !added {
                dust_gained += economy::dust_for_duplicate(id);
            }
            is_new.push(added);
        }
        self.dust = self.dust.saturating_add(dust_gained);
        Ok(PackResult { cards, is_new, dust_gained })
    }

    pub fn craft(&mut self, id: &str) -> Result<(), WalletError> {
        // Finishers Pro : jamais deckables → plus forgeables (500 ✨ perdus).
        if !economy::is_packable(id) {
            return Err(WalletError::Unknown);
        }
        if self.owns(id) {
            return Err(WalletError::Owned);
        }
        let cost = economy::craft_cost(id).ok_or(WalletError::Unknown)?;
        if self.dust < cost {
            return Err(WalletError::Funds);
        }
        self.dust -= cost;
        self.add_card(id);
        Ok(())
    }

    pub fn buy_premium_set(&mut self, set_id: &str) -> Result<(), WalletError> {
        let cost = economy::premium_set_cost(set_id).ok_or(WalletError::Unknown)?;
        if self.owned_premium_sets.iter().any(|s| s == set_id) {
            return Err(WalletError::Owned);
        }
        if self.stars < cost {
            return Err(WalletError::Funds);
        }
        self.stars -= cost;
        self.owned_premium_sets.push(set_id.to_string());
        Ok(())
    }

    pub fn claim_codex(&mut self, threshold: u32) -> Result<(), WalletError> {
        let tier = economy::codex_tiers()
            .iter()
            .find(|t| t.threshold == threshold as usize)
            .ok_or(WalletError::Unknown)?;
        if self.codex_claimed.contains(&threshold) {
            return Err(WalletError::Claimed);
        }
        // Seules les cartes OBTENABLES comptent (un Finisher forgé avant la
        // règle ne fait pas avancer le Codex).
        let owned = self.card_collection.iter().filter(|c| economy::is_packable(c)).count();
        if owned < tier.threshold {
            return Err(WalletError::NotEligible);
        }
        self.eclats = self.eclats.saturating_add(tier.eclats);
        self.dust = self.dust.saturating_add(tier.dust);
        self.codex_claimed.push(threshold);
        Ok(())
    }

    /// Crédite `amount` éclats DANS le plafond CPU du jour UTC (matchs CPU,
    /// passages de niveau, défis quotidiens). Renvoie le montant RÉELLEMENT versé.
    fn grant_capped(&mut self, amount: u64, now_ms: u64) -> u64 {
        let day = now_ms / MS_PER_DAY;
        if self.cpu_day != day {
            self.cpu_day = day;
            self.cpu_eclats_today = 0;
        }
        let room = economy::cpu_eclats_daily_cap().saturating_sub(self.cpu_eclats_today);
        let granted = amount.min(room);
        self.cpu_eclats_today += granted;
        self.eclats = self.eclats.saturating_add(granted);
        granted
    }

    /// Compte une victoire Constellation/Arena pour les déblocages (au plus
    /// `MAX_CONSTELL_WINS_PER_DAY` par jour UTC, toutes sources confondues).
    pub fn count_constell_win(&mut self, sweep: bool, now_ms: u64) {
        let day = now_ms / MS_PER_DAY;
        if self.constell_day != day {
            self.constell_day = day;
            self.constell_today = 0;
        }
        if self.constell_today >= MAX_CONSTELL_WINS_PER_DAY {
            return;
        }
        self.constell_today += 1;
        self.constell_wins += 1;
        if sweep {
            self.constell_sweeps += 1;
        }
    }

    /// Récompense d'un match vs CPU, au barème officiel × multiplicateur de
    /// longueur (`best_of` : bestOf en classique, winTo en Constellation) et sous
    /// le plafond du jour UTC. Renvoie les éclats RÉELLEMENT crédités (0 si
    /// plafond atteint). `mode` : casual | ranked | constellation | arena.
    /// "online" est REFUSÉ (un match en ligne est crédité par le serveur, qui l'a
    /// arbitré ; le repli bot se réclame en "ranked"), tout comme training /
    /// hotseat (0 💎). `sweep` : victoire sans manche concédée (déblocages).
    pub fn claim_cpu_reward(
        &mut self,
        mode: &str,
        outcome: &str,
        best_of: Option<u32>,
        sweep: bool,
        now_ms: u64,
    ) -> Result<u64, WalletError> {
        if !matches!(outcome, "win" | "loss" | "draw") || mode == "online" {
            return Err(WalletError::Unknown);
        }
        let amount = if mode == "arena" {
            economy::arena_eclats(outcome)
        } else if economy::eclats_per_win(mode) > 0 {
            economy::scale_by_length(economy::eclats_reward(mode, outcome), mode, best_of)
        } else {
            return Err(WalletError::Unknown);
        };
        let granted = self.grant_capped(amount, now_ms);
        if outcome == "win" && matches!(mode, "constellation" | "arena") {
            // Arena : le client journalise toute victoire en 1-0 (bestOf 1) →
            // c'est toujours un blanchissage pour rankedUnlocks.ts.
            self.count_constell_win(sweep || mode == "arena", now_ms);
        }
        Ok(granted)
    }

    /// Lot de réclamations CPU : les ids déjà vus (rejeu) sont ignorés, les
    /// entrées invalides aussi (le client les retire de sa file comme les
    /// autres). Renvoie le total crédité.
    pub fn claim_cpu_batch(&mut self, rewards: &[crate::protocol::CpuReward], now_ms: u64) -> u64 {
        let mut total = 0;
        for r in rewards {
            let id = r.id.as_deref().filter(|i| !i.is_empty() && i.len() <= 64);
            if let Some(id) = id {
                if self.recent_claim_ids.iter().any(|c| c == id) {
                    continue;
                }
            }
            let Ok(g) = self.claim_cpu_reward(&r.mode, &r.outcome, r.best_of, r.sweep, now_ms) else { continue };
            total += g;
            if let Some(id) = id {
                self.recent_claim_ids.push(id.to_string());
                let excess = self.recent_claim_ids.len().saturating_sub(RECENT_CLAIM_IDS);
                self.recent_claim_ids.drain(..excess);
            }
        }
        total
    }

    /// Passages de niveau : paie (✦ + 💎) les niveaux de `level_rewarded + 1`
    /// à `level`, au plus `level_up_daily_max` par jour UTC (le reste sera payé
    /// les jours suivants : le client renvoie son niveau à chaque passage). Le
    /// niveau vient du client (calculé depuis l'XP) : invérifiable, d'où ce
    /// débit borné. Les 💎 comptent dans le plafond CPU. Renvoie (💎, ✦).
    pub fn claim_level(&mut self, level: u32, now_ms: u64) -> (u64, u64) {
        let level = level.min(MAX_LEVEL);
        let Some(done) = self.level_rewarded else {
            // Portefeuille antérieur à la règle : on pose la base, sans payer
            // rétroactivement les niveaux déjà atteints.
            self.level_rewarded = Some(level);
            return (0, 0);
        };
        if level <= done {
            return (0, 0);
        }
        let day = now_ms / MS_PER_DAY;
        if self.level_day != day {
            self.level_day = day;
            self.levels_today = 0;
        }
        let room = economy::level_up_daily_max().saturating_sub(self.levels_today);
        let upto = level.min(done.saturating_add(room));
        if upto <= done {
            return (0, 0);
        }
        let eclats: u64 = (done + 1..=upto).map(economy::level_up_eclats).sum();
        let stars = economy::level_up_stars() * (upto - done) as u64;
        let granted = self.grant_capped(eclats, now_ms);
        self.stars = self.stars.saturating_add(stars);
        self.levels_today += upto - done;
        self.level_rewarded = Some(upto);
        (granted, stars)
    }

    /// Défi quotidien `id` du jour `date` (« AAAA-MM-JJ », jour LOCAL du
    /// téléphone) : accepté si la date est à ±1 jour du jour UTC serveur (fuseaux),
    /// pas déjà réclamé, et au plus `daily_challenges_per_day` par date. Les 💎
    /// comptent dans le plafond CPU. Renvoie les éclats versés.
    pub fn claim_daily(&mut self, date: &str, id: &str, now_ms: u64) -> Result<u64, WalletError> {
        let today = (now_ms / MS_PER_DAY) as i64;
        let day = parse_date_key(date).ok_or(WalletError::Unknown)?;
        if (day - today).abs() > 1 {
            return Err(WalletError::NotEligible);
        }
        if id.is_empty() || id.len() > 32 || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
            return Err(WalletError::Unknown);
        }
        // Purge des dates hors fenêtre (la liste reste minuscule).
        self.daily_claims
            .retain(|k| k.split(':').next().and_then(parse_date_key).is_some_and(|d| d >= today - 2));
        let key = format!("{date}:{id}");
        if self.daily_claims.contains(&key) {
            return Err(WalletError::Claimed);
        }
        let prefix = format!("{date}:");
        if self.daily_claims.iter().filter(|k| k.starts_with(&prefix)).count() >= economy::daily_challenges_per_day() {
            return Err(WalletError::NotEligible);
        }
        self.daily_claims.push(key);
        Ok(self.grant_capped(economy::daily_challenge_eclats(), now_ms))
    }

    /// Déblocages de progression : chaque carte doit être une carte de
    /// `rankedUnlocks.ts` ET sa règle doit être remplie côté SERVEUR (victoires
    /// Constellation/Arena comptées par le serveur, `server_lp` = score du
    /// leaderboard). Renvoie les cartes réellement ajoutées.
    pub fn claim_unlocks(&mut self, ids: &[String], server_lp: u64) -> Vec<String> {
        let mut added = Vec::new();
        for id in ids {
            let Some(rule) = economy::unlock_rule(id) else { continue };
            let have = match rule.kind.as_str() {
                "constellWins" => self.constell_wins,
                "constellSweeps" => self.constell_sweeps,
                "rankLp" => server_lp,
                _ => continue,
            };
            if have >= rule.min && self.add_card(id) {
                added.push(id.clone());
            }
        }
        added
    }

    /// Fin de saison, sur l'horloge serveur : verse le palier de `lp` (score du
    /// joueur au leaderboard SERVEUR, 1000 par défaut), puis ouvre la saison
    /// suivante. Renvoie (éclats, poussière, étoiles) versés.
    pub fn claim_season(&mut self, lp: u64, now_ms: u64) -> Result<(u64, u64, u64), WalletError> {
        if now_ms < self.season_started_at.saturating_add(economy::season_duration_ms()) {
            return Err(WalletError::NotEligible);
        }
        let tier = economy::season_rewards()
            .iter()
            .rev()
            .find(|t| lp >= t.min_lp)
            .ok_or(WalletError::Unknown)?;
        self.eclats = self.eclats.saturating_add(tier.eclats);
        self.dust = self.dust.saturating_add(tier.dust);
        self.stars = self.stars.saturating_add(tier.stars);
        self.season_number = self.season_number.saturating_add(1);
        self.season_started_at = now_ms;
        Ok((tier.eclats, tier.dust, tier.stars))
    }

    /// Gain d'un match EN LIGNE arbitré par le serveur (pas de plafond : le
    /// résultat est connu du serveur).
    pub fn credit_eclats(&mut self, amount: u64) {
        self.eclats = self.eclats.saturating_add(amount);
    }

    /// Bonus de bienvenue (montants + cartes de `account::bonus`). Une seule
    /// fois par portefeuille (`welcomed`) : le don peut arriver par deux voies
    /// (création du portefeuille neuf / `grant_welcome`) sans doubler.
    pub fn apply_welcome(&mut self, cards: &[&str]) {
        if self.welcomed {
            return;
        }
        self.welcomed = true;
        self.eclats = self.eclats.saturating_add(economy::welcome_eclats());
        self.dust = self.dust.saturating_add(economy::welcome_dust());
        self.stars = self.stars.saturating_add(economy::welcome_stars());
        for id in cards {
            self.add_card(id);
        }
    }
}

/// Carte reprise par la migration bornée : départ ∪ bienvenue ∪ déblocages.
fn migratable_card(id: &str) -> bool {
    economy::starter_cards().iter().any(|c| c == id)
        || crate::account::WELCOME_CARDS.contains(&id)
        || economy::is_unlock_card(id)
}

/// « AAAA-MM-JJ » → jour depuis l'epoch (calendrier grégorien proleptique,
/// algorithme « days from civil » de H. Hinnant). None si mal formé.
pub(crate) fn parse_date_key(s: &str) -> Option<i64> {
    let b = s.as_bytes();
    if b.len() != 10 || b[4] != b'-' || b[7] != b'-' {
        return None;
    }
    let y: i64 = s.get(0..4)?.parse().ok()?;
    let m: i64 = s.get(5..7)?.parse().ok()?;
    let d: i64 = s.get(8..10)?.parse().ok()?;
    if !(1..=12).contains(&m) || !(1..=31).contains(&d) {
        return None;
    }
    let y = if m <= 2 { y - 1 } else { y };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let mp = (m + 9) % 12;
    let doy = (153 * mp + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    Some(era * 146_097 + doe - 719_468)
}

/// Tire une carte : rareté selon les poids officiels, puis une carte de cette
/// rareté parmi les tirables (`is_packable`). Repli : une commune.
fn roll_card(rng: &mut impl Rng) -> String {
    const RARITIES: [&str; 4] = ["common", "rare", "epic", "legendary"];
    let total: u32 = RARITIES.iter().map(|r| economy::pack_weight(r)).sum();
    let mut r = rng.gen_range(0..total.max(1));
    let mut picked = "common";
    for rarity in RARITIES {
        let w = economy::pack_weight(rarity);
        if r < w {
            picked = rarity;
            break;
        }
        r -= w;
    }
    let pool = packable_of(picked);
    let pool = if pool.is_empty() { packable_of("common") } else { pool };
    pool[rng.gen_range(0..pool.len())].to_string()
}

fn packable_of(rarity: &str) -> Vec<&'static str> {
    let mut ids: Vec<&'static str> = economy::collectible_ids()
        .into_iter()
        .filter(|id| economy::is_packable(id) && economy::rarity_of(id) == Some(rarity))
        .collect();
    ids.sort_unstable(); // ordre stable : tirage reproductible à graine égale
    ids
}
