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
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
    routing::get,
    Router,
};
use dashmap::DashMap;
use futures_util::{sink::SinkExt, stream::StreamExt};
use tokio::sync::mpsc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::{info, warn};
use uuid::Uuid;

use crate::lanes_engine::{start_lanes_match, LanesCommand};
use crate::lobby::LobbyManager;
use crate::match_engine::{start_match, MatchCommand};
use crate::protocol::{ClientMessage, PlayerSlot, ServerMessage};
use crate::session::Session;

mod lanes_engine;
mod lobby;
mod match_engine;
mod protocol;
mod session;

struct AppState {
    lobbies: Arc<LobbyManager>,
    /// session_id → (match_tx, our_slot) — classic 1v1 mode.
    in_match: DashMap<String, (mpsc::UnboundedSender<MatchCommand>, PlayerSlot)>,
    /// session_id → (lanes_tx, our_slot) — Constellation Lanes mode (Phase 1+).
    in_lanes: DashMap<String, (mpsc::UnboundedSender<LanesCommand>, PlayerSlot)>,
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
        in_match: DashMap::new(),
        in_lanes: DashMap::new(),
    });

    let cors = CorsLayer::new().allow_origin(Any).allow_methods(Any);

    let app = Router::new()
        .route("/health", get(health))
        .route("/ws", get(ws_handler))
        .with_state(state)
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(8080);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!("listening on {addr}");

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health() -> &'static str {
    "ok"
}

async fn ws_handler(ws: WebSocketUpgrade, State(state): State<Arc<AppState>>) -> impl IntoResponse {
    ws.on_upgrade(move |sock| handle_socket(sock, state))
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let session_id = Uuid::new_v4().to_string();
    let (mut sink, mut stream) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<ServerMessage>();

    let session = Arc::new(Session::new(
        session_id.clone(),
        "Anonymous".to_string(),
        tx.clone(),
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
        ClientMessage::Hello { nickname } => {
            let clean = nickname.trim();
            if !clean.is_empty() && clean.len() <= 32 {
                session.set_nickname(clean.to_string());
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
            let Some(lobby) = state.lobbies.join_lobby(&code) else {
                return reply_error(session, "lobby_not_found", "no lobby with that code");
            };
            // Don't let yourself join your own lobby.
            if lobby.host.id == session.id {
                return reply_error(session, "self_lobby", "cannot join your own lobby");
            }
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
            if let Some(entry) = state.in_match.get(&session.id) {
                let (tx, slot) = entry.value().clone();
                let _ = tx.send(MatchCommand::Chat { slot, emoji });
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
