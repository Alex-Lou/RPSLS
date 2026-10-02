//! Global leaderboard writes (Upstash Redis REST API).
//!
//! Server-authoritative: only the server (which witnessed the match) writes
//! LP, using the FULL Upstash token from the environment. The app ships only a
//! read-only token, so the ladder can't be faked client-side.
//!
//! The board is a sorted set `leaderboard` (member = client player_id, score =
//! LP) plus a hash `leaderboard:names` (player_id -> nickname). New players are
//! seeded at 1000 LP (NX) then the match delta is applied.
//!
//! Writes are fire-and-forget: a failed/absent leaderboard never affects the
//! live match. If the env vars aren't set the whole thing is a no-op.
//!
//! Reads are served to the app over HTTP (`GET /leaderboard`,
//! `GET /leaderboard/rank/:id`) so the client never holds an Upstash token:
//! a read-only Upstash token can read EVERY key of the database (claim tokens,
//! accounts), not just the ladder.

use std::collections::HashSet;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use axum::{extract::Path, http::StatusCode, Json};
use serde::Serialize;
use tracing::{debug, warn};

/// LP awarded for an online win / lost on an online loss, and the starting LP
/// for a player's first appearance on the ladder. Mirrors the client rewards.
const WIN_LP: i32 = 20;
const LOSS_LP: i32 = -15;
const START_LP: i32 = 1000;

const KEY: &str = "leaderboard";
const NAMES: &str = "leaderboard:names";

/// Rows returned by `GET /leaderboard`.
const TOP_LIMIT: usize = 100;
/// Over-fetch factor so ~TOP_LIMIT distinct players survive nickname collapse.
const TOP_FETCH: usize = TOP_LIMIT * 3;
/// The top list is cached this long — every open of the page would otherwise
/// cost 2 Upstash requests.
const TOP_CACHE_TTL: Duration = Duration::from_secs(30);
/// Per-request ceiling on Upstash reads, so a stalled Upstash can't pile up
/// pending HTTP handlers.
const READ_TIMEOUT: Duration = Duration::from_secs(5);

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

/// True when the leaderboard is configured (used for a startup log line).
pub fn enabled() -> bool {
    config().is_some()
}

/// Record a decisive online result on the global ladder.
///
/// No-op when the leaderboard isn't configured or when either player has no
/// stable id (old client). Spawns a detached task — never blocks the match.
pub fn record_result(
    winner_id: String,
    winner_nick: String,
    loser_id: String,
    loser_nick: String,
) {
    let Some((url, token)) = config() else { return };
    if winner_id.trim().is_empty() || loser_id.trim().is_empty() {
        return;
    }
    let endpoint = format!("{url}/pipeline");
    let token = token.clone();

    // One pipeline call: seed each player at START_LP if new (NX), apply the
    // LP delta, and refresh their display name.
    let cmds: Vec<Vec<String>> = vec![
        vec!["ZADD".into(), KEY.into(), "NX".into(), START_LP.to_string(), winner_id.clone()],
        vec!["ZINCRBY".into(), KEY.into(), WIN_LP.to_string(), winner_id.clone()],
        vec!["HSET".into(), NAMES.into(), winner_id.clone(), winner_nick],
        vec!["ZADD".into(), KEY.into(), "NX".into(), START_LP.to_string(), loser_id.clone()],
        vec!["ZINCRBY".into(), KEY.into(), LOSS_LP.to_string(), loser_id.clone()],
        vec!["HSET".into(), NAMES.into(), loser_id.clone(), loser_nick],
    ];

    tokio::spawn(async move {
        match http().post(&endpoint).bearer_auth(&token).json(&cmds).send().await {
            Ok(resp) if resp.status().is_success() => {
                debug!(winner = %winner_id, loser = %loser_id, "leaderboard updated");
            }
            Ok(resp) => {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                warn!(%status, %body, "leaderboard write rejected");
            }
            Err(e) => warn!(error = %e, "leaderboard write failed"),
        }
    });
}

