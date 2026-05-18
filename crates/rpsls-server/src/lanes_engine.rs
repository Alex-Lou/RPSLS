//! Constellation Lanes match engine — phase 1.
//!
//! Runs as its own async task, parallel to the classic match engine.
//! Owns the two players' sessions, accumulates their 3-lane plays per round,
//! and drives the [`Battle`] state machine from rpsls-core.

use std::sync::Arc;
use std::time::Duration;

use rpsls_core::constellation::{
    Battle, BattleConfig, BattleStatus, LanePlay, WinCondition,
};
use tokio::sync::mpsc;
use tokio::time::timeout;
use uuid::Uuid;

use crate::protocol::{OpponentInfo, PlayerSlot, ServerMessage};
use crate::session::Session;

/// Time given to each player to submit their 3 lane plays.
const PICK_DEADLINE: Duration = Duration::from_secs(12);

/// Commands sent to a running lanes match.
#[derive(Debug)]
pub enum LanesCommand {
    Play { slot: PlayerSlot, plays: Vec<LanePlay> },
    Leave { slot: PlayerSlot },
}

/// Spawn a new lanes match task. Returns the sender to feed it commands.
pub fn start_lanes_match(
    a: Arc<Session>,
    b: Arc<Session>,
    win_to: u8,
) -> mpsc::UnboundedSender<LanesCommand> {
    let (tx, rx) = mpsc::unbounded_channel();
    tokio::spawn(run_lanes_match(a, b, win_to, rx));
    tx
}

async fn run_lanes_match(
    a: Arc<Session>,
    b: Arc<Session>,
    win_to: u8,
    mut rx: mpsc::UnboundedReceiver<LanesCommand>,
) {
    let match_id = Uuid::new_v4().to_string();
    a.set_in_match(true);
    b.set_in_match(true);

    // Phase 1 preset: 3 lanes, configurable round-win target, no mana, no terrain.
    let mut config = BattleConfig::phase_1_casual();
    config.win_condition = WinCondition::FirstToRoundWins { n: win_to };
    config.pick_deadline_ms = PICK_DEADLINE.as_millis() as u32;
    let lanes = config.lanes;
    let pick_deadline_ms = config.pick_deadline_ms;
    let mut battle = Battle::new(config);

    a.send(ServerMessage::LanesMatchFound {
        match_id: match_id.clone(),
        opponent: OpponentInfo { nickname: b.nickname() },
        you_are: PlayerSlot::A,
        lanes,
        win_to,
    });
    b.send(ServerMessage::LanesMatchFound {
        match_id: match_id.clone(),
        opponent: OpponentInfo { nickname: a.nickname() },
        you_are: PlayerSlot::B,
        lanes,
        win_to,
    });

    let mut round_no = 0u32;

    loop {
        if battle.status() != BattleStatus::InProgress {
            break;
        }
        round_no += 1;
        a.send(ServerMessage::LanesRoundStart { round_no, deadline_ms: pick_deadline_ms });
        b.send(ServerMessage::LanesRoundStart { round_no, deadline_ms: pick_deadline_ms });

        // Collect both players' lane plays.
        let (a_plays, b_plays, forfeit_slot) =
            collect_lanes_round(&mut rx, lanes as usize).await;

        // Forfeit handling.
        if let Some(slot) = forfeit_slot {
            let other = match slot {
                PlayerSlot::A => &b,
                PlayerSlot::B => &a,
            };
            other.send(ServerMessage::OpponentLeft);
            let (round_wins_a, round_wins_b) = match slot {
                PlayerSlot::A => (0u8, win_to),
                PlayerSlot::B => (win_to, 0u8),
            };
            broadcast_lanes_end(
                &a, &b,
                Some(other_slot(slot)),
                round_wins_a, round_wins_b,
                true,
            );
            break;
        }

        let a_p = a_plays.expect("forfeit handled above");
        let b_p = b_plays.expect("forfeit handled above");
        let outcome = match battle.play_round(&a_p, &b_p) {
            Ok(o) => o,
            Err(e) => {
                tracing::warn!(?e, "lanes battle rejected play_round");
                break;
            }
        };

        let msg = ServerMessage::LanesRoundResult {
            round_no,
            a_plays: a_p.clone(),
            b_plays: b_p.clone(),
            lane_results: outcome.lanes.clone(),
            a_points: outcome.a_points,
            b_points: outcome.b_points,
            round_wins_a: battle.state.round_wins_a,
            round_wins_b: battle.state.round_wins_b,
        };
        a.send(msg.clone());
        b.send(msg);

        // Same generous "savour the verdict" delay as the classic engine.
        tokio::time::sleep(Duration::from_millis(3500)).await;
    }

    if battle.status() != BattleStatus::InProgress {
        let winner = match battle.status() {
            BattleStatus::AWon => Some(PlayerSlot::A),
            BattleStatus::BWon => Some(PlayerSlot::B),
            BattleStatus::InProgress => None,
        };
        broadcast_lanes_end(
            &a, &b,
            winner,
            battle.state.round_wins_a,
            battle.state.round_wins_b,
            false,
        );
    }

    a.set_in_match(false);
    b.set_in_match(false);
}

async fn collect_lanes_round(
    rx: &mut mpsc::UnboundedReceiver<LanesCommand>,
    expected_lanes: usize,
) -> (Option<Vec<LanePlay>>, Option<Vec<LanePlay>>, Option<PlayerSlot>) {
    let mut a_plays: Option<Vec<LanePlay>> = None;
    let mut b_plays: Option<Vec<LanePlay>> = None;

    while a_plays.is_none() || b_plays.is_none() {
        let timeout_dur = PICK_DEADLINE + Duration::from_secs(2);
        let next = timeout(timeout_dur, rx.recv()).await;
        match next {
            Err(_) => {
                // Deadline expired — whichever side hasn't played forfeits.
                let forfeit = if a_plays.is_none() {
                    PlayerSlot::A
                } else {
                    PlayerSlot::B
                };
                return (a_plays, b_plays, Some(forfeit));
            }
            Ok(None) => {
                return (a_plays, b_plays, Some(PlayerSlot::A));
            }
            Ok(Some(cmd)) => match cmd {
                LanesCommand::Play { slot, plays } => {
                    if plays.len() != expected_lanes {
                        tracing::warn!(
                            "got {} lane plays from slot {:?}, expected {}",
                            plays.len(), slot, expected_lanes
                        );
                        continue;
                    }
                    match slot {
                        PlayerSlot::A => a_plays = Some(plays),
                        PlayerSlot::B => b_plays = Some(plays),
                    }
                }
                LanesCommand::Leave { slot } => return (a_plays, b_plays, Some(slot)),
            },
        }
    }
    (a_plays, b_plays, None)
}

fn other_slot(s: PlayerSlot) -> PlayerSlot {
    match s {
        PlayerSlot::A => PlayerSlot::B,
        PlayerSlot::B => PlayerSlot::A,
    }
}

fn broadcast_lanes_end(
    a: &Arc<Session>,
    b: &Arc<Session>,
    winner: Option<PlayerSlot>,
    round_wins_a: u8,
    round_wins_b: u8,
    forfeit: bool,
) {
    let msg = ServerMessage::LanesMatchEnd { winner, round_wins_a, round_wins_b, forfeit };
    a.send(msg.clone());
    b.send(msg);
}
