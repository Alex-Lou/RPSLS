//! Phases du moteur de match lanes (prep + collecte de round + rematch).
//! Extrait verbatim de lanes_engine.rs au refactor (deplacement, zero changement).
use std::sync::Arc;
use std::time::Duration;
use rand::Rng;
use rpsls_core::constellation::{LanePlay, LaneResult, LaneWinner, RoundOutcome};
use rpsls_core::{Move, Outcome};
use tokio::sync::mpsc;
use tokio::time::timeout;
use crate::protocol::{PlayerSlot, ServerMessage};
use crate::session::Session;
use super::{
    other_slot, session_for, LanesCommand, LanesRematch, PrepOutcome, RoundEnd,
    COIN_REVEAL_PAUSE, PICK_DEADLINE, PREP_DEADLINE,
};

/// Waits for the rematch handshake after a clean lanes finish — mirrors the
/// classic engine: one side asks (`RematchOffered` to the other), who accepts
/// (replay) or declines (`RematchDeclined` to the asker). 30s timeout.
pub(super) async fn lanes_rematch_window(
    a: &Arc<Session>,
    b: &Arc<Session>,
    rx: &mut mpsc::UnboundedReceiver<LanesCommand>,
) -> LanesRematch {
    let window = Duration::from_secs(30);
    let mut offered_by: Option<PlayerSlot> = None;
    loop {
        match timeout(window, rx.recv()).await {
            Err(_) | Ok(None) => return LanesRematch::Done,
            Ok(Some(cmd)) => match cmd {
                LanesCommand::RequestRematch { slot } => match offered_by {
                    None => {
                        offered_by = Some(slot);
                        session_for(other_slot(slot), a, b).send(ServerMessage::RematchOffered);
                    }
                    Some(prev) if prev != slot => return LanesRematch::Restart,
                    Some(_) => {}
                },
                LanesCommand::RespondRematch { slot, accept } => {
                    // Only the offered side answering a pending offer counts.
                    let asker = match offered_by {
                        Some(asker) if asker == other_slot(slot) => asker,
                        _ => continue,
                    };
                    if accept {
                        return LanesRematch::Restart;
                    }
                    session_for(asker, a, b).send(ServerMessage::RematchDeclined);
                    return LanesRematch::Done;
                }
                LanesCommand::Leave { slot } => {
                    if let Some(asker) = offered_by {
                        if asker != slot {
                            session_for(asker, a, b).send(ServerMessage::RematchDeclined);
                        }
                    }
                    return LanesRematch::Done;
                }
                LanesCommand::Play { .. } | LanesCommand::Ready { .. } => {}
            },
        }
    }
}