// ──────────────────────────────────────────────────────────────────────────
// Reads (HTTP API for the app)
// ──────────────────────────────────────────────────────────────────────────

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct LeaderboardEntry {
    pub rank: u32,
    pub id: String,
    pub nickname: String,
    pub lp: i64,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct MyRank {
    pub rank: u32,
    pub lp: i64,
}

/// One Upstash REST command → its `result` field.
async fn read_cmd(args: Vec<String>) -> Result<serde_json::Value, StatusCode> {
    let Some((url, token)) = config() else { return Err(StatusCode::SERVICE_UNAVAILABLE) };
    let resp = http()
        .post(url.as_str())
        .bearer_auth(token)
        .timeout(READ_TIMEOUT)
        .json(&args)
        .send()
        .await
        .map_err(|e| {
            warn!(error = %e, "leaderboard read failed");
            StatusCode::BAD_GATEWAY
        })?;
    if !resp.status().is_success() {
        warn!(status = %resp.status(), "leaderboard read rejected");
        return Err(StatusCode::BAD_GATEWAY);
    }
    let mut body: serde_json::Value = resp.json().await.map_err(|e| {
        warn!(error = %e, "leaderboard read: bad JSON");
        StatusCode::BAD_GATEWAY
    })?;
    Ok(body["result"].take())
}

/// Upstash returns scores as strings ("1020") — accept numbers too.
fn as_lp(v: &serde_json::Value) -> Option<i64> {
    match v {
        serde_json::Value::String(s) => s.parse::<f64>().ok().map(|f| f as i64),
        serde_json::Value::Number(n) => n.as_f64().map(|f| f as i64),
        _ => None,
    }
}

/// Collapse same-nickname duplicates (one physical player can own several
/// ids, e.g. an id orphaned by an old reinstall), keeping the highest-LP row,
/// then re-rank. Input is LP-desc (ZREVRANGE), so the first time a nickname
/// is seen is its best entry. Blank names fall back to "Anonyme".
fn collapse_top(rows: Vec<(String, i64, Option<String>)>, limit: usize) -> Vec<LeaderboardEntry> {
    let mut seen = HashSet::new();
    let mut out = Vec::new();
    for (id, lp, name) in rows {
        let nickname = name
            .map(|n| n.trim().to_string())
            .filter(|n| !n.is_empty())
            .unwrap_or_else(|| "Anonyme".to_string());
        if seen.insert(nickname.to_lowercase()) {
            out.push((id, nickname, lp));
        }
    }
    out.sort_by_key(|e| std::cmp::Reverse(e.2));
    out.into_iter()
        .take(limit)
        .enumerate()
        .map(|(i, (id, nickname, lp))| LeaderboardEntry { rank: i as u32 + 1, id, nickname, lp })
        .collect()
}

async fn load_top() -> Result<Vec<LeaderboardEntry>, StatusCode> {
    let flat = read_cmd(vec![
        "ZREVRANGE".into(),
        KEY.into(),
        "0".into(),
        (TOP_FETCH - 1).to_string(),
        "WITHSCORES".into(),
    ])
    .await?;
    let flat = flat.as_array().cloned().unwrap_or_default();
    let mut ids = Vec::new();
    let mut lps = Vec::new();
    for pair in flat.chunks_exact(2) {
        if let (Some(id), Some(lp)) = (pair[0].as_str(), as_lp(&pair[1])) {
            ids.push(id.to_string());
            lps.push(lp);
        }
    }
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let mut hmget = vec!["HMGET".to_string(), NAMES.to_string()];
    hmget.extend(ids.iter().cloned());
    // Names are cosmetic: a failed HMGET degrades to "Anonyme", not an error.
    let names = read_cmd(hmget).await.ok().and_then(|v| v.as_array().cloned()).unwrap_or_default();
    let rows = ids
        .into_iter()
        .zip(lps)
        .enumerate()
        .map(|(i, (id, lp))| (id, lp, names.get(i).and_then(|n| n.as_str()).map(str::to_string)))
        .collect();
    Ok(collapse_top(rows, TOP_LIMIT))
}

/// `GET /leaderboard` — top players, highest LP first (cached TOP_CACHE_TTL).
pub async fn http_top() -> Result<Json<Vec<LeaderboardEntry>>, StatusCode> {
    static CACHE: Mutex<Option<(Instant, Vec<LeaderboardEntry>)>> = Mutex::new(None);
    // Std Mutex: each lock is taken and released in a plain fn, never across an await.
    let cached = || {
        let guard = CACHE.lock().unwrap_or_else(|e| e.into_inner());
        guard.as_ref().filter(|(at, _)| at.elapsed() < TOP_CACHE_TTL).map(|(_, top)| top.clone())
    };
    if let Some(top) = cached() {
        return Ok(Json(top));
    }
    let top = load_top().await?;
    *CACHE.lock().unwrap_or_else(|e| e.into_inner()) = Some((Instant::now(), top.clone()));
    Ok(Json(top))
}

/// `GET /leaderboard/rank/:id` — the caller's rank + LP, `null` when absent.
pub async fn http_rank(Path(raw_id): Path<String>) -> Result<Json<Option<MyRank>>, StatusCode> {
    let id = crate::hello::validate_player_id(&raw_id).ok_or(StatusCode::BAD_REQUEST)?;
    let (rank, score) = tokio::try_join!(
        read_cmd(vec!["ZREVRANK".into(), KEY.into(), id.clone()]),
        read_cmd(vec!["ZSCORE".into(), KEY.into(), id]),
    )?;
    let mine = match (rank.as_u64(), as_lp(&score)) {
        (Some(r), Some(lp)) => Some(MyRank { rank: r as u32 + 1, lp }),
        _ => None,
    };
    Ok(Json(mine))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn row(id: &str, lp: i64, name: Option<&str>) -> (String, i64, Option<String>) {
        (id.to_string(), lp, name.map(str::to_string))
    }

    #[test]
    fn collapse_keeps_best_entry_per_nickname_and_reranks() {
        let out = collapse_top(
            vec![
                row("a", 1200, Some("Alex")),
                row("b", 1100, Some("alex ")), // same player, older id
                row("c", 1050, Some("Zoe")),
            ],
            10,
        );
        assert_eq!(
            out,
            vec![
                LeaderboardEntry { rank: 1, id: "a".into(), nickname: "Alex".into(), lp: 1200 },
                LeaderboardEntry { rank: 2, id: "c".into(), nickname: "Zoe".into(), lp: 1050 },
            ]
        );
    }

    #[test]
    fn collapse_names_blank_as_anonyme_and_respects_limit() {
        let out = collapse_top(
            vec![row("a", 900, None), row("b", 800, Some("  ")), row("c", 700, Some("Bo"))],
            1,
        );
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].nickname, "Anonyme");
    }

    #[test]
    fn lp_parses_upstash_string_scores() {
        assert_eq!(as_lp(&serde_json::json!("1020")), Some(1020));
        assert_eq!(as_lp(&serde_json::json!(985)), Some(985));
        assert_eq!(as_lp(&serde_json::Value::Null), None);
    }
}
