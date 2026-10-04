//! Client-message dispatcher — routes a parsed `ClientMessage` to the lobby,
//! matchmaking, in-match, and state-sync handlers. Extracted from main.rs so
//! the entry point stays under the 400-line ceiling (audit 2026-06-14). The
//! `Hello` auth arm lives in its own module (`hello.rs`).

use std::sync::Arc;
use std::time::Instant;

use crate::ccg_engine::{start_ccg_match, CcgCommand};
use crate::hello;
use crate::lanes_engine::{start_lanes_match, LanesCommand};
use crate::lobby::JoinLobby;
use crate::match_engine::{start_match, MatchCommand};
use crate::player_state;
use crate::protocol::{ClientMessage, PlayerSlot, ServerMessage};
use crate::session::Session;
use crate::wallet::handlers::{self as wallet, WalletOp};
use crate::{account, google_auth, AppState};

pub(crate) async fn handle_client_message(
    state: &Arc<AppState>,
    session: &Arc<Session>,
    msg: ClientMessage,
) {
    match msg {
        ClientMessage::Hello { nickname, player_id, claim_token, auth_token } => {
            // Rafale de Hello sur une même connexion = amplification Upstash
            // (~4 requêtes chacun) : refusée au-delà du plafond.
            let n = session.hellos.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            if n >= crate::session::MAX_HELLOS_PER_CONNECTION {
                return reply_error(session, "hello_limited", "too many hello on this connection");
            }
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
            // Un seul salon par hôte : recréer remplace l'ancien (anti-spam mémoire).
            state.lobbies.remove_lobby_by_host(&session.id);
            if state.lobbies.lobby_count() >= state.max_lobbies {
                return reply_error(session, "server_full", "too many open lobbies right now — try again in a moment");
            }
            leave_current_match(state, session);
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
            // Capacité vérifiée AVANT d'apparier : sinon l'adversaire (déjà
            // retiré de la file / salon consommé) restait bloqué, sans match.
            if matches_full(state) {
                return reply_error(session, "server_full", "too many active matches right now — try again in a moment");
            }
            let lobby = match state.lobbies.join_lobby(&normalized, session) {
                JoinLobby::Joined(lobby) => lobby,
                JoinLobby::NotFound => {
                    state.lobby_attempts.record_failed(session.peer_ip);
                    return reply_error(session, "lobby_not_found", "no lobby with that code");
                }
                // Son propre salon (même session ou même player_id) : refusé
                // SANS consommer le salon.
                JoinLobby::SelfMatch => {
                    return reply_error(session, "self_match", "cannot join your own lobby");
                }
            };
            // Legit join — clear any pent-up counter for this IP.
            state.lobby_attempts.record_success(session.peer_ip);
            leave_current_match(state, session);
            let a_id = lobby.host.id.clone();
            let b_id = session.id.clone();
            // on_end : ne retire que les entrées de CE match (canal fermé), pas celles
            // d'un nouveau match où une session est déjà repartie.
            let st = state.clone();
            let match_tx = start_match(lobby.host.clone(), session.clone(), lobby.best_of, Box::new(move || {
                st.in_match.remove_if(&a_id, |_, e| e.0.is_closed());
                st.in_match.remove_if(&b_id, |_, e| e.0.is_closed());
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
            // Capacité vérifiée AVANT d'apparier : sinon l'adversaire (déjà
            // retiré de la file / salon consommé) restait bloqué, sans match.
            if matches_full(state) {
                return reply_error(session, "server_full", "too many active matches right now — try again in a moment");
            }
            leave_current_match(state, session);
            if let Some(opp) = state.lobbies.join_or_match(session.clone(), best_of).await {
                let a_id = opp.id.clone();
                let b_id = session.id.clone();
                // on_end : ne retire que les entrées de CE match (canal fermé), pas celles
                // d'un nouveau match où une session est déjà repartie.
                let st = state.clone();
                let match_tx = start_match(opp.clone(), session.clone(), best_of, Box::new(move || {
                    st.in_match.remove_if(&a_id, |_, e| e.0.is_closed());
                    st.in_match.remove_if(&b_id, |_, e| e.0.is_closed());
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
            // Capacité vérifiée AVANT d'apparier : sinon l'adversaire (déjà
            // retiré de la file / salon consommé) restait bloqué, sans match.
            if matches_full(state) {
                return reply_error(session, "server_full", "too many active matches right now — try again in a moment");
            }
            leave_current_match(state, session);
            if let Some(opp) = state
                .lobbies
                .join_or_match_lanes(session.clone(), win_to)
                .await
            {
                let a_id = opp.id.clone();
                let b_id = session.id.clone();
                // on_end : ne retire que les entrées de CE match (canal fermé), pas celles
                // d'un nouveau match où une session est déjà repartie.
                let st = state.clone();
                let lanes_tx = start_lanes_match(opp.clone(), session.clone(), win_to, Box::new(move || {
                    st.in_lanes.remove_if(&a_id, |_, e| e.0.is_closed());
                    st.in_lanes.remove_if(&b_id, |_, e| e.0.is_closed());
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

        ClientMessage::JoinCcgQueue { win_to, variant, ruleset_hash } => {
            if !validate_win_to(win_to) {
                return reply_error(session, "bad_win_to", "win_to must be in 1..=5");
            }
            // Bornes défensives (relais aveugle : on ne fait pas confiance au client)
            // — un variant/hash surdimensionné n'a pas à polluer la file.
            if variant.len() > 32 || ruleset_hash.len() > 64 {
                return reply_error(session, "bad_ccg_join", "variant/ruleset_hash too long");
            }
            // Capacité vérifiée AVANT d'apparier : sinon l'adversaire (déjà
            // retiré de la file / salon consommé) restait bloqué, sans match.
            if matches_full(state) {
                return reply_error(session, "server_full", "too many active matches right now — try again in a moment");
            }
            leave_current_match(state, session);
            if let Some(opp) = state.lobbies.join_or_match_ccg(session.clone(), win_to, variant, ruleset_hash).await {
                let a_id = opp.id.clone();
                let b_id = session.id.clone();
                // on_end : ne retire que les entrées de CE match (canal fermé), pas celles
                // d'un nouveau match où une session est déjà repartie.
                let st = state.clone();
                let ccg_tx = start_ccg_match(opp.clone(), session.clone(), win_to, Box::new(move || {
                    st.in_ccg.remove_if(&a_id, |_, e| e.0.is_closed());
                    st.in_ccg.remove_if(&b_id, |_, e| e.0.is_closed());
                }));
                state.in_ccg.insert(opp.id.clone(), (ccg_tx.clone(), PlayerSlot::A));
                state.in_ccg.insert(session.id.clone(), (ccg_tx, PlayerSlot::B));
            } else {
                let pos = state.lobbies.ccg_queue_position(&session.id).await;
                session.send(ServerMessage::Queued { position: pos });
            }
        }

        ClientMessage::CcgTurn { round_no, intent, state_hash } => {
            if let Some(entry) = state.in_ccg.get(&session.id) {
                let (tx, slot) = entry.value().clone();
                let _ = tx.send(CcgCommand::Turn { slot, round_no, intent, state_hash });
            }
        }

        ClientMessage::CcgResult { winner, state_hash } => {
            if let Some(entry) = state.in_ccg.get(&session.id) {
                let (tx, slot) = entry.value().clone();
                let _ = tx.send(CcgCommand::Result { slot, winner, state_hash });
            }
        }

        ClientMessage::Cancel => {
            state.lobbies.leave_queue(&session.id).await;
            state.lobbies.leave_lanes_queue(&session.id).await;
            state.lobbies.leave_ccg_queue(&session.id).await;
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

        ClientMessage::LeaveMatch => leave_current_match(state, session),

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
            let delivered = if let Some(entry) = state.in_match.get(&session.id) {
                let (tx, slot) = entry.value().clone();
                tx.send(MatchCommand::RequestRematch { slot }).is_ok()
            } else if let Some(entry) = state.in_lanes.get(&session.id) {
                let (tx, slot) = entry.value().clone();
                tx.send(LanesCommand::RequestRematch { slot }).is_ok()
            } else if let Some(entry) = state.in_ccg.get(&session.id) {
                let (tx, slot) = entry.value().clone();
                tx.send(CcgCommand::RequestRematch { slot }).is_ok()
            } else {
                false
            };
            // Match déjà clos (adversaire parti / fenêtre expirée) : refus
            // immédiat plutôt qu'un silence.
            if !delivered {
                session.send(ServerMessage::RematchDeclined);
            }
        }

        ClientMessage::RespondRematch { accept } => {
            if let Some(entry) = state.in_match.get(&session.id) {
                let (tx, slot) = entry.value().clone();
                let _ = tx.send(MatchCommand::RespondRematch { slot, accept });
            } else if let Some(entry) = state.in_lanes.get(&session.id) {
                let (tx, slot) = entry.value().clone();
                let _ = tx.send(LanesCommand::RespondRematch { slot, accept });
            } else if let Some(entry) = state.in_ccg.get(&session.id) {
                let (tx, slot) = entry.value().clone();
                let _ = tx.send(CcgCommand::RespondRematch { slot, accept });
            }
        }

        ClientMessage::PrepReady => {
            // Prep phase (double-confirm + coin) — lanes OR ccg. The engine
            // ignores stray Ready commands once the round loop has started.
            if let Some(entry) = state.in_lanes.get(&session.id) {
                let (tx, slot) = entry.value().clone();
                let _ = tx.send(LanesCommand::Ready { slot });
            } else if let Some(entry) = state.in_ccg.get(&session.id) {
                let (tx, slot) = entry.value().clone();
                let _ = tx.send(CcgCommand::Ready { slot });
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

        ClientMessage::WalletInit => wallet::handle(session, WalletOp::Init),
        ClientMessage::OpenPack => wallet::handle(session, WalletOp::OpenPack),
        ClientMessage::CraftCard { card_id } => wallet::handle(session, WalletOp::Craft(card_id)),
        ClientMessage::BuyPremiumSet { set_id } => wallet::handle(session, WalletOp::BuyPremiumSet(set_id)),
        ClientMessage::ClaimCodex { threshold } => wallet::handle(session, WalletOp::ClaimCodex(threshold)),
        ClientMessage::ClaimCpuRewards { rewards } => wallet::handle(session, WalletOp::ClaimCpuRewards(rewards)),
        ClientMessage::ClaimUnlocks { card_ids } => wallet::handle(session, WalletOp::ClaimUnlocks(card_ids)),
        ClientMessage::ClaimSeason => wallet::handle(session, WalletOp::ClaimSeason),
        ClientMessage::ClaimLevel { level } => wallet::handle(session, WalletOp::ClaimLevel(level)),
        ClientMessage::ClaimDailies { claims } => wallet::handle(session, WalletOp::ClaimDailies(claims)),
    }
}

/// Quitte le match (classique / lanes / ccg) où la session est encore inscrite
/// — même effet qu'un `LeaveMatch` client. Appelé aussi avant de rejoindre une
/// file / un salon : l'ancienne task (fenêtre de rematch) se termine proprement.
fn leave_current_match(state: &AppState, session: &Session) {
    if let Some((_, (tx, slot))) = state.in_match.remove(&session.id) {
        let _ = tx.send(MatchCommand::Leave { slot });
    }
    if let Some((_, (tx, slot))) = state.in_lanes.remove(&session.id) {
        let _ = tx.send(LanesCommand::Leave { slot });
    }
    if let Some((_, (tx, slot))) = state.in_ccg.remove(&session.id) {
        let _ = tx.send(CcgCommand::Leave { slot });
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

/// Plafond de matchs simultanés atteint (tous modes confondus).
fn matches_full(state: &AppState) -> bool {
    state.in_match.len() + state.in_lanes.len() + state.in_ccg.len() >= state.max_matches
}
