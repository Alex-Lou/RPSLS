//! google_auth.rs — "Sign in with Google" / Play Games (Alex 2026-06-14).
//!
//! REAL verification of a Google-issued OpenID-Connect ID token (unlike the
//! `auth.rs` scaffold, which only parses). The client obtains an ID token from
//! Google on-device and sends it once; the server:
//!   1. parses the JWT header → `kid`,
//!   2. fetches + caches Google's JWKS (public keys) and finds the matching key,
//!   3. verifies the RS256 signature AND the `aud` (our OAuth client id) / `iss`
//!      (accounts.google.com) / `exp` claims,
//!   4. maps the verified, immutable `sub` to a durable player_id (`google:{sub}`),
//!      linking the guest's progression on first sign-in and granting the welcome
//!      bonus ONCE per identity.
//!
//! Why this is the right anti-cheat foundation: a Google `sub` is verified and
//! unique per Google account, so the welcome bonus can't be farmed by clearing
//! data (the same Google account always maps back to the same player_id).
//!
//! CONFIG (ops): set `GOOGLE_OAUTH_CLIENT_IDS` (comma-separated; e.g. the Web +
//! Android OAuth client ids from the Google Cloud / Play console) on the server.
//! Until it's set, verification refuses every token (fails closed) — and no
//! client sends `GoogleLogin` yet, so this module is inert until both land.

use std::sync::{Arc, OnceLock, RwLock};
use std::time::{Duration, Instant};

use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use serde::Deserialize;
use tracing::warn;

use crate::account;
use crate::player_state;
use crate::protocol::ServerMessage;
use crate::security::AuthAttemptTracker;
use crate::session::Session;

const GOOGLE_JWKS_URL: &str = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS: &[&str] = &["accounts.google.com", "https://accounts.google.com"];
/// Refresh Google's keys at most this often (they rotate ~daily; an hour keeps
/// us current without hammering the endpoint).
const JWKS_TTL: Duration = Duration::from_secs(3600);
const GOOGLE_PREFIX: &str = "google:";

/// The claims we read out of a verified token. `aud` / `iss` / `exp` are checked
/// by `jsonwebtoken` against the [`Validation`] below, so they don't need to live
/// here — `sub` is the identity, `email` is informational.
#[derive(Debug, Deserialize)]
pub struct GoogleClaims {
    pub sub: String,
    #[serde(default)]
    pub email: String,
    #[serde(default)]
    pub email_verified: bool,
}

#[derive(Debug, PartialEq, Eq)]
pub enum GoogleAuthError {
    /// No `GOOGLE_OAUTH_CLIENT_IDS` configured — we fail closed.
    NotConfigured,
    /// Token structure / header / unsupported alg is broken.
    Malformed,
    /// No JWKS key matched the token's `kid` (even after a refresh).
    UnknownKey,
    /// Signature / aud / iss / exp validation failed.
    Invalid,
}

/// Allowed audiences (our OAuth client ids), parsed once from the environment.
fn parse_client_ids(raw: &str) -> Vec<String> {
    raw.split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

fn google_client_ids() -> &'static Vec<String> {
    static IDS: OnceLock<Vec<String>> = OnceLock::new();
    IDS.get_or_init(|| {
        std::env::var("GOOGLE_OAUTH_CLIENT_IDS")
            .or_else(|_| std::env::var("GOOGLE_OAUTH_CLIENT_ID"))
            .ok()
            .map(|raw| parse_client_ids(&raw))
            .unwrap_or_default()
    })
}

pub fn is_configured() -> bool {
    !google_client_ids().is_empty()
}

fn http() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(reqwest::Client::new)
}

// ──────────────────────────────────────────────────────────────────────────
// JWKS fetch + cache
// ──────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
struct Jwk {
    kid: String,
    /// RSA modulus / exponent, base64url — fed straight to `from_rsa_components`.
    n: String,
    e: String,
}

#[derive(Debug, Deserialize)]
struct JwksResponse {
    keys: Vec<Jwk>,
}

