//! Wire protocol for the RPSLS multiplayer server.
//!
//! All messages are JSON with a `type` discriminator. Mirrored in TypeScript
//! at `app/src/online.ts` — keep both in sync.

use rpsls_core::constellation::{LanePlay, LaneResult};
use rpsls_core::{Move, Outcome};
use serde::{Deserialize, Serialize};

/* ──────────── Client → Server ──────────── */

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMessage {
    /// Hello — first message client sends after connecting.
    Hello { nickname: String },

    /// Create a private lobby. Server replies with a 6-char code.
    CreateLobby { best_of: u8 },

    /// Join an existing private lobby by its code.
    JoinLobby { code: String },

    /// Enter the public matchmaking queue.
    JoinQueue { best_of: u8 },

    /// Leave the queue / lobby (cancel waiting).
    Cancel,

    /// Play a move in the current match.
    PlayMove { mv: Move },

    /// Enter the public matchmaking queue for a Constellation Lanes match.
    /// `win_to` = number of round-wins needed (e.g. 3 → best-of-5).
    JoinLanesQueue { win_to: u8 },

    /// Submit the 3 lane plays for the current Lanes round. Order is left
    /// to right (lane 0, lane 1, lane 2).
    PlayLanes { plays: Vec<LanePlay> },

    /// Quit the current match (forfeit). Works for both classic and lanes.
    LeaveMatch,

    /// Send a quick emoji reaction to the opponent.
    Chat { emoji: String },

    /// Keep-alive heartbeat.
    Ping,
}

/* ──────────── Server → Client ──────────── */

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    /// Welcome — assigned a session id.
    Welcome { session_id: String },

    /// Your private lobby is open and waiting for an opponent.
    LobbyCreated { code: String, best_of: u8 },

    /// You're in the matchmaking queue; this is your queue position.
    Queued { position: u32 },

    /// A match has been found and is starting.
    MatchFound {
        match_id: String,
        opponent: OpponentInfo,
        best_of: u8,
        you_are: PlayerSlot,
    },

    /// New round started; client should prompt for move.
    RoundStart { round_no: u32, deadline_ms: u32 },

    /// Round result with both moves revealed.
    RoundResult {
        round_no: u32,
        a_move: Move,
        b_move: Move,
        outcome: Outcome,
        score_a: u8,
        score_b: u8,
    },

    /// Match has ended.
    MatchEnd {
        winner: Option<PlayerSlot>,
        score_a: u8,
        score_b: u8,
        forfeit: bool,
    },

    /// Opponent disconnected before the match ended.
    OpponentLeft,

    /* ──────────── Constellation Lanes (Phase 1) ──────────── */

    /// Lanes match has been found and is starting.
    LanesMatchFound {
        match_id: String,
        opponent: OpponentInfo,
        you_are: PlayerSlot,
        /// How many lanes per round (3 in Phase 1).
        lanes: u8,
        /// Number of round-wins required to win the match (e.g. 3 for bo5).
        win_to: u8,
    },

    /// New Lanes round started — client should show the 3-lane picker.
    LanesRoundStart { round_no: u32, deadline_ms: u32 },

    /// Lanes round resolved — both sides revealed simultaneously.
    LanesRoundResult {
        round_no: u32,
        a_plays: Vec<LanePlay>,
        b_plays: Vec<LanePlay>,
        lane_results: Vec<LaneResult>,
        /// Total points this round (Phase 1: = lanes won this round).
        a_points: u8,
        b_points: u8,
        /// Cumulative round wins so far.
        round_wins_a: u8,
        round_wins_b: u8,
    },

    /// Lanes match has ended.
    LanesMatchEnd {
        winner: Option<PlayerSlot>,
        round_wins_a: u8,
        round_wins_b: u8,
        forfeit: bool,
    },

    /// Opponent sent a chat emoji.
    Chat { from: PlayerSlot, emoji: String },

    /// Server-side error or rule violation.
    Error { code: String, message: String },

    /// Heartbeat reply.
    Pong,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PlayerSlot {
    A,
    B,
}

#[derive(Debug, Clone, Serialize)]
pub struct OpponentInfo {
    pub nickname: String,
}
