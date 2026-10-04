//! Lobby manager — private 6-char-code lobbies + public matchmaking queue.

use std::sync::Arc;

use dashmap::DashMap;
use rand::Rng;
use tokio::sync::Mutex;

use crate::session::Session;

/// 6-character lobby code, e.g. "FR4G7K".
pub type LobbyCode = String;

#[derive(Debug)]
pub struct Lobby {
    #[allow(dead_code)]
    pub code: LobbyCode,
    pub host: Arc<Session>,
    pub best_of: u8,
}

#[derive(Debug)]
pub struct QueueEntry {
    pub player: Arc<Session>,
    pub best_of: u8,
}

/// File CCG (Pro/Classée) — comme QueueEntry mais avec la clé d'appariement
/// étendue : on n'apparie que deux joueurs de MÊME `variant` (Pro vs Pro),
/// MÊME `win_to` ET MÊME `ruleset_hash` (même version de règles → pas de desync).
#[derive(Debug)]
struct CcgQueueEntry {
    player: Arc<Session>,
    win_to: u8,
    variant: String,
    ruleset_hash: String,
}

/// Issue d'une tentative `join_lobby`.
pub enum JoinLobby {
    /// Salon trouvé et consommé.
    Joined(Lobby),
    NotFound,
    /// Salon de ce même joueur : refusé, le salon reste ouvert.
    SelfMatch,
}

/// Même joueur : même session, OU même `player_id` non vide (deux onglets /
/// appareils). On n'apparie jamais un joueur contre lui-même (double crédit).
fn same_player(a: &Session, b: &Session) -> bool {
    if a.id == b.id {
        return true;
    }
    let pid = a.player_id();
    !pid.is_empty() && pid == b.player_id()
}

#[derive(Debug, Default)]
pub struct LobbyManager {
    /// Open private lobbies, by code.
    lobbies: DashMap<LobbyCode, Lobby>,
    /// Public matchmaking queue. Simple FIFO per `best_of` bucket would be
    /// nicer but a single Vec is fine for an MVP — we scan it.
    queue: Mutex<Vec<QueueEntry>>,
    /// Separate queue for Constellation Lanes matches — same shape but a
    /// different bucket so it never crosses with classic match queueing.
    lanes_queue: Mutex<Vec<QueueEntry>>,
    /// Separate queue for CCG (Constellation Pro/Classée) matches — its own
    /// bucket (blind relay, cf. ccg_engine), clé d'appariement étendue.
    ccg_queue: Mutex<Vec<CcgQueueEntry>>,
}

impl LobbyManager {
    pub fn new() -> Self {
        Self::default()
    }

    /// Number of open private lobbies right now. Used by the create_lobby
    /// handler to refuse new lobbies past a configured ceiling so a scripted
    /// attacker can't exhaust server memory by spamming `create_lobby`.
    pub fn lobby_count(&self) -> usize {
        self.lobbies.len()
    }

    /// Create a private lobby and return its code.
    pub fn create_lobby(&self, host: Arc<Session>, best_of: u8) -> LobbyCode {
        // Try a few random codes until we find an unused one.
        let mut rng = rand::thread_rng();
        loop {
            let code: String = (0..6)
                .map(|_| {
                    const ALPHABET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0,O,1,I
                    let i = rng.gen_range(0..ALPHABET.len());
                    ALPHABET[i] as char
                })
                .collect();
            if !self.lobbies.contains_key(&code) {
                self.lobbies.insert(
                    code.clone(),
                    Lobby {
                        code: code.clone(),
                        host,
                        best_of,
                    },
                );
                return code;
            }
        }
    }

    /// Try to join a lobby. Returns the lobby if found, removing it (it's
    /// consumed) — sauf si son hôte est le même joueur que `joiner`.
    pub fn join_lobby(&self, code: &str, joiner: &Session) -> JoinLobby {
        let key = code.to_uppercase();
        match self.lobbies.remove_if(&key, |_, l| !same_player(&l.host, joiner)) {
            Some((_, lobby)) => JoinLobby::Joined(lobby),
            None if self.lobbies.contains_key(&key) => JoinLobby::SelfMatch,
            None => JoinLobby::NotFound,
        }
    }

    /// Remove a lobby hosted by a given session id (e.g. on disconnect).
    pub fn remove_lobby_by_host(&self, session_id: &str) {
        self.lobbies.retain(|_, l| l.host.id != session_id);
    }

    /// Push a player into the matchmaking queue. If a compatible opponent
    /// is already waiting, return them and pop from the queue.
    pub async fn join_or_match(&self, player: Arc<Session>, best_of: u8) -> Option<Arc<Session>> {
        let mut q = self.queue.lock().await;
        // Re-join = on remplace l'ancienne entrée (pas de doublons dans la file).
        q.retain(|e| e.player.id != player.id);
        // Find first entry with same best_of and not the same player.
        if let Some(idx) = q
            .iter()
            .position(|e| e.best_of == best_of && !same_player(&e.player, &player))
        {
            let entry = q.remove(idx);
            return Some(entry.player);
        }
        q.push(QueueEntry { player, best_of });
        None
    }

    /// Remove a session from the queue (cancel waiting).
    pub async fn leave_queue(&self, session_id: &str) {
        let mut q = self.queue.lock().await;
        q.retain(|e| e.player.id != session_id);
    }

    pub async fn queue_position(&self, session_id: &str) -> u32 {
        let q = self.queue.lock().await;
        q.iter()
            .position(|e| e.player.id == session_id)
            .map(|i| (i + 1) as u32)
            .unwrap_or(0)
    }

