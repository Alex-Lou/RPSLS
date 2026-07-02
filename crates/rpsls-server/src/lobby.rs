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

    /// Try to join a lobby. Returns the host session if found, removing the
    /// lobby (it's consumed).
    pub fn join_lobby(&self, code: &str) -> Option<Lobby> {
        let key = code.to_uppercase();
        self.lobbies.remove(&key).map(|(_, lobby)| lobby)
    }

    /// Remove a lobby hosted by a given session id (e.g. on disconnect).
    pub fn remove_lobby_by_host(&self, session_id: &str) {
        self.lobbies.retain(|_, l| l.host.id != session_id);
    }

    /// Push a player into the matchmaking queue. If a compatible opponent
    /// is already waiting, return them and pop from the queue.
    pub async fn join_or_match(&self, player: Arc<Session>, best_of: u8) -> Option<Arc<Session>> {
        let mut q = self.queue.lock().await;
        // Find first entry with same best_of and not the same session.
        if let Some(idx) = q
            .iter()
            .position(|e| e.best_of == best_of && e.player.id != player.id)
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
        if let Some(idx) = q
            .iter()
            .position(|e| e.best_of == win_to && e.player.id != player.id)
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
        if let Some(idx) = q.iter().position(|e| {
            e.win_to == win_to
                && e.variant == variant
                && e.ruleset_hash == ruleset_hash
                && e.player.id != player.id
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
