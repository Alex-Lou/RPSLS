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
use crate::security::{cors_layer, governor_layer, AuthAttemptTracker, LobbyAttemptTracker, MsgRateLimit};
use crate::session::Session;

mod account;
mod auth;
mod google_auth;
// Économie serveur-autoritaire (Alex 2026-06-13) — fondation pure pour l'instant
// (règles + méta cartes). Pas encore câblée → dead_code toléré le temps des
// incréments (endpoints validés à venir).
#[allow(dead_code)]
mod economy;
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

struct AppState {
    /// `in_match.len() + in_lanes.len()` must stay below this to accept new
    /// matches. Loaded once at boot from `MAX_CONCURRENT_MATCHES` env.
    max_matches: usize,
    /// `lobbies.lobby_count()` must stay below this to accept new lobbies.
    max_lobbies: usize,
    lobbies: Arc<LobbyManager>,
    /// Brute-force protection on JoinLobby — tracks failed attempts per IP.
    lobby_attempts: Arc<LobbyAttemptTracker>,
    /// Throttle on Signup/Login — failed/abusive auth attempts keyed by
    /// `login|email|ip` and `signup|ip`. Blocks online password brute-force and
    /// mass-signup; pruned by the same janitor pattern as `lobby_attempts`.
    auth_attempts: Arc<AuthAttemptTracker>,
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
        in_match: DashMap::new(),
        in_lanes: DashMap::new(),
        sync_throttle: DashMap::new(),
    });

    // Background janitor — purges stale per-IP attempt entries so the tracker
    // doesn't accumulate one perpetual entry per unique IP that ever tried
    // a lobby join. Runs every 5 min, no-op when nothing to prune.
    state.lobby_attempts.clone().spawn_janitor();
    state.auth_attempts.clone().spawn_janitor();

    // Inactive-user sweeper: every 24h, SCAN `player:*`, read each row's
    // `updatedAt`, and DELETE both `player:{id}` and `claim:{id}` when the
    // row is older than INACTIVE_TTL_DAYS. Idempotent (a row that was
    // already deleted last sweep just isn't there next sweep). Bounded:
    // we sleep between SCAN pages so a sudden 100k-key sweep can't burn
    // through the Upstash request budget.
    tokio::spawn(async move {
        const INACTIVE_TTL_DAYS: u64 = 180;
        const SWEEP_INTERVAL_SECS: u64 = 24 * 3600;
        const SCAN_PAGE: u32 = 200;
        const PAGE_PAUSE_MS: u64 = 250;
        let ttl_ms: u64 = INACTIVE_TTL_DAYS * 24 * 3600 * 1000;
        // Skip the immediate first tick — boot-time bursts are bad form.
        let mut tick = tokio::time::interval(std::time::Duration::from_secs(SWEEP_INTERVAL_SECS));
        tick.tick().await;
        loop {
            tick.tick().await;
            if !player_state::enabled() {
                continue;
            }
            let now_ms = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);
            let cutoff_ms = now_ms.saturating_sub(ttl_ms);
            let mut cursor = "0".to_string();
            let mut deleted = 0u32;
            let mut scanned = 0u32;
            loop {
                let Some((next, keys)) = player_state::scan_player_keys(&cursor, SCAN_PAGE).await else {
                    break;
                };
                scanned += keys.len() as u32;
                for key in &keys {
                    let updated = player_state::read_updated_at(key).await;
                    let Some(ts) = updated else { continue };
                    if ts >= cutoff_ms { continue }
                    let Some(pid) = player_state::player_id_from_key(key) else { continue };
                    if player_state::delete_player(pid).await {
                        deleted += 1;
                    }
                }
                cursor = next;
                if cursor == "0" { break }
                tokio::time::sleep(std::time::Duration::from_millis(PAGE_PAUSE_MS)).await;
            }
            info!(scanned, deleted, days = INACTIVE_TTL_DAYS, "inactive-user sweep done");
        }
    });

    // Same pattern for the SyncState throttle map: each player_id who ever
    // pushed leaves an Instant entry; without periodic pruning the map grows
    // monotonically. 5-min sweep dropping entries older than 60s (12× the
    // 5s throttle window — well past any legitimate cooldown).
    // sync_throttle sweep: was 300s — at 1000 unique pushers, that left up to
    // ~60k stale entries between sweeps (waste, not a crash threat). Dropped
    // to 60s so the map'\''s upper bound is bounded by the actual concurrent
    // pusher count, not by the sweep interval. cutoff stays 60s — 12× the
    // 5s throttle window, so a legitimate cooldown is never evicted early.
    let throttle_state = state.clone();
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(std::time::Duration::from_secs(60));
        tick.tick().await; // skip first immediate tick
        loop {
            tick.tick().await;
            let cutoff = std::time::Duration::from_secs(60);
            let now = Instant::now();
            let stale: Vec<String> = throttle_state
                .sync_throttle
                .iter()
                .filter(|e| now.duration_since(*e.value()) >= cutoff)
                .map(|e| e.key().clone())
                .collect();
            for pid in &stale {
                throttle_state
                    .sync_throttle
                    .remove_if(pid, |_, v| now.duration_since(*v) >= cutoff);
            }
            if !stale.is_empty() {
                tracing::debug!(removed = stale.len(), "sync throttle swept");
            }
        }
    });

    // Dead-match janitor: on_end runs when a match task exits cleanly, but a
    // panic inside run_match (e.g. channel send failure) skips on_end and
    // leaves the in_match / in_lanes entries forever. Over weeks of uptime
    // that'\''s a slow leak. Every 2 min, scan both maps and drop entries whose
    // command sender is closed — a closed sender means the match task is no
    // longer receiving, so cleanup is safe and idempotent.
    let dead_match_state = state.clone();
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(std::time::Duration::from_secs(120));
        tick.tick().await;
        loop {
            tick.tick().await;
            let dead_classic: Vec<String> = dead_match_state
                .in_match
                .iter()
                .filter(|e| e.value().0.is_closed())
                .map(|e| e.key().clone())
                .collect();
            let dead_lanes: Vec<String> = dead_match_state
                .in_lanes
                .iter()
                .filter(|e| e.value().0.is_closed())
                .map(|e| e.key().clone())
                .collect();
            let total = dead_classic.len() + dead_lanes.len();
            for id in &dead_classic {
                dead_match_state.in_match.remove_if(id, |_, v| v.0.is_closed());
            }
            for id in &dead_lanes {
                dead_match_state.in_lanes.remove_if(id, |_, v| v.0.is_closed());
            }
            if total > 0 {
                tracing::warn!(removed = total, "dead match channels swept (on_end skipped?)");
            }
        }
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

