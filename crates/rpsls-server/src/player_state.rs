//! Player state persistence via Upstash Redis REST API.
//!
//! Stores player progression (currencies, XP, cards, stats) so it survives
//! app reinstalls. Uses the same Upstash credentials as the leaderboard.
//!
//! Redis key: `player:{player_id}` — stores a JSON blob of the synced fields.
//! Reads are awaited (blocking on Hello); writes are fire-and-forget.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::OnceLock;
use tracing::{debug, warn};

const KEY_PREFIX: &str = "player:";

/// The subset of player state that we persist server-side.
/// Only progression data — cosmetic preferences stay local.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PlayerProgress {
    #[serde(default)]
    pub xp: u64,
    #[serde(default)]
    pub rank_lp: u64,
    #[serde(default)]
    pub eclats: u64,
    #[serde(default)]
    pub dust: u64,
    #[serde(default)]
    pub wins: u64,
    #[serde(default)]
    pub losses: u64,
    #[serde(default)]
    pub draws: u64,
    #[serde(default)]
    pub card_collection: Vec<String>,
    #[serde(default)]
    pub card_mastery: HashMap<String, u64>,
    #[serde(default)]
    pub codex_claimed: Vec<u32>,
    #[serde(default)]
    pub ranked_deck: Vec<String>,
    #[serde(default)]
    pub season_number: u32,
    #[serde(default)]
    pub season_started_at: u64,
    #[serde(default)]
    pub win_streak: u32,
    /// Epoch millis of last sync — used for conflict resolution.
    #[serde(default)]
    pub updated_at: u64,
}

fn config() -> Option<&'static (String, String)> {
    static CFG: OnceLock<Option<(String, String)>> = OnceLock::new();
    CFG.get_or_init(|| {
        let url = std::env::var("UPSTASH_REDIS_REST_URL").ok()?;
        let token = std::env::var("UPSTASH_REDIS_REST_TOKEN").ok()?;
        let url = url.trim().trim_end_matches('/').to_string();
        if url.is_empty() || token.trim().is_empty() {
            return None;
        }
        Some((url, token.trim().to_string()))
    })
    .as_ref()
}

fn http() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(reqwest::Client::new)
}

pub fn enabled() -> bool {
    config().is_some()
}

/// Load player state from Redis. Returns None if not found or on error.
/// This is awaited on Hello so the player gets their state immediately.
pub async fn load(player_id: &str) -> Option<PlayerProgress> {
    let (url, token) = config()?;
    if player_id.trim().is_empty() {
        return None;
    }
    let key = format!("{KEY_PREFIX}{player_id}");
    let endpoint = format!("{url}/get/{key}");

    match http().get(&endpoint).bearer_auth(token).send().await {
        Ok(resp) if resp.status().is_success() => {
            let body: serde_json::Value = resp.json().await.ok()?;
            let result = body.get("result")?;
            if result.is_null() {
                return None;
            }
            let json_str = result.as_str()?;
            match serde_json::from_str::<PlayerProgress>(json_str) {
                Ok(state) => {
                    debug!(player_id, "player state loaded from Redis");
                    Some(state)
                }
                Err(e) => {
                    warn!(player_id, error = %e, "failed to deserialize player state");
                    None
                }
            }
        }
        Ok(resp) => {
            let status = resp.status();
            warn!(player_id, %status, "player state load rejected");
            None
        }
        Err(e) => {
            warn!(player_id, error = %e, "player state load failed");
            None
        }
    }
}

/// Save player state to Redis. Fire-and-forget (spawns a detached task).
pub fn save(player_id: String, state: PlayerProgress) {
    let Some((url, token)) = config() else { return };
    if player_id.trim().is_empty() {
        return;
    }
    let key = format!("{KEY_PREFIX}{player_id}");
    let token = token.clone();

    let json = match serde_json::to_string(&state) {
        Ok(s) => s,
        Err(e) => {
            warn!(error = %e, "failed to serialize player state");
            return;
        }
    };

    // Use Upstash REST pipeline: [["SET", key, value]]
    let endpoint = format!("{url}/pipeline");
    let cmds: Vec<Vec<String>> = vec![vec!["SET".into(), key, json]];

    tokio::spawn(async move {
        match http()
            .post(&endpoint)
            .bearer_auth(&token)
            .json(&cmds)
            .send()
            .await
        {
            Ok(resp) if resp.status().is_success() => {
                debug!(player_id = %player_id, "player state saved");
            }
            Ok(resp) => {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                warn!(%status, %body, "player state save rejected");
            }
            Err(e) => warn!(error = %e, "player state save failed"),
        }
    });
}
