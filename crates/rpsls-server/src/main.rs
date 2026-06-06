//! RPSLS multiplayer server.
//!
//!  - WebSocket endpoint at /ws (JSON protocol)
//!  - Health check at /health (returns 200 OK)
//!
//! Hosted on Fly.io (or any small container host).

use std::net::SocketAddr;
use std::sync::Arc;

use axum::{
    extract::{
        connect_info::ConnectInfo,
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
    routing::get,
    Router,
};
use dashmap::DashMap;
use futures_util::{sink::SinkExt, stream::StreamExt};
use std::time::Instant;
use tokio::sync::mpsc;
use tower_http::trace::TraceLayer;
use tracing::{info, warn};
use uuid::Uuid;

use crate::lanes_engine::{start_lanes_match, LanesCommand};
use crate::lobby::LobbyManager;
use crate::match_engine::{start_match, MatchCommand};
use crate::protocol::{ClientMessage, PlayerSlot, ServerMessage};
use crate::security::{cors_layer, governor_layer, LobbyAttemptTracker, MsgRateLimit};
use crate::session::Session;

mod lanes_engine;
mod leaderboard;
mod lobby;
mod match_engine;
mod player_state;
mod protocol;
mod security;
mod session;

struct AppState {
    lobbies: Arc<LobbyManager>,
    /// Brute-force protection on JoinLobby — tracks failed attempts per IP.
    lobby_attempts: Arc<LobbyAttemptTracker>,
    /// session_id → (match_tx, our_slot) — classic 1v1 mode.
    in_match: DashMap<String, (mpsc::UnboundedSender<MatchCommand>, PlayerSlot)>,
    /// session_id → (lanes_tx, our_slot) — Constellation Lanes mode (Phase 1+).
    in_lanes: DashMap<String, (mpsc::UnboundedSender<LanesCommand>, PlayerSlot)>,
    /// player_id → last SyncState save timestamp — server-side write throttle
    /// (max 1 save per 5s per identity) to protect Upstash quota.
    sync_throttle: DashMap<String, Instant>,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,rpsls_server=debug".into()),
        )
        .init();

    let state = Arc::new(AppState {
        lobbies: Arc::new(LobbyManager::new()),
        lobby_attempts: Arc::new(LobbyAttemptTracker::default()),
        in_match: DashMap::new(),
        in_lanes: DashMap::new(),
        sync_throttle: DashMap::new(),
    });

    // `/health` is infra-only: Render hammers it during rolling deploys
    // (multiple probes per second to confirm the new instance is up before
    // switching traffic) and UptimeRobot keeps it warm against the free-tier
    // 15-min sleep. Sat behind `governor_layer()`, those bursts can clip the
    // 30-request burst window and serve a 429 to Render's own probe — which
    // then trips a false "service unavailable" alert. So `/health` stays
    // OUT of the rate limiter (and CORS, which doesn't apply to non-browser
    // infra calls); only the user-facing `/ws` endpoint is throttled.
    //
    // Layer order is bottom-up: trace → cors → governor → router.
    let app = Router::new()
        .route("/health", get(health))
        .merge(
            Router::new()
                .route("/ws", get(ws_handler))
                .with_state(state)
                .layer(governor_layer())
                .layer(cors_layer()),
        )
        .layer(TraceLayer::new_for_http());

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(8080);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!("listening on {addr}");
    info!(
        "global leaderboard: {}",
        if leaderboard::enabled() { "ENABLED (Upstash)" } else { "disabled (no UPSTASH_REDIS_REST_* env)" }
    );
    info!(
        "player state sync: {}",
        if player_state::enabled() { "ENABLED (Upstash)" } else { "disabled" }
    );

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    // ConnectInfo is required by tower_governor's SmartIpKeyExtractor to
    // grab the peer SocketAddr when no X-Forwarded-For header is present
    // (i.e. during local dev without a reverse proxy).
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .unwrap();
}

