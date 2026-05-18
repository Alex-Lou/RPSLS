//! Constellation mode — RPSLS played on parallel lanes with future room for
//! mana, decks, modifier cards and a roguelike RPG map layer.
//!
//! This module is layered on purpose so each phase of the design can be
//! shipped without touching the previous one:
//!
//! - **Layer 1 — Round** (this file): a single round is a pure function that
//!   takes the two players' lane plays + a terrain modifier and produces a
//!   deterministic outcome. Easy to unit-test, easy to fuzz, no side effects.
//! - **Layer 2 — Battle** (also here, as a small state machine): wraps several
//!   rounds into a match with a configurable win condition. The config struct
//!   is the *only* knob that has to grow as we add phases.
//! - **Layer 3 — Run / Map**: future home for the roguelike loop. Not in
//!   Phase 1.
//!
//! Phase 1 ships with: 3 lanes, best-of-N rounds, every move always available,
//! no mana, no deck, no modifiers. The data model already carries fields for
//! mana and modifiers so Phase 2/3 only need to populate them.

use serde::{Deserialize, Serialize};

use crate::{resolve, Move, Outcome};

/* ──────────── Constants ──────────── */

/// Phase 1: every battle uses exactly 3 lanes. Master mode (Phase 5+) will
/// allow 5; widening this enum is the only structural change required.
pub const LANES_PHASE_1: usize = 3;

/* ──────────── Layer 1 types — a single round ──────────── */

/// What one player places on one lane for one round.
///
/// Phase 1: only `mv` is read. `mana` and `modifier` are kept on the wire so
/// later phases don't need a protocol bump.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LanePlay {
    pub mv: Move,
    /// Mana invested on this lane. Phase 1: always 0.
    #[serde(default)]
    pub mana: u8,
    /// Optional modifier card. Phase 1: always None. Reserved for Phase 5.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub modifier: Option<String>,
}

impl LanePlay {
    /// Convenience: a phase-1 play (just the move, no mana, no modifier).
    pub fn simple(mv: Move) -> Self {
        Self { mv, mana: 0, modifier: None }
    }
}

/// Per-round, per-board modifier — comes from the map node in Phase 4+.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Terrain {
    /// Moves disabled this round. Phase 4+. Empty in Phase 1.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub bans: Vec<Move>,
}

impl Terrain {
    pub fn empty() -> Self { Self::default() }
    pub fn bans(&self, m: Move) -> bool { self.bans.contains(&m) }
}

/// Which side a lane resolved in favor of.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LaneWinner {
    A,
    B,
    Draw,
}

/// Per-lane resolution result.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LaneResult {
    pub a_play: LanePlay,
    pub b_play: LanePlay,
    pub outcome: Outcome,
    pub winner: LaneWinner,
    /// Points scored by the lane winner on this lane (Phase 1: 1 if win,
    /// 0 otherwise; Phase 2+ will scale by mana invested).
    pub points: u8,
}

/// Outcome of resolving one full round (all lanes at once).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RoundOutcome {
    pub lanes: Vec<LaneResult>,
    /// Points scored by player A this round.
    pub a_points: u8,
    /// Points scored by player B this round.
    pub b_points: u8,
    /// Convenience: who won the *round* (majority of lanes). `Draw` if tied.
    pub round_winner: LaneWinner,
}

/// Inputs to a single round resolution. Pure function, no state.
#[derive(Debug, Clone)]
pub struct RoundInput<'a> {
    pub player_a: &'a [LanePlay],
    pub player_b: &'a [LanePlay],
    pub terrain: &'a Terrain,
}

