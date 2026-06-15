//! Persistance via API REST Upstash Redis -- extrait verbatim de player_state.rs au refactor (deplacement, zero changement de logique).
use std::sync::OnceLock;
use tracing::{debug, warn};
use super::{CLAIM_PREFIX, KEY_PREFIX, PlayerProgress};

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

/// POST a command pipeline to the Upstash REST `/pipeline` endpoint. Centralises
/// the `format!("{url}/pipeline")` + `bearer_auth` + `json` + `send` boilerplate
/// that every pipeline caller repeated. Returns:
///   `None`           — Redis isn't configured (no URL/token)
///   `Some(Ok(resp))` — the HTTP round-trip completed (caller checks the status)
///   `Some(Err(e))`   — the send itself failed (transport error; caller may log)
/// The body is intentionally NOT parsed here: callers differ (some want only the
/// status, some the parsed JSON), so each handles the response as it needs.
async fn pipeline_send(cmds: &[Vec<String>]) -> Option<reqwest::Result<reqwest::Response>> {
    let (url, token) = config()?;
    let endpoint = format!("{url}/pipeline");
    Some(http().post(&endpoint).bearer_auth(token).json(cmds).send().await)
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
    let player_key = format!("{KEY_PREFIX}{player_id}");
    let claim_key = format!("{CLAIM_PREFIX}{player_id}");
    let cmds: Vec<Vec<String>> = vec![
        vec!["DEL".into(), player_key],
        vec!["DEL".into(), claim_key],
    ];
    matches!(pipeline_send(&cmds).await, Some(Ok(resp)) if resp.status().is_success())
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
    let cmds: Vec<Vec<String>> = vec![vec!["GET".into(), key.to_string()]];
    let resp = match pipeline_send(&cmds).await {
        Some(Ok(resp)) if resp.status().is_success() => resp,
        _ => return None,
    };
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
    let cmds: Vec<Vec<String>> = vec![vec!["SET".into(), key.to_string(), val.to_string(), "NX".into()]];
    match pipeline_send(&cmds).await {
        Some(Ok(resp)) if resp.status().is_success() => {
            let body: serde_json::Value = resp.json().await.map_err(|_| ())?;
            // Upstash returns [{"result":"OK"}] when set, [{"result":null}] when NX rejected.
            let entry = body.as_array().and_then(|a| a.first()).ok_or(())?;
            let result = entry.get("result").ok_or(())?;
            Ok(result.as_str() == Some("OK"))
        }
        Some(Ok(resp)) => {
            let status = resp.status();
            warn!(%status, "set_nx rejected");
            Err(())
        }
        Some(Err(e)) => {
            warn!(error = %e, "set_nx failed");
            Err(())
        }
        None => Err(()),
    }
}

/// Best-effort `DEL key`. Returns true on a 2xx from Upstash. Used to roll back
/// a half-written multi-key write (e.g. an account row whose player-link failed).
pub(crate) async fn del(key: &str) -> bool {
    let cmds: Vec<Vec<String>> = vec![vec!["DEL".into(), key.to_string()]];
    matches!(pipeline_send(&cmds).await, Some(Ok(resp)) if resp.status().is_success())
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
