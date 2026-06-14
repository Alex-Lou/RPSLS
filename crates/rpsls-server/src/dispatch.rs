//! Client-message dispatcher — routes a parsed `ClientMessage` to the lobby,
//! matchmaking, in-match, and state-sync handlers. Extracted from main.rs so
//! the entry point stays under the 400-line ceiling (audit 2026-06-14). The
//! `Hello` auth arm lives in its own module (`hello.rs`).

use std::sync::Arc;
use std::time::Instant;

use crate::hello;
use crate::lanes_engine::{start_lanes_match, LanesCommand};
use crate::match_engine::{start_match, MatchCommand};
use crate::player_state;
use crate::protocol::{ClientMessage, PlayerSlot, ServerMessage};
use crate::session::Session;
use crate::{account, google_auth, AppState};

pub(crate) async fn handle_client_message(
    state: &Arc<AppState>,
    session: &Arc<Session>,
    msg: ClientMessage,
) {
    match msg {
        ClientMessage::Hello { nickname, player_id, claim_token, auth_token } => {
            hello::handle_hello(session, nickname, player_id, claim_token, auth_token);
        }

        ClientMessage::Signup { email, password } => {
            account::handle_signup(&state.auth_attempts, session, email, password);
        }

        ClientMessage::Login { email, password } => {
            account::handle_login(
                &state.auth_attempts,
                &state.login_email_attempts,
                session,
                email,
                password,
            );
        }

        ClientMessage::GoogleLogin { id_token } => {
            google_auth::handle_google_login(&state.auth_attempts, session, id_token);
        }

        ClientMessage::CreateLobby { best_of } => {
            if !validate_best_of(best_of) {
                return reply_error(session, "bad_best_of", "best_of must be odd 1..=9");
            }
            if state.lobbies.lobby_count() >= state.max_lobbies {
                return reply_error(session, "server_full", "too many open lobbies right now — try again in a moment");
            }
            let code = state.lobbies.create_lobby(session.clone(), best_of);
            session.send(ServerMessage::LobbyCreated { code, best_of });
        }

        ClientMessage::JoinLobby { code } => {
            // Brute-force gate. If this peer has already burned through the
            // attempt budget in the active window, we stop the request right
            // here without even consulting the lobby map — that way a
            // scripted attacker can't piggy-back on the lookup cost.
            if state.lobby_attempts.is_blocked(session.peer_ip) {
                return reply_error(
                    session,
                    "lobby_rate_limited",
                    "too many invalid lobby codes — try again in a minute",
                );
            }
            // Reject obviously-malformed codes before consulting the map.
            let normalized = code.trim().to_ascii_uppercase();
            if normalized.len() != 6 || !normalized.chars().all(|c| c.is_ascii_alphanumeric()) {
                state.lobby_attempts.record_failed(session.peer_ip);
                return reply_error(session, "bad_code", "lobby codes are 6 chars A-Z 2-9");
            }
            let Some(lobby) = state.lobbies.join_lobby(&normalized) else {
                state.lobby_attempts.record_failed(session.peer_ip);
                return reply_error(session, "lobby_not_found", "no lobby with that code");
            };
            // Don't let yourself join your own lobby.
            if lobby.host.id == session.id {
                return reply_error(session, "self_lobby", "cannot join your own lobby");
            }
            if state.in_match.len() + state.in_lanes.len() >= state.max_matches {
                return reply_error(session, "server_full", "too many active matches right now — try again in a moment");
            }
            // Legit join — clear any pent-up counter for this IP.
            state.lobby_attempts.record_success(session.peer_ip);
            let a_id = lobby.host.id.clone();
            let b_id = session.id.clone();
            let st = state.clone();
            let match_tx = start_match(lobby.host.clone(), session.clone(), lobby.best_of, Box::new(move || {
                st.in_match.remove(&a_id);
                st.in_match.remove(&b_id);
            }));
            state
                .in_match
                .insert(lobby.host.id.clone(), (match_tx.clone(), PlayerSlot::A));
            state
                .in_match
                .insert(session.id.clone(), (match_tx, PlayerSlot::B));
        }

        ClientMessage::JoinQueue { best_of } => {
            if !validate_best_of(best_of) {
                return reply_error(session, "bad_best_of", "best_of must be odd 1..=9");
            }
            if let Some(opp) = state.lobbies.join_or_match(session.clone(), best_of).await {
                if state.in_match.len() + state.in_lanes.len() >= state.max_matches {
                    return reply_error(session, "server_full", "too many active matches right now — try again in a moment");
                }
                let a_id = opp.id.clone();
                let b_id = session.id.clone();
                let st = state.clone();
                let match_tx = start_match(opp.clone(), session.clone(), best_of, Box::new(move || {
                    st.in_match.remove(&a_id);
                    st.in_match.remove(&b_id);
                }));
                state
                    .in_match
                    .insert(opp.id.clone(), (match_tx.clone(), PlayerSlot::A));
                state
                    .in_match
                    .insert(session.id.clone(), (match_tx, PlayerSlot::B));
            } else {
                let pos = state.lobbies.queue_position(&session.id).await;
                session.send(ServerMessage::Queued { position: pos });
            }
        }

        ClientMessage::JoinLanesQueue { win_to } => {
            if !validate_win_to(win_to) {
                return reply_error(session, "bad_win_to", "win_to must be in 1..=5");
            }
            if let Some(opp) = state
                .lobbies
                .join_or_match_lanes(session.clone(), win_to)
                .await
            {
                if state.in_match.len() + state.in_lanes.len() >= state.max_matches {
                    return reply_error(session, "server_full", "too many active matches right now — try again in a moment");
                }
                let a_id = opp.id.clone();
                let b_id = session.id.clone();
                let st = state.clone();
                let lanes_tx = start_lanes_match(opp.clone(), session.clone(), win_to, Box::new(move || {
                    st.in_lanes.remove(&a_id);
                    st.in_lanes.remove(&b_id);
                }));
                state
                    .in_lanes
                    .insert(opp.id.clone(), (lanes_tx.clone(), PlayerSlot::A));
                state
                    .in_lanes
                    .insert(session.id.clone(), (lanes_tx, PlayerSlot::B));
            } else {
                let pos = state.lobbies.lanes_queue_position(&session.id).await;
                session.send(ServerMessage::Queued { position: pos });
            }
        }

        ClientMessage::Cancel => {
            state.lobbies.leave_queue(&session.id).await;
            state.lobbies.leave_lanes_queue(&session.id).await;
            state.lobbies.remove_lobby_by_host(&session.id);
        }

        ClientMessage::PlayMove { mv } => {
            if let Some(entry) = state.in_match.get(&session.id) {
                let (tx, slot) = entry.value().clone();
                let _ = tx.send(MatchCommand::Move { slot, mv });
            }
        }

        ClientMessage::PlayLanes { plays } => {
            if let Some(entry) = state.in_lanes.get(&session.id) {
                let (tx, slot) = entry.value().clone();
                let _ = tx.send(LanesCommand::Play { slot, plays });
            }
        }

        ClientMessage::LeaveMatch => {
            if let Some((_, (tx, slot))) = state.in_match.remove(&session.id) {
                let _ = tx.send(MatchCommand::Leave { slot });
            }
            if let Some((_, (tx, slot))) = state.in_lanes.remove(&session.id) {
                let _ = tx.send(LanesCommand::Leave { slot });
            }
        }

        ClientMessage::Chat { emoji } => {
            // Hard cap chat payload: max 8 graphemes, strip control + bidi
            // chars. Prevents a hostile peer from flooding 60 KB "emoji"
            // text at the opponent.
            let clean: String = emoji
                .chars()
                .filter(|c| {
                    !c.is_control()
                        && *c != '\u{200B}' && *c != '\u{200C}' && *c != '\u{200D}'
                        && *c != '\u{202A}' && *c != '\u{202B}' && *c != '\u{202C}'
                        && *c != '\u{202D}' && *c != '\u{202E}'
                        && *c != '\u{2066}' && *c != '\u{2067}' && *c != '\u{2068}'
                        && *c != '\u{2069}' && *c != '\u{FEFF}'
                })
                .take(16) // 16 codepoints accounts for compound emoji (e.g. flags = 2 cp).
                .collect();
            if clean.is_empty() {
                return;
            }
            if let Some(entry) = state.in_match.get(&session.id) {
                let (tx, slot) = entry.value().clone();
                let _ = tx.send(MatchCommand::Chat { slot, emoji: clean });
            }
        }

        ClientMessage::RequestRematch => {
            if let Some(entry) = state.in_match.get(&session.id) {
                let (tx, slot) = entry.value().clone();
                let _ = tx.send(MatchCommand::RequestRematch { slot });
            } else if let Some(entry) = state.in_lanes.get(&session.id) {
                let (tx, slot) = entry.value().clone();
                let _ = tx.send(LanesCommand::RequestRematch { slot });
            }
        }

        ClientMessage::RespondRematch { accept } => {
            if let Some(entry) = state.in_match.get(&session.id) {
                let (tx, slot) = entry.value().clone();
                let _ = tx.send(MatchCommand::RespondRematch { slot, accept });
            } else if let Some(entry) = state.in_lanes.get(&session.id) {
                let (tx, slot) = entry.value().clone();
                let _ = tx.send(LanesCommand::RespondRematch { slot, accept });
            }
        }

        ClientMessage::PrepReady => {
            // Only meaningful during a lanes match's prep phase; the engine
            // ignores stray Ready commands once the round loop has started.
            if let Some(entry) = state.in_lanes.get(&session.id) {
                let (tx, slot) = entry.value().clone();
                let _ = tx.send(LanesCommand::Ready { slot });
            }
        }

        ClientMessage::SyncState { state: progress } => {
            let pid = session.player_id();
            if !pid.is_empty() {
                // Server-side write throttle: max 1 save per 5s per identity.
                let now = Instant::now();
                if let Some(last) = state.sync_throttle.get(&pid) {
                    if now.duration_since(*last).as_secs() < 5 {
                        return;
                    }
                }
                state.sync_throttle.insert(pid.clone(), now);
                player_state::save(pid, progress);
            }
        }

        ClientMessage::Ping => session.send(ServerMessage::Pong),
    }
}

fn reply_error(session: &Arc<Session>, code: &str, msg: &str) {
    session.send(ServerMessage::Error {
        code: code.into(),
        message: msg.into(),
    });
}

fn validate_best_of(n: u8) -> bool {
    n >= 1 && n <= 9 && n % 2 == 1
}

/// Number of round-wins to take a Lanes match (3 → bo5, 5 → bo9, etc.).
fn validate_win_to(n: u8) -> bool {
    (1..=5).contains(&n)
}