/// Resolve a Constellation round.
///
/// Pure function. Same inputs always produce the same output — fuzz-friendly.
///
/// Phase 1 behaviour:
/// - Each lane resolved by [`resolve`] from the core RPSLS rules.
/// - Banned moves count as a forfeit on that lane (the other side wins).
/// - Points per lane = 1 on win, 0 otherwise.
/// - Round winner = whoever won the majority of lanes (A, B, or Draw).
///
/// Panics: lanes counts must match between players, and be 1..=5.
pub fn resolve_round(input: RoundInput<'_>) -> RoundOutcome {
    assert_eq!(
        input.player_a.len(),
        input.player_b.len(),
        "both players must place the same number of lanes",
    );
    assert!(
        (1..=5).contains(&input.player_a.len()),
        "lane count must be between 1 and 5",
    );

    let mut lanes = Vec::with_capacity(input.player_a.len());
    let mut a_points = 0u8;
    let mut b_points = 0u8;
    let mut a_lane_wins = 0u8;
    let mut b_lane_wins = 0u8;

    for (a, b) in input.player_a.iter().zip(input.player_b.iter()) {
        let (outcome, winner, points) = resolve_lane(a, b, input.terrain);
        match winner {
            LaneWinner::A => { a_points += points; a_lane_wins += 1; }
            LaneWinner::B => { b_points += points; b_lane_wins += 1; }
            LaneWinner::Draw => {}
        }
        lanes.push(LaneResult {
            a_play: a.clone(),
            b_play: b.clone(),
            outcome,
            winner,
            points,
        });
    }

    let round_winner = match a_lane_wins.cmp(&b_lane_wins) {
        std::cmp::Ordering::Greater => LaneWinner::A,
        std::cmp::Ordering::Less    => LaneWinner::B,
        std::cmp::Ordering::Equal   => LaneWinner::Draw,
    };

    RoundOutcome { lanes, a_points, b_points, round_winner }
}

fn resolve_lane(a: &LanePlay, b: &LanePlay, terrain: &Terrain) -> (Outcome, LaneWinner, u8) {
    // Forfeit cases first — banned moves auto-lose the lane.
    let a_banned = terrain.bans(a.mv);
    let b_banned = terrain.bans(b.mv);
    if a_banned && b_banned {
        return (Outcome::Draw, LaneWinner::Draw, 0);
    }
    if a_banned {
        let verb = "forfeit (banned move)".to_string();
        return (Outcome::BWins { verb }, LaneWinner::B, lane_points(b));
    }
    if b_banned {
        let verb = "forfeit (banned move)".to_string();
        return (Outcome::AWins { verb }, LaneWinner::A, lane_points(a));
    }

    let outcome = resolve(a.mv, b.mv);
    let (winner, points) = match outcome {
        Outcome::Draw            => (LaneWinner::Draw, 0),
        Outcome::AWins { .. }    => (LaneWinner::A, lane_points(a)),
        Outcome::BWins { .. }    => (LaneWinner::B, lane_points(b)),
    };
    (outcome, winner, points)
}

/// Points awarded on a lane win. Phase 1: always 1. Phase 2+ will return
/// `1 + winner.mana` so this is the one knob to flip.
fn lane_points(_winner: &LanePlay) -> u8 {
    1
}

/* ──────────── Layer 2 types — a multi-round battle ──────────── */

/// Win condition for a Constellation battle. Extensible: add more variants
/// over time without touching the existing engine.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum WinCondition {
    /// First side to win `n` rounds. Equivalent to "best of (2n-1)".
    FirstToRoundWins { n: u8 },
    /// First side to accumulate `n` total points across rounds. Used for the
    /// mana-aware phase 2+ where a single round can score multiple points.
    FirstToTotalPoints { n: u8 },
}

/// Static configuration for a battle. Difficulty presets live here, not in
/// the engine. The same `Battle` code drives Tutorial, Casual, Hard, etc. —
/// the differences are *only* in this struct + the AI choice.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BattleConfig {
    pub lanes: u8,
    pub win_condition: WinCondition,
    /// Mana pool refreshed at the start of each round. Phase 1: 0.
    pub starting_mana: u8,
    /// Pick deadline in milliseconds. The engine itself doesn't enforce this
    /// (that's the network layer's job) — it's here so the UI and the AI can
    /// read a single source of truth.
    pub pick_deadline_ms: u32,
    pub terrain: Terrain,
}

