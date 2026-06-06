//! Security primitives — IP rate limit, CORS allow-list, per-session message
//! throttle, lobby brute-force protection.
//!
//! Centralised here so changing the policy (raising a limit, adding an
//! allowed origin) is a one-file edit. Every other module just calls into
//! these helpers and never deals with `tower_governor` or CORS detail.

use std::collections::VecDeque;
use std::net::IpAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::http::HeaderValue;
use dashmap::DashMap;
use tower_governor::{
    governor::GovernorConfigBuilder, key_extractor::SmartIpKeyExtractor, GovernorLayer,
};
use tower_http::cors::{AllowOrigin, CorsLayer};

// ──────────────────────────────────────────────────────────────────────────
// CORS
// ──────────────────────────────────────────────────────────────────────────

/// Origins the WebSocket endpoint is willing to upgrade. Anything else gets
/// rejected at the CORS preflight stage so a random web page cannot open a
/// WS against the production server.
///
/// Tauri 2 Android WebView serves the bundled app from the
/// `http://tauri.localhost` origin; iOS uses `tauri://localhost`. Dev runs
/// against Vite (`http://localhost:1420` / `:5173`). Add new entries here
/// when shipping a real web build.
const ALLOWED_ORIGINS: &[&str] = &[
    "http://tauri.localhost",
    "https://tauri.localhost",
    "tauri://localhost",
    "http://localhost:1420",
    "http://127.0.0.1:1420",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
];

/// Build the CORS layer. Strict allow-list — see [`ALLOWED_ORIGINS`].
pub fn cors_layer() -> CorsLayer {
    CorsLayer::new()
        .allow_origin(AllowOrigin::predicate(
            |origin: &HeaderValue, _request_parts: &_| {
                let Ok(s) = origin.to_str() else { return false };
                ALLOWED_ORIGINS.iter().any(|p| s == *p)
            },
        ))
        .allow_methods([axum::http::Method::GET])
        .allow_headers([axum::http::header::CONTENT_TYPE])
}

// ──────────────────────────────────────────────────────────────────────────
// Per-IP HTTP rate limit (governor)
// ──────────────────────────────────────────────────────────────────────────

/// Build the global per-IP rate limit layer.
///
/// Sustained rate: 20 req/sec. Burst: 30 (so a fresh app start that opens a
/// /health check + a /ws upgrade in quick succession passes through). Past
/// that, the offender gets a 429 — and the layer keeps the bucket open
/// for ~60 s of cooldown before the next allowed request.
///
/// Behind the Render reverse proxy the client IP arrives in
/// `X-Forwarded-For` / `Forwarded`. [`SmartIpKeyExtractor`] reads both
/// before falling back to the TCP peer (which would be the proxy IP).
pub fn governor_layer() -> GovernorLayer<SmartIpKeyExtractor, governor::middleware::NoOpMiddleware> {
    let config = Arc::new(
        GovernorConfigBuilder::default()
            .per_second(20)
            .burst_size(30)
            .key_extractor(SmartIpKeyExtractor)
            .finish()
            .expect("static governor config must build"),
    );
    GovernorLayer { config }
}

// ──────────────────────────────────────────────────────────────────────────
// Per-session WebSocket message throttle
// ──────────────────────────────────────────────────────────────────────────

/// Sliding-window message rate limiter held inside the WS handler. A legit
/// client sends a handful of messages per second at most (pick a move, lock
/// a deck). 30 msg/s is way above that and well below "flood the receive
/// loop".
///
/// The window itself is a tiny `VecDeque` of timestamps — peak memory ~30
/// `Instant`s = 720 bytes per session.
pub struct MsgRateLimit {
    window: VecDeque<Instant>,
    max_per_sec: usize,
}

impl MsgRateLimit {
    pub fn new(max_per_sec: usize) -> Self {
        Self {
            window: VecDeque::with_capacity(max_per_sec * 2),
            max_per_sec,
        }
    }

    /// Returns `true` if this message should be processed, `false` if the
    /// session has exceeded the rate. Stale entries (older than 1 s) are
    /// dropped on every call so the deque can never grow unbounded.
    pub fn allow(&mut self) -> bool {
        let now = Instant::now();
        let cutoff = now - Duration::from_secs(1);
        while self.window.front().is_some_and(|t| *t < cutoff) {
            self.window.pop_front();
        }
        if self.window.len() >= self.max_per_sec {
            return false;
        }
        self.window.push_back(now);
        true
    }
}

