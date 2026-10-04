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

/// Plafonds de la MIGRATION (première init) : la ligne player a toujours été
/// écrite par le client, donc un solde gonflé avant l'activation ne doit pas
/// devenir officiel. Un joueur honnête est très en dessous.
/// - éclats / poussière : marge large au-dessus de toute progression réelle ;
/// - étoiles : on ne peut en gagner QUE via le bonus de bienvenue ;
/// - sets premium : retirés (800+ ✦ chacun, inaccessibles honnêtement).
pub const MIGRATION_MAX_ECLATS: u64 = 5_000;
pub const MIGRATION_MAX_DUST: u64 = 2_000;

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
    /// Migration : le portefeuille part de la ligne Redis du joueur, nettoyée
    /// (ids inconnus retirés, doublons fusionnés) et PLAFONNÉE (cf.
    /// `MIGRATION_MAX_*`) — choix Alex : pas d'amnistie pour un solde gonflé.
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
            w.add_card(id);
        }
        for &t in &p.codex_claimed {
            if economy::codex_tiers().iter().any(|c| c.threshold == t as usize) && !w.codex_claimed.contains(&t) {
                w.codex_claimed.push(t);
            }
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
        if !economy::is_collectible(id) {
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
        if self.card_collection.len() < tier.threshold {
            return Err(WalletError::NotEligible);
        }
        self.eclats = self.eclats.saturating_add(tier.eclats);
        self.dust = self.dust.saturating_add(tier.dust);
        self.codex_claimed.push(threshold);
        Ok(())
    }

    /// Récompense d'un match vs CPU, au barème officiel et sous le plafond du
    /// jour UTC. Renvoie les éclats RÉELLEMENT crédités (0 si plafond atteint).
    /// `mode` : un mode de `eclats_per_win`, ou "arena" (Constellation Pro).
    pub fn claim_cpu_reward(&mut self, mode: &str, outcome: &str, now_ms: u64) -> Result<u64, WalletError> {
        if !matches!(outcome, "win" | "loss" | "draw") {
            return Err(WalletError::Unknown);
        }
        let amount = if mode == "arena" {
            economy::arena_eclats(outcome)
        } else if economy::eclats_per_win(mode) > 0 {
            economy::eclats_reward(mode, outcome)
        } else {
            return Err(WalletError::Unknown);
        };
        let day = now_ms / MS_PER_DAY;
        if self.cpu_day != day {
            self.cpu_day = day;
            self.cpu_eclats_today = 0;
        }
        let room = economy::cpu_eclats_daily_cap().saturating_sub(self.cpu_eclats_today);
        let granted = amount.min(room);
        self.cpu_eclats_today += granted;
        self.eclats = self.eclats.saturating_add(granted);
        Ok(granted)
    }

    /// Déblocages de progression : la condition (victoires vs CPU, LP) n'est pas
    /// vérifiable, mais seules les cartes de `rankedUnlocks.ts` sont acceptées.
    /// Renvoie les cartes réellement ajoutées.
    pub fn claim_unlocks(&mut self, ids: &[String]) -> Vec<String> {
        ids.iter()
            .filter(|id| economy::is_unlock_card(id))
            .filter(|id| self.add_card(id))
            .cloned()
            .collect()
    }

    /// Fin de saison, sur l'horloge serveur : verse le palier de `lp` (LP du
    /// joueur, borné à 5000 par `sanitize`), puis ouvre la saison suivante.
    /// Renvoie (éclats, poussière) versés.
    pub fn claim_season(&mut self, lp: u64, now_ms: u64) -> Result<(u64, u64), WalletError> {
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
        self.season_number = self.season_number.saturating_add(1);
        self.season_started_at = now_ms;
        Ok((tier.eclats, tier.dust))
    }

    /// Gain d'un match EN LIGNE arbitré par le serveur (pas de plafond : le
    /// résultat est connu du serveur).
    pub fn credit_eclats(&mut self, amount: u64) {
        self.eclats = self.eclats.saturating_add(amount);
    }

    /// Bonus de bienvenue (montants + cartes de `account::bonus`).
    pub fn apply_welcome(&mut self, cards: &[&str]) {
        self.eclats = self.eclats.saturating_add(economy::welcome_eclats());
        self.dust = self.dust.saturating_add(economy::welcome_dust());
        self.stars = self.stars.saturating_add(economy::welcome_stars());
        for id in cards {
            self.add_card(id);
        }
    }
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
