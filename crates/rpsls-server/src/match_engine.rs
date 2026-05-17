//! Server-authoritative match engine.
//!
//! Each match runs as its own async task. It owns the two players' sessions,
//! receives their moves via channels, resolves rounds with `rpsls-core`, and
//! broadcasts results.

use std::sync::Arc;
use std::time::Duration;

use rpsls_core::{Match, MatchStatus, Move};
use tokio::sync::mpsc;
use tokio::time::timeout;
use uuid::Uuid;

use crate::protocol::{OpponentInfo, PlayerSlot, ServerMessage};
use crate::session::Session;

/// Time given to each player to pick a move.
const PICK_DEADLINE: Duration = Duration::from_secs(10);

/// Commands sent to a running match.
#[derive(Debug)]
pub enum MatchCommand {
    Move { slot: PlayerSlot, mv: Move },
    Leave { slot: PlayerSlot },
    Chat { slot: PlayerSlot, emoji: String },
}

pub fn start_match(
    a: Arc<Session>,
    b: Arc<Session>,
    best_of: u8,
) -> mpsc::UnboundedSender<MatchCommand> {
    let (tx, rx) = mpsc::unbounded_channel();
    tokio::spawn(run_match(a, b, best_of, rx));
    tx
}

async fn run_match(
    a: Arc<Session>,
    b: Arc<Session>,
    best_of: u8,
    mut rx: mpsc::UnboundedReceiver<MatchCommand>,
) {
    let match_id = Uuid::new_v4().to_string();
    a.set_in_match(true);
    b.set_in_match(true);

    a.send(ServerMessage::MatchFound {
        match_id: match_id.clone(),
        opponent: OpponentInfo { nickname: b.nickname() },
        best_of,
        you_are: PlayerSlot::A,
    });
    b.send(ServerMessage::MatchFound {
        match_id: match_id.clone(),
        opponent: OpponentInfo { nickname: a.nickname() },
        best_of,
        you_are: PlayerSlot::B,
    });

    let mut m = Match::new(best_of);
    let mut round_no = 0u32;

    loop {
        if m.status() != MatchStatus::InProgress {
            break;
        }
        round_no += 1;
        let deadline_ms = PICK_DEADLINE.as_millis() as u32;
        a.send(ServerMessage::RoundStart { round_no, deadline_ms });
        b.send(ServerMessage::RoundStart { round_no, deadline_ms });

        let (a_move, b_move, forfeit_slot) =
            collect_round_moves(&mut rx, &a, &b).await;

        // Forfeit handling: someone left.
        if let Some(slot) = forfeit_slot {
            let other = match slot {
                PlayerSlot::A => &b,
                PlayerSlot::B => &a,
            };
            other.send(ServerMessage::OpponentLeft);
            let (score_a, score_b) = match slot {
                PlayerSlot::A => (0, m.target()),
                PlayerSlot::B => (m.target(), 0),
            };
            broadcast_match_end(
                &a, &b,
                Some(other_slot(slot)),
                score_a, score_b,
                true,
            );
            break;
        }

        let a_mv = a_move.expect("forfeit handled above");
        let b_mv = b_move.expect("forfeit handled above");
        let _ = m.play(a_mv, b_mv);
        let last = m.rounds.last().expect("just played");

        // Send result to both players.
        let msg = ServerMessage::RoundResult {
            round_no,
            a_move: a_mv,
            b_move: b_mv,
            outcome: last.outcome.clone(),
            score_a: m.score_a,
            score_b: m.score_b,
        };
        a.send(msg.clone());
        b.send(msg);

        // Pause so clients can play the full reveal sequence (countdown
        // "Rock-Paper-Scissors-SHOOT!" ≈1.4s + verdict savouring ≈1.5s)
        // before we kick off the next round.
        tokio::time::sleep(Duration::from_millis(3500)).await;
    }

    if m.status() != MatchStatus::InProgress {
        let winner = match m.status() {
            MatchStatus::AWon => Some(PlayerSlot::A),
            MatchStatus::BWon => Some(PlayerSlot::B),
            MatchStatus::InProgress => None,
        };
        broadcast_match_end(&a, &b, winner, m.score_a, m.score_b, false);
    }

    a.set_in_match(false);
    b.set_in_match(false);
}

async fn collect_round_moves(
    rx: &mut mpsc::UnboundedReceiver<MatchCommand>,
    a: &Arc<Session>,
    b: &Arc<Session>,
) -> (Option<Move>, Option<Move>, Option<PlayerSlot>) {
    let mut a_move: Option<Move> = None;
    let mut b_move: Option<Move> = None;

    while a_move.is_none() || b_move.is_none() {
        let timeout_dur = PICK_DEADLINE + Duration::from_secs(2);
        let next = timeout(timeout_dur, rx.recv()).await;
        match next {
            Err(_) => {
                // Both players idle past the deadline. Treat as forfeit by
                // whichever side hasn't played. If both idle, A forfeits.
                let forfeit = if a_move.is_none() {
                    PlayerSlot::A
                } else {
                    PlayerSlot::B
                };
                return (a_move, b_move, Some(forfeit));
            }
            Ok(None) => {
                // Channel closed unexpectedly — treat as A leaving.
                return (a_move, b_move, Some(PlayerSlot::A));
            }
            Ok(Some(cmd)) => match cmd {
                MatchCommand::Move { slot, mv } => match slot {
                    PlayerSlot::A => a_move = Some(mv),
                    PlayerSlot::B => b_move = Some(mv),
                },
                MatchCommand::Leave { slot } => return (a_move, b_move, Some(slot)),
                MatchCommand::Chat { slot, emoji } => {
                    // Relay to the other player only.
                    let target = match slot {
                        PlayerSlot::A => b,
                        PlayerSlot::B => a,
                    };
                    target.send(ServerMessage::Chat { from: slot, emoji });
                }
            },
        }
    }
    (a_move, b_move, None)
}

fn other_slot(s: PlayerSlot) -> PlayerSlot {
    match s {
        PlayerSlot::A => PlayerSlot::B,
        PlayerSlot::B => PlayerSlot::A,
    }
}

fn broadcast_match_end(
    a: &Arc<Session>,
    b: &Arc<Session>,
    winner: Option<PlayerSlot>,
    score_a: u8,
    score_b: u8,
    forfeit: bool,
) {
    let msg = ServerMessage::MatchEnd { winner, score_a, score_b, forfeit };
    a.send(msg.clone());
    b.send(msg);
}
