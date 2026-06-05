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

use std::sync::OnceLock;

use tracing::{debug, warn};

/// LP awarded for an online win / lost on an online loss, and the starting LP
/// for a player's first appearance on the ladder. Mirrors the client rewards.
const WIN_LP: i32 = 20;
const LOSS_LP: i32 = -15;
const START_LP: i32 = 1000;

const KEY: &str = "leaderboard";
const NAMES: &str = "leaderboard:names";

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
