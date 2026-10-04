//! Security primitives — IP rate limit, CORS allow-list, per-session message
//! throttle, lobby brute-force protection.
//!
//! Centralised here so changing the policy (raising a limit, adding an
//! allowed origin) is a one-file edit. Every other module just calls into
//! these helpers and never deals with `tower_governor` or CORS detail.

use std::collections::VecDeque;
use std::hash::Hash;
use std::net::IpAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::extract::ConnectInfo;
use axum::http::{HeaderMap, HeaderValue, Request};
use dashmap::DashMap;
use std::net::SocketAddr;
use tower_governor::{
    governor::GovernorConfigBuilder, key_extractor::KeyExtractor, GovernorError, GovernorLayer,
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

/// Extra origins from the `CORS_EXTRA_ORIGINS` env var (comma-separated).
/// Lets ops add the production landing-page / web-build origin without a
/// recompile. Resolved once at boot via `OnceLock` so the request-path stays
/// allocation-free.
fn extra_origins() -> &'static Vec<String> {
    use std::sync::OnceLock;
    static EXTRA: OnceLock<Vec<String>> = OnceLock::new();
    EXTRA.get_or_init(|| {
        std::env::var("CORS_EXTRA_ORIGINS")
            .ok()
            .map(|raw| {
                raw.split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect()
            })
            .unwrap_or_default()
    })
}

/// Build the CORS layer. Strict allow-list — see [`ALLOWED_ORIGINS`].
/// Additional origins can be supplied at boot via `CORS_EXTRA_ORIGINS`
/// (comma-separated). Used to whitelist e.g. the production landing page or
/// a real web build without redeploying server code.
pub fn cors_layer() -> CorsLayer {
    CorsLayer::new()
        .allow_origin(AllowOrigin::predicate(
            |origin: &HeaderValue, _request_parts: &_| {
                let Ok(s) = origin.to_str() else { return false };
                ALLOWED_ORIGINS.iter().any(|p| s == *p)
                    || extra_origins().iter().any(|p| s == *p)
            },
        ))
        .allow_methods([axum::http::Method::GET])
        .allow_headers([axum::http::header::CONTENT_TYPE])
}

// ──────────────────────────────────────────────────────────────────────────
// Per-IP HTTP rate limit (governor)
// ──────────────────────────────────────────────────────────────────────────

/// Vraie IP du client derrière Render. Mesuré en prod (diag 2026-10-04) :
/// - le pair TCP est TOUJOURS le proxy de Render (127.0.0.1) → inutilisable ;
/// - `X-Forwarded-For` garde ce que le client a envoyé EN TÊTE
///   (`1.2.3.4,<vraie>`) → falsifiable, jamais utilisé ;
/// - `CF-Connecting-IP` est posé par Cloudflare (un client qui l'envoie lui-même
///   est rejeté par Cloudflare, erreur 1000) ; `True-Client-IP` est écrasé par
///   Cloudflare avec la même valeur → secours.
///
/// Les en-têtes ne sont crus que si le pair est une adresse locale/privée (= on
/// est derrière le proxy). Un pair public (exposition directe) fait foi.
pub fn client_ip(peer: IpAddr, headers: &HeaderMap) -> IpAddr {
    let behind_proxy = match peer {
        IpAddr::V4(v4) => v4.is_loopback() || v4.is_private(),
        IpAddr::V6(v6) => v6.is_loopback(),
    };
    if !behind_proxy {
        return peer;
    }
    ["cf-connecting-ip", "true-client-ip"]
        .iter()
        .find_map(|h| headers.get(*h)?.to_str().ok()?.trim().parse::<IpAddr>().ok())
        .unwrap_or(peer)
}

/// Clé du rate limit HTTP = [`client_ip`] (remplace `SmartIpKeyExtractor`, qui
/// lisait la tête falsifiable de `X-Forwarded-For`).
#[derive(Debug, Clone, Copy)]
pub struct ClientIpKeyExtractor;

impl KeyExtractor for ClientIpKeyExtractor {
    type Key = IpAddr;

    fn extract<T>(&self, req: &Request<T>) -> Result<Self::Key, GovernorError> {
        let peer = req
            .extensions()
            .get::<ConnectInfo<SocketAddr>>()
            .map(|ConnectInfo(addr)| addr.ip())
            .ok_or(GovernorError::UnableToExtractKey)?;
        Ok(client_ip(peer, req.headers()))
    }
}