impl BattleConfig {
    /// Phase 1 preset: 3 lanes, best-of-5, no mana, no terrain, 10s deadline.
    pub fn phase_1_casual() -> Self {
        Self {
            lanes: LANES_PHASE_1 as u8,
            win_condition: WinCondition::FirstToRoundWins { n: 3 },
            starting_mana: 0,
            pick_deadline_ms: 10_000,
            terrain: Terrain::empty(),
        }
    }

    pub fn target_round_wins(&self) -> Option<u8> {
        match self.win_condition {
            WinCondition::FirstToRoundWins { n } => Some(n),
            _ => None,
        }
    }
}

/// Current state of a battle (mutated as rounds are played).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BattleState {
    pub round_wins_a: u8,
    pub round_wins_b: u8,
    pub total_points_a: u8,
    pub total_points_b: u8,
    pub rounds_played: u32,
    pub history: Vec<RoundOutcome>,
}

impl Default for BattleState {
    fn default() -> Self {
        Self {
            round_wins_a: 0, round_wins_b: 0,
            total_points_a: 0, total_points_b: 0,
            rounds_played: 0,
            history: Vec::new(),
        }
    }
}

/// Status of a battle.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BattleStatus {
    InProgress,
    AWon,
    BWon,
}

/// A Constellation battle in progress. Owns config + state, exposes a single
/// `play_round` method that drives the engine forward.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Battle {
    pub config: BattleConfig,
    pub state: BattleState,
}

impl Battle {
    pub fn new(config: BattleConfig) -> Self {
        Self { config, state: BattleState::default() }
    }

    pub fn status(&self) -> BattleStatus {
        match self.config.win_condition {
            WinCondition::FirstToRoundWins { n } => {
                if self.state.round_wins_a >= n { BattleStatus::AWon }
                else if self.state.round_wins_b >= n { BattleStatus::BWon }
                else { BattleStatus::InProgress }
            }
            WinCondition::FirstToTotalPoints { n } => {
                if self.state.total_points_a >= n { BattleStatus::AWon }
                else if self.state.total_points_b >= n { BattleStatus::BWon }
                else { BattleStatus::InProgress }
            }
        }
    }

    /// Resolve one round given both players' lane plays.
    pub fn play_round(
        &mut self,
        a_plays: &[LanePlay],
        b_plays: &[LanePlay],
    ) -> Result<RoundOutcome, &'static str> {
        if self.status() != BattleStatus::InProgress {
            return Err("battle already finished");
        }
        let outcome = resolve_round(RoundInput {
            player_a: a_plays,
            player_b: b_plays,
            terrain: &self.config.terrain,
        });
        self.state.total_points_a += outcome.a_points;
        self.state.total_points_b += outcome.b_points;
        match outcome.round_winner {
            LaneWinner::A    => self.state.round_wins_a += 1,
            LaneWinner::B    => self.state.round_wins_b += 1,
            LaneWinner::Draw => {}
        }
        self.state.rounds_played += 1;
        self.state.history.push(outcome.clone());
        Ok(outcome)
    }
}

