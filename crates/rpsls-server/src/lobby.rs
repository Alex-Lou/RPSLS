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

#[derive(Debug, Default)]
pub struct LobbyManager {
    /// Open private lobbies, by code.
    lobbies: DashMap<LobbyCode, Lobby>,
    /// Public matchmaking queue. Simple FIFO per `best_of` bucket would be
    /// nicer but a single Vec is fine for an MVP — we scan it.
    queue: Mutex<Vec<QueueEntry>>,
}

impl LobbyManager {
    pub fn new() -> Self {
        Self::default()
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
    pub async fn join_or_match(
        &self,
        player: Arc<Session>,
        best_of: u8,
    ) -> Option<Arc<Session>> {
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
}
