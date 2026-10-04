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

/// True si la carte peut sortir d'un pack : collectionnable ET pas un Finisher
/// Pro (injectés à 3 étoiles en match, jamais deckables). Miroir de
/// `PACKABLE_IDS` côté client (engine/economy.ts).
pub fn is_packable(id: &str) -> bool {
    is_collectible(id) && !id.starts_with("finisher-")
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
    /// ✦ de fin de saison.
    #[serde(default)]
    pub stars: u64,
}

/// Règle de déblocage générée depuis rankedUnlocks.ts : `card` s'obtient quand
/// le compteur `kind` (constellWins | constellSweeps | rankLp) atteint `min`.
#[derive(Debug, Clone, Deserialize)]
pub struct UnlockRule {
    pub card: String,
    pub kind: String,
    pub min: u64,
}

/// Bonus de bienvenue (monnaies accordées une fois à l'inscription). Le champ
/// `cards` de economy.ts est purement décoratif côté client → ignoré ici (serde
/// laisse tomber les champs inconnus).
#[derive(Debug, Clone, Deserialize, Default)]
pub struct WelcomeBonus {
    #[serde(default)]
    pub eclats: u64,
    #[serde(default)]
    pub dust: u64,
    #[serde(default)]
    pub stars: u64,
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
    welcome_bonus: WelcomeBonus,
    premium_set_ids: Vec<String>,
    codex_tiers: Vec<CodexTier>,
    season_rewards: Vec<SeasonReward>,
    premium_set_costs: HashMap<String, u64>,
    arena_eclats: HashMap<String, u64>,
    cpu_eclats_daily_cap: u64,
    unlock_cards: Vec<String>,
    unlock_rules: Vec<UnlockRule>,
    starter_cards: Vec<String>,
    season_duration_ms: u64,
    length_mult_best_of: HashMap<String, u64>,
    length_mult_win_to: HashMap<String, u64>,
    level_up_eclats_base: u64,
    level_up_eclats_per_level: u64,
    level_up_stars: u64,
    level_up_daily_max: u32,
    daily_challenge_eclats: u64,
    daily_challenges_per_day: usize,
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

/// Bonus de bienvenue (monnaies accordées une fois à l'inscription). Source =
/// `WELCOME_BONUS` dans economy.ts ; account.rs lit ces valeurs au lieu de les
/// redéfinir (single source ⇒ l'affichage pré-inscription ne peut plus diverger
/// du don serveur).
pub fn welcome_eclats() -> u64 {
    economy_meta().welcome_bonus.eclats
}
pub fn welcome_dust() -> u64 {
    economy_meta().welcome_bonus.dust
}
pub fn welcome_stars() -> u64 {
    economy_meta().welcome_bonus.stars
}

/// Vrai si `id` est un set premium CONNU (défini dans themes.ts). Sert de
/// whitelist anti-forge serveur : un set absent de la liste ne peut pas être
/// légitimement possédé, donc le serveur le retire de `ownedPremiumSets`.
pub fn is_premium_set(id: &str) -> bool {
    economy_meta().premium_set_ids.iter().any(|s| s == id)
}

/// Prix en ✦ d'un set premium, ou None si le set est inconnu.
pub fn premium_set_cost(id: &str) -> Option<u64> {
    if !is_premium_set(id) {
        return None;
    }
    economy_meta().premium_set_costs.get(id).copied()
}

/// Éclats d'un match Constellation Pro (Arena) : "win" | "draw" | "loss".
pub fn arena_eclats(outcome: &str) -> u64 {
    economy_meta().arena_eclats.get(outcome).copied().unwrap_or(0)
}

/// Plafond quotidien (jour UTC) d'éclats gagnés contre le CPU.
pub fn cpu_eclats_daily_cap() -> u64 {
    economy_meta().cpu_eclats_daily_cap
}

/// True si la carte fait partie des déblocages de progression (rankedUnlocks.ts).
pub fn is_unlock_card(id: &str) -> bool {
    economy_meta().unlock_cards.iter().any(|c| c == id)
}

/// Règle de déblocage d'une carte (None si la carte n'est pas un déblocage).
pub fn unlock_rule(id: &str) -> Option<&'static UnlockRule> {
    economy_meta().unlock_rules.iter().find(|r| r.card == id)
}

/// Collection de départ (STARTER_COLLECTION de cards.ts).
pub fn starter_cards() -> &'static [String] {
    &economy_meta().starter_cards
}

/// Multiplicateur de longueur (%) d'un match vs CPU — miroir de
/// `lengthMultPct` (economy.ts). Classique : par bestOf ; Constellation : par
/// winTo. Longueur absente ou inconnue → 100.
pub fn length_mult_pct(mode: &str, best_of: Option<u32>) -> u64 {
    let Some(n) = best_of else { return 100 };
    let table = match mode {
        "casual" | "ranked" => &economy_meta().length_mult_best_of,
        "constellation" => &economy_meta().length_mult_win_to,
        _ => return 100,
    };
    table.get(&n.to_string()).copied().unwrap_or(100)
}

