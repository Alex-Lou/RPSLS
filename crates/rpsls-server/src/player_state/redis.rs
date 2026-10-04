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
    // Délais BORNÉS : sans eux, un Upstash lent gardait indéfiniment les tâches
    // (et les verrous du portefeuille) → accumulation sous charge.
    CLIENT.get_or_init(|| {
        let b = reqwest::Client::builder()
            .connect_timeout(std::time::Duration::from_secs(3))
            .timeout(std::time::Duration::from_secs(8));
        // Tests : chaque #[tokio::test] a son runtime ; une connexion gardée en
        // pool par un runtime terminé faisait échouer (au hasard) le test suivant.
        #[cfg(test)]
        let b = b.pool_max_idle_per_host(0);
        b.build().unwrap_or_default()
    })
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

/// Load player state from Redis. This is awaited on Hello so the player gets
/// their state immediately.
///   `Ok(Some(_))` — row found;
///   `Ok(None)`    — no row (new player), or Redis not configured;
///   `Err(())`     — transport/HTTP error or an unreadable row.
/// Callers MUST NOT save (or authenticate the session) after `Err`: doing so
/// would overwrite the real progression with an empty state.
pub async fn load(player_id: &str) -> Result<Option<PlayerProgress>, ()> {
    let Some((url, token)) = config() else { return Ok(None) };
    if player_id.trim().is_empty() {
        return Ok(None);
    }
    let key = format!("{KEY_PREFIX}{player_id}");
    let endpoint = format!("{url}/get/{key}");

    match http().get(&endpoint).bearer_auth(token).send().await {
        Ok(resp) if resp.status().is_success() => {
            let body: serde_json::Value = resp.json().await.map_err(|e| {
                warn!(player_id, error = %e, "player state load: bad JSON");
            })?;
            let result = body.get("result").ok_or(())?;
            if result.is_null() {
                return Ok(None);
            }
            let json_str = result.as_str().ok_or(())?;
            match serde_json::from_str::<PlayerProgress>(json_str) {
                Ok(mut state) => {
                    // Defense-in-depth: a poisoned row (left over from before
                    // sanitize() was added to save(), or any future bug that
                    // bypasses it) must not flow back to the client unchecked.
                    // mergeServerState on the client takes Math.max — a leaked
                    // u64::MAX would permanently corrupt the local player state.
                    state.sanitize();
                    debug!(player_id, "player state loaded from Redis");
                    Ok(Some(state))
                }
                Err(e) => {
                    // Unreadable row = error, NOT "absent": treating it as a new
                    // player would let the next save overwrite it.
                    warn!(player_id, error = %e, "failed to deserialize player state");
                    Err(())
                }
            }
        }
        Ok(resp) => {
            let status = resp.status();
            warn!(player_id, %status, "player state load rejected");
            Err(())
        }
        Err(e) => {
            warn!(player_id, error = %e, "player state load failed");
            Err(())
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

/// Delete everything a GUEST player owns (state, claim token, wallet, activity
/// stamp) in one round-trip. Used by the 6-month inactive-user janitor, which
/// never calls it for an account-linked player.
pub async fn delete_player(player_id: &str) -> bool {
    let cmds: Vec<Vec<String>> = [KEY_PREFIX, CLAIM_PREFIX, "wallet:", SEEN_PREFIX, BORN_PREFIX]
        .iter()
        .map(|p| vec!["DEL".into(), format!("{p}{player_id}")])
        .collect();
    matches!(pipeline_send(&cmds).await, Some(Ok(resp)) if resp.status().is_success())
}

/// Dernière activité authentifiée (epoch ms), posée par le SERVEUR. Remplace
/// l'ancien `updatedAt` de la ligne player, écrit par le client (un client
/// pouvait y mettre n'importe quoi → compte supprimé par le janitor).
const SEEN_PREFIX: &str = "seen:";

/// Date de CRÉATION de l'identité (epoch ms), posée par le SERVEUR à la création
/// du jeton TOFU (`try_create_claim_token`). Absente = identité antérieure à ce
/// marquage → cf. `wallet::WALLET_LAUNCH_MS` (migration bornée vs portefeuille neuf).
const BORN_PREFIX: &str = "born:";

/// Date de création de l'identité : `Ok(None)` si jamais marquée (identité
/// ancienne), `Err` sur erreur backend.
pub async fn born_ms(player_id: &str) -> Result<Option<u64>, ()> {
    match get_opt(&format!("{BORN_PREFIX}{player_id}")).await? {
        None => Ok(None),
        Some(s) => s.parse().map(Some).map_err(|_| ()),
    }
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Note l'activité d'un joueur maintenant (fire-and-forget, une écriture par
/// authentification de session).
pub fn touch_seen(player_id: &str) {
    if player_id.is_empty() || !enabled() {
        return;
    }
    let key = format!("{SEEN_PREFIX}{player_id}");
    tokio::spawn(async move {
        if set_checked(&key, &now_ms().to_string()).await.is_err() {
            warn!(key = %key, "seen stamp NOT written");
        }
    });
}

/// Dernière activité connue : `Ok(None)` si jamais vue (joueur antérieur à ce
/// marquage), `Err` sur erreur backend (l'appelant ne supprime alors rien).
#[cfg(test)]
pub async fn read_seen(player_id: &str) -> Result<Option<u64>, ()> {
    match get_opt(&format!("{SEEN_PREFIX}{player_id}")).await? {
        None => Ok(None),
        Some(s) => s.parse().map(Some).map_err(|_| ()),
    }
}

/// `seen:{pid}` de PLUSIEURS joueurs en UNE commande MGET (janitor : une
/// requête par page de SCAN au lieu d'une par joueur — Upstash facture à la
/// commande). Même sémantique que `read_seen` par élément ; `Err(())` si le
/// backend échoue ou si la réponse est illisible (le janitor saute la page).
pub async fn read_seen_many(player_ids: &[&str]) -> Result<Vec<Option<u64>>, ()> {
    if player_ids.is_empty() {
        return Ok(Vec::new());
    }
    let mut cmd = Vec::with_capacity(player_ids.len() + 1);
    cmd.push("MGET".to_string());
    cmd.extend(player_ids.iter().map(|p| format!("{SEEN_PREFIX}{p}")));
    let resp = match pipeline_send(&[cmd]).await {
        Some(Ok(resp)) if resp.status().is_success() => resp,
        _ => return Err(()),
    };
    let body: serde_json::Value = resp.json().await.map_err(|_| ())?;
    let values = body.as_array().and_then(|a| a.first()).and_then(|r| r.get("result")).and_then(|r| r.as_array()).ok_or(())?;
    if values.len() != player_ids.len() {
        return Err(());
    }
    values
        .iter()
        .map(|v| match v {
            serde_json::Value::Null => Ok(None),
            serde_json::Value::String(s) => s.parse().map(Some).map_err(|_| ()),
            _ => Err(()),
        })
        .collect()
}

/// Pose `seen:{pid}` à `ms` (janitor : premier passage sur un joueur ancien).
pub async fn set_seen(player_id: &str, ms: u64) -> Result<(), ()> {
    set_checked(&format!("{SEEN_PREFIX}{player_id}"), &ms.to_string()).await
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

/// Like `get_raw`, but distinguishes a MISSING key (`Ok(None)`) from a backend
/// error (`Err(())`). Callers that would CREATE data on "missing" (e.g. the
/// wallet migration) must use this one: an Upstash outage must never pass for
/// "new player" and overwrite real data (same lesson as `load`, H4).
pub(crate) async fn get_opt(key: &str) -> Result<Option<String>, ()> {
    let cmds: Vec<Vec<String>> = vec![vec!["GET".into(), key.to_string()]];
    let resp = match pipeline_send(&cmds).await {
        Some(Ok(resp)) if resp.status().is_success() => resp,
        _ => return Err(()),
    };
    let body: serde_json::Value = resp.json().await.map_err(|_| ())?;
    let result = body.as_array().and_then(|a| a.first()).and_then(|e| e.get("result")).ok_or(())?;
    if result.is_null() {
        return Ok(None);
    }
    result.as_str().map(|s| Some(s.to_string())).ok_or(())
}

/// Awaited `SET key val`. `Err(())` on any backend failure — for writes whose
/// caller must know the outcome before replying (wallet operations).
pub(crate) async fn set_checked(key: &str, val: &str) -> Result<(), ()> {
    let cmds: Vec<Vec<String>> = vec![vec!["SET".into(), key.to_string(), val.to_string()]];
    match pipeline_send(&cmds).await {
        Some(Ok(resp)) if resp.status().is_success() => {
            let body: serde_json::Value = resp.json().await.map_err(|_| ())?;
            let ok = body.as_array().and_then(|a| a.first()).and_then(|e| e.get("result")).and_then(|r| r.as_str());
            if ok == Some("OK") { Ok(()) } else { Err(()) }
        }
        Some(Ok(resp)) => {
            warn!(status = %resp.status(), "set_checked rejected");
            Err(())
        }
        Some(Err(e)) => {
            warn!(error = %e, "set_checked failed");
            Err(())
        }
        None => Err(()),
    }
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
    // Horodatage de naissance AVANT le jeton (SET NX : jamais réécrit). Échec →
    // on refuse la création (transitoire) : sans `born:`, l'identité passerait
    // pour antérieure au lancement du portefeuille.
    set_nx(&format!("{BORN_PREFIX}{player_id}"), &now_ms().to_string()).await?;
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

#[cfg(test)]
mod tests {
    use super::*;

    /// H4 : `load` distingue « absent » (Ok(None)) d'une erreur (Err) — une ligne
    /// illisible ou un Upstash en erreur ne doit JAMAIS passer pour un nouveau
    /// joueur, sinon la sauvegarde suivante écrase la vraie progression.
    #[tokio::test]
    async fn load_distinguishes_absent_from_error() {
        // Faux Upstash partagé par tout le binaire (config lue une seule fois).
        crate::test_upstash::ensure();
        assert_eq!(load("absent").await.map(|p| p.is_none()), Ok(true));
        assert!(load("corrupt").await.is_err());
        assert!(load("upstash-down").await.is_err());
    }

    /// L'activité est horodatée par le SERVEUR (janitor des inactifs).
    #[tokio::test]
    async fn seen_stamp_roundtrip() {
        crate::test_upstash::ensure();
        assert_eq!(read_seen("never-seen").await, Ok(None));
        touch_seen("just-seen");
        tokio::time::sleep(std::time::Duration::from_millis(300)).await;
        let ts = read_seen("just-seen").await.unwrap().expect("seen stamp written");
        assert!(ts.abs_diff(now_ms()) < 60_000);
    }

    /// Lecture groupée (janitor) : même résultat que `read_seen`, dans l'ordre.
    #[tokio::test]
    async fn seen_many_matches_single_reads() {
        crate::test_upstash::ensure();
        set_seen("many-a", 111).await.unwrap();
        set_seen("many-c", 333).await.unwrap();
        assert_eq!(read_seen_many(&["many-a", "many-b", "many-c"]).await, Ok(vec![Some(111), None, Some(333)]));
        assert_eq!(read_seen_many(&[]).await, Ok(vec![]));
        crate::test_upstash::put("seen:many-bad", "pas-un-nombre");
        assert!(read_seen_many(&["many-a", "many-bad"]).await.is_err(), "valeur illisible → erreur, jamais « absent »");
    }
}
