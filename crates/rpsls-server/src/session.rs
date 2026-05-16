//! A connected client session — wraps the WebSocket send half and metadata.

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
    pub tx: Tx,
    /// Set to true when this session is in an active match. Used by the
    /// lobby/queue to avoid double-matching.
    pub in_match: AtomicBool,
}

impl Session {
    pub fn new(id: String, nickname: String, tx: Tx) -> Self {
        Self {
            id,
            nickname: Mutex::new(nickname),
            tx,
            in_match: AtomicBool::new(false),
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

    pub fn set_in_match(&self, v: bool) {
        self.in_match.store(v, Ordering::SeqCst);
    }

    #[allow(dead_code)]
    pub fn is_in_match(&self) -> bool {
        self.in_match.load(Ordering::SeqCst)
    }
}
