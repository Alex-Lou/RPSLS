//! Pure game logic for Rock-Paper-Scissors-Lizard-Spock.
//!
//! No I/O, no async, no network. The whole game in one file so it can be
//! audited, fuzzed, and reused by both the Tauri app and the future server.

use serde::{Deserialize, Serialize};

pub mod constellation;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Move {
    Rock,
    Paper,
    Scissors,
    Lizard,
    Spock,
}

impl Move {
    pub const ALL: [Move; 5] = [
        Move::Rock,
        Move::Paper,
        Move::Scissors,
        Move::Lizard,
        Move::Spock,
    ];

    /// Verbs describing how `self` beats `other`, per Sheldon's canon.
    /// Returns `None` if `self` does not beat `other`.
    pub fn beats(self, other: Move) -> Option<&'static str> {
        use Move::*;
        Some(match (self, other) {
            (Scissors, Paper)    => "cuts",
            (Paper,    Rock)     => "covers",
            (Rock,     Lizard)   => "crushes",
            (Lizard,   Spock)    => "poisons",
            (Spock,    Scissors) => "smashes",
            (Scissors, Lizard)   => "decapitates",
            (Lizard,   Paper)    => "eats",
            (Paper,    Spock)    => "disproves",
            (Spock,    Rock)     => "vaporizes",
            (Rock,     Scissors) => "crushes",
            _ => return None,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Outcome {
    Draw,
    AWins { verb: String },
    BWins { verb: String },
}

/// Arbitrate a single round. `a` and `b` are the moves of player A and B.
pub fn resolve(a: Move, b: Move) -> Outcome {
    if a == b {
        return Outcome::Draw;
    }
    if let Some(verb) = a.beats(b) {
        Outcome::AWins { verb: verb.to_string() }
    } else if let Some(verb) = b.beats(a) {
        Outcome::BWins { verb: verb.to_string() }
    } else {
        unreachable!("RPSLS rules are total over distinct moves")
    }
}

/// State machine for a best-of-N match. N must be odd.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Match {
    pub best_of: u8,
    pub rounds: Vec<RoundResult>,
    pub score_a: u8,
    pub score_b: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoundResult {
    pub move_a: Move,
    pub move_b: Move,
    pub outcome: Outcome,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MatchStatus {
    InProgress,
    AWon,
    BWon,
}

impl Match {
    pub fn new(best_of: u8) -> Self {
        assert!(best_of % 2 == 1 && best_of >= 1, "best_of must be odd >= 1");
        Self {
            best_of,
            rounds: Vec::new(),
            score_a: 0,
            score_b: 0,
        }
    }

    pub fn target(&self) -> u8 {
        self.best_of / 2 + 1
    }

    pub fn status(&self) -> MatchStatus {
        let t = self.target();
        if self.score_a >= t { MatchStatus::AWon }
        else if self.score_b >= t { MatchStatus::BWon }
        else { MatchStatus::InProgress }
    }

    /// Play a round. Returns the resolved round or an error if match is over.
    pub fn play(&mut self, a: Move, b: Move) -> Result<RoundResult, &'static str> {
        if self.status() != MatchStatus::InProgress {
            return Err("match already finished");
        }
        let outcome = resolve(a, b);
        match outcome {
            Outcome::AWins { .. } => self.score_a += 1,
            Outcome::BWins { .. } => self.score_b += 1,
            Outcome::Draw => {}
        }
        let result = RoundResult { move_a: a, move_b: b, outcome };
        self.rounds.push(result.clone());
        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use Move::*;

    #[test]
    fn same_move_is_draw() {
        for m in Move::ALL {
            assert_eq!(resolve(m, m), Outcome::Draw);
        }
    }

    #[test]
    fn all_canonical_wins() {
        // Sheldon's canon: each move beats exactly 2 others.
        let canon = [
            (Scissors, Paper),    (Paper,  Rock),
            (Rock,     Lizard),   (Lizard, Spock),
            (Spock,    Scissors), (Scissors, Lizard),
            (Lizard,   Paper),    (Paper,    Spock),
            (Spock,    Rock),     (Rock,     Scissors),
        ];
        for (winner, loser) in canon {
            match resolve(winner, loser) {
                Outcome::AWins { .. } => {}
                other => panic!("{:?} should beat {:?}, got {:?}", winner, loser, other),
            }
            match resolve(loser, winner) {
                Outcome::BWins { .. } => {}
                other => panic!("{:?} loses to {:?}, got {:?}", loser, winner, other),
            }
        }
    }

    #[test]
    fn exhaustive_25_pairs() {
        let mut draws = 0;
        let mut wins = 0;
        for a in Move::ALL {
            for b in Move::ALL {
                match resolve(a, b) {
                    Outcome::Draw => draws += 1,
                    _ => wins += 1,
                }
            }
        }
        assert_eq!(draws, 5);
        assert_eq!(wins, 20);
    }

    #[test]
    fn each_move_beats_exactly_two() {
        for m in Move::ALL {
            let count = Move::ALL.iter().filter(|o| m.beats(**o).is_some()).count();
            assert_eq!(count, 2, "{:?} should beat exactly 2 moves", m);
        }
    }

    #[test]
    fn best_of_three_match() {
        let mut m = Match::new(3);
        assert_eq!(m.target(), 2);
        m.play(Rock, Scissors).unwrap(); // A
        assert_eq!(m.status(), MatchStatus::InProgress);
        m.play(Paper, Paper).unwrap();   // Draw
        assert_eq!(m.score_a, 1);
        m.play(Spock, Paper).unwrap();   // B (Paper disproves Spock)
        assert_eq!(m.score_b, 1);
        m.play(Lizard, Paper).unwrap();  // A (Lizard eats Paper)
        assert_eq!(m.status(), MatchStatus::AWon);
        assert!(m.play(Rock, Rock).is_err());
    }

    #[test]
    fn serde_roundtrip() {
        let m = Move::Spock;
        let j = serde_json::to_string(&m).unwrap();
        assert_eq!(j, "\"spock\"");
        let back: Move = serde_json::from_str(&j).unwrap();
        assert_eq!(back, m);
    }
}
