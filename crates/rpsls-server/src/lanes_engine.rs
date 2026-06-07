//! Constellation Lanes match engine — phase 1.
//!
//! Runs as its own async task, parallel to the classic match engine.
//! Owns the two players' sessions, accumulates their 3-lane plays per round,
//! and drives the [`Battle`] state machine from rpsls-core.

use std::sync::Arc;
use std::time::Duration;

use rand::Rng;
use rpsls_core::constellation::{
    Battle, BattleConfig, BattleStatus, LanePlay, LaneResult, LaneWinner, RoundOutcome,
    WinCondition,
};
use rpsls_core::{Move, Outcome};
use tokio::sync::mpsc;
use tokio::time::timeout;
use uuid::Uuid;

use crate::protocol::{OpponentInfo, PlayerSlot, ServerMessage};
use crate::session::Session;

/// Time given to each player to submit their 3 lane plays. Bumped from 12s
/// to 13.5s on user feedback ("need more thinking room"). The countdown
/// UI is unchanged — last 3s still trigger the urgency styling.
const PICK_DEADLINE: Duration = Duration::from_millis(13_500);

/// Hard cap on the pre-match prep window. If the other player never sends
/// `Ready` within this budget we treat the silent side as having abandoned
/// the match — cohesive with the post-match watchdog already in the client.
/// 30s leaves enough slack for a phone to wake up + the WebView to mount
/// (a 5–10s reconnect happens often on flaky cellular) without making the
/// patient player stare at a frozen "0/2" forever.
const PREP_DEADLINE: Duration = Duration::from_secs(30);

/// How long the server waits between broadcasting `StartCoinFlip` and the
/// first `LanesRoundStart`. Has to cover the client coin animation
/// (`FLIP_DURATION_MS = 1600`) + the verdict reveal + a beat of breathing
/// room. 4s feels right — anything shorter clips the "Terrain de X" line.
const COIN_REVEAL_PAUSE: Duration = Duration::from_millis(4000);

/// Commands sent to a running lanes match.
#[derive(Debug)]
pub enum LanesCommand {
    Play {
        slot: PlayerSlot,
        plays: Vec<LanePlay>,
    },
    Leave {
        slot: PlayerSlot,
    },
    RequestRematch {
        slot: PlayerSlot,
    },
    RespondRematch {
        slot: PlayerSlot,
        accept: bool,
    },
    /// Pre-match coin-flip confirmation from one side. The match doesn't
    /// start until BOTH slots have sent this.
    Ready {
        slot: PlayerSlot,
    },
}

/// How the pre-match prep phase ended. Drives whether we enter the round
/// loop or short-circuit straight to a forfeit broadcast.
enum PrepOutcome {
    /// Both sides confirmed — coin landed on `coin_winner`. The result is for
    /// the client UI (whose arena dresses the board); gameplay is identical
    /// either way, so the engine just discards it after broadcasting.
    /// `coin_winner` is kept on the variant to make the broadcast payload
    /// obvious at the call site even though no downstream code reads it.
    #[allow(dead_code)]
    Ready { coin_winner: PlayerSlot },
    /// One side explicitly left during prep.
    Leave { quitter: PlayerSlot },
    /// Prep budget expired. `silent` is the slot that never confirmed; `None`
    /// when NEITHER side confirmed (mutual timeout — no winner, no LP).
    Timeout { silent: Option<PlayerSlot> },
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
    on_end: Box<dyn FnOnce() + Send>,
) -> mpsc::UnboundedSender<LanesCommand> {
    let (tx, rx) = mpsc::unbounded_channel();
    tokio::spawn(async move {
        run_lanes_match(a, b, win_to, rx).await;
        on_end();
    });
    tx
}