/// Build the global per-IP rate limit layer.
///
/// Sustained rate: 20 req/sec (one token every 50 ms — NB: `per_second(n)`
/// means « one token every n seconds » in tower_governor, the previous
/// `per_second(20)` allowed 1 req / 20 s). Burst: 30 (so a fresh app start that
/// opens a /health check + a /ws upgrade in quick succession passes through).
/// Past that, the offender gets a 429.
pub fn governor_layer() -> GovernorLayer<ClientIpKeyExtractor, governor::middleware::NoOpMiddleware> {
    let config = Arc::new(
        GovernorConfigBuilder::default()
            .per_millisecond(50)
            .burst_size(30)
            .key_extractor(ClientIpKeyExtractor)
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
// Generic sliding-window attempt tracker (lobby brute-force + auth throttle)
// ──────────────────────────────────────────────────────────────────────────

/// Per-key record of failed attempts in the last `window`. After `max` failures
/// inside the window the key is blocked for the rest of it. Generic over the key
/// type so the same battle-tested sliding-window logic serves both the lobby
/// brute-force gate (keyed by IP) and the account auth throttle (keyed by an
/// `email|ip` / `signup|ip` string). See [`LobbyAttemptTracker`] /
/// [`AuthAttemptTracker`] for the concrete policies.
pub struct AttemptTracker<K: Eq + Hash + Clone> {
    by_key: DashMap<K, VecDeque<Instant>>,
    window: Duration,
    max: usize,
}

impl<K: Eq + Hash + Clone> AttemptTracker<K> {
    pub fn new(window: Duration, max: usize) -> Self {
        Self {
            by_key: DashMap::new(),
            window,
            max,
        }
    }

    /// Record a *failed* attempt for `key` and return how many failures have
    /// piled up in the active window after this one.
    pub fn record_failed(&self, key: K) -> usize {
        let now = Instant::now();
        let mut entry = self.by_key.entry(key).or_default();
        prune_old(&mut entry, now, self.window);
        entry.push_back(now);
        entry.len()
    }

    /// Is `key` currently locked out?
    pub fn is_blocked(&self, key: K) -> bool {
        let now = Instant::now();
        let Some(mut entry) = self.by_key.get_mut(&key) else {
            return false;
        };
        prune_old(&mut entry, now, self.window);
        entry.len() >= self.max
    }

    /// A success clears the counter for `key` — assume the attacker isn't also
    /// the one legitimately succeeding.
    pub fn record_success(&self, key: K) {
        self.by_key.remove(&key);
    }

    /// Drop entries whose deques are stale (all timestamps older than window).
    /// Returns the count removed. Called from the background janitor below.
    fn sweep(&self) -> usize {
        let now = Instant::now();
        let stale: Vec<K> = self
            .by_key
            .iter()
            .filter_map(|e| {
                let back = e.value().back().copied()?;
                if now.duration_since(back) >= self.window {
                    Some(e.key().clone())
                } else {
                    None
                }
            })
            .collect();
        let n = stale.len();
        for key in stale {
            // Re-check under write-lock: don't drop a key that hit a fresh
            // failure between our scan and the remove.
            self.by_key.remove_if(&key, |_, v| {
                v.back().is_some_and(|t| now.duration_since(*t) >= self.window)
            });
        }
        n
    }
}

impl<K: Eq + Hash + Clone + Send + Sync + 'static> AttemptTracker<K> {
    /// Spawn a background task that periodically prunes stale entries so the map
    /// can't accumulate one perpetual entry per unique key that ever failed.
    /// Cheap: scans the map every 5 minutes.
    pub fn spawn_janitor(self: Arc<Self>) {
        tokio::spawn(async move {
            let mut tick = tokio::time::interval(Duration::from_secs(300));
            // Skip the immediate first tick — there's nothing to sweep at boot.
            tick.tick().await;
            loop {
                tick.tick().await;
                let n = self.sweep();
                if n > 0 {
                    tracing::debug!(removed = n, "attempt tracker swept");
                }
            }
        });
    }
}

/// Lobby brute-force gate, keyed by IP. After [`LOBBY_MAX_ATTEMPTS`] failed
/// `JoinLobby` calls inside [`LOBBY_WINDOW`] the IP is blocked. Combined with the
/// 32^6 (≈ 1.07 B) code keyspace, this caps an attacker to ~5 codes/min ≈ 7 200
/// codes/day — effectively unattackable.
pub type LobbyAttemptTracker = AttemptTracker<IpAddr>;
pub const LOBBY_WINDOW: Duration = Duration::from_secs(60);
pub const LOBBY_MAX_ATTEMPTS: usize = 5;

/// Account auth throttle, keyed by an `email|ip` (login) / `signup|ip` string.
/// Tuned looser than the lobby gate so a fumbling legit user isn't locked out,
/// but tight enough — combined with Argon2id's per-verify cost — to make online
/// password brute-force / mass-signup impractical.
pub type AuthAttemptTracker = AttemptTracker<String>;
pub const AUTH_WINDOW: Duration = Duration::from_secs(300);
pub const AUTH_MAX_ATTEMPTS: usize = 10;

/// Per-ACCOUNT login lock (keyed by e-mail alone, all IPs). Closes the IP-
/// rotation bypass of the per-`email|ip` throttle above: an attacker behind a
/// proxy/botnet pool can no longer reset their per-IP budget by switching IP.
/// Deliberately wider + higher than the per-IP lock — assuming each verify costs
/// an Argon2id, 15 guesses / 15 min per account makes online brute-force
/// impractical while being high enough that a legit user is never the one
/// locked out (and the window self-heals quickly to limit any lockout griefing).
pub const LOGIN_EMAIL_WINDOW: Duration = Duration::from_secs(900);
pub const LOGIN_EMAIL_MAX: usize = 15;

fn prune_old(entry: &mut VecDeque<Instant>, now: Instant, window: Duration) {
    while entry.front().is_some_and(|t| now.duration_since(*t) >= window) {
        entry.pop_front();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::Ipv4Addr;

    fn headers(pairs: &[(&'static str, &str)]) -> HeaderMap {
        let mut h = HeaderMap::new();
        for (k, v) in pairs {
            h.insert(*k, v.parse().unwrap());
        }
        h
    }

    const PROXY: IpAddr = IpAddr::V4(Ipv4Addr::LOCALHOST);

    /// Rejoue la requête falsifiée mesurée en prod (diag 2026-10-04) : le client
    /// met 1.2.3.4 en tête de X-Forwarded-For, Cloudflare pose la vraie IP.
    #[test]
    fn client_ip_ignores_spoofed_forwarded_for() {
        let h = headers(&[
            ("x-forwarded-for", "1.2.3.4,83.59.139.63"),
            ("true-client-ip", "83.59.139.63"),
            ("cf-connecting-ip", "83.59.139.63"),
        ]);
        assert_eq!(client_ip(PROXY, &h), "83.59.139.63".parse::<IpAddr>().unwrap());
    }

    #[test]
    fn client_ip_fallbacks() {
        // Pas de CF-Connecting-IP → True-Client-IP.
        let h = headers(&[("true-client-ip", "83.59.139.63")]);
        assert_eq!(client_ip(PROXY, &h), "83.59.139.63".parse::<IpAddr>().unwrap());
        // En-tête illisible → pair TCP (jamais de panique, jamais X-Forwarded-For).
        let h = headers(&[("cf-connecting-ip", "not-an-ip"), ("x-forwarded-for", "1.2.3.4")]);
        assert_eq!(client_ip(PROXY, &h), PROXY);
        // Pair PUBLIC (pas derrière le proxy) : les en-têtes ne sont pas crus.
        let public: IpAddr = "203.0.113.9".parse().unwrap();
        let h = headers(&[("cf-connecting-ip", "1.2.3.4")]);
        assert_eq!(client_ip(public, &h), public);
    }

    #[test]
    fn rate_limit_key_is_the_client_ip() {
        let mut req = Request::builder()
            .header("x-forwarded-for", "1.2.3.4,83.59.139.63")
            .header("cf-connecting-ip", "83.59.139.63")
            .body(())
            .unwrap();
        req.extensions_mut().insert(ConnectInfo(SocketAddr::from(([127, 0, 0, 1], 4000))));
        assert_eq!(
            ClientIpKeyExtractor.extract(&req).unwrap(),
            "83.59.139.63".parse::<IpAddr>().unwrap()
        );
    }

    #[test]
    fn msg_rate_limit_allows_up_to_max_then_blocks() {
        let mut rl = MsgRateLimit::new(3);
        assert!(rl.allow());
        assert!(rl.allow());
        assert!(rl.allow());
        assert!(!rl.allow());
    }

    #[test]
    fn attempt_tracker_blocks_after_max() {
        let t = AttemptTracker::new(LOBBY_WINDOW, LOBBY_MAX_ATTEMPTS);
        let ip = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1));
        for _ in 0..LOBBY_MAX_ATTEMPTS - 1 {
            assert!(!t.is_blocked(ip));
            t.record_failed(ip);
        }
        t.record_failed(ip);
        assert!(t.is_blocked(ip));
        t.record_success(ip);
        assert!(!t.is_blocked(ip));
    }

    #[test]
    fn attempt_tracker_works_with_string_keys() {
        let t = AttemptTracker::new(AUTH_WINDOW, 3);
        let k = "login|a@b.co|127.0.0.1".to_string();
        assert!(!t.is_blocked(k.clone()));
        t.record_failed(k.clone());
        t.record_failed(k.clone());
        t.record_failed(k.clone());
        assert!(t.is_blocked(k.clone()));
        // A different key is unaffected.
        assert!(!t.is_blocked("signup|10.0.0.1".to_string()));
        t.record_success(k.clone());
        assert!(!t.is_blocked(k));
    }
}