/// Montant × multiplicateur, arrondi au plus proche (= Math.round côté client).
pub fn scale_by_length(amount: u64, mode: &str, best_of: Option<u32>) -> u64 {
    (amount * length_mult_pct(mode, best_of) + 50) / 100
}

/// 💎 d'un passage au niveau `level` (25 + 5 × niveau).
pub fn level_up_eclats(level: u32) -> u64 {
    let m = economy_meta();
    m.level_up_eclats_base + m.level_up_eclats_per_level * level as u64
}
pub fn level_up_stars() -> u64 {
    economy_meta().level_up_stars
}
/// Niveaux payés au plus par jour UTC (le surplus attend le lendemain).
pub fn level_up_daily_max() -> u32 {
    economy_meta().level_up_daily_max
}
pub fn daily_challenge_eclats() -> u64 {
    economy_meta().daily_challenge_eclats
}
pub fn daily_challenges_per_day() -> usize {
    economy_meta().daily_challenges_per_day
}

/// Durée d'une saison (ms) — SEASON_DURATION_MS côté client.
pub fn season_duration_ms() -> u64 {
    economy_meta().season_duration_ms
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn meta_loads_and_is_consistent() {
        let m = card_meta();
        // 87 cartes définies, 8 de fusion → 79 collectionnables.
        assert_eq!(m.len(), 131, "cards_meta.json doit contenir 131 cartes");
        assert_eq!(collectible_ids().len(), 115, "115 cartes collectionnables");
        // Fusions déclarées APRÈS `voie:` (bug du générateur corrigé) : non collectionnables.
        assert!(!is_collectible("apotheose-spectrale"));
        assert!(!is_collectible("imposteur"));
        // Finishers : collectionnables (codex) mais jamais tirés en pack.
        assert!(is_collectible("finisher-lame"));
        assert!(!is_packable("finisher-lame"));
        assert!(is_packable("aegis"));
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
        // Codex : 8 paliers étalés jusqu'aux 110 cartes obtenables.
        let codex = codex_tiers();
        assert_eq!(codex.len(), 8);
        assert_eq!((codex[0].threshold, codex[0].eclats, codex[0].dust), (20, 50, 0));
        assert_eq!((codex[7].threshold, codex[7].eclats, codex[7].dust), (110, 1000, 500));
        // Saison : 5 paliers, bronze (0,50,..) et diamond (1750,700,200).
        let season = season_rewards();
        assert_eq!(season.len(), 5);
        assert_eq!((season[0].min_lp, season[0].eclats), (0, 50));
        assert_eq!((season[4].min_lp, season[4].eclats, season[4].dust, season[4].stars), (1750, 700, 200, 100));
        assert_eq!(season[0].stars, 10);
        // Bonus de bienvenue (single source economy.ts, lu par account.rs).
        assert_eq!((welcome_eclats(), welcome_dust(), welcome_stars()), (300, 150, 30));
        // Whitelist sets premium : ids connus acceptés, id forgé rejeté.
        assert!(is_premium_set("eclipse"));
        assert!(is_premium_set("quartz"));
        assert!(!is_premium_set("forged-set-xyz"));
        assert_eq!(premium_set_cost("quartz"), Some(300));
        assert_eq!(premium_set_cost("void"), Some(300));
        assert_eq!(premium_set_cost("forged-set-xyz"), None);
        assert_eq!((arena_eclats("win"), arena_eclats("draw"), arena_eclats("loss")), (40, 20, 10));
        assert_eq!(cpu_eclats_daily_cap(), 375);
        assert_eq!(eclats_per_win("training"), 0);
        assert_eq!(eclats_per_win("hotseat"), 0);
        // Multiplicateurs de longueur + règles de déblocage générés.
        assert_eq!(length_mult_pct("ranked", Some(7)), 180);
        assert_eq!(length_mult_pct("constellation", Some(1)), 50);
        assert_eq!(scale_by_length(15, "casual", Some(5)), 21);
        let r = unlock_rule("supernova").unwrap();
        assert_eq!((r.kind.as_str(), r.min), ("rankLp", 1500));
        assert_eq!(unlock_rule("vortex").unwrap().kind, "constellSweeps");
        assert!(unlock_rule("aegis").is_none());
        assert_eq!(starter_cards().len(), 6);
        assert_eq!((level_up_eclats(1), level_up_stars(), level_up_daily_max()), (30, 10, 5));
        assert_eq!((daily_challenge_eclats(), daily_challenges_per_day()), (25, 3));
        assert!(is_unlock_card("supernova"));
        assert!(!is_unlock_card("aegis"));
        assert_eq!(season_duration_ms(), 30 * 24 * 3600 * 1000);
    }
}
