//! account.rs — Comptes e-mail/mot de passe (Alex 2026-06-13, §9-A du HANDOFF).
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

use serde::{Deserialize, Serialize};
use std::sync::{Arc, OnceLock};

use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use rand::RngCore;

use crate::player_state::{self, PlayerProgress};
use crate::protocol::ServerMessage;
use crate::security::AuthAttemptTracker;
use crate::session::Session;

/// Clé Redis du compte, indexée par l'e-mail NORMALISÉ.
const ACCOUNT_PREFIX: &str = "account:";
/// Drapeau « ce player_id a déjà reçu le bonus » (SET NX) — rend le bonus
/// infarmable même si un même player_id crée plusieurs comptes. Volontairement
/// SÉPARÉ de `PlayerProgress` : un `SyncState` client ne doit jamais pouvoir le
/// remettre à zéro.
const WELCOMED_PREFIX: &str = "welcomed:";

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

// ──────────────────────────────────────────────────────────────────────────
// Validation / normalisation
// ──────────────────────────────────────────────────────────────────────────

/// Normalise un e-mail (trim + lowercase) et le valide structurellement.
/// Renvoie None si la forme est invalide. On NE fait PAS le RFC 5322 complet —
/// juste assez pour rejeter le junk ET borner la clé Redis : charset ASCII
/// restreint, un seul `@`, partie locale + domaine non vides, un point dans le
/// domaine. Le charset borné ferme aussi tout vecteur d'injection dans la clé.
pub fn normalize_email(raw: &str) -> Option<String> {
    let e = raw.trim().to_lowercase();
    if e.len() < 3 || e.len() > 254 {
        return None;
    }
    // Charset volontairement étroit : couvre la quasi-totalité des e-mails réels
    // (ASCII) et exclut espaces, contrôles, `/`, etc.
    let charset_ok = e
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '@' | '.' | '_' | '+' | '-'));
    if !charset_ok {
        return None;
    }
    let parts: Vec<&str> = e.split('@').collect();
    if parts.len() != 2 {
        return None;
    }
    let (local, domain) = (parts[0], parts[1]);
    if local.is_empty() || domain.is_empty() {
        return None;
    }
    if !domain.contains('.') || domain.starts_with('.') || domain.ends_with('.') {
        return None;
    }
    Some(e)
}

/// Politique mot de passe : 8..=256 caractères. La longueur est le meilleur
/// prédicteur de robustesse ; on n'impose pas de règle de complexité (friction
/// inutile). Le plafond borne le coût Argon2 d'une entrée hostile.
pub fn validate_password(pw: &str) -> Result<(), ()> {
    let len = pw.chars().count();
    if (8..=256).contains(&len) {
        Ok(())
    } else {
        Err(())
    }
}

// ──────────────────────────────────────────────────────────────────────────
// Hachage Argon2id
// ──────────────────────────────────────────────────────────────────────────

/// Hache un mot de passe en Argon2id (paramètres par défaut = recommandation
/// OWASP : m=19 MiB, t=2, p=1) avec un sel aléatoire de 16 octets tiré du CSPRNG
/// thread-local. Renvoie la chaîne PHC à stocker. Err sur échec interne (rare).
pub fn hash_password(password: &str) -> Result<String, ()> {
    let mut salt_bytes = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut salt_bytes);
    let salt = SaltString::encode_b64(&salt_bytes).map_err(|_| ())?;
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|_| ())?;
    Ok(hash.to_string())
}

/// Vérifie un mot de passe candidat contre un hash PHC stocké. False si le hash
/// est illisible ou si la vérif échoue (jamais de panic sur entrée corrompue).
pub fn verify_password(stored_hash: &str, candidate: &str) -> bool {
    let Ok(parsed) = PasswordHash::new(stored_hash) else {
        return false;
    };
    Argon2::default()
        .verify_password(candidate.as_bytes(), &parsed)
        .is_ok()
}

/// Hash factice (calculé une fois) pour égaliser le temps d'une connexion dont
/// l'e-mail N'EXISTE PAS : sans ça, un login « e-mail inconnu » répondrait bien
/// plus vite qu'un « mauvais mot de passe » → oracle de timing révélant quels
/// e-mails sont inscrits. On dépense un verify Argon2 dans les deux cas.
fn dummy_hash() -> &'static str {
    static H: OnceLock<String> = OnceLock::new();
    H.get_or_init(|| hash_password("argon2-anti-enumeration-dummy").unwrap_or_default())
}

