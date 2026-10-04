//! A connected client session — wraps the WebSocket send half and metadata.

use std::net::IpAddr;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Mutex;

use tokio::sync::mpsc;

use crate::protocol::ServerMessage;

/// Channel sender for messages to be forwarded to the WebSocket. BORNÉ : un
/// client trop lent (ou qui ne lit plus) ne peut plus faire grossir la mémoire
/// du serveur sans limite — au-delà, les messages sont abandonnés.
pub type Tx = mpsc::Sender<ServerMessage>;

/// Capacité de la file d'envoi par connexion (largement au-dessus d'une rafale
/// légitime : état de match + chat + portefeuille).
pub const OUTGOING_CAPACITY: usize = 256;

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
    /// Client IP — used by the lobby brute-force tracker so a single
    /// attacker can't dodge the cap by reconnecting (which would yield a
    /// fresh session_id). Behind Render this is `security::client_ip`
    /// (CF-Connecting-IP), never the proxy's address.
    pub peer_ip: IpAddr,
    /// Nombre de Hello reçus sur CETTE connexion. Chaque Hello coûte ~4
    /// requêtes Upstash : on le plafonne (cf. MAX_HELLOS_PER_CONNECTION).
    pub hellos: AtomicU32,
}

/// Un client légitime envoie 1 Hello par connexion (une reconnexion ouvre une
/// nouvelle connexion). Marge pour un changement de pseudo en cours de route.
pub const MAX_HELLOS_PER_CONNECTION: u32 = 5;

impl Session {
    pub fn new(id: String, nickname: String, tx: Tx, peer_ip: IpAddr) -> Self {
        Self {
            id,
            nickname: Mutex::new(nickname),
            player_id: Mutex::new(String::new()),
            tx,
            in_match: AtomicBool::new(false),
            peer_ip,
            hellos: AtomicU32::new(0),
        }
    }

    pub fn send(&self, msg: ServerMessage) {
        match self.tx.try_send(msg) {
            Ok(()) | Err(mpsc::error::TrySendError::Closed(_)) => {}
            Err(mpsc::error::TrySendError::Full(_)) => {
                tracing::warn!(session_id = %self.id, "outgoing queue full — message dropped (client too slow)");
            }
        }
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

    /// Pose l'identité AUTHENTIFIÉE de la session (Hello, login, Google) et
    /// note l'activité côté serveur (`seen:{pid}`, lue par le janitor des
    /// comptes inactifs — jamais une date fournie par le client).
    pub fn set_player_id(&self, id: String) {
        crate::player_state::touch_seen(&id);
        *self.player_id.lock().unwrap() = id;
    }

    pub fn set_in_match(&self, v: bool) {
        self.in_match.store(v, Ordering::SeqCst);
    }
}