impl Default for MsgRateLimit {
    fn default() -> Self {
        Self::new(30)
    }
}

// ──────────────────────────────────────────────────────────────────────────
// Lobby brute-force tracker
// ──────────────────────────────────────────────────────────────────────────

/// Per-IP record of failed lobby-join attempts in the last [`WINDOW`].
///
/// After [`MAX_ATTEMPTS`] failed `JoinLobby` calls inside the window the
/// IP is blocked for the rest of the window. Combined with the 32^6
/// (≈ 1.07 B) keyspace, this caps an attacker to ~5 codes/min ≈ 7 200
/// codes/day — effectively unattackable.
const WINDOW: Duration = Duration::from_secs(60);
const MAX_ATTEMPTS: usize = 5;

#[derive(Default)]
pub struct LobbyAttemptTracker {
    by_ip: DashMap<IpAddr, VecDeque<Instant>>,
}

impl LobbyAttemptTracker {
    /// Record a *failed* attempt for `ip` and return how many failures
    /// have piled up in the active window after this one.
    pub fn record_failed(&self, ip: IpAddr) -> usize {
        let now = Instant::now();
        let mut entry = self.by_ip.entry(ip).or_default();
        prune_old(&mut entry, now);
        entry.push_back(now);
        entry.len()
    }

    /// Is `ip` currently locked out?
    pub fn is_blocked(&self, ip: IpAddr) -> bool {
        let now = Instant::now();
        let Some(mut entry) = self.by_ip.get_mut(&ip) else {
            return false;
        };
        prune_old(&mut entry, now);
        entry.len() >= MAX_ATTEMPTS
    }

    /// A successful join clears the counter — assume the attacker isn't
    /// also legitimately playing.
    pub fn record_success(&self, ip: IpAddr) {
        self.by_ip.remove(&ip);
    }

    /// Drop entries whose deques are stale (all timestamps older than WINDOW).
    /// Returns the count removed. Called from the background janitor below.
    fn sweep(&self) -> usize {
        let now = Instant::now();
        let stale: Vec<IpAddr> = self
            .by_ip
            .iter()
            .filter_map(|e| {
                let back = e.value().back().copied()?;
                if now.duration_since(back) >= WINDOW {
                    Some(*e.key())
                } else {
                    None
                }
            })
            .collect();
        let n = stale.len();
        for ip in stale {
            // Re-check under write-lock: don't drop an IP that hit a fresh
            // failure between our scan and the remove.
            self.by_ip.remove_if(&ip, |_, v| {
                v.back().is_some_and(|t| now.duration_since(*t) >= WINDOW)
            });
        }
        n
    }

    /// Spawn a background task that periodically prunes stale entries so the
    /// map can't accumulate one perpetual entry per unique IP that ever tried
    /// a lobby join. Cheap: scans the map every 5 minutes.
    pub fn spawn_janitor(self: Arc<Self>) {
        tokio::spawn(async move {
            let mut tick = tokio::time::interval(Duration::from_secs(300));
            // Skip the immediate first tick — there's nothing to sweep at boot.
            tick.tick().await;
            loop {
                tick.tick().await;
                let n = self.sweep();
                if n > 0 {
                    tracing::debug!(removed = n, "lobby attempt tracker swept");
                }
            }
        });
    }
}

fn prune_old(entry: &mut VecDeque<Instant>, now: Instant) {
    while entry.front().is_some_and(|t| now.duration_since(*t) >= WINDOW) {
        entry.pop_front();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::Ipv4Addr;

    #[test]
    fn msg_rate_limit_allows_up_to_max_then_blocks() {
        let mut rl = MsgRateLimit::new(3);
        assert!(rl.allow());
        assert!(rl.allow());
        assert!(rl.allow());
        assert!(!rl.allow());
    }

    #[test]
    fn lobby_tracker_blocks_after_max() {
        let t = LobbyAttemptTracker::default();
        let ip = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1));
        for _ in 0..MAX_ATTEMPTS - 1 {
            assert!(!t.is_blocked(ip));
            t.record_failed(ip);
        }
        t.record_failed(ip);
        assert!(t.is_blocked(ip));
        t.record_success(ip);
        assert!(!t.is_blocked(ip));
    }
}