struct JwksCache {
    keys: Vec<Jwk>,
    fetched_at: Instant,
}

fn cache() -> &'static RwLock<Option<JwksCache>> {
    static CACHE: OnceLock<RwLock<Option<JwksCache>>> = OnceLock::new();
    CACHE.get_or_init(|| RwLock::new(None))
}

async fn fetch_jwks() -> Option<Vec<Jwk>> {
    let resp = http().get(GOOGLE_JWKS_URL).send().await.ok()?;
    if !resp.status().is_success() {
        warn!(status = %resp.status(), "google JWKS fetch rejected");
        return None;
    }
    let body: JwksResponse = resp.json().await.ok()?;
    Some(body.keys)
}

/// Find the JWK for `kid`. Serves from cache when fresh; otherwise (or when the
/// `kid` is missing — key rotation) refetches. The lock is never held across the
/// await.
async fn find_jwk(kid: &str) -> Option<Jwk> {
    {
        let guard = cache().read().ok()?;
        if let Some(c) = guard.as_ref() {
            if c.fetched_at.elapsed() < JWKS_TTL {
                if let Some(k) = c.keys.iter().find(|k| k.kid == kid) {
                    return Some(k.clone());
                }
                // Fresh cache but unknown kid → fall through and refetch once
                // (Google may have just rotated keys).
            }
        }
    }
    let fetched = fetch_jwks().await?;
    let found = fetched.iter().find(|k| k.kid == kid).cloned();
    if let Ok(mut guard) = cache().write() {
        *guard = Some(JwksCache { keys: fetched, fetched_at: Instant::now() });
    }
    found
}

// ──────────────────────────────────────────────────────────────────────────
// Verification
// ──────────────────────────────────────────────────────────────────────────

/// Verify a Google ID token end-to-end and return its claims. Fails closed when
/// no client id is configured. Signature, `aud` (∈ configured ids), `iss`
/// (Google) and `exp` are all validated by `jsonwebtoken`.
pub async fn verify_google_id_token(token: &str) -> Result<GoogleClaims, GoogleAuthError> {
    let auds = google_client_ids();
    if auds.is_empty() {
        return Err(GoogleAuthError::NotConfigured);
    }
    let header = decode_header(token).map_err(|_| GoogleAuthError::Malformed)?;
    if header.alg != Algorithm::RS256 {
        return Err(GoogleAuthError::Malformed);
    }
    let kid = header.kid.ok_or(GoogleAuthError::Malformed)?;
    let jwk = find_jwk(&kid).await.ok_or(GoogleAuthError::UnknownKey)?;
    let key = DecodingKey::from_rsa_components(&jwk.n, &jwk.e).map_err(|_| GoogleAuthError::Malformed)?;

    let mut validation = Validation::new(Algorithm::RS256);
    validation.set_audience(auds);
    validation.set_issuer(GOOGLE_ISSUERS);
    validation.validate_exp = true;

    decode::<GoogleClaims>(token, &key, &validation)
        .map(|data| data.claims)
        .map_err(|_| GoogleAuthError::Invalid)
}

// ──────────────────────────────────────────────────────────────────────────
// WS handler
// ──────────────────────────────────────────────────────────────────────────

fn reply_auth_error(session: &Arc<Session>, code: &str) {
    session.send(ServerMessage::AuthError { code: code.into() });
}