    /* ──────────── Lanes queue (Phase 1) ──────────── */

    /// Same semantics as [`join_or_match`] but for the Constellation Lanes
    /// queue. `win_to` is the number of round-wins required (3 → bo5).
    pub async fn join_or_match_lanes(
        &self,
        player: Arc<Session>,
        win_to: u8,
    ) -> Option<Arc<Session>> {
        let mut q = self.lanes_queue.lock().await;
        q.retain(|e| e.player.id != player.id);
        if let Some(idx) = q
            .iter()
            .position(|e| e.best_of == win_to && !same_player(&e.player, &player))
        {
            let entry = q.remove(idx);
            return Some(entry.player);
        }
        q.push(QueueEntry {
            player,
            best_of: win_to,
        });
        None
    }

    pub async fn leave_lanes_queue(&self, session_id: &str) {
        let mut q = self.lanes_queue.lock().await;
        q.retain(|e| e.player.id != session_id);
    }

    pub async fn lanes_queue_position(&self, session_id: &str) -> u32 {
        let q = self.lanes_queue.lock().await;
        q.iter()
            .position(|e| e.player.id == session_id)
            .map(|i| (i + 1) as u32)
            .unwrap_or(0)
    }

    /// CCG matchmaking — bucket dédié. N'apparie que deux joueurs de MÊME
    /// `variant` (Pro/Classée), MÊME `win_to` ET MÊME `ruleset_hash` (même
    /// version de règles) → aucune paire ne peut desync par skew de version.
    pub async fn join_or_match_ccg(
        &self,
        player: Arc<Session>,
        win_to: u8,
        variant: String,
        ruleset_hash: String,
    ) -> Option<Arc<Session>> {
        let mut q = self.ccg_queue.lock().await;
        q.retain(|e| e.player.id != player.id);
        if let Some(idx) = q.iter().position(|e| {
            e.win_to == win_to
                && e.variant == variant
                && e.ruleset_hash == ruleset_hash
                && !same_player(&e.player, &player)
        }) {
            let entry = q.remove(idx);
            return Some(entry.player);
        }
        q.push(CcgQueueEntry {
            player,
            win_to,
            variant,
            ruleset_hash,
        });
        None
    }

    pub async fn leave_ccg_queue(&self, session_id: &str) {
        let mut q = self.ccg_queue.lock().await;
        q.retain(|e| e.player.id != session_id);
    }

    pub async fn ccg_queue_position(&self, session_id: &str) -> u32 {
        let q = self.ccg_queue.lock().await;
        q.iter()
            .position(|e| e.player.id == session_id)
            .map(|i| (i + 1) as u32)
            .unwrap_or(0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn session(id: &str, pid: &str) -> Arc<Session> {
        let (tx, _rx) = tokio::sync::mpsc::channel(crate::session::OUTGOING_CAPACITY);
        let s = Session::new(id.into(), id.into(), tx, std::net::IpAddr::from([127, 0, 0, 1]));
        // Direct (pas set_player_id : il touche Redis).
        *s.player_id.lock().unwrap() = pid.into();
        Arc::new(s)
    }

    /// Deux onglets du même player_id ne s'apparient pas ; un tiers, si.
    #[tokio::test]
    async fn queues_never_match_a_player_against_itself() {
        let m = LobbyManager::new();
        let (tab1, tab2, other) = (session("s1", "p1"), session("s2", "p1"), session("s3", "p2"));
        assert!(m.join_or_match(tab1.clone(), 3).await.is_none());
        assert!(m.join_or_match(tab2.clone(), 3).await.is_none());
        assert_eq!(m.join_or_match(other.clone(), 3).await.unwrap().id, "s1");
        assert!(m.join_or_match_lanes(tab1.clone(), 3).await.is_none());
        assert!(m.join_or_match_lanes(tab2.clone(), 3).await.is_none());
        let ccg = |s: &Arc<Session>| m.join_or_match_ccg(s.clone(), 3, "arena".into(), "h".into());
        assert!(ccg(&tab1).await.is_none());
        assert!(ccg(&tab2).await.is_none());
        assert_eq!(ccg(&other).await.unwrap().id, "s1");
        // player_id vide (vieux client) : seules les sessions comptent.
        assert!(m.join_or_match(session("s4", ""), 5).await.is_none());
        assert!(m.join_or_match(session("s5", ""), 5).await.is_some());
    }

    /// Re-join de la même session : une seule entrée dans la file.
    #[tokio::test]
    async fn rejoining_a_queue_does_not_duplicate() {
        let m = LobbyManager::new();
        let s = session("s1", "p1");
        for _ in 0..3 {
            assert!(m.join_or_match(s.clone(), 3).await.is_none());
            assert!(m.join_or_match_lanes(s.clone(), 3).await.is_none());
        }
        assert_eq!(m.queue.lock().await.len(), 1);
        assert_eq!(m.lanes_queue.lock().await.len(), 1);
    }

    /// Rejoindre son propre salon (autre onglet) : refusé SANS consommer le salon.
    #[test]
    fn self_join_keeps_the_lobby_open() {
        let m = LobbyManager::new();
        let code = m.create_lobby(session("s1", "p1"), 3);
        assert!(matches!(m.join_lobby(&code, &session("s2", "p1")), JoinLobby::SelfMatch));
        assert!(matches!(m.join_lobby(&code, &session("s1", "p1")), JoinLobby::SelfMatch));
        assert!(matches!(m.join_lobby(&code, &session("s3", "p2")), JoinLobby::Joined(_)));
        assert!(matches!(m.join_lobby(&code, &session("s3", "p2")), JoinLobby::NotFound));
    }
}
