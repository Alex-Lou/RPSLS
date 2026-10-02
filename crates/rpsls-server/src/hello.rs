//! `Hello` message handling — TOFU (trust-on-first-use) claim-token auth plus
//! player-state load. Extracted from the message dispatcher (`dispatch.rs`) so
//! both stay under the 400-line ceiling (refactor « au fil de l'eau »,
//! audit 2026-06-14). The `Hello` arm is self-contained: it touches only the
//! session + player-state backend, never `AppState`.

use std::sync::Arc;
use tracing::warn;

use crate::auth;
use crate::player_state;
use crate::protocol::ServerMessage;
use crate::session::Session;

/// Handle a `Hello` frame: sanitize the nickname, resolve a stable player id
/// (preferring an attested `auth_token` subject over the self-asserted UUID),
/// then run TOFU claim-token verification + state load in parallel. The
/// supplied nickname is adopted only on an auth-success arm.
pub(crate) fn handle_hello(
    session: &Arc<Session>,
    nickname: String,
    player_id: String,
    claim_token: String,
    auth_token: String,
) {
    // Sanitize nickname: strip control chars + RTL/bidi overrides +
    // zero-width joiners. Cap at 24 chars.
    let pending_nickname: Option<String> = {
        let clean: String = nickname
            .chars()
            .filter(|c| {
                !c.is_control()
                    && *c != '\u{200B}' && *c != '\u{200C}' && *c != '\u{200D}'  // ZWS / ZWNJ / ZWJ
                    && *c != '\u{202A}' && *c != '\u{202B}' && *c != '\u{202C}'  // bidi: LRE / RLE / PDF
                    && *c != '\u{202D}' && *c != '\u{202E}'                       // bidi: LRO / RLO
                    && *c != '\u{2066}' && *c != '\u{2067}' && *c != '\u{2068}'  // bidi: LRI / RLI / FSI
                    && *c != '\u{2069}'                                           // bidi: PDI
                    && *c != '\u{FEFF}'                                           // BOM
            })
            .collect();
        let trimmed = clean.trim();
        if !trimmed.is_empty() && trimmed.chars().count() <= 24 {
            Some(trimmed.to_string())
        } else { None }
    };

    // Adopt the sanitized display name IMMEDIATELY (bug "Anonymous", Alex
    // 2026-07) : l'ancienne adoption différée aux arms auth-success (post
    // aller-retour Redis dans le spawn ci-dessous) perdait la course contre le
    // join_queue envoyé juste après le Hello sur le même socket → le match se
    // créait avec le pseudo par défaut "Anonymous" et c'est ce que l'adversaire
    // voyait au match_found. Un pseudo est une donnée d'AFFICHAGE déclarative,
    // pas une identité : n'importe quel client peut déjà faire adopter le
    // pseudo qu'il veut avec son PROPRE id+token valides (les pseudos ne sont
    // ni uniques ni réservés) — l'adoption synchrone n'ouvre donc AUCUNE
    // surface d'usurpation nouvelle, et aligne ce chemin sur l'arm « invité »
    // (pid invalide) qui adoptait déjà en synchrone. L'auth (player_id/claim
    // token) reste, elle, strictement différée aux arms verified ci-dessous.
    if let Some(ref n) = pending_nickname {
        session.set_nickname(n.clone());
    }

    // Stable client id for leaderboard attribution + state sync.
    // Prefer an attested identity from auth_token (Google / Apple JWT)
    // when supplied — even parsed-only (today), it's harder to forge
    // than a self-asserted UUID. See auth.rs TODO_VERIFY for the
    // signature-verification plan.
    let candidate_pid: String = if !auth_token.trim().is_empty() {
        match auth::extract_unverified_subject(auth_token.trim()) {
            Ok(c) => c.sub,
            Err(e) => {
                warn!(?e, "auth_token parse failed — falling back to client player_id");
                player_id.clone()
            }
        }
    } else {
        player_id.clone()
    };
    // Strict UUID-style validation regardless of source: only ASCII
    // alnum + dashes, length 32..=64. Closes the Redis-key path-
    // traversal vector even if a future JWT issuer slips a weird sub
    // through (defense-in-depth — JWT sub format is provider-defined
    // and not guaranteed alnum+dash).
    let pid_clean = validate_player_id(&candidate_pid);

    if let Some(pid) = pid_clean {
        let client_token: String = claim_token.chars().filter(|c| !c.is_control()).take(64).collect();
        let client_token = client_token.trim().to_string();
        let session_clone = session.clone();

        // TOFU claim-token verification + state load run in parallel.
        tokio::spawn(async move {
            let (stored_token, progress) = tokio::join!(
                player_state::load_claim_token(&pid),
                player_state::load(&pid),
            );
            // Progression unreadable (Redis error) → stay UNAUTHENTICATED: an
            // authenticated session would SyncState over the real row.
            let Ok(progress) = progress else {
                warn!(player_id = %pid, "player state load error — Hello deferred");
                session_clone.send(ServerMessage::Error {
                    code: "auth_transient".into(),
                    message: "transient auth backend error".into(),
                });
                return;
            };

            match stored_token {
                Some(ref st) if client_token == *st => {
                    // Token matches — authenticate the session. (Le pseudo est
                    // déjà adopté en synchrone avant ce spawn, cf. plus haut.)
                    let mut state = progress.unwrap_or_default();
                    crate::wallet::handlers::overlay_best_effort(&pid, &mut state).await;
                    session_clone.set_player_id(pid);
                    session_clone.send(ServerMessage::StateLoaded {
                        state,
                        claim_token: Some(st.clone()),
                    });
                }
                Some(_) => {
                    // Token exists but client sent wrong/empty token — the
                    // session stays UNAUTHENTICATED (no player_id). Le pseudo
                    // d'affichage, lui, reste adopté (cf. adoption synchrone) :
                    // il est déclaratif, non unique, et n'accorde aucun droit.
                    warn!(player_id = %pid, "claim token mismatch — Hello rejected");
                    session_clone.send(ServerMessage::Error {
                        code: "auth_failed".into(),
                        message: "claim token mismatch".into(),
                    });
                }
                None => {
                    // First connection for this player_id — atomically
                    // create the token via Redis SET NX so two concurrent
                    // Hellos can't both mint and one steal. If NX fails
                    // it means another connection won the race; we reject
                    // and ask the client to retry with its existing token.
                    match player_state::try_create_claim_token(&pid).await {
                        Ok(Some(new_token)) => {
                            let mut state = progress.unwrap_or_default();
                            crate::wallet::handlers::overlay_best_effort(&pid, &mut state).await;
                            session_clone.set_player_id(pid);
                            session_clone.send(ServerMessage::StateLoaded {
                                state,
                                claim_token: Some(new_token),
                            });
                        }
                        Ok(None) => {
                            warn!(player_id = %pid, "claim token NX race — id was claimed by another session");
                            session_clone.send(ServerMessage::Error {
                                code: "auth_needed".into(),
                                message: "player_id was just claimed by another session — re-send with your claim_token".into(),
                            });
                        }
                        Err(()) => {
                            warn!(player_id = %pid, "claim token NX-create transient error");
                            session_clone.send(ServerMessage::Error {
                                code: "auth_transient".into(),
                                message: "transient auth backend error".into(),
                            });
                        }
                    }
                }
            }
        });
    }
    // (Client « invité » sans player_id valide : rien de plus à faire — le
    // pseudo est déjà adopté en synchrone plus haut, comme avant.)
}