async fn handle_client_message(state: &Arc<AppState>, session: &Arc<Session>, msg: ClientMessage) {
    match msg {
        ClientMessage::Hello { nickname, player_id, claim_token, auth_token } => {
            // Sanitize nickname: strip control chars + RTL/bidi overrides +
            // zero-width joiners. Cap at 24 chars. CAPTURED here but applied
            // ONLY in an auth-success branch below — letting a client set the
            // session nickname before auth check passes would let a wrong-token
            // Hello still leave someone else's display name attached to this
            // socket. Pure paranoia: in practice the queued nickname is never
            // used until queue_join / play_move, which require an authenticated
            // pid_clean, but cleanliness > coincidence.
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
                let nick_for_auth = pending_nickname;

                // TOFU claim-token verification + state load run in parallel.
                tokio::spawn(async move {
                    let (stored_token, progress) = tokio::join!(
                        player_state::load_claim_token(&pid),
                        player_state::load(&pid),
                    );

                    match stored_token {
                        Some(ref st) if client_token == *st => {
                            // Token matches — authenticate session AND adopt
                            // the supplied nickname (only-if-auth-OK).
                            if let Some(n) = nick_for_auth { session_clone.set_nickname(n); }
                            session_clone.set_player_id(pid);
                            let state = progress.unwrap_or_default();
                            session_clone.send(ServerMessage::StateLoaded {
                                state,
                                claim_token: Some(st.clone()),
                            });
                        }
                        Some(_) => {
                            // Token exists but client sent wrong/empty token —
                            // do NOT adopt the supplied nickname (leaks identity).
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
                                    if let Some(n) = nick_for_auth { session_clone.set_nickname(n); }
                                    session_clone.set_player_id(pid);
                                    let state = progress.unwrap_or_default();
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
            } else if let Some(n) = pending_nickname {
                // Anonymous client (no/invalid player_id) — there's no auth
                // boundary to cross, so adopting the supplied nickname is safe.
                // Used for casual play, LAN matches, and old clients pre-TOFU.
                session.set_nickname(n);
            }
        }

        ClientMessage::Signup { email, password } => {
            account::handle_signup(&state.auth_attempts, session, email, password);
        }

        ClientMessage::Login { email, password } => {
            account::handle_login(&state.auth_attempts, session, email, password);
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

/// Strict player_id validator. Accepts only ASCII alphanumeric + hyphens, of
/// length 32..=64 — the shape of a `crypto.randomUUID()` (36 chars) with
/// headroom for future SHA-based ids. Anything weirder is rejected outright,
/// which closes the Redis-key path-traversal vector (a `player_id` like
/// `"../../leaderboard"` would otherwise become a Redis key fragment that
/// some misconfigured REST proxy could mis-route).
fn validate_player_id(raw: &str) -> Option<String> {
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

fn validate_best_of(n: u8) -> bool {
    n >= 1 && n <= 9 && n % 2 == 1
}

/// Number of round-wins to take a Lanes match (3 → bo5, 5 → bo9, etc.).
fn validate_win_to(n: u8) -> bool {
    (1..=5).contains(&n)
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
        // 65 'a's get truncated to 64 — caller'\''s problem, but the result is
        // still a valid-shape id. The point of the length cap is to bound
        // the Redis key size, not to bounce slightly-too-long inputs.
        assert_eq!(validate_player_id(&"a".repeat(65)).map(|s| s.len()), Some(64));
    }

    #[test]
    fn strips_then_accepts_when_remainder_valid() {
        // Null byte stripped → remaining 36 chars pass; the result is exactly
        // the UUID without the embedded control byte. That'\''s the desired
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
