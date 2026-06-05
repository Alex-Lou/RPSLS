//! A connected client session — wraps the WebSocket send half and metadata.

use std::net::IpAddr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use tokio::sync::mpsc;

use crate::protocol::ServerMessage;

/// Channel sender for messages to be forwarded to the WebSocket.
pub type Tx = mpsc::UnboundedSender<ServerMessage>;

#[derive(Debug)]
pub struct Session {
    pub id: String,
    pub nickname: Mutex<String>,
    /// Stable client-supplied id (from Hello). Used to attribute global
    /// leaderboard entries across sessions/devices. Empty for old clients.
    pub player_id: Mutex<String>,
    pub tx: Tx,
    /// Set to true when this session is in an active match. Used by the
    /// lobby/queue to avoid double-matching.
    pub in_match: AtomicBool,
    /// Peer IP — used by the lobby brute-force tracker so a single
    /// attacker can't dodge the cap by reconnecting (which would yield a
    /// fresh session_id). Behind the Render proxy this resolves via the
    /// X-Forwarded-For header upstream.
    pub peer_ip: IpAddr,
}

impl Session {
    pub fn new(id: String, nickname: String, tx: Tx, peer_ip: IpAddr) -> Self {
        Self {
            id,
            nickname: Mutex::new(nickname),
            player_id: Mutex::new(String::new()),
            tx,
            in_match: AtomicBool::new(false),
            peer_ip,
        }
    }

    pub fn send(&self, msg: ServerMessage) {
        let _ = self.tx.send(msg);
    }

    pub fn nickname(&self) -> String {
        self.nickname.lock().unwrap().clone()
    }

    pub fn set_nickname(&self, name: String) {
        *self.nickname.lock().unwrap() = name;
    }

    pub fn player_id(&self) -> String {
        self.player_id.lock().unwrap().clone()
    }

    pub fn set_player_id(&self, id: String) {
        *self.player_id.lock().unwrap() = id;
    }

    pub fn set_in_match(&self, v: bool) {
        self.in_match.store(v, Ordering::SeqCst);
    }

    #[allow(dead_code)]
    pub fn is_in_match(&self) -> bool {
        self.in_match.load(Ordering::SeqCst)
    }
}
