//! economy.rs — RÈGLES D'ÉCONOMIE CÔTÉ SERVEUR (Alex 2026-06-13, anti-triche).
//!
//! Fondation de l'économie SERVEUR-AUTORITAIRE. Le serveur doit connaître les
//! prix / récompenses / raretés INDÉPENDAMMENT du client, sinon un client
//! modifié peut prétendre « cette légendaire coûte 0 » ou « j'ai gagné 1M
//! d'éclats ». Ici : la méta cartes (générée depuis cards.ts → zéro dérive) +
//! les barèmes (miroir de app/src/engine/economy.ts — À GARDER EN SYNC).
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

// ───────── Barèmes (miroir de app/src/engine/economy.ts — SYNC à la main) ─────────

pub const PACK_COST: u64 = 50;
pub const PACK_SIZE: usize = 3;
pub const ECLATS_PER_LOSS: u64 = 2;

/// Éclats pour une victoire, par mode de match enregistré.
pub fn eclats_per_win(mode: &str) -> u64 {
    match mode {
        "ranked" | "online" => 15,
        "constellation" => 12,
        // casual / hotseat / training
        _ => 5,
    }
}

pub fn eclats_reward(mode: &str, outcome: &str) -> u64 {
    match outcome {
        "win" => eclats_per_win(mode),
        "loss" => ECLATS_PER_LOSS,
        _ => 0,
    }
}

/// Poids de tirage d'une rareté dans un pack (la somme n'a pas à faire 100).
pub fn pack_weight(rarity: &str) -> u32 {
    match rarity {
        "common" => 60,
        "rare" => 30,
        "epic" => 9,
        "legendary" => 1,
        _ => 0,
    }
}

/// Poussière gagnée quand une carte tirée double une déjà possédée.
pub fn dust_per_duplicate(rarity: &str) -> u64 {
    match rarity {
        "common" => 5,
        "rare" => 15,
        "epic" => 40,
        "legendary" => 100,
        _ => 0,
    }
}
pub fn dust_for_duplicate(id: &str) -> u64 {
    rarity_of(id).map(dust_per_duplicate).unwrap_or(0)
}

/// Poussière nécessaire pour crafter une carte verrouillée précise.
pub fn craft_cost_for_rarity(rarity: &str) -> u64 {
    match rarity {
        "common" => 25,
        "rare" => 75,
        "epic" => 200,
        "legendary" => 500,
        _ => 0,
    }
}
pub fn craft_cost(id: &str) -> Option<u64> {
    rarity_of(id).map(craft_cost_for_rarity)
}

/// Paliers Codex : (seuil de cartes possédées, éclats, poussière). Pour valider
/// un claim côté serveur (collection ≥ seuil ET pas déjà réclamé).
pub const CODEX_TIERS: &[(usize, u64, u64)] = &[
    (5, 50, 0),
    (10, 120, 30),
    (15, 300, 80),
    (20, 450, 120),
    (26, 700, 200),
    (32, 850, 250),
    (40, 1100, 350),
    (46, 1500, 500),
];

/// Récompenses de saison : (LP minimum du palier, éclats, poussière).
pub const SEASON_REWARDS: &[(u64, u64, u64)] = &[
    (0, 50, 0),
    (1100, 150, 20),
    (1300, 300, 50),
    (1500, 500, 100),
    (1750, 700, 200),
];

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
}
