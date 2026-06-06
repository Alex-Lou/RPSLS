//! Auth — extract a stable player identity from a Google / Apple ID token.
//!
//! STATUS: STUB. `extract_unverified_subject` parses the JWT structure and
//! returns the `sub` claim WITHOUT verifying the signature. That's enough to
//! wire the full request flow client → server end-to-end during development,
//! but it MUST be replaced with proper verification (see `TODO_VERIFY` below)
//! before any real IAP money flows through the system.
//!
//! Why ship a stub: validating a Google ID token requires fetching + rotating
//! Google's JWKS (`https://www.googleapis.com/oauth2/v3/certs`), parsing RS256
//! signatures, and checking `aud` against our app's OAuth client id — all of
//! which require Play Console credentials we don't have yet. The migration
//! path is documented in `docs/PLAY_AUTH_AND_IAP.md`.

use base64::Engine as _;
use serde::Deserialize;

#[derive(Debug, Deserialize, PartialEq)]
pub struct JwtClaims {
    pub sub: String,
    #[serde(default)]
    pub iss: String,
    #[serde(default)]
    pub aud: String,
    #[serde(default)]
    pub exp: u64,
    #[serde(default)]
    #[allow(dead_code)] // Read once full verifier lands.
    pub email: Option<String>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum AuthError {
    Malformed,
    UnsupportedIssuer,
    Expired,
}

/// Parse a JWT and return its `sub` claim WITHOUT verifying the signature.
/// Returns Err when the structure is broken / the issuer is unknown.
///
/// ⚠️ DO NOT USE TO MAKE TRUST DECISIONS until `verify_google_id_token` is
/// wired in. A malicious client can forge any `sub` they want.
pub fn extract_unverified_subject(token: &str) -> Result<JwtClaims, AuthError> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return Err(AuthError::Malformed);
    }
    let payload_b64 = parts[1];
    let payload_bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(payload_b64)
        .or_else(|_| base64::engine::general_purpose::STANDARD_NO_PAD.decode(payload_b64))
        .map_err(|_| AuthError::Malformed)?;
    let claims: JwtClaims = serde_json::from_slice(&payload_bytes).map_err(|_| AuthError::Malformed)?;
    // Issuer allowlist — only Google + Apple for now. Anyone else: reject.
    let ok_issuer = claims.iss == "https://accounts.google.com"
        || claims.iss == "accounts.google.com"
        || claims.iss == "https://appleid.apple.com";
    if !ok_issuer {
        return Err(AuthError::UnsupportedIssuer);
    }
    if claims.exp > 0 {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        if now > claims.exp {
            return Err(AuthError::Expired);
        }
    }
    Ok(claims)
}

// TODO_VERIFY — replace `extract_unverified_subject` with a real validator:
//
//   pub async fn verify_google_id_token(
//       token: &str,
//       expected_audience: &str,
//   ) -> Result<JwtClaims, AuthError> { ... }
//
// Implementation plan:
//   1. Add `jsonwebtoken` crate to Cargo.toml
//   2. Cache Google's JWKS in a static OnceCell, refresh every hour
//        (HTTP GET https://www.googleapis.com/oauth2/v3/certs)
//   3. Parse the JWT header to get the `kid` (key id)
//   4. Look up the matching JWK, build a DecodingKey from RS256 params
//   5. jsonwebtoken::decode with Validation::new(RS256), set aud + iss
//   6. Cross-check `aud` == our Play Games OAuth client id
//
// Same shape for Sign-In With Apple (Apple JWKS at
// https://appleid.apple.com/auth/keys, issuer "https://appleid.apple.com").
//
// Until then, any production IAP / leaderboard write must NOT trust the
// player_id derived from an auth_token — see main.rs Hello handler for the
// fall-back to claim_token for legacy clients.

#[cfg(test)]
mod tests {
    use super::*;
    // A real Google ID token (truncated, expired) — sanity-check parser.
    const SAMPLE_GOOG: &str =
        "eyJhbGciOiJSUzI1NiIsImtpZCI6ImtleS1pZCIsInR5cCI6IkpXVCJ9.\
         eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJzdWIiOiIxMTExMTExMTExMTExMTExMTExMTEiLCJhdWQiOiJyZXBsYWNlLW1lIiwiZXhwIjoxfQ.\
         signature";

    #[test]
    fn rejects_malformed() {
        assert_eq!(extract_unverified_subject("not.a.jwt.too-many"), Err(AuthError::Malformed));
        assert_eq!(extract_unverified_subject("notajwt"), Err(AuthError::Malformed));
    }

    #[test]
    fn rejects_expired() {
        // SAMPLE_GOOG has exp=1 (1970) — must be rejected as expired.
        assert_eq!(extract_unverified_subject(SAMPLE_GOOG), Err(AuthError::Expired));
    }

    #[test]
    fn rejects_unknown_issuer() {
        // Payload: { iss: "evil.com", sub: "x", exp: 99999999999 }
        let bad = "eyJhbGciOiJSUzI1NiJ9.eyJpc3MiOiJldmlsLmNvbSIsInN1YiI6IngiLCJleHAiOjk5OTk5OTk5OTk5fQ.x";
        assert_eq!(extract_unverified_subject(bad), Err(AuthError::UnsupportedIssuer));
    }
}
