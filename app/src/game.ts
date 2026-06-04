import { invoke } from "@tauri-apps/api/core";

export type Move = "rock" | "paper" | "scissors" | "lizard" | "spock";

export const MOVES: Move[] = ["rock", "paper", "scissors", "lizard", "spock"];

export const MOVE_META: Record<Move, { label: string }> = {
  rock:     { label: "Rock" },
  paper:    { label: "Paper" },
  scissors: { label: "Scissors" },
  lizard:   { label: "Lizard" },
  spock:    { label: "Spock" },
};

export type Outcome =
  | { kind: "draw" }
  | { kind: "a_wins"; verb: string }
  | { kind: "b_wins"; verb: string };

export interface RoundResult {
  move_a: Move;
  move_b: Move;
  outcome: Outcome;
}

export async function resolveRound(a: Move, b: Move): Promise<RoundResult> {
  return invoke<RoundResult>("resolve_round", { a, b });
}

/* ───────── AI personalities (client-side, weighted random) ───────── */

export type AiMood = "random" | "aggressive" | "logical";

export const AI_MOOD_META: Record<AiMood, { label: string; emoji: string; desc: string }> = {
  random:     { label: "Random",     emoji: "🎲", desc: "Pure chance, no bias." },
  aggressive: { label: "Aggressive", emoji: "💪", desc: "Favors rock & scissors." },
  logical:    { label: "Logical",    emoji: "🧠", desc: "Favors paper & spock." },
};

const AI_WEIGHTS: Record<AiMood, Record<Move, number>> = {
  random:     { rock: 1, paper: 1, scissors: 1, lizard: 1, spock: 1 },
  aggressive: { rock: 3, paper: 1, scissors: 3, lizard: 2, spock: 1 },
  logical:    { rock: 1, paper: 3, scissors: 1, lizard: 1, spock: 3 },
};

export function rollAiMood(): AiMood {
  const moods: AiMood[] = ["random", "aggressive", "logical"];
  return moods[Math.floor(Math.random() * moods.length)];
}

function moodPick(mood: AiMood): Move {
  const w = AI_WEIGHTS[mood];
  const total = MOVES.reduce((s, m) => s + w[m], 0);
  let r = Math.random() * total;
  for (const m of MOVES) {
    r -= w[m];
    if (r <= 0) return m;
  }
  return MOVES[MOVES.length - 1];
}

/** What `winner` beats. Pure JS mirror of the Rust canon. */
const BEATS: Record<Move, Move[]> = {
  rock:     ["scissors", "lizard"],
  paper:    ["rock", "spock"],
  scissors: ["paper", "lizard"],
  lizard:   ["spock", "paper"],
  spock:    ["scissors", "rock"],
};

/** Moves that beat `loser` — i.e. counters. */
function countersOf(loser: Move): Move[] {
  return MOVES.filter((m) => BEATS[m].includes(loser));
}

/** Moves that lose to `winner` — i.e. AI plays these to throw the round. */
function losesTo(winner: Move): Move[] {
  return BEATS[winner];
}

type Difficulty = "easy" | "normal" | "hard";

/**
 * Decide the AI's next move.
 *
 * Easy   → ~60% intentionally picks a move that loses to the player's last move;
 *           otherwise mood-weighted random.
 * Normal → mood-weighted random.
 * Hard   → ~60% counters the player's most-frequent recent move (last 5);
 *           otherwise mood-weighted random.
 */
export function aiMove(
  mood: AiMood,
  difficulty: Difficulty = "normal",
  playerRecent: Move[] = []
): Move {
  if (difficulty === "easy") {
    // Easy must FEEL easy from round 1. With no history yet, throw a move
    // that loses to a uniformly-random move (still a genuine "bad" pick),
    // so the player isn't facing a fair mood-random CPU on the opening
    // rounds of a short Bo3. Once history exists, throw vs the last move.
    // 0.8 throw-rate (was 0.6) lands easy-CPU win-rate in the intended
    // ~35-45% band instead of the old near-coinflip.
    if (Math.random() < 0.8) {
      const ref = playerRecent.length > 0
        ? playerRecent[playerRecent.length - 1]
        : MOVES[Math.floor(Math.random() * MOVES.length)];
      const dumbPicks = losesTo(ref);
      return dumbPicks[Math.floor(Math.random() * dumbPicks.length)];
    }
    return moodPick(mood);
  }

  if (difficulty === "hard" && playerRecent.length >= 1) {
    if (Math.random() < 0.6) {
      // Most-used move in the last 5
      const window = playerRecent.slice(-5);
      const counts: Record<Move, number> = {
        rock: 0, paper: 0, scissors: 0, lizard: 0, spock: 0,
      };
      for (const m of window) counts[m]++;
      let target: Move = window[window.length - 1];
      let max = 0;
      for (const m of MOVES) {
        if (counts[m] > max) { max = counts[m]; target = m; }
      }
      const ctr = countersOf(target);
      return ctr[Math.floor(Math.random() * ctr.length)];
    }
    return moodPick(mood);
  }

  return moodPick(mood);
}

export type MatchStatus = "in_progress" | "a_won" | "b_won";

export interface MatchState {
  bestOf: number;
  scoreA: number;
  scoreB: number;
  history: RoundResult[];
}

export function newMatch(bestOf: number): MatchState {
  if (bestOf % 2 === 0 || bestOf < 1) {
    throw new Error("bestOf must be odd >= 1");
  }
  return { bestOf, scoreA: 0, scoreB: 0, history: [] };
}

export function target(m: MatchState): number {
  return Math.floor(m.bestOf / 2) + 1;
}

export function status(m: MatchState): MatchStatus {
  const t = target(m);
  if (m.scoreA >= t) return "a_won";
  if (m.scoreB >= t) return "b_won";
  return "in_progress";
}

export function applyRound(m: MatchState, r: RoundResult): MatchState {
  let scoreA = m.scoreA;
  let scoreB = m.scoreB;
  if (r.outcome.kind === "a_wins") scoreA++;
  else if (r.outcome.kind === "b_wins") scoreB++;
  return { ...m, scoreA, scoreB, history: [...m.history, r] };
}
