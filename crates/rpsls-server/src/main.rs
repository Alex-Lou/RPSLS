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

use crate::dispatch::handle_client_message;
use crate::lanes_engine::LanesCommand;
use crate::lobby::LobbyManager;
use crate::match_engine::MatchCommand;
use crate::protocol::{ClientMessage, PlayerSlot, ServerMessage};
use crate::security::{cors_layer, governor_layer, AuthAttemptTracker, LobbyAttemptTracker, MsgRateLimit};
use crate::session::Session;

mod account;
mod auth;
mod dispatch;
mod google_auth;
mod hello;
// Économie serveur-autoritaire (Alex 2026-06-13) — fondation pure pour l'instant
// (règles + méta cartes). Pas encore câblée → dead_code toléré le temps des
// incréments (endpoints validés à venir).
#[allow(dead_code)]
mod economy;
mod janitors;
mod lanes_engine;
mod leaderboard;
mod lobby;
mod match_engine;
mod player_state;
mod protocol;
mod security;
mod session;

/// Hard ceiling on concurrent active matches (classic + lanes combined).
/// Past this, new join_lobby / join_queue calls are refused with `server_full`
/// instead of spawning a fresh tokio task. Each running match owns two
/// `Arc<Session>` and one `tokio::spawn`-ed task — bounded growth keeps the
/// server within the Render free-tier memory envelope even under a scripted
/// flood. Tunable via the `MAX_CONCURRENT_MATCHES` env var.
const DEFAULT_MAX_MATCHES: usize = 400;
/// Hard ceiling on open private lobbies. Same idea, smaller number (a lobby
/// without a paired player is cheaper than a running match but accumulates
/// faster — every `CreateLobby` makes one).
const DEFAULT_MAX_LOBBIES: usize = 200;

fn cap_from_env(var: &str, default: usize) -> usize {
    std::env::var(var)
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(default)
}

pub(crate) struct AppState {
    /// `in_match.len() + in_lanes.len()` must stay below this to accept new
    /// matches. Loaded once at boot from `MAX_CONCURRENT_MATCHES` env.
    pub(crate) max_matches: usize,
    /// `lobbies.lobby_count()` must stay below this to accept new lobbies.
    pub(crate) max_lobbies: usize,
    pub(crate) lobbies: Arc<LobbyManager>,
    /// Brute-force protection on JoinLobby — tracks failed attempts per IP.
    pub(crate) lobby_attempts: Arc<LobbyAttemptTracker>,
    /// Throttle on Signup/Login — failed/abusive auth attempts keyed by
    /// `login|email|ip` and `signup|ip`. Blocks online password brute-force and
    /// mass-signup; pruned by the same janitor pattern as `lobby_attempts`.
    pub(crate) auth_attempts: Arc<AuthAttemptTracker>,
    /// Per-ACCOUNT login lock, keyed by e-mail alone (all IPs) — closes the
    /// IP-rotation bypass of `auth_attempts`. Wider window / higher ceiling
    /// (`LOGIN_EMAIL_*`). Pruned by the same janitor pattern.
    pub(crate) login_email_attempts: Arc<AuthAttemptTracker>,
    /// session_id → (match_tx, our_slot) — classic 1v1 mode.
    pub(crate) in_match: DashMap<String, (mpsc::UnboundedSender<MatchCommand>, PlayerSlot)>,
    /// session_id → (lanes_tx, our_slot) — Constellation Lanes mode (Phase 1+).
    pub(crate) in_lanes: DashMap<String, (mpsc::UnboundedSender<LanesCommand>, PlayerSlot)>,
    /// player_id → last SyncState save timestamp — server-side write throttle
    /// (max 1 save per 5s per identity) to protect Upstash quota.
    pub(crate) sync_throttle: DashMap<String, Instant>,
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
        max_matches: cap_from_env("MAX_CONCURRENT_MATCHES", DEFAULT_MAX_MATCHES),
        max_lobbies: cap_from_env("MAX_CONCURRENT_LOBBIES", DEFAULT_MAX_LOBBIES),
        lobbies: Arc::new(LobbyManager::new()),
        lobby_attempts: Arc::new(LobbyAttemptTracker::new(
            security::LOBBY_WINDOW,
            security::LOBBY_MAX_ATTEMPTS,
        )),
        auth_attempts: Arc::new(AuthAttemptTracker::new(
            security::AUTH_WINDOW,
            security::AUTH_MAX_ATTEMPTS,
        )),
        login_email_attempts: Arc::new(AuthAttemptTracker::new(
            security::LOGIN_EMAIL_WINDOW,
            security::LOGIN_EMAIL_MAX,
        )),
        in_match: DashMap::new(),
        in_lanes: DashMap::new(),
        sync_throttle: DashMap::new(),
    });

    // Background janitor — purges stale per-IP attempt entries so the tracker
    // doesn't accumulate one perpetual entry per unique IP that ever tried
    // a lobby join. Runs every 5 min, no-op when nothing to prune.
    state.lobby_attempts.clone().spawn_janitor();
    state.auth_attempts.clone().spawn_janitor();
    state.login_email_attempts.clone().spawn_janitor();

    // Inactive-user sweeper: every 24h, SCAN `player:*`, read each row's
    // `updatedAt`, and DELETE both `player:{id}` and `claim:{id}` when the
    // row is older than INACTIVE_TTL_DAYS. Idempotent (a row that was
    // already deleted last sweep just isn't there next sweep). Bounded:
    // we sleep between SCAN pages so a sudden 100k-key sweep can't burn
    // through the Upstash request budget.
    janitors::spawn_inactive_user_sweeper();

    // Same pattern for the SyncState throttle map: each player_id who ever
    // pushed leaves an Instant entry; without periodic pruning the map grows
    // monotonically. 5-min sweep dropping entries older than 60s (12× the
    // 5s throttle window — well past any legitimate cooldown).
    // sync_throttle sweep: was 300s — at 1000 unique pushers, that left up to
    // ~60k stale entries between sweeps (waste, not a crash threat). Dropped
    // to 60s so the map'\''s upper bound is bounded by the actual concurrent
    // pusher count, not by the sweep interval. cutoff stays 60s — 12× the
    // 5s throttle window, so a legitimate cooldown is never evicted early.
    janitors::spawn_sync_throttle_sweeper(state.clone());

    // Dead-match janitor: on_end runs when a match task exits cleanly, but a
    // panic inside run_match (e.g. channel send failure) skips on_end and
    // leaves the in_match / in_lanes entries forever. Over weeks of uptime
    // that'\''s a slow leak. Every 2 min, scan both maps and drop entries whose
    // command sender is closed — a closed sender means the match task is no
    // longer receiving, so cleanup is safe and idempotent.
    janitors::spawn_dead_match_sweeper(state.clone());

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
    info!(
        "google sign-in: {}",
        if google_auth::is_configured() { "ENABLED (GOOGLE_OAUTH_CLIENT_IDS set)" } else { "disabled (set GOOGLE_OAUTH_CLIENT_IDS)" }
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