/// Dépense un verify Argon2 ~équivalent à un vrai, sans révéler de résultat.
/// À appeler sur le chemin « e-mail introuvable » d'une connexion.
pub fn verify_dummy(candidate: &str) {
    let h = dummy_hash();
    if !h.is_empty() {
        let _ = verify_password(h, candidate);
    }
}

// ──────────────────────────────────────────────────────────────────────────
// Bonus de bienvenue (§9-A étape 4) — montants par défaut, à valider par Alex
// ──────────────────────────────────────────────────────────────────────────

pub const WELCOME_ECLATS: u64 = 300;
pub const WELCOME_DUST: u64 = 150;
pub const WELCOME_STARS: u64 = 30;

/// Les 14 cartes offertes = 6 starters + les 4 cartes que le deck Arena par
/// défaut référence HORS collection de départ (`heist/supernova/seve/jet-caillou`,
/// bug corrigé au passage) + 4 extras (`prescience/riposte/curse/gaia`). Ids
/// vérifiés contre l'union `CardId` (`app/src/ranked/rankedTypes.ts`).
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
    p.eclats = p.eclats.saturating_add(WELCOME_ECLATS);
    p.dust = p.dust.saturating_add(WELCOME_DUST);
    p.stars = p.stars.saturating_add(WELCOME_STARS);
    for &id in WELCOME_CARDS {
        if !p.card_collection.iter().any(|c| c == id) {
            p.card_collection.push(id.to_string());
        }
    }
}

// ──────────────────────────────────────────────────────────────────────────
// I/O Redis (via les primitives centralisées de player_state)
// ──────────────────────────────────────────────────────────────────────────

/// Charge un compte par e-mail normalisé. None si absent / illisible.
pub async fn load_account(email_norm: &str) -> Option<AccountRecord> {
    let key = format!("{ACCOUNT_PREFIX}{email_norm}");
    let raw = player_state::get_raw(&key).await?;
    serde_json::from_str(&raw).ok()
}

/// Crée le compte de façon ATOMIQUE (`SET account:{email} NX`). Renvoie
/// Ok(true) si créé, Ok(false) si l'e-mail est déjà pris, Err sur panne backend.
/// L'atomicité ferme la course « deux inscriptions simultanées même e-mail ».
pub async fn try_create_account(record: &AccountRecord) -> Result<bool, ()> {
    let key = format!("{ACCOUNT_PREFIX}{}", record.email);
    let json = serde_json::to_string(record).map_err(|_| ())?;
    player_state::set_nx(&key, &json).await
}

/// Marque ATOMIQUEMENT un player_id comme « bonus reçu » (`SET welcomed:{id} NX`).
/// Ok(true) = première fois (don autorisé), Ok(false) = déjà reçu (refuser le
/// don), Err = panne (par sécurité l'appelant NE donne PAS le bonus).
pub async fn try_mark_welcomed(player_id: &str) -> Result<bool, ()> {
    let key = format!("{WELCOMED_PREFIX}{player_id}");
    player_state::set_nx(&key, "1").await
}

// ──────────────────────────────────────────────────────────────────────────
// WS message handlers (called from main.rs dispatch — keeps that match thin)
// ──────────────────────────────────────────────────────────────────────────

/// Auth-flow error reply — generic codes only (`invalid_credentials`,
/// `email_taken`, `weak_password`, `rate_limited`, `auth_needed`,
/// `server_error`) so a probe can't learn whether an e-mail is registered.
fn reply_auth_error(session: &Arc<Session>, code: &str) {
    session.send(ServerMessage::AuthError { code: code.into() });
}