/// Pre-match double-confirm + server-authoritative coin flip.
///
/// Sends an initial `PrepReadyState { false, false }` to both sides so the
/// 0/2 counter renders immediately, then waits up to `PREP_DEADLINE` for
/// each side to send `Ready`. Every readiness update is broadcast
/// per-perspective. As soon as BOTH have confirmed, the server rolls a coin
/// (uniform random) and broadcasts `StartCoinFlip` with the winner, then
/// pauses `COIN_REVEAL_PAUSE` so each client can animate locally before the
/// first `LanesRoundStart` lands.
///
/// During prep, `Play`/`RequestRematch`/`RespondRematch` are silently
/// ignored — clients have no UI to send them here, but a stray message from
/// a desynced peer shouldn't crash the match.
pub(super) async fn prep_phase(
    a: &Arc<Session>,
    b: &Arc<Session>,
    rx: &mut mpsc::UnboundedReceiver<LanesCommand>,
) -> PrepOutcome {
    let mut ready_a = false;
    let mut ready_b = false;

    // 0/2 baseline so the client UI doesn't render "—/2" while waiting for
    // the first server message.
    broadcast_ready_state(a, b, ready_a, ready_b);

    let deadline = tokio::time::Instant::now() + PREP_DEADLINE;

    loop {
        let now = tokio::time::Instant::now();
        if now >= deadline {
            return PrepOutcome::Timeout {
                silent: silent_slot(ready_a, ready_b),
            };
        }
        let remaining = deadline - now;

        match timeout(remaining, rx.recv()).await {
            Err(_) => {
                return PrepOutcome::Timeout {
                    silent: silent_slot(ready_a, ready_b),
                };
            }
            Ok(None) => {
                // Channel closed — both sides went away. Treat as a leave by
                // whichever side hadn't confirmed (defaults to A).
                let quitter = silent_slot(ready_a, ready_b).unwrap_or(PlayerSlot::A);
                return PrepOutcome::Leave { quitter };
            }
            Ok(Some(cmd)) => match cmd {
                LanesCommand::Ready { slot } => {
                    match slot {
                        PlayerSlot::A => ready_a = true,
                        PlayerSlot::B => ready_b = true,
                    }
                    broadcast_ready_state(a, b, ready_a, ready_b);

                    if ready_a && ready_b {
                        // Server-authoritative coin flip — uniform random.
                        let coin_winner = if rand::thread_rng().gen_bool(0.5) {
                            PlayerSlot::A
                        } else {
                            PlayerSlot::B
                        };
                        let msg = ServerMessage::StartCoinFlip {
                            winner: coin_winner,
                        };
                        a.send(msg.clone());
                        b.send(msg);
                        // Hold the round loop just long enough for the client
                        // animation + verdict reveal to read clearly.
                        tokio::time::sleep(COIN_REVEAL_PAUSE).await;
                        return PrepOutcome::Ready { coin_winner };
                    }
                }
                LanesCommand::Leave { slot } => {
                    return PrepOutcome::Leave { quitter: slot };
                }
                // Ignore everything else mid-prep.
                LanesCommand::Play { .. }
                | LanesCommand::RequestRematch { .. }
                | LanesCommand::RespondRematch { .. } => {}
            },
        }
    }
}

fn broadcast_ready_state(a: &Arc<Session>, b: &Arc<Session>, ready_a: bool, ready_b: bool) {
    // Per-perspective: each client sees its OWN slot under `you_ready` so the
    // UI math stays simple ("show 0/1/2 based on (you, opp)").
    a.send(ServerMessage::PrepReadyState {
        you_ready: ready_a,
        opp_ready: ready_b,
    });
    b.send(ServerMessage::PrepReadyState {
        you_ready: ready_b,
        opp_ready: ready_a,
    });
}

/// Map a (ready_a, ready_b) pair to the slot that hasn't confirmed yet.
/// Returns `None` only when NEITHER side has confirmed — both timed out, so
/// there's no asymmetric loser to penalize.
fn silent_slot(ready_a: bool, ready_b: bool) -> Option<PlayerSlot> {
    match (ready_a, ready_b) {
        (false, true) => Some(PlayerSlot::A),
        (true, false) => Some(PlayerSlot::B),
        (false, false) => None,
        // (true, true) is the success path, never observed here.
        (true, true) => None,
    }
}

pub(super) async fn collect_lanes_round(
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
                            plays.len(),
                            slot,
                            expected_lanes
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
                // The rematch handshake only matters after a match — ignore mid-round.
                // `Ready` belongs to the prep phase only; a late one is a
                // desynced client and gets dropped silently.
                LanesCommand::RequestRematch { .. }
                | LanesCommand::RespondRematch { .. }
                | LanesCommand::Ready { .. } => {}
            },
        }
    }
    (a_plays, b_plays, RoundEnd::Both)
}

/// Build placeholder plays for a side that ran out of time. The silent side
/// gets 3× Rock — meaningless picks since `build_timeout_outcome` overrides
/// the lane resolution anyway, but the client still sees something coherent.
pub(super) fn build_timeout_plays(
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
pub(super) fn build_timeout_outcome(
    a_plays: &[LanePlay],
    b_plays: &[LanePlay],
    silent: PlayerSlot,
) -> RoundOutcome {
    let mut lanes = Vec::with_capacity(a_plays.len());
    for (a, b) in a_plays.iter().zip(b_plays.iter()) {
        let (outcome, winner) = match silent {
            PlayerSlot::A => (
                Outcome::BWins {
                    verb: "wins by timeout".into(),
                },
                LaneWinner::B,
            ),
            PlayerSlot::B => (
                Outcome::AWins {
                    verb: "wins by timeout".into(),
                },
                LaneWinner::A,
            ),
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
    RoundOutcome {
        lanes,
        a_points,
        b_points,
        round_winner,
    }
}
