//! Background janitors — periodic sweepers spawned once at boot. Extracted from
//! main.rs to keep the entry point lean (audit 2026-06-14, règle <400 lignes).
//!
//! Each `spawn_*` detaches a tokio task that ticks forever; they own only what
//! they need (a cheap `Arc<AppState>` clone, or nothing for the Redis sweeper).

use std::sync::Arc;
use std::time::{Duration, Instant};
use tracing::{debug, info, warn};

use crate::player_state;
use crate::AppState;

/// Inactive-user sweeper: every 24h, SCAN `player:*`, read each row's
/// `updatedAt`, and DELETE both `player:{id}` and `claim:{id}` when the row is
/// older than INACTIVE_TTL_DAYS. Idempotent (a row already deleted last sweep
/// just isn't there next sweep). Bounded: we sleep between SCAN pages so a
/// sudden 100k-key sweep can't burn through the Upstash request budget.
pub fn spawn_inactive_user_sweeper() {
    tokio::spawn(async move {
        const INACTIVE_TTL_DAYS: u64 = 180;
        const SWEEP_INTERVAL_SECS: u64 = 24 * 3600;
        const SCAN_PAGE: u32 = 200;
        const PAGE_PAUSE_MS: u64 = 250;
        let ttl_ms: u64 = INACTIVE_TTL_DAYS * 24 * 3600 * 1000;
        // Skip the immediate first tick — boot-time bursts are bad form.
        let mut tick = tokio::time::interval(Duration::from_secs(SWEEP_INTERVAL_SECS));
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
                tokio::time::sleep(Duration::from_millis(PAGE_PAUSE_MS)).await;
            }
            info!(scanned, deleted, days = INACTIVE_TTL_DAYS, "inactive-user sweep done");
        }
    });
}

/// SyncState throttle-map sweeper: each player_id who ever pushed leaves an
/// Instant entry; without pruning the map grows monotonically. 60s sweep drops
/// entries older than 60s (12× the 5s throttle window — well past any legit
/// cooldown), so the map's upper bound tracks the concurrent pusher count
/// rather than the sweep interval.
pub fn spawn_sync_throttle_sweeper(state: Arc<AppState>) {
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(Duration::from_secs(60));
        tick.tick().await; // skip first immediate tick
        loop {
            tick.tick().await;
            let cutoff = Duration::from_secs(60);
            let now = Instant::now();
            let stale: Vec<String> = state
                .sync_throttle
                .iter()
                .filter(|e| now.duration_since(*e.value()) >= cutoff)
                .map(|e| e.key().clone())
                .collect();
            for pid in &stale {
                state
                    .sync_throttle
                    .remove_if(pid, |_, v| now.duration_since(*v) >= cutoff);
            }
            if !stale.is_empty() {
                debug!(removed = stale.len(), "sync throttle swept");
            }
        }
    });
}

/// Dead-match janitor: `on_end` runs when a match task exits cleanly, but a
/// panic inside run_match (e.g. a channel send failure) skips on_end and leaves
/// the in_match / in_lanes entries forever — a slow leak over weeks of uptime.
/// Every 2 min, scan both maps and drop entries whose command sender is closed
/// (a closed sender means the match task is gone, so cleanup is safe + idempotent).
pub fn spawn_dead_match_sweeper(state: Arc<AppState>) {
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(Duration::from_secs(120));
        tick.tick().await;
        loop {
            tick.tick().await;
            let dead_classic: Vec<String> = state
                .in_match
                .iter()
                .filter(|e| e.value().0.is_closed())
                .map(|e| e.key().clone())
                .collect();
            let dead_lanes: Vec<String> = state
                .in_lanes
                .iter()
                .filter(|e| e.value().0.is_closed())
                .map(|e| e.key().clone())
                .collect();
            let total = dead_classic.len() + dead_lanes.len();
            for id in &dead_classic {
                state.in_match.remove_if(id, |_, v| v.0.is_closed());
            }
            for id in &dead_lanes {
                state.in_lanes.remove_if(id, |_, v| v.0.is_closed());
            }
            if total > 0 {
                warn!(removed = total, "dead match channels swept (on_end skipped?)");
            }
        }
    });
}