/// Strict player_id validator. Accepts only ASCII alphanumeric + hyphens, of
/// length 32..=64 — the shape of a `crypto.randomUUID()` (36 chars) with
/// headroom for future SHA-based ids. Anything weirder is rejected outright,
/// which closes the Redis-key path-traversal vector (a `player_id` like
/// `"../../leaderboard"` would otherwise become a Redis key fragment that
/// some misconfigured REST proxy could mis-route).
pub(crate) fn validate_player_id(raw: &str) -> Option<String> {
    let clean: String = raw
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-')
        .take(64)
        .collect();
    if clean.len() >= 32 && clean.len() <= 64 {
        Some(clean)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_uuid_v4() {
        let v4 = "550e8400-e29b-41d4-a716-446655440000";
        assert_eq!(validate_player_id(v4).as_deref(), Some(v4));
    }

    #[test]
    fn rejects_path_traversal() {
        assert!(validate_player_id("../../sensitive-key").is_none());
        assert!(validate_player_id("player:abc/../leaderboard").is_none());
    }

    #[test]
    fn rejects_too_short_post_filter() {
        assert!(validate_player_id("abc123").is_none()); // <32 raw
        // 65 'a's get truncated to 64 — caller's problem, but the result is
        // still a valid-shape id. The point of the length cap is to bound
        // the Redis key size, not to bounce slightly-too-long inputs.
        assert_eq!(validate_player_id(&"a".repeat(65)).map(|s| s.len()), Some(64));
    }

    #[test]
    fn strips_then_accepts_when_remainder_valid() {
        // Null byte stripped → remaining 36 chars pass; the result is exactly
        // the UUID without the embedded control byte. That's the desired
        // defense-in-depth behaviour (nulls cannot reach Redis).
        let out = validate_player_id("550e8400-e29b-41d4\u{0000}-a716-446655440000").unwrap();
        assert_eq!(out, "550e8400-e29b-41d4-a716-446655440000");
    }

    #[test]
    fn rejects_when_filter_empties_string() {
        // Non-ASCII removed → empty → too short → reject.
        assert!(validate_player_id(&"é".repeat(32)).is_none());
    }

    #[test]
    fn strips_disallowed_then_revalidates() {
        // Bytes that get stripped reduce length below 32 → reject.
        let raw = "550e8400-e29b-41d4-a716-{{{{}}}}";
        assert!(validate_player_id(raw).is_none());
    }
}
