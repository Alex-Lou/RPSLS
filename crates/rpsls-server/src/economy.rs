//! economy.rs — RÈGLES D'ÉCONOMIE CÔTÉ SERVEUR (Alex 2026-06-13, anti-triche).
//!
//! Fondation de l'économie SERVEUR-AUTORITAIRE. Le serveur doit connaître les
//! prix / récompenses / raretés INDÉPENDAMMENT du client, sinon un client
//! modifié peut prétendre « cette légendaire coûte 0 » ou « j'ai gagné 1M
//! d'éclats ». Ici : la méta cartes (générée depuis cards.ts → zéro dérive) +
//! les barèmes (générés depuis app/src/engine/economy.ts + rank.ts → zéro dérive,
//! via scripts/gen-economy-meta.mjs).
//!
//! ⚠️ Ce module est PUR (data + fonctions). Il ne mute encore rien : les
//! endpoints validés (buy_pack / craft / claim / grant_match_reward) viendront
//! s'appuyer dessus aux incréments suivants.

use serde::Deserialize;
use std::collections::HashMap;
use std::sync::OnceLock;

#[derive(Debug, Clone, Deserialize)]
pub struct CardMeta {
    pub id: String,
    pub cost: u8,
    /// "common" | "rare" | "epic" | "legendary"
    pub rarity: String,
    /// "active" | "passive" | "fusion"
    pub kind: String,
}

/// Méta cartes générée depuis `app/src/ranked/cards.ts` par
/// `scripts/gen-card-meta.mjs`, EMBARQUÉE à la compilation (pas d'I/O runtime,
/// pas de dérive — relancer le générateur après tout ajout de carte).
const CARDS_META_JSON: &str = include_str!("../cards_meta.json");

pub fn card_meta() -> &'static HashMap<String, CardMeta> {
    static MAP: OnceLock<HashMap<String, CardMeta>> = OnceLock::new();
    MAP.get_or_init(|| {
        let list: Vec<CardMeta> = serde_json::from_str(CARDS_META_JSON)
            .expect("cards_meta.json invalide — relancer scripts/gen-card-meta.mjs");
        list.into_iter().map(|c| (c.id.clone(), c)).collect()
    })
}

/// Rareté d'une carte, ou None si id inconnu.
pub fn rarity_of(id: &str) -> Option<&'static str> {
    card_meta().get(id).map(|c| c.rarity.as_str())
}

/// True si la carte est COLLECTIONNABLE (kind != "fusion" — les cartes de
/// fusion sont créées en match via la Forge, jamais possédées). Miroir de
/// ALL_CARD_IDS côté client.
pub fn is_collectible(id: &str) -> bool {
    card_meta().get(id).map(|c| c.kind != "fusion").unwrap_or(false)
}

/// Tous les ids collectionnables (pour valider une collection / tirer un pack).
pub fn collectible_ids() -> Vec<&'static str> {
    card_meta()
        .values()
        .filter(|c| c.kind != "fusion")
        .map(|c| c.id.as_str())
        .collect()
}

// ───────── Barèmes — GÉNÉRÉS depuis app/src/engine/economy.ts (+ les floors de
// tiers de rank.ts pour la saison) par scripts/gen-economy-meta.mjs, embarqués
// ici via include_str!. ZÉRO dérive : relancer le générateur après toute modif
// de barème côté TS. ─────────