async fn run_lanes_match(
    a: Arc<Session>,
    b: Arc<Session>,
    win_to: u8,
    mut rx: mpsc::UnboundedReceiver<LanesCommand>,
) {
    a.set_in_match(true);
    b.set_in_match(true);

    // Outer loop: one pass per match; replay on a mutually-agreed rematch,
    // reusing this task so the server's in_match routing stays valid throughout.
    loop {
        let match_id = Uuid::new_v4().to_string();

        // Phase 1 preset: 3 lanes, configurable round-win target, no mana, no terrain.
        let mut config = BattleConfig::phase_1_casual();
        config.win_condition = WinCondition::FirstToRoundWins { n: win_to };
        config.pick_deadline_ms = PICK_DEADLINE.as_millis() as u32;
        let lanes = config.lanes;
        let pick_deadline_ms = config.pick_deadline_ms;
        let mut battle = Battle::new(config);

        a.send(ServerMessage::LanesMatchFound {
            match_id: match_id.clone(),
            opponent: OpponentInfo {
                nickname: b.nickname(),
            },
            you_are: PlayerSlot::A,
            lanes,
            win_to,
        });
        b.send(ServerMessage::LanesMatchFound {
            match_id: match_id.clone(),
            opponent: OpponentInfo {
                nickname: a.nickname(),
            },
            you_are: PlayerSlot::B,
            lanes,
            win_to,
        });

        let mut round_no = 0u32;
        let mut forfeited = false;

        // ── Pre-match: double "Ready" + server-side coin flip ──────────────
        // The coin's `winner` slot only matters to the client (it dresses the
        // arena with the winner's theme + pad); the engine doesn't read it.
        let prep_failed = match prep_phase(&a, &b, &mut rx).await {
            PrepOutcome::Ready { coin_winner: _ } => false,
            PrepOutcome::Leave { quitter } => {
                let other = session_for(other_slot(quitter), &a, &b);
                other.send(ServerMessage::OpponentLeft);
                let (round_wins_a, round_wins_b) = match quitter {
                    PlayerSlot::A => (0u8, win_to),
                    PlayerSlot::B => (win_to, 0u8),
                };
                broadcast_lanes_end(
                    &a,
                    &b,
                    Some(other_slot(quitter)),
                    round_wins_a,
                    round_wins_b,
                    true,
                );
                forfeited = true;
                true
            }
            PrepOutcome::Timeout { silent: Some(slot) } => {
                let other = session_for(other_slot(slot), &a, &b);
                other.send(ServerMessage::OpponentLeft);
                let (round_wins_a, round_wins_b) = match slot {
                    PlayerSlot::A => (0u8, win_to),
                    PlayerSlot::B => (win_to, 0u8),
                };
                broadcast_lanes_end(
                    &a,
                    &b,
                    Some(other_slot(slot)),
                    round_wins_a,
                    round_wins_b,
                    true,
                );
                forfeited = true;
                true
            }
            PrepOutcome::Timeout { silent: None } => {
                // Neither side ever pressed Ready — no winner, no LP, both
                // get a clean forfeit notice and the task exits.
                broadcast_lanes_end(&a, &b, None, 0, 0, true);
                forfeited = true;
                true
            }
        };

        if prep_failed {
            break;
        }

        loop {
            if battle.status() != BattleStatus::InProgress {
                break;
            }
            round_no += 1;
            a.send(ServerMessage::LanesRoundStart {
                round_no,
                deadline_ms: pick_deadline_ms,
            });
            b.send(ServerMessage::LanesRoundStart {
                round_no,
                deadline_ms: pick_deadline_ms,
            });

            // Collect both players' lane plays.
            let (a_plays, b_plays, end) = collect_lanes_round(&mut rx, lanes as usize).await;

            // Explicit leave = full match forfeit.
            if let RoundEnd::Leave(slot) = end {
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
                    &a,
                    &b,
                    Some(other_slot(slot)),
                    round_wins_a,
                    round_wins_b,
                    true,
                );
                forfeited = true;
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

            // 7.5s of inter-round breathing room — lets the combo banner,
            // verdict line and lane-by-lane reveal land fully and gives the
            // player time to read the tagline (and *get* the joke).
            tokio::time::sleep(Duration::from_millis(7500)).await;
        }

        if !forfeited {
            let winner = match battle.status() {
                BattleStatus::AWon => Some(PlayerSlot::A),
                BattleStatus::BWon => Some(PlayerSlot::B),
                BattleStatus::InProgress => None,
            };
            broadcast_lanes_end(
                &a,
                &b,
                winner,
                battle.state.round_wins_a,
                battle.state.round_wins_b,
                false,
            );
        }

        // A forfeit means a player already left — no rematch. A clean finish opens
        // the handshake window.
        if forfeited {
            break;
        }
        match lanes_rematch_window(&a, &b, &mut rx).await {
            LanesRematch::Restart => continue,
            LanesRematch::Done => break,
        }
    } // end outer rematch loop

    a.set_in_match(false);
    b.set_in_match(false);
}

/// How the post-match rematch window resolved (lanes).
enum LanesRematch {
    Restart,
    Done,
}

/// Waits for the rematch handshake after a clean lanes finish — mirrors the
/// classic engine: one side asks (`RematchOffered` to the other), who accepts
/// (replay) or declines (`RematchDeclined` to the asker). 30s timeout.
async fn lanes_rematch_window(
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

fn session_for<'s>(slot: PlayerSlot, a: &'s Arc<Session>, b: &'s Arc<Session>) -> &'s Arc<Session> {
    match slot {
        PlayerSlot::A => a,
        PlayerSlot::B => b,
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
async fn prep_phase(
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
    let msg = ServerMessage::LanesMatchEnd {
        winner,
        round_wins_a,
        round_wins_b,
        forfeit,
    };
    a.send(msg.clone());
    b.send(msg);

    // Record the decisive result on the global ladder (winner +LP, loser -LP).
    if let Some(slot) = winner {
        let (w, l) = match slot {
            PlayerSlot::A => (a, b),
            PlayerSlot::B => (b, a),
        };
        crate::leaderboard::record_result(w.player_id(), w.nickname(), l.player_id(), l.nickname());
    }
}
