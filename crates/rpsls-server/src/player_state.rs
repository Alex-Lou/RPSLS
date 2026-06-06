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
const CLAIM_PREFIX: &str = "claim:";

/// The subset of player state that we persist server-side: progression data
/// PLUS the player's small cosmetic preferences (theme / background / pad /
/// avatar / nickname) so a reinstall restores the chosen look. Bulky custom
/// uploaded images (data: URLs) are deliberately NOT synced — they stay
/// device-local; `sanitize` drops anything that slips past via the length cap.
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
    /// Epoch millis of last sync — used for last-write-wins on cosmetics.
    #[serde(default)]
    pub updated_at: u64,

    // ── Cosmetic preferences (small strings; empty = "unset") ──
    #[serde(default)]
    pub theme_id: String,
    #[serde(default)]
    pub background_id: String,
    #[serde(default)]
    pub pad_id: String,
    #[serde(default)]
    pub avatar: String,
    #[serde(default)]
    pub nickname: String,
}

/// Hard ceiling for any single numeric progression field — well above any
/// legitimate value, but bounds a forged `u64::MAX` payload.
const MAX_NUM: u64 = 10_000_000_000;

fn clamp_str(s: &mut String, max: usize) {
    if s.chars().count() > max {
        *s = s.chars().take(max).collect();
    }
}

fn cap_vec(v: &mut Vec<String>, max_len: usize, max_str: usize) {
    v.truncate(max_len);
    for s in v.iter_mut() {
        clamp_str(s, max_str);
    }
}

