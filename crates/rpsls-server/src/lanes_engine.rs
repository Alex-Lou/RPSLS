//! Constellation Lanes match engine — phase 1.
//!
//! Runs as its own async task, parallel to the classic match engine.
//! Owns the two players' sessions, accumulates their 3-lane plays per round,
//! and drives the [`Battle`] state machine from rpsls-core.

use std::sync::Arc;
use std::time::Duration;

use rpsls_core::constellation::{
    Battle, BattleConfig, BattleStatus, LaneResult, LaneWinner, LanePlay, RoundOutcome,
    WinCondition,
};
use rpsls_core::{Move, Outcome};
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

/// How a round resolution ended at the collection layer.
enum RoundEnd {
    /// Both players submitted their plays in time.
    Both,
    /// One side ran out of time but is still connected — round is a forced
    /// loss on that side, the match continues. Stored so we can flag it in
    /// history / UI ("lost by inactivity").
    Timeout(PlayerSlot),
    /// One side explicitly left the match — full forfeit, match ends now.
    Leave(PlayerSlot),
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
        let (a_plays, b_plays, end) = collect_lanes_round(&mut rx, lanes as usize).await;

        // Explicit leave = full match forfeit.
        if let RoundEnd::Leave(slot) = end {
            let other = match slot { PlayerSlot::A => &b, PlayerSlot::B => &a };
            other.send(ServerMessage::OpponentLeft);
            let (round_wins_a, round_wins_b) = match slot {
                PlayerSlot::A => (0u8, win_to),
                PlayerSlot::B => (win_to, 0u8),
            };
            broadcast_lanes_end(&a, &b, Some(other_slot(slot)), round_wins_a, round_wins_b, true);
            break;
        }

        // Timeout = round forced loss for the silent side; match continues.
        let (a_p, b_p, outcome) = match end {
            RoundEnd::Timeout(silent) => {
                let (ap, bp) = build_timeout_plays(lanes as usize, silent, a_plays, b_plays);
                let o = build_timeout_outcome(&ap, &bp, silent);
                // Apply to battle state manually (skip play_round).
                match silent {
                    PlayerSlot::A => battle.state.round_wins_b += 1,
                    PlayerSlot::B => battle.state.round_wins_a += 1,
                }
                battle.state.total_points_a += o.a_points;
                battle.state.total_points_b += o.b_points;
                battle.state.rounds_played += 1;
                battle.state.history.push(o.clone());
                (ap, bp, o)
            }
            RoundEnd::Both => {
                let ap = a_plays.expect("Both => a present");
                let bp = b_plays.expect("Both => b present");
                let o = match battle.play_round(&ap, &bp) {
                    Ok(o) => o,
                    Err(e) => {
                        tracing::warn!(?e, "lanes battle rejected play_round");
                        break;
                    }
                };
                (ap, bp, o)
            }
            RoundEnd::Leave(_) => unreachable!(),
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
) -> (Option<Vec<LanePlay>>, Option<Vec<LanePlay>>, RoundEnd) {
    let mut a_plays: Option<Vec<LanePlay>> = None;
    let mut b_plays: Option<Vec<LanePlay>> = None;

    while a_plays.is_none() || b_plays.is_none() {
        let timeout_dur = PICK_DEADLINE + Duration::from_secs(2);
        let next = timeout(timeout_dur, rx.recv()).await;
        match next {
            Err(_) => {
                // Deadline expired. Whichever side is silent loses *this round*
                // by inactivity — the match goes on.
                let silent = if a_plays.is_none() {
                    PlayerSlot::A
                } else {
                    PlayerSlot::B
                };
                return (a_plays, b_plays, RoundEnd::Timeout(silent));
            }
            Ok(None) => {
                return (a_plays, b_plays, RoundEnd::Leave(PlayerSlot::A));
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
                LanesCommand::Leave { slot } => {
                    return (a_plays, b_plays, RoundEnd::Leave(slot));
                }
            },
        }
    }
    (a_plays, b_plays, RoundEnd::Both)
}

/// Build placeholder plays for a side that ran out of time. The silent side
/// gets 3× Rock — meaningless picks since `build_timeout_outcome` overrides
/// the lane resolution anyway, but the client still sees something coherent.
fn build_timeout_plays(
    expected_lanes: usize,
    silent: PlayerSlot,
    a: Option<Vec<LanePlay>>,
    b: Option<Vec<LanePlay>>,
) -> (Vec<LanePlay>, Vec<LanePlay>) {
    let filler = vec![LanePlay::simple(Move::Rock); expected_lanes];
    match silent {
        PlayerSlot::A => (a.unwrap_or_else(|| filler.clone()), b.unwrap_or(filler)),
        PlayerSlot::B => (a.unwrap_or_else(|| filler.clone()), b.unwrap_or(filler)),
    }
}

/// All lanes are awarded to the side that *didn't* time out, regardless of
/// the placeholder moves. Lane verbs carry a "timeout" marker so the client
/// can label the round accordingly.
fn build_timeout_outcome(
    a_plays: &[LanePlay],
    b_plays: &[LanePlay],
    silent: PlayerSlot,
) -> RoundOutcome {
    let mut lanes = Vec::with_capacity(a_plays.len());
    for (a, b) in a_plays.iter().zip(b_plays.iter()) {
        let (outcome, winner) = match silent {
            PlayerSlot::A => (Outcome::BWins { verb: "wins by timeout".into() }, LaneWinner::B),
            PlayerSlot::B => (Outcome::AWins { verb: "wins by timeout".into() }, LaneWinner::A),
        };
        lanes.push(LaneResult {
            a_play: a.clone(),
            b_play: b.clone(),
            outcome,
            winner,
            points: 1,
        });
    }
    let lane_count = lanes.len() as u8;
    let (a_points, b_points, round_winner) = match silent {
        PlayerSlot::A => (0u8, lane_count, LaneWinner::B),
        PlayerSlot::B => (lane_count, 0u8, LaneWinner::A),
    };
    RoundOutcome { lanes, a_points, b_points, round_winner }
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
