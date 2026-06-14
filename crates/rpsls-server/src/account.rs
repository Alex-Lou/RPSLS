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
/// Drapeau « cette BOÎTE e-mail a déjà reçu le bonus » (SET NX), keyé sur la
/// forme CANONIQUE de l'e-mail (cf. `canonical_email`). C'est lui qui rend le
/// bonus infarmable côté inscription e-mail : réinstaller (player_id neuf) ou
/// décliner des variantes `+tag` ne donne plus un nouveau bonus tant que la
/// vraie boîte est la même. Séparé de `welcomed:` (keyé player_id, voie Google).
const WELCOMED_EMAIL_PREFIX: &str = "welcomed_email:";
/// Index inverse player_id → e-mail du compte. Pose l'invariant « UN compte par
/// identité » : à l'inscription on le claim en SET NX ; s'il existe déjà, cette
/// identité a déjà un compte → on refuse (jamais deux comptes sur un player_id).
const ACCOUNT_PID_PREFIX: &str = "account_pid:";

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

/// Domaines e-mail jetables connus. Refusés à l'inscription pour brider le farm
/// du bonus de bienvenue via des boîtes éphémères. Liste courte et conservatrice
/// (faux positifs quasi nuls) ; à étendre au besoin. Ce n'est PAS une frontière
/// de sécurité — juste un coût supplémentaire pour l'abuseur.
const DISPOSABLE_DOMAINS: &[&str] = &[
    "mailinator.com", "guerrillamail.com", "guerrillamail.info", "10minutemail.com",
    "tempmail.com", "temp-mail.org", "throwawaymail.com", "yopmail.com", "getnada.com",
    "trashmail.com", "sharklasers.com", "maildrop.cc", "dispostable.com", "fakeinbox.com",
    "mintemail.com", "mohmal.com", "spam4.me", "emailondeck.com", "moakt.com",
];

/// True si l'e-mail NORMALISÉ appartient à un domaine jetable connu.
pub fn is_disposable_email(email_norm: &str) -> bool {
    match email_norm.rsplit('@').next() {
        Some(domain) => DISPOSABLE_DOMAINS.iter().any(|d| *d == domain),
        None => false,
    }
}

