//! Handlers WS `Signup` / `Login` (appelés depuis le dispatch — garde le `match`
//! de routage mince). Toute la logique sécu-critique (validation, hashing,
//! atomicité, anti-énumération) vit dans les sous-modules `validation` /
//! `hashing` / `store` ; ici on orchestre + on répond.

use std::sync::Arc;

use crate::player_state;
use crate::protocol::ServerMessage;
use crate::security::AuthAttemptTracker;
use crate::session::Session;

use super::store::delete_account_link;
use super::*;

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
