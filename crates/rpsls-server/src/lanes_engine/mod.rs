//! Constellation Lanes match engine — phase 1.
//!
//! Runs as its own async task, parallel to the classic match engine.
//! Owns the two players' sessions, accumulates their 3-lane plays per round,
//! and drives the [`Battle`] state machine from rpsls-core.

use std::sync::Arc;
use std::time::Duration;

use rpsls_core::constellation::{Battle, BattleConfig, BattleStatus, LanePlay, WinCondition};
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::protocol::{OpponentInfo, PlayerSlot, ServerMessage};
use crate::session::Session;

mod phases;
use phases::{build_timeout_outcome, build_timeout_plays, collect_lanes_round, lanes_rematch_window, prep_phase};

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

fn session_for<'s>(slot: PlayerSlot, a: &'s Arc<Session>, b: &'s Arc<Session>) -> &'s Arc<Session> {
    match slot {
        PlayerSlot::A => a,
        PlayerSlot::B => b,
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
