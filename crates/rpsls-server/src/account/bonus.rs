//! Bonus de bienvenue (§9-A étape 4).
//!
//! Les MONTANTS de monnaies (éclats/dust/stars) viennent de `WELCOME_BONUS` dans
//! app/src/engine/economy.ts via economy_meta.json (single source ⇒ l'affichage
//! pré-inscription d'AuthGate ne peut plus diverger du don serveur) :
//! `crate::economy::welcome_eclats()` / `welcome_dust()` / `welcome_stars()`.

use crate::player_state::PlayerProgress;

/// Les 14 cartes offertes = 6 starters + les 4 cartes que le deck Arena par
/// défaut référence HORS collection de départ (`heist/supernova/seve/jet-caillou`,
/// bug corrigé au passage) + 4 extras (`prescience/riposte/curse/gaia`). Ids
/// vérifiés contre l'union `CardId` (`app/src/ranked/rankedTypes.ts`).
/// ⚠️ Le NOMBRE (14) est affiché côté client via `WELCOME_BONUS.cards`
/// (economy.ts) — garder `WELCOME_CARDS.len()` en phase avec lui.
pub const WELCOME_CARDS: &[&str] = &[
    // 6 starters
    "aegis", "precision", "anchor", "second-wind", "surge", "augur",
    // cartes du deck Arena par défaut, sinon hors collection
    "heist", "supernova", "seve", "jet-caillou",
    // extras de bienvenue
    "prescience", "riposte", "curse", "gaia",
];

/// Applique le bonus à une progression : monnaies additives (saturantes) +
/// union des cartes (jamais de doublon). PUR — l'appelant gère l'unicité du
/// don via `try_mark_welcomed`.
pub fn apply_welcome_bonus(p: &mut PlayerProgress) {
    p.eclats = p.eclats.saturating_add(crate::economy::welcome_eclats());
    p.dust = p.dust.saturating_add(crate::economy::welcome_dust());
    p.stars = p.stars.saturating_add(crate::economy::welcome_stars());
    for &id in WELCOME_CARDS {
        if !p.card_collection.iter().any(|c| c == id) {
            p.card_collection.push(id.to_string());
        }
    }
}
