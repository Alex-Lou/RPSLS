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

/** RPSLS verbs, indexed VERBS[winner][loser]. Mirrors the Rust canon. */
const VERBS: Record<Move, Partial<Record<Move, string>>> = {
  rock:     { scissors: "crushes", lizard: "crushes" },
  paper:    { rock: "covers", spock: "disproves" },
  scissors: { paper: "cuts", lizard: "decapitates" },
  lizard:   { spock: "poisons", paper: "eats" },
  spock:    { scissors: "smashes", rock: "vaporizes" },
};

/**
 * Pure, synchronous round resolver — same canon as the Rust `resolve_round`
 * command, but works with no IPC and no network (used by the offline bot
 * fallback). `a` is "you", `b` is the opponent.
 */
export function localResolve(a: Move, b: Move): RoundResult {
  if (a === b) return { move_a: a, move_b: b, outcome: { kind: "draw" } };
  if (BEATS[a].includes(b)) {
    return { move_a: a, move_b: b, outcome: { kind: "a_wins", verb: VERBS[a][b] ?? "beats" } };
  }
  return { move_a: a, move_b: b, outcome: { kind: "b_wins", verb: VERBS[b][a] ?? "beats" } };
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

const rand = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

/** Player's most-frequent move in a window (ties → most recent). */
function mostFrequent(window: Move[]): Move {
  const counts: Record<Move, number> = { rock: 0, paper: 0, scissors: 0, lizard: 0, spock: 0 };
  for (const m of window) counts[m]++;
  let target: Move = window[window.length - 1];
  for (const m of MOVES) if (counts[m] > counts[target]) target = m;
  return target;
}

/**
 * AI strategies. Rather than ONE fixed rule per difficulty (which becomes an
 * exploitable pattern), each round the AI rolls one strategy from a
 * difficulty-weighted pool — so its behaviour keeps shifting and never reads as
 * a single identifiable habit.
 */
type AiStrategy = "throw" | "random" | "counterLast" | "counterFreq" | "antiStreak" | "secondGuess";

const STRATEGY_WEIGHTS: Record<Difficulty, Partial<Record<AiStrategy, number>>> = {
  // Mostly plays into you, with the odd reaction so spam isn't free.
  easy:   { throw: 7, random: 2, counterLast: 1 },
  // Balanced + varied: no single tell dominates.
  normal: { random: 4, counterLast: 2, counterFreq: 2, antiStreak: 1, secondGuess: 1 },
  // Sharp + mixed (incl. mind-games) so habits get punished but stay unreadable.
  hard:   { counterFreq: 3, secondGuess: 3, counterLast: 2, antiStreak: 2, random: 2 },
};

function pickStrategy(difficulty: Difficulty): AiStrategy {
  const w = STRATEGY_WEIGHTS[difficulty];
  const entries = Object.entries(w) as [AiStrategy, number][];
  const total = entries.reduce((s, [, n]) => s + n, 0);
  let r = Math.random() * total;
  for (const [k, n] of entries) { r -= n; if (r <= 0) return k; }
  return entries[entries.length - 1][0];
}

/**
 * Decide the AI's next move by rolling a difficulty-weighted strategy, then
 * executing it with internal randomness (counters pick randomly between the two
 * valid options). The mix is what prevents an easily-readable pattern.
 */
export function aiMove(
  mood: AiMood,
  difficulty: Difficulty = "normal",
  playerRecent: Move[] = []
): Move {
  // No history yet → nothing to read. Easy still throws into a random ref so
  // it feels beatable from round 1; the rest play mood-weighted random.
  if (playerRecent.length === 0) {
    if (difficulty === "easy" && Math.random() < 0.8) return rand(losesTo(rand(MOVES)));
    return moodPick(mood);
  }

  const last = playerRecent[playerRecent.length - 1];
  const window = playerRecent.slice(-5);

  switch (pickStrategy(difficulty)) {
    case "throw":
      return rand(losesTo(last)); // hand the player the win
    case "counterLast":
      return rand(countersOf(last));
    case "counterFreq":
      return rand(countersOf(mostFrequent(window)));
    case "antiStreak": {
      // Punish a repeated move; otherwise read the frequency.
      const repeated = playerRecent.length >= 2 && playerRecent[playerRecent.length - 2] === last;
      return rand(countersOf(repeated ? last : mostFrequent(window)));
    }
    case "secondGuess": {
      // You expect us to counter your last move, so you'd beat that counter —
      // we play to beat YOUR counter instead (one level deeper).
      const ourNaive = rand(countersOf(last));
      const yourLikely = rand(countersOf(ourNaive));
      return rand(countersOf(yourLikely));
    }
    case "random":
    default:
      return moodPick(mood);
  }
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