/// Handle a `Signup`: validate + rate-limit synchronously, then (off the
/// receive loop) hash the password, atomically create the account linked to the
/// guest's player_id, grant the one-time welcome bonus, and reply. See §9-A.
pub fn handle_signup(
    auth_attempts: &Arc<AuthAttemptTracker>,
    session: &Arc<Session>,
    email: String,
    password: String,
) {
    // Cheap, synchronous shape checks before any Redis / Argon2 work.
    let Some(email_norm) = normalize_email(&email) else {
        return reply_auth_error(session, "invalid_credentials");
    };
    if validate_password(&password).is_err() {
        return reply_auth_error(session, "weak_password");
    }
    // Linking the new account to the guest's progression requires an
    // authenticated guest session — the client always Hellos first, so this is
    // just a guard (never a normal path).
    let pid = session.player_id();
    if pid.is_empty() {
        return reply_auth_error(session, "auth_needed");
    }
    // Mass-signup guard: bound signups per IP. Every attempt counts and ages out
    // of the window; no per-key success-clear here.
    let sk = format!("signup|{}", session.peer_ip);
    if auth_attempts.is_blocked(sk.clone()) {
        return reply_auth_error(session, "rate_limited");
    }
    auth_attempts.record_failed(sk);

    let session_clone = session.clone();
    tokio::spawn(async move {
        let hash = match hash_password(&password) {
            Ok(h) => h,
            Err(()) => {
                session_clone.send(ServerMessage::AuthError { code: "server_error".into() });
                return;
            }
        };
        let record = AccountRecord {
            email: email_norm,
            password_hash: hash,
            player_id: pid.clone(),
            created_at: now_ms(),
            verified: false,
        };
        match try_create_account(&record).await {
            Err(()) => session_clone.send(ServerMessage::AuthError { code: "server_error".into() }),
            Ok(false) => session_clone.send(ServerMessage::AuthError { code: "email_taken".into() }),
            Ok(true) => {
                // New account: link the guest's current progression and grant the
                // welcome bonus exactly once per player_id (atomic `SET
                // welcomed:{id} NX`). On a backend error we skip the bonus (safe
                // default) rather than risk a double.
                let mut progress = player_state::load(&pid).await.unwrap_or_default();
                if let Ok(true) = try_mark_welcomed(&pid).await {
                    apply_welcome_bonus(&mut progress);
                }
                player_state::save(pid.clone(), progress.clone());
                let claim_token = player_state::load_claim_token(&pid).await;
                session_clone.send(ServerMessage::AuthOk {
                    player_id: pid,
                    claim_token,
                    state: progress,
                });
            }
        }
    });
}

/// Handle a `Login`: load the account, verify the password (constant-ish timing
/// via a dummy verify on miss), adopt the account identity + its progression,
/// and reply.
pub fn handle_login(
    auth_attempts: &Arc<AuthAttemptTracker>,
    session: &Arc<Session>,
    email: String,
    password: String,
) {
    let Some(email_norm) = normalize_email(&email) else {
        return reply_auth_error(session, "invalid_credentials");
    };
    let lk = format!("login|{}|{}", email_norm, session.peer_ip);
    if auth_attempts.is_blocked(lk.clone()) {
        return reply_auth_error(session, "rate_limited");
    }
    let session_clone = session.clone();
    let attempts = auth_attempts.clone();
    tokio::spawn(async move {
        let acct = load_account(&email_norm).await;
        // Always spend a verify (real or dummy) so timing is ~constant whether or
        // not the e-mail exists — closes the enumeration oracle.
        let ok = match &acct {
            Some(a) => verify_password(&a.password_hash, &password),
            None => {
                verify_dummy(&password);
                false
            }
        };
        match acct {
            Some(a) if ok => {
                attempts.record_success(lk);
                let pid = a.player_id;
                // Adopt the account's stable identity (cross-device login).
                session_clone.set_player_id(pid.clone());
                let progress = player_state::load(&pid).await.unwrap_or_default();
                // A fresh device holds no claim token yet — load it (or mint one)
                // so subsequent TOFU Hellos still authenticate.
                let claim_token = match player_state::load_claim_token(&pid).await {
                    Some(t) => Some(t),
                    None => player_state::try_create_claim_token(&pid).await.ok().flatten(),
                };
                session_clone.send(ServerMessage::AuthOk {
                    player_id: pid,
                    claim_token,
                    state: progress,
                });
            }
            _ => {
                attempts.record_failed(lk);
                session_clone.send(ServerMessage::AuthError { code: "invalid_credentials".into() });
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

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
        assert_eq!(p.eclats, 10 + WELCOME_ECLATS);
        assert_eq!(p.dust, WELCOME_DUST);
        assert_eq!(p.stars, WELCOME_STARS);
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
