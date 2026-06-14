//! account — Comptes e-mail/mot de passe (Alex 2026-06-13, §9-A du HANDOFF).
//!
//! Première brique du système de comptes : la RESSOURCE compte + le hachage
//! Argon2id + le bonus de bienvenue. Sécu-critique (mots de passe + argent réel
//! lié au compte) → tout est carré :
//!   - mot de passe JAMAIS stocké : seul le hash Argon2id (sel aléatoire) part
//!     en Redis (`account:{email}` → JSON `AccountRecord`).
//!   - e-mail normalisé (trim + lowercase + charset borné) avant toute lecture
//!     ou clé Redis.
//!   - codes d'erreur GÉNÉRIQUES côté appelant (anti-énumération) — ce module
//!     se contente de dire « existe / valide / pas valide ».
//!
//! L'I/O Redis réutilise les primitives `player_state::{get_raw, set_nx}` (la
//! config Upstash y est déjà centralisée) — pas de second client HTTP ici.
//!
//! Découpé par responsabilité ; l'API publique `account::*` (appelée depuis
//! `dispatch.rs` et `google_auth.rs`) est préservée par les `pub use` ci-dessous :
//!   - `validation` : normalisation/validation e-mail + mot de passe.
//!   - `hashing`    : Argon2id + anti-énumération par timing.
//!   - `bonus`      : bonus de bienvenue (montants depuis economy_meta.json).
//!   - `store`      : I/O Redis (clés + SET NX atomiques).
//!   - `handlers`   : handlers WS `Signup`/`Login` (appelés par le dispatch).

use serde::{Deserialize, Serialize};

mod bonus;
mod handlers;
mod hashing;
mod store;
mod validation;

pub use bonus::*;
pub use handlers::*;
pub use hashing::*;
pub use store::*;
pub use validation::*;

/// Enregistrement compte persisté en Redis. Le `player_id` est l'identité
/// DURABLE : à l'inscription on y lie le player_id de la session invitée
/// courante ; à la connexion la session adopte ce player_id (cross-device).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountRecord {
    pub email: String,
    /// Hash Argon2id au format PHC (`$argon2id$v=19$...`). JAMAIS le mot de passe.
    pub password_hash: String,
    pub player_id: String,
    pub created_at: u64,
    /// Vérification e-mail différée (SMTP plus tard) — prévu, pas encore utilisé.
    #[serde(default)]
    pub verified: bool,
}

/// Epoch millis (0 si l'horloge système est cassée — inoffensif ici).
pub fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::player_state::PlayerProgress;

    #[test]
    fn normalize_trims_lowercases_and_validates() {
        assert_eq!(
            normalize_email("  Alex@Example.COM "),
            Some("alex@example.com".to_string())
        );
        assert!(normalize_email("user+tag@example.com").is_some());
        assert!(normalize_email("a.b-c_d@sub.example.co").is_some());
        // rejets
        assert!(normalize_email("no-at-sign").is_none());
        assert!(normalize_email("a@b").is_none()); // domaine sans point
        assert!(normalize_email("a@b.").is_none()); // domaine finit par un point
        assert!(normalize_email("@example.com").is_none()); // local vide
        assert!(normalize_email("a b@example.com").is_none()); // espace
        assert!(normalize_email("a@@example.com").is_none()); // deux @
        assert!(normalize_email("évil@example.com").is_none()); // non-ASCII
    }

    #[test]
    fn canonical_email_folds_plus_tag_and_gmail_dots() {
        // +tag stripped for everyone
        assert_eq!(canonical_email("moi+promo@example.com"), "moi@example.com");
        assert_eq!(canonical_email("moi+1+2@example.com"), "moi@example.com");
        // Gmail folds dots, and googlemail.com is folded onto gmail.com → the
        // same real inbox shares ONE welcome key across all these variants.
        assert_eq!(canonical_email("jo.hn+x@gmail.com"), "john@gmail.com");
        assert_eq!(canonical_email("j.o.h.n@googlemail.com"), "john@gmail.com");
        assert_eq!(canonical_email("john+promo@googlemail.com"), "john@gmail.com");
        // Non-gmail keeps dots
        assert_eq!(canonical_email("jo.hn@example.com"), "jo.hn@example.com");
        // Plain address is its own canonical form
        assert_eq!(canonical_email("alex@example.com"), "alex@example.com");
    }

    #[test]
    fn disposable_domains_are_flagged() {
        assert!(is_disposable_email("x@mailinator.com"));
        assert!(is_disposable_email("a+b@yopmail.com"));
        assert!(!is_disposable_email("alex@gmail.com"));
        assert!(!is_disposable_email("alex@example.com"));
    }

    #[test]
    fn password_length_bounds() {
        assert!(validate_password("short").is_err()); // <8
        assert!(validate_password("longenough").is_ok());
        assert!(validate_password(&"x".repeat(257)).is_err()); // >256
    }

    #[test]
    fn hash_then_verify_roundtrips() {
        let h = hash_password("correct-horse-battery").unwrap();
        assert!(h.starts_with("$argon2id$"));
        assert!(verify_password(&h, "correct-horse-battery"));
        assert!(!verify_password(&h, "wrong-password"));
        // Sel aléatoire → deux hash du même mot de passe diffèrent.
        let h2 = hash_password("correct-horse-battery").unwrap();
        assert_ne!(h, h2);
    }

    #[test]
    fn verify_rejects_garbage_hash() {
        assert!(!verify_password("not-a-phc-string", "whatever"));
    }

    #[test]
    fn welcome_bonus_adds_and_unions() {
        let mut p = PlayerProgress {
            eclats: 10,
            card_collection: vec!["aegis".to_string()],
            ..Default::default()
        };
        apply_welcome_bonus(&mut p);
        assert_eq!(p.eclats, 10 + crate::economy::welcome_eclats());
        assert_eq!(p.dust, crate::economy::welcome_dust());
        assert_eq!(p.stars, crate::economy::welcome_stars());
        // "aegis" déjà présent → pas de doublon.
        assert_eq!(
            p.card_collection.iter().filter(|c| *c == "aegis").count(),
            1
        );
        for id in WELCOME_CARDS {
            assert!(p.card_collection.iter().any(|c| c == id), "carte manquante: {id}");
        }
        // aegis faisait partie des 14 → total == nb de cartes de bienvenue.
        assert_eq!(p.card_collection.len(), WELCOME_CARDS.len());
        assert_eq!(WELCOME_CARDS.len(), 14);
    }
}