/// Forme CANONIQUE d'un e-mail pour la clé « bonus déjà reçu » : on retire le
/// sous-adressage `+tag` de la partie locale (et les points pour Gmail, qui les
/// ignore). `moi+1@gmail.com`, `moi.2+x@gmail.com` et `moi@gmail.com` partagent
/// donc UNE seule clé de bienvenue → un bonus par vraie boîte, même en
/// fabriquant des variantes. N'affecte PAS l'identité du compte
/// (`account:{email}` garde l'e-mail complet tel que saisi).
pub fn canonical_email(email_norm: &str) -> String {
    let mut parts = email_norm.splitn(2, '@');
    let local_raw = parts.next().unwrap_or("");
    let domain_raw = parts.next().unwrap_or("");
    // googlemail.com is an official alias of gmail.com — same physical inbox —
    // so fold it onto gmail.com BEFORE keying, else the same mailbox claims the
    // bonus twice (name@gmail.com vs name@googlemail.com).
    let domain = if domain_raw == "googlemail.com" { "gmail.com" } else { domain_raw };
    let mut local = local_raw.split('+').next().unwrap_or(local_raw).to_string();
    if domain == "gmail.com" {
        local = local.replace('.', "");
    }
    format!("{local}@{domain}")
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

/// Marque ATOMIQUEMENT une BOÎTE e-mail (forme canonique) comme « bonus reçu »
/// (`SET welcomed_email:{canonical} NX`). Ok(true) = première fois pour cette
/// boîte (don autorisé), Ok(false) = déjà reçu (refuser), Err = panne (défaut
/// sûr : pas de don). C'est la garde anti-farm de l'inscription e-mail.
pub async fn try_mark_welcomed_email(canonical: &str) -> Result<bool, ()> {
    let key = format!("{WELCOMED_EMAIL_PREFIX}{canonical}");
    player_state::set_nx(&key, "1").await
}

/// Lie ATOMIQUEMENT un player_id à l'e-mail de SON compte (`SET account_pid:{id}
/// NX`). Ok(true) = lié (cette identité n'avait pas de compte), Ok(false) =
/// l'identité a DÉJÀ un compte (refuser : un seul compte par identité),
/// Err = panne backend.
pub async fn try_link_player(player_id: &str, email_norm: &str) -> Result<bool, ()> {
    let key = format!("{ACCOUNT_PID_PREFIX}{player_id}");
    player_state::set_nx(&key, email_norm).await
}

/// Annule (best-effort) le lien identité→compte posé par `try_link_player`,
/// quand l'étape de création de la ligne compte échoue ENSUITE. Garde l'identité
/// réutilisable pour une nouvelle tentative d'inscription.
async fn delete_account_link(player_id: &str) {
    let key = format!("{ACCOUNT_PID_PREFIX}{player_id}");
    player_state::del(&key).await;
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
    // Disposable mailbox → refuse outright (raises the cost of welcome-bonus
    // farming; generic code so it doesn't leak the reason).
    if is_disposable_email(&email_norm) {
        return reply_auth_error(session, "invalid_credentials");
    }
    // Linking the new account to the guest's progression requires an
    // authenticated guest session — the client always Hellos first, so this is
    // just a guard (never a normal path).
    let pid = session.player_id();
    if pid.is_empty() {
        return reply_auth_error(session, "auth_needed");
    }
    // Mass-signup guard, keyed by IP. Checked synchronously here; counted once in
    // the async task below. We count EVERY attempt that gets this far — success
    // INCLUDED, because a fresh pid + fresh e-mail always "succeeds", so a
    // successful creation is precisely the mass-signup signal (and we must NOT
    // clear on success, or the cap becomes a no-op). Structural rejects (invalid
    // e-mail, weak password, disposable domain, empty pid) returned BEFORE here,
    // so a legit user's typo bounces never consume the budget — and AUTH_MAX
    // (10/5min) is far above any real person's signup burst.
    let sk = format!("signup|{}", session.peer_ip);
    if auth_attempts.is_blocked(sk.clone()) {
        return reply_auth_error(session, "rate_limited");
    }

    let session_clone = session.clone();
    let attempts = auth_attempts.clone();
    tokio::spawn(async move {
        // One count per attempt that reaches the work, regardless of outcome.
        attempts.record_failed(sk);

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
        // ATOMICITY: claim the IDENTITY first (`account_pid:{pid}` NX), BEFORE
        // reserving the e-mail row. An already-linked identity therefore costs
        // nothing to roll back (no orphan row), and if the row creation fails
        // afterwards we release the link cleanly. This removes the previous
        // window where `account:{email}` was reserved with no owning identity.
        match try_link_player(&pid, &record.email).await {
            Ok(false) => {
                // This identity already has an account (e.g. re-ran signup after a
                // wipe instead of logging in). Nothing was created → tell the
                // client to log in. (Still counted toward the per-IP cap above.)
                session_clone.send(ServerMessage::AuthError { code: "already_linked".into() });
            }
            Err(()) => {
                session_clone.send(ServerMessage::AuthError { code: "server_error".into() });
            }
            Ok(true) => match try_create_account(&record).await {
                Err(()) => {
                    delete_account_link(&pid).await;
                    session_clone.send(ServerMessage::AuthError { code: "server_error".into() });
                }
                Ok(false) => {
                    // E-mail already taken by ANOTHER identity → release our link.
                    delete_account_link(&pid).await;
                    session_clone.send(ServerMessage::AuthError { code: "email_taken".into() });
                }
                Ok(true) => {
                    let mut progress = player_state::load(&pid).await.unwrap_or_default();
                    // Welcome bonus EXACTLY once per real mailbox: gate on the
                    // canonical e-mail (`+tag` / Gmail dots folded). A fresh
                    // install (new pid) or a `+tag` variant of the same mailbox
                    // can no longer re-trigger it. Backend error → no bonus (safe
                    // default). `welcomed:{pid}` is also marked for parity with
                    // the Google path, but the e-mail key is the real guard here.
                    let canonical = canonical_email(&record.email);
                    if let Ok(true) = try_mark_welcomed_email(&canonical).await {
                        apply_welcome_bonus(&mut progress);
                    }
                    let _ = try_mark_welcomed(&pid).await;
                    player_state::save(pid.clone(), progress.clone());
                    let claim_token = player_state::load_claim_token(&pid).await;
                    session_clone.send(ServerMessage::AuthOk {
                        player_id: pid,
                        claim_token,
                        state: progress,
                        email: None,
                    });
                }
            },
        }
    });
}

/// Handle a `Login`: load the account, verify the password (constant-ish timing
/// via a dummy verify on miss), adopt the account identity + its progression,
/// and reply.
pub fn handle_login(
    auth_attempts: &Arc<AuthAttemptTracker>,
    email_attempts: &Arc<AuthAttemptTracker>,
    session: &Arc<Session>,
    email: String,
    password: String,
) {
    let Some(email_norm) = normalize_email(&email) else {
        return reply_auth_error(session, "invalid_credentials");
    };
    let lk = format!("login|{}|{}", email_norm, session.peer_ip);
    // Second lock keyed on the e-mail ALONE (all IPs). The per-IP lock above is
    // trivially bypassed by IP rotation behind a botnet/proxy pool; this one caps
    // total guesses per account regardless of source IP. Wider window + higher
    // ceiling (LOGIN_EMAIL_*) so a fumbling legit user is never the one blocked.
    let ek = format!("login-email|{email_norm}");
    if auth_attempts.is_blocked(lk.clone()) || email_attempts.is_blocked(ek.clone()) {
        return reply_auth_error(session, "rate_limited");
    }
    let session_clone = session.clone();
    let attempts = auth_attempts.clone();
    let email_attempts = email_attempts.clone();
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
                email_attempts.record_success(ek);
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
                    email: None,
                });
            }
            _ => {
                attempts.record_failed(lk);
                email_attempts.record_failed(ek);
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