async fn health() -> &'static str {
    "ok"
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    // Cap frame + message size so a malicious client can't OOM the server
    // by streaming a 60 MB JSON blob. 64 KiB is well above any legit
    // payload (lobby code, move enum, deck of 6 ids).
    ws.max_frame_size(64 * 1024)
        .max_message_size(64 * 1024)
        .on_upgrade(move |sock| handle_socket(sock, state, peer.ip()))
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>, peer_ip: std::net::IpAddr) {
    let session_id = Uuid::new_v4().to_string();
    let (mut sink, mut stream) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<ServerMessage>();

    // Per-session message rate limit. Lives on the stack so it's dropped
    // when the connection closes — zero cleanup work elsewhere.
    let mut rate = MsgRateLimit::default();

    let session = Arc::new(Session::new(
        session_id.clone(),
        "Anonymous".to_string(),
        tx.clone(),
        peer_ip,
    ));

    session.send(ServerMessage::Welcome {
        session_id: session_id.clone(),
    });

    // Forward server-side messages to the WebSocket sink.
    let outgoing_session_id = session_id.clone();
    let outgoing = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            let json = match serde_json::to_string(&msg) {
                Ok(s) => s,
                Err(e) => {
                    warn!(?e, "failed to serialize outgoing message");
                    continue;
                }
            };
            if sink.send(Message::Text(json)).await.is_err() {
                break;
            }
        }
        info!(session_id = %outgoing_session_id, "outgoing task ended");
    });

    // Incoming loop.
    while let Some(Ok(msg)) = stream.next().await {
        match msg {
            Message::Text(text) => {
                // Per-session WS message throttle. Past 30 msg/s the peer
                // either has a bug or is hostile — drop silently rather
                // than echo an error (which would itself eat bandwidth).
                if !rate.allow() {
                    warn!(session_id = %session_id, peer = %peer_ip, "ws message rate exceeded — dropped");
                    continue;
                }
                let parsed: Result<ClientMessage, _> = serde_json::from_str(&text);
                match parsed {
                    Ok(m) => handle_client_message(&state, &session, m).await,
                    Err(e) => {
                        session.send(ServerMessage::Error {
                            code: "bad_message".into(),
                            message: format!("invalid JSON: {e}"),
                        });
                    }
                }
            }
            Message::Close(_) => break,
            Message::Ping(b) => {
                let _ = tx.send(ServerMessage::Pong);
                // axum auto-handles pong frames at the WS level — we keep app-level too.
                let _ = b;
            }
            _ => {}
        }
    }

    // Cleanup.
    state.lobbies.remove_lobby_by_host(&session_id);
    state.lobbies.leave_queue(&session_id).await;
    state.lobbies.leave_lanes_queue(&session_id).await;
    if let Some((_, (match_tx, slot))) = state.in_match.remove(&session_id) {
        let _ = match_tx.send(MatchCommand::Leave { slot });
    }
    if let Some((_, (lanes_tx, slot))) = state.in_lanes.remove(&session_id) {
        let _ = lanes_tx.send(LanesCommand::Leave { slot });
    }
    drop(outgoing);
    info!(%session_id, "socket closed");
}

async fn handle_client_message(state: &Arc<AppState>, session: &Arc<Session>, msg: ClientMessage) {
    match msg {
        ClientMessage::Hello { nickname, player_id, claim_token } => {
            // Sanitize nickname: strip control chars + RTL/bidi overrides +
            // zero-width joiners. Cap at 24 chars. Always set (no auth gate).
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
            let clean = clean.trim();
            if !clean.is_empty() && clean.chars().count() <= 24 {
                session.set_nickname(clean.to_string());
            }

            // Stable client id for leaderboard attribution + state sync.
            let pid: String = player_id.chars().filter(|c| !c.is_control()).take(64).collect();
            let pid_clean = pid.trim().to_string();

            if !pid_clean.is_empty() {
                let client_token: String = claim_token.chars().filter(|c| !c.is_control()).take(64).collect();
                let client_token = client_token.trim().to_string();
                let session_clone = session.clone();
                let pid = pid_clean;

                // TOFU claim-token verification + state load run in parallel.
                tokio::spawn(async move {
                    let (stored_token, progress) = tokio::join!(
                        player_state::load_claim_token(&pid),
                        player_state::load(&pid),
                    );

                    match stored_token {
                        Some(ref st) if client_token == *st => {
                            // Token matches — authenticate session.
                            session_clone.set_player_id(pid);
                            let state = progress.unwrap_or_default();
                            session_clone.send(ServerMessage::StateLoaded {
                                state,
                                claim_token: Some(st.clone()),
                            });
                        }
                        Some(_) => {
                            // Token exists but client sent wrong/empty token.
                            warn!(player_id = %pid, "claim token mismatch — Hello rejected");
                            session_clone.send(ServerMessage::Error {
                                code: "auth_failed".into(),
                                message: "claim token mismatch".into(),
                            });
                        }
                        None => {
                            // First connection for this player_id — issue token.
                            let new_token = Uuid::new_v4().to_string();
                            player_state::save_claim_token(pid.clone(), new_token.clone());
                            session_clone.set_player_id(pid);
                            let state = progress.unwrap_or_default();
                            session_clone.send(ServerMessage::StateLoaded {
                                state,
                                claim_token: Some(new_token),
                            });
                        }
                    }
                });
            }
        }

        ClientMessage::CreateLobby { best_of } => {
            if !validate_best_of(best_of) {
                return reply_error(session, "bad_best_of", "best_of must be odd 1..=9");
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
            // Legit join — clear any pent-up counter for this IP.
            state.lobby_attempts.record_success(session.peer_ip);
            let match_tx = start_match(lobby.host.clone(), session.clone(), lobby.best_of);
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
                let match_tx = start_match(opp.clone(), session.clone(), best_of);
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
                let lanes_tx = start_lanes_match(opp.clone(), session.clone(), win_to);
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