/* ──────────── Tests ──────────── */

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Move::*;

    fn p(mv: Move) -> LanePlay { LanePlay::simple(mv) }

    #[test]
    fn simple_round_3_lanes_clean_win() {
        // A plays [Rock, Paper, Spock]
        // B plays [Scissors, Rock, Scissors]
        // → A wins all 3 lanes.
        let a = [p(Rock), p(Paper), p(Spock)];
        let b = [p(Scissors), p(Rock), p(Scissors)];
        let o = resolve_round(RoundInput {
            player_a: &a, player_b: &b, terrain: &Terrain::empty(),
        });
        assert_eq!(o.lanes.len(), 3);
        assert_eq!(o.a_points, 3);
        assert_eq!(o.b_points, 0);
        assert_eq!(o.round_winner, LaneWinner::A);
        for lane in &o.lanes {
            assert_eq!(lane.winner, LaneWinner::A);
        }
    }

    #[test]
    fn round_majority_decides_winner() {
        // A wins 2, B wins 1 → A takes the round.
        let a = [p(Rock), p(Paper), p(Scissors)];
        let b = [p(Scissors), p(Rock), p(Rock)];
        let o = resolve_round(RoundInput {
            player_a: &a, player_b: &b, terrain: &Terrain::empty(),
        });
        assert_eq!(o.a_points, 2);
        assert_eq!(o.b_points, 1);
        assert_eq!(o.round_winner, LaneWinner::A);
    }

    #[test]
    fn round_tied_is_draw() {
        // Lane 1 A wins, Lane 2 B wins, Lane 3 draw → 1-1, round is draw.
        let a = [p(Rock), p(Rock), p(Paper)];
        let b = [p(Scissors), p(Paper), p(Paper)];
        let o = resolve_round(RoundInput {
            player_a: &a, player_b: &b, terrain: &Terrain::empty(),
        });
        assert_eq!(o.a_points, 1);
        assert_eq!(o.b_points, 1);
        assert_eq!(o.round_winner, LaneWinner::Draw);
    }

    #[test]
    fn banned_move_forfeits_the_lane() {
        let terrain = Terrain { bans: vec![Lizard] };
        let a = [p(Lizard), p(Rock), p(Paper)];
        let b = [p(Spock),  p(Paper), p(Spock)];
        let o = resolve_round(RoundInput { player_a: &a, player_b: &b, terrain: &terrain });
        // Lane 1: A banned → B wins.
        assert_eq!(o.lanes[0].winner, LaneWinner::B);
        // Lane 2: Rock vs Paper → B wins.
        assert_eq!(o.lanes[1].winner, LaneWinner::B);
        // Lane 3: Paper vs Spock → A wins.
        assert_eq!(o.lanes[2].winner, LaneWinner::A);
        assert_eq!(o.round_winner, LaneWinner::B);
    }

    #[test]
    fn five_lane_master_mode() {
        // Future-proof: engine handles arbitrary lane counts up to 5.
        let a = [p(Rock), p(Rock), p(Rock), p(Rock), p(Rock)];
        let b = [p(Paper), p(Paper), p(Paper), p(Paper), p(Paper)];
        let o = resolve_round(RoundInput {
            player_a: &a, player_b: &b, terrain: &Terrain::empty(),
        });
        assert_eq!(o.lanes.len(), 5);
        assert_eq!(o.b_points, 5);
        assert_eq!(o.round_winner, LaneWinner::B);
    }

    #[test]
    fn battle_first_to_3_round_wins() {
        let mut b = Battle::new(BattleConfig::phase_1_casual());
        assert_eq!(b.status(), BattleStatus::InProgress);

        // Round 1: A wins all lanes.
        b.play_round(
            &[p(Rock), p(Paper), p(Spock)],
            &[p(Scissors), p(Rock), p(Scissors)],
        ).unwrap();
        assert_eq!(b.state.round_wins_a, 1);

        // Round 2: B wins majority.
        b.play_round(
            &[p(Rock), p(Rock), p(Rock)],
            &[p(Paper), p(Paper), p(Scissors)],
        ).unwrap();
        assert_eq!(b.state.round_wins_b, 1);

        // Round 3-4: A wins both.
        for _ in 0..2 {
            b.play_round(
                &[p(Rock), p(Paper), p(Spock)],
                &[p(Scissors), p(Rock), p(Scissors)],
            ).unwrap();
        }
        assert_eq!(b.status(), BattleStatus::AWon);
        // Can't play once finished.
        assert!(b.play_round(&[p(Rock), p(Rock), p(Rock)], &[p(Paper), p(Paper), p(Paper)]).is_err());
    }

    #[test]
    fn serde_round_outcome() {
        let a = [p(Rock), p(Paper), p(Spock)];
        let b = [p(Scissors), p(Rock), p(Scissors)];
        let o = resolve_round(RoundInput { player_a: &a, player_b: &b, terrain: &Terrain::empty() });
        let j = serde_json::to_string(&o).unwrap();
        let back: RoundOutcome = serde_json::from_str(&j).unwrap();
        assert_eq!(o, back);
    }
}