impl PlayerProgress {
    /// Clamp every field to sane bounds before persisting. A `SyncState` is
    /// fully client-authored, so without this a crafted payload could poison
    /// Redis (junk card ids, giant arrays) or inflate storage/egress. Numbers
    /// are capped, arrays length-bounded, strings truncated. Cosmetic strings
    /// are length-capped here; the client additionally only ADOPTS a server
    /// cosmetic value that maps to a known id, so any junk that survives the
    /// cap is inert on read.
    pub fn sanitize(&mut self) {
        self.xp = self.xp.min(MAX_NUM);
        // rank_lp is a competitive number — diamond tier opens at 1750 (see
        // engine/rank.ts). A 5000 ceiling leaves room for future tiers without
        // letting a tampered client mint billions for season-rollover rewards.
        // Server-issued LP from real online matches already lives well below.
        self.rank_lp = self.rank_lp.min(5_000);
        self.eclats = self.eclats.min(MAX_NUM);
        self.dust = self.dust.min(MAX_NUM);
        self.wins = self.wins.min(MAX_NUM);
        self.losses = self.losses.min(MAX_NUM);
        self.draws = self.draws.min(MAX_NUM);
        self.season_number = self.season_number.min(100_000);
        self.win_streak = self.win_streak.min(100_000);

        cap_vec(&mut self.card_collection, 64, 64);
        cap_vec(&mut self.ranked_deck, 16, 64);
        self.codex_claimed.truncate(32);
        if self.card_mastery.len() > 64 {
            let keep: std::collections::HashSet<String> =
                self.card_mastery.keys().take(64).cloned().collect();
            self.card_mastery.retain(|k, _| keep.contains(k));
        }
        for v in self.card_mastery.values_mut() {
            *v = (*v).min(MAX_NUM);
        }

        clamp_str(&mut self.theme_id, 32);
        clamp_str(&mut self.background_id, 32);
        clamp_str(&mut self.pad_id, 32);
        clamp_str(&mut self.avatar, 300);
        clamp_str(&mut self.nickname, 24);
    }
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
                Ok(mut state) => {
                    // Defense-in-depth: a poisoned row (left over from before
                    // sanitize() was added to save(), or any future bug that
                    // bypasses it) must not flow back to the client unchecked.
                    // mergeServerState on the client takes Math.max — a leaked
                    // u64::MAX would permanently corrupt the local player state.
                    state.sanitize();
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

/// Load the TOFU claim token for a player. Returns None if not found or on
/// error — meaning this is the player's first connection.
pub async fn load_claim_token(player_id: &str) -> Option<String> {
    let (url, token) = config()?;
    if player_id.trim().is_empty() {
        return None;
    }
    let key = format!("{CLAIM_PREFIX}{player_id}");
    let endpoint = format!("{url}/get/{key}");

    match http().get(&endpoint).bearer_auth(token).send().await {
        Ok(resp) if resp.status().is_success() => {
            let body: serde_json::Value = resp.json().await.ok()?;
            let result = body.get("result")?;
            if result.is_null() {
                return None;
            }
            result.as_str().map(|s| s.to_string())
        }
        Ok(resp) => {
            let status = resp.status();
            warn!(player_id, %status, "claim token load rejected");
            None
        }
        Err(e) => {
            warn!(player_id, error = %e, "claim token load failed");
            None
        }
    }
}

/// One page of `SCAN player:*` — returns (next_cursor, keys). next_cursor is
/// "0" when the scan completes. Caller loops until then.
pub async fn scan_player_keys(cursor: &str, count: u32) -> Option<(String, Vec<String>)> {
    let (url, token) = config()?;
    // Upstash REST form for SCAN: GET /scan/{cursor}?match=<pattern>&count=<n>
    let endpoint = format!(
        "{url}/scan/{cursor}?match={KEY_PREFIX}*&count={count}",
    );
    let resp = http().get(&endpoint).bearer_auth(token).send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let body: serde_json::Value = resp.json().await.ok()?;
    // Upstash returns { result: [cursor, [keys…]] }
    let arr = body.get("result")?.as_array()?;
    let next = arr.first()?.as_str()?.to_string();
    let keys = arr.get(1)?.as_array()?.iter()
        .filter_map(|v| v.as_str().map(|s| s.to_string()))
        .collect();
    Some((next, keys))
}

/// Delete a player's state and their claim token in one round-trip. Used by
/// the 6-month inactive-user janitor.
pub async fn delete_player(player_id: &str) -> bool {
    let Some((url, token)) = config() else { return false };
    let player_key = format!("{KEY_PREFIX}{player_id}");
    let claim_key = format!("{CLAIM_PREFIX}{player_id}");
    let endpoint = format!("{url}/pipeline");
    let cmds: Vec<Vec<String>> = vec![
        vec!["DEL".into(), player_key],
        vec!["DEL".into(), claim_key],
    ];
    let resp = http().post(&endpoint).bearer_auth(token).json(&cmds).send().await.ok();
    resp.map(|r| r.status().is_success()).unwrap_or(false)
}

/// Read `updated_at` (epoch millis) from a player_key. Returns None when
/// the row is missing / malformed — caller treats that as "skip, don't delete"
/// so a transient parse failure can never erase live data.
pub async fn read_updated_at(player_key: &str) -> Option<u64> {
    let (url, token) = config()?;
    let endpoint = format!("{url}/get/{player_key}");
    let resp = http().get(&endpoint).bearer_auth(token).send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let body: serde_json::Value = resp.json().await.ok()?;
    let raw = body.get("result")?.as_str()?;
    let val: serde_json::Value = serde_json::from_str(raw).ok()?;
    val.get("updatedAt").and_then(|v| v.as_u64())
}

/// Extract the `{player_id}` suffix from a Redis key of form `player:{id}`.
pub fn player_id_from_key(key: &str) -> Option<&str> {
    key.strip_prefix(KEY_PREFIX)
}

/// Atomically claim a player_id by issuing a fresh TOFU token IFF the key
/// doesn't already exist (Redis `SET … NX`). Returns:
///   `Ok(Some(token))` — the token we just minted (this is the first connection)
///   `Ok(None)`        — another session already claimed this id; the caller
///                       must reject and ask the client to present its token
///   `Err(())`         — Redis unreachable / config missing — best treated as
///                       a transient failure (the caller should disconnect)
///
/// Replaces the previous load-then-set-if-none flow, which had a TOCTOU race
/// (two concurrent Hellos for the same fresh id would both mint their own
/// token; the second one to write would silently overwrite the first and
/// thereby steal the identity). `SET NX` makes the create atomic.
pub async fn try_create_claim_token(player_id: &str) -> Result<Option<String>, ()> {
    let Some((url, token)) = config() else { return Err(()) };
    if player_id.trim().is_empty() {
        return Err(());
    }
    let new_token = uuid::Uuid::new_v4().to_string();
    let key = format!("{CLAIM_PREFIX}{player_id}");
    // Pipeline form: [["SET", key, value, "NX"]]. Upstash returns "OK" when
    // it set the key, nil when NX rejected because the key already existed.
    let endpoint = format!("{url}/pipeline");
    let cmds: Vec<Vec<String>> = vec![vec!["SET".into(), key, new_token.clone(), "NX".into()]];
    match http().post(&endpoint).bearer_auth(token).json(&cmds).send().await {
        Ok(resp) if resp.status().is_success() => {
            let body: serde_json::Value = resp.json().await.map_err(|_| ())?;
            // Upstash pipeline returns either [{"result":"OK"}] or [{"result":null}].
            let entry = body.as_array().and_then(|a| a.first()).ok_or(())?;
            let result = entry.get("result").ok_or(())?;
            if result.as_str() == Some("OK") {
                Ok(Some(new_token))
            } else {
                Ok(None)
            }
        }
        Ok(resp) => {
            let status = resp.status();
            warn!(player_id, %status, "claim token NX-create rejected");
            Err(())
        }
        Err(e) => {
            warn!(player_id, error = %e, "claim token NX-create failed");
            Err(())
        }
    }
}

/// Persist a TOFU claim token. Fire-and-forget.
#[allow(dead_code)]
pub fn save_claim_token(player_id: String, claim_token: String) {
    let Some((url, auth_token)) = config() else { return };
    if player_id.trim().is_empty() || claim_token.is_empty() {
        return;
    }
    let key = format!("{CLAIM_PREFIX}{player_id}");
    let auth_token = auth_token.clone();
    let endpoint = format!("{url}/pipeline");
    let cmds: Vec<Vec<String>> = vec![vec!["SET".into(), key, claim_token]];

    tokio::spawn(async move {
        match http()
            .post(&endpoint)
            .bearer_auth(&auth_token)
            .json(&cmds)
            .send()
            .await
        {
            Ok(resp) if resp.status().is_success() => {
                debug!(player_id = %player_id, "claim token saved");
            }
            Ok(resp) => {
                let status = resp.status();
                warn!(%status, "claim token save rejected");
            }
            Err(e) => warn!(error = %e, "claim token save failed"),
        }
    });
}

/// Save player state to Redis. Fire-and-forget (spawns a detached task).
/// The payload is `sanitize`d first — it is fully client-authored and must
/// never reach Redis unbounded.
pub fn save(player_id: String, mut state: PlayerProgress) {
    let Some((url, token)) = config() else { return };
    if player_id.trim().is_empty() {
        return;
    }
    state.sanitize();
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