#[derive(Debug, Clone, Deserialize)]
pub struct CodexTier {
    pub threshold: usize,
    pub eclats: u64,
    pub dust: u64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SeasonReward {
    pub min_lp: u64,
    pub eclats: u64,
    pub dust: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EconomyMeta {
    pack_cost: u64,
    pack_size: usize,
    eclats_per_loss: u64,
    eclats_per_win: HashMap<String, u64>,
    pack_weights: HashMap<String, u32>,
    dust_per_duplicate: HashMap<String, u64>,
    craft_cost: HashMap<String, u64>,
    codex_tiers: Vec<CodexTier>,
    season_rewards: Vec<SeasonReward>,
}

const ECONOMY_META_JSON: &str = include_str!("../economy_meta.json");

fn economy_meta() -> &'static EconomyMeta {
    static M: OnceLock<EconomyMeta> = OnceLock::new();
    M.get_or_init(|| {
        serde_json::from_str(ECONOMY_META_JSON)
            .expect("economy_meta.json invalide — relancer scripts/gen-economy-meta.mjs")
    })
}

pub fn pack_cost() -> u64 {
    economy_meta().pack_cost
}
pub fn pack_size() -> usize {
    economy_meta().pack_size
}
pub fn eclats_per_loss() -> u64 {
    economy_meta().eclats_per_loss
}

/// Éclats pour une victoire dans `mode`. Mode inconnu → 0 (miroir du `?? 0` de
/// economy.ts ; l'ancien `_ => 5` côté Rust était une dérive silencieuse).
pub fn eclats_per_win(mode: &str) -> u64 {
    economy_meta().eclats_per_win.get(mode).copied().unwrap_or(0)
}

pub fn eclats_reward(mode: &str, outcome: &str) -> u64 {
    match outcome {
        "win" => eclats_per_win(mode),
        "loss" => eclats_per_loss(),
        _ => 0,
    }
}

/// Poids de tirage d'une rareté dans un pack (la somme n'a pas à faire 100).
pub fn pack_weight(rarity: &str) -> u32 {
    economy_meta().pack_weights.get(rarity).copied().unwrap_or(0)
}

/// Poussière gagnée quand une carte tirée double une déjà possédée.
pub fn dust_per_duplicate(rarity: &str) -> u64 {
    economy_meta().dust_per_duplicate.get(rarity).copied().unwrap_or(0)
}
pub fn dust_for_duplicate(id: &str) -> u64 {
    rarity_of(id).map(dust_per_duplicate).unwrap_or(0)
}

/// Poussière nécessaire pour crafter une carte verrouillée précise.
pub fn craft_cost_for_rarity(rarity: &str) -> u64 {
    economy_meta().craft_cost.get(rarity).copied().unwrap_or(0)
}
pub fn craft_cost(id: &str) -> Option<u64> {
    rarity_of(id).map(craft_cost_for_rarity)
}

/// Paliers Codex (seuil de cartes possédées, éclats, poussière) — pour valider
/// un claim côté serveur (collection ≥ seuil ET pas déjà réclamé).
pub fn codex_tiers() -> &'static [CodexTier] {
    &economy_meta().codex_tiers
}

/// Récompenses de saison (LP minimum du palier, éclats, poussière).
pub fn season_rewards() -> &'static [SeasonReward] {
    &economy_meta().season_rewards
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn meta_loads_and_is_consistent() {
        let m = card_meta();
        // 87 cartes définies, 8 de fusion → 79 collectionnables.
        assert_eq!(m.len(), 87, "cards_meta.json doit contenir 87 cartes");
        assert_eq!(collectible_ids().len(), 79, "79 cartes collectionnables");
        // Quelques sanity-checks de barème.
        assert_eq!(rarity_of("supernova"), Some("legendary"));
        assert_eq!(craft_cost("supernova"), Some(500));
        assert_eq!(craft_cost("aegis"), Some(25));
        assert!(!is_collectible("apocalypse")); // carte de fusion
        assert_eq!(eclats_reward("ranked", "win"), 15);
        assert_eq!(eclats_reward("constellation", "win"), 12);
    }

    #[test]
    fn economy_meta_barems_match_source() {
        // Valeurs générées depuis economy.ts — gate de régression du codegen.
        assert_eq!(pack_cost(), 50);
        assert_eq!(pack_size(), 3);
        assert_eq!(eclats_per_loss(), 2);
        assert_eq!(eclats_per_win("ranked"), 15);
        assert_eq!(eclats_per_win("online"), 15);
        assert_eq!(eclats_per_win("constellation"), 12);
        assert_eq!(eclats_per_win("casual"), 5);
        // Mode inconnu → 0 (miroir du `?? 0` de economy.ts ; corrige la dérive `_ => 5`).
        assert_eq!(eclats_per_win("bogus"), 0);
        assert_eq!(eclats_reward("bogus", "win"), 0);
        assert_eq!(pack_weight("common"), 60);
        assert_eq!(pack_weight("legendary"), 1);
        assert_eq!(dust_per_duplicate("legendary"), 100);
        assert_eq!(dust_per_duplicate("common"), 5);
        assert_eq!(craft_cost_for_rarity("epic"), 200);
        // Codex : 8 paliers, premier (5,50,0), dernier seuil 46.
        let codex = codex_tiers();
        assert_eq!(codex.len(), 8);
        assert_eq!((codex[0].threshold, codex[0].eclats, codex[0].dust), (5, 50, 0));
        assert_eq!(codex[7].threshold, 46);
        // Saison : 5 paliers, bronze (0,50,..) et diamond (1750,700,200).
        let season = season_rewards();
        assert_eq!(season.len(), 5);
        assert_eq!((season[0].min_lp, season[0].eclats), (0, 50));
        assert_eq!((season[4].min_lp, season[4].eclats, season[4].dust), (1750, 700, 200));
    }
}