/// Handle a `GoogleLogin`: verify the ID token, map the Google `sub` to a
/// durable player_id (`google:{sub}`), adopt it, grant the welcome bonus once
/// per identity, and reply. Errors stay generic (anti-enumeration).
pub fn handle_google_login(
    auth_attempts: &Arc<AuthAttemptTracker>,
    session: &Arc<Session>,
    id_token: String,
) {
    let rk = format!("google|{}", session.peer_ip);
    if auth_attempts.is_blocked(rk.clone()) {
        return reply_auth_error(session, "rate_limited");
    }
    let guest_pid = session.player_id();
    let session_clone = session.clone();
    let attempts = auth_attempts.clone();
    tokio::spawn(async move {
        let claims = match verify_google_id_token(&id_token).await {
            Ok(c) => c,
            Err(e) => {
                // A misconfigured server is OUR fault → server_error; anything
                // else is a bad/forged token → generic invalid_credentials.
                let code = if e == GoogleAuthError::NotConfigured {
                    "server_error"
                } else {
                    attempts.record_failed(rk);
                    "invalid_credentials"
                };
                session_clone.send(ServerMessage::AuthError { code: code.into() });
                return;
            }
        };
        attempts.record_success(rk);

        // Pass the e-mail back only when Google says it's verified — lets the
        // client show "signed in as …" and enable logout. (Play Games sign-in
        // may omit e-mail depending on scopes; `sub` is the real identity.)
        let email = if claims.email_verified && !claims.email.is_empty() {
            Some(claims.email)
        } else {
            None
        };

        // Resolve the durable player_id for this Google identity.
        let gkey = format!("{GOOGLE_PREFIX}{}", claims.sub);
        let pid = match player_state::get_raw(&gkey).await {
            Some(existing) => existing, // returning Google user → same identity
            None => {
                // First sign-in: link the guest's current progression when present,
                // otherwise mint a fresh id. `set_nx` makes the first-link atomic.
                let candidate = if guest_pid.is_empty() {
                    uuid::Uuid::new_v4().to_string()
                } else {
                    guest_pid.clone()
                };
                match player_state::set_nx(&gkey, &candidate).await {
                    Ok(true) => candidate,
                    // Lost a race — adopt whoever won the link.
                    Ok(false) => player_state::get_raw(&gkey).await.unwrap_or(candidate),
                    Err(()) => {
                        session_clone.send(ServerMessage::AuthError { code: "server_error".into() });
                        return;
                    }
                }
            }
        };

        session_clone.set_player_id(pid.clone());
        let mut progress = player_state::load(&pid).await.unwrap_or_default();
        // Bonus exactly once per identity. A returning Google user's pid is
        // already `welcomed`, so this is a no-op for them — farm-proof.
        if let Ok(true) = account::try_mark_welcomed(&pid).await {
            account::apply_welcome_bonus(&mut progress);
            player_state::save(pid.clone(), progress.clone());
        }
        let claim_token = match player_state::load_claim_token(&pid).await {
            Some(t) => Some(t),
            None => player_state::try_create_claim_token(&pid).await.ok().flatten(),
        };
        session_clone.send(ServerMessage::AuthOk {
            player_id: pid,
            claim_token,
            state: progress,
            email,
        });
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_client_ids() {
        assert_eq!(
            parse_client_ids(" a.apps.googleusercontent.com , b.apps.googleusercontent.com "),
            vec!["a.apps.googleusercontent.com", "b.apps.googleusercontent.com"]
        );
        assert!(parse_client_ids("").is_empty());
        assert!(parse_client_ids("  ,  ").is_empty());
        assert_eq!(parse_client_ids("solo").len(), 1);
    }

    #[tokio::test]
    async fn refuses_when_not_configured() {
        // No GOOGLE_OAUTH_CLIENT_IDS in the test env → fail closed, never parse.
        assert_eq!(
            verify_google_id_token("ey.malformed.token").await.err(),
            Some(GoogleAuthError::NotConfigured)
        );
    }

    #[test]
    fn jwk_and_claims_deserialize() {
        let jwks: JwksResponse = serde_json::from_str(
            r#"{"keys":[{"kid":"abc","n":"modulus","e":"AQAB","kty":"RSA","alg":"RS256","use":"sig"}]}"#,
        )
        .unwrap();
        assert_eq!(jwks.keys.len(), 1);
        assert_eq!(jwks.keys[0].kid, "abc");

        let claims: GoogleClaims =
            serde_json::from_str(r#"{"sub":"12345","email":"x@y.com","email_verified":true}"#).unwrap();
        assert_eq!(claims.sub, "12345");
        assert!(claims.email_verified);
    }
}
