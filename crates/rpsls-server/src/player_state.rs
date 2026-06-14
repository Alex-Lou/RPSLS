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
    /// Premium currency (✦). Synced so unspent stars survive a reinstall — same
    /// durability guarantee as eclats/dust.
    #[serde(default)]
    pub stars: u64,
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
    /// One-time quest claim ids — union-merged on the client so rewards can't
    /// be re-claimed after a reinstall.
    #[serde(default)]
    pub claimed_quests: Vec<String>,
    #[serde(default)]
    pub ranked_deck: Vec<String>,
    /// Arena (Constellation Pro) deck — separate from Classé. Synced so it
    /// survives a reinstall exactly like `ranked_deck`. Alex 2026-06-13: Arena
    /// data was being SILENTLY DROPPED server-side because this field (and the
    /// arena_* record below) were missing from the struct — serde ignores the
    /// `arenaDeck` the client sends, so the deck only ever lived in localStorage
    /// and was lost on every reinstall.
    #[serde(default)]
    pub arena_deck: Vec<String>,
    /// Premium cosmetic sets the player has purchased. Synced (union) so a
    /// reinstall never loses paid sets — same durability guarantee as cards.
    #[serde(default)]
    pub owned_premium_sets: Vec<String>,
    #[serde(default)]
    pub season_number: u32,
    #[serde(default)]
    pub season_started_at: u64,
    #[serde(default)]
    pub win_streak: u32,
    /// Classé (classic 1v1) own ladder + record — cloud-saved like the rest of
    /// the progression so it survives reinstall and follows the player across
    /// devices.
    #[serde(default)]
    pub classe_lp: u64,
    #[serde(default)]
    pub classe_wins: u64,
    #[serde(default)]
    pub classe_losses: u64,
    #[serde(default)]
    pub classe_draws: u64,
    /// Constellation Pro (arena) record — cloud-saved like classe_* so the
    /// Arena win/loss/draw tally survives a reinstall. Was dropped server-side
    /// (field missing) → Arena stats never persisted (Alex 2026-06-13).
    #[serde(default)]
    pub arena_wins: u64,
    #[serde(default)]
    pub arena_losses: u64,
    #[serde(default)]
    pub arena_draws: u64,
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

    // ── Gameplay / accessibility prefs (0 / empty / false = "unset") ──
    #[serde(default)]
    pub difficulty: String,
    /// UI font scale multiplier (1.0 = default). 0.0 means "never set on this
    /// device" — the client only ADOPTS values >= 1.
    #[serde(default)]
    pub font_scale: f32,
    /// True once the player has explicitly picked a pad — gates the first-run
    /// chooser from popping back on a re-install.
    #[serde(default)]
    pub pad_chosen: bool,

    /// Recent match history (opaque JSON `MatchRecord`s, capped to 60 in
    /// sanitize). Synced so the player's match LOG + the chosen Voies survive a
    /// reinstall (Alex 2026-06-13: history was localStorage-only → lost on
    /// every reinstall). The server only stores/returns it — it never inspects
    /// the records.
    #[serde(default)]
    pub history: Vec<serde_json::Value>,
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
        self.stars = self.stars.min(MAX_NUM);
        self.wins = self.wins.min(MAX_NUM);
        self.losses = self.losses.min(MAX_NUM);
        self.draws = self.draws.min(MAX_NUM);
        // Classé runs its own ladder on the same 5000 ceiling as ranked.
        self.classe_lp = self.classe_lp.min(5_000);
        self.classe_wins = self.classe_wins.min(MAX_NUM);
        self.classe_losses = self.classe_losses.min(MAX_NUM);
        self.classe_draws = self.classe_draws.min(MAX_NUM);
        self.arena_wins = self.arena_wins.min(MAX_NUM);
        self.arena_losses = self.arena_losses.min(MAX_NUM);
        self.arena_draws = self.arena_draws.min(MAX_NUM);
        self.season_number = self.season_number.min(100_000);
        self.win_streak = self.win_streak.min(100_000);

        // 256 = bien au-dessus des ~79 cartes collectionnables (Alex 2026-06-13 :
        // 64 TRONQUAIT la collection d'un joueur avancé → cartes PERDUES au sync /
        // réinstall). Marge confortable pour les cartes futures ; les ids sont
        // courts (≤64 char) → coût Redis négligeable.
        cap_vec(&mut self.card_collection, 256, 64);
        cap_vec(&mut self.ranked_deck, 16, 64);
        cap_vec(&mut self.arena_deck, 16, 64);
        // History: bound the COUNT so the Redis blob stays small (each
        // MatchRecord is a few hundred bytes; 60 is plenty for a match log).
        // Opaque JSON — records are client-authored; the count cap is the guard.
        self.history.truncate(60);
        cap_vec(&mut self.owned_premium_sets, 32, 32);
        // Quests accumulate over seasons of play — 128 ids is plenty without
        // letting a tampered client blow up Redis storage.
        cap_vec(&mut self.claimed_quests, 128, 64);
        self.codex_claimed.truncate(32);
        if self.card_mastery.len() > 256 {
            let keep: std::collections::HashSet<String> =
                self.card_mastery.keys().take(256).cloned().collect();
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
        clamp_str(&mut self.difficulty, 16);
        // font_scale: NaN/Inf/negative → "unset" (0). Cap legit values at 2x
        // so a tampered client can't ship 1e30 and break the UI on adopt.
        if !self.font_scale.is_finite() || self.font_scale < 0.0 {
            self.font_scale = 0.0;
        } else if self.font_scale > 2.0 {
            self.font_scale = 2.0;
        }
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

/// Low-level Redis GET via the pipeline POST form (`[["GET", key]]`). Unlike the
/// URL-path `/get/{key}` form used elsewhere, the key travels in the JSON body —
/// so it's safe for keys containing characters that would need URL encoding
/// (e.g. an email in `account:{email}`). Returns the stored string, or None when
/// the key is missing / on any backend error. Crate-internal primitive reused by
/// the account module.
pub(crate) async fn get_raw(key: &str) -> Option<String> {
    let (url, token) = config()?;
    let endpoint = format!("{url}/pipeline");
    let cmds: Vec<Vec<String>> = vec![vec!["GET".into(), key.to_string()]];
    let resp = http().post(&endpoint).bearer_auth(token).json(&cmds).send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let body: serde_json::Value = resp.json().await.ok()?;
    // Pipeline form → [{"result": <value-or-null>}].
    let result = body.as_array()?.first()?.get("result")?;
    if result.is_null() {
        return None;
    }
    result.as_str().map(|s| s.to_string())
}

/// Atomic `SET key val NX` via the pipeline POST form. Returns:
///   `Ok(true)`  — the key was created (it did not exist)
///   `Ok(false)` — the key already existed (NX rejected the write)
///   `Err(())`   — Redis unreachable / config missing / malformed reply
/// The key travels in the JSON body, so arbitrary keys (e.g. `account:{email}`)
/// are safe. Single create-if-absent primitive shared by the claim-token,
/// account, and welcome-bonus flows.
pub(crate) async fn set_nx(key: &str, val: &str) -> Result<bool, ()> {
    let Some((url, token)) = config() else { return Err(()) };
    let endpoint = format!("{url}/pipeline");
    let cmds: Vec<Vec<String>> = vec![vec!["SET".into(), key.to_string(), val.to_string(), "NX".into()]];
    match http().post(&endpoint).bearer_auth(token).json(&cmds).send().await {
        Ok(resp) if resp.status().is_success() => {
            let body: serde_json::Value = resp.json().await.map_err(|_| ())?;
            // Upstash returns [{"result":"OK"}] when set, [{"result":null}] when NX rejected.
            let entry = body.as_array().and_then(|a| a.first()).ok_or(())?;
            let result = entry.get("result").ok_or(())?;
            Ok(result.as_str() == Some("OK"))
        }
        Ok(resp) => {
            let status = resp.status();
            warn!(%status, "set_nx rejected");
            Err(())
        }
        Err(e) => {
            warn!(error = %e, "set_nx failed");
            Err(())
        }
    }
}

/// Best-effort `DEL key`. Returns true on a 2xx from Upstash. Used to roll back
/// a half-written multi-key write (e.g. an account row whose player-link failed).
pub(crate) async fn del(key: &str) -> bool {
    let Some((url, token)) = config() else { return false };
    let endpoint = format!("{url}/pipeline");
    let cmds: Vec<Vec<String>> = vec![vec!["DEL".into(), key.to_string()]];
    http()
        .post(&endpoint)
        .bearer_auth(token)
        .json(&cmds)
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false)
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
    if player_id.trim().is_empty() {
        return Err(());
    }
    let new_token = uuid::Uuid::new_v4().to_string();
    let key = format!("{CLAIM_PREFIX}{player_id}");
    if set_nx(&key, &new_token).await? {
        Ok(Some(new_token))
    } else {
        Ok(None)
    }
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
