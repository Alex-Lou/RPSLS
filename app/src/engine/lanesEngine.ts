/**
 * Client-side Constellation Lanes engine — used for offline / vs-CPU play.
 *
 * Mirrors `crates/rpsls-core/src/constellation.rs` resolve_round / Battle
 * logic in TypeScript so the same UI can power the Lanes mode without a
 * server.
 *
 * Kept intentionally tiny — no mana, no modifier card support yet (Phase 1).
 */

import { MOVES, type Move, type AiMood } from "./game";
import type { LanePlay, LaneResult, LaneWinner, PlayerSlot } from "../online";

/* ──────────── Pure RPSLS rules (mirrored from rpsls-core) ──────────── */

/** Which moves each move beats, with the canonical verb. */
const RULES: Partial<Record<Move, Partial<Record<Move, string>>>> = {
  scissors: { paper: "cuts", lizard: "decapitates" },
  paper:    { rock: "covers", spock: "disproves" },
  rock:     { scissors: "crushes", lizard: "crushes" },
  lizard:   { spock: "poisons", paper: "eats" },
  spock:    { rock: "vaporizes", scissors: "smashes" },
};

export function rpslsBeats(a: Move, b: Move): string | null {
  return RULES[a]?.[b] ?? null;
}

export type Outcome =
  | { kind: "draw" }
  | { kind: "a_wins"; verb: string }
  | { kind: "b_wins"; verb: string };

export function resolveOutcome(a: Move, b: Move): Outcome {
  if (a === b) return { kind: "draw" };
  const av = rpslsBeats(a, b);
  if (av) return { kind: "a_wins", verb: av };
  const bv = rpslsBeats(b, a);
  if (bv) return { kind: "b_wins", verb: bv };
  // Should never happen — RPSLS is total.
  return { kind: "draw" };
}

/* ──────────── Lanes resolution ──────────── */

export interface RoundOutcome {
  lanes: LaneResult[];
  aPoints: number;
  bPoints: number;
  roundWinner: LaneWinner;
}

export function resolveLanesRound(
  aPlays: LanePlay[],
  bPlays: LanePlay[],
): RoundOutcome {
  if (aPlays.length !== bPlays.length) {
    throw new Error("lane counts must match");
  }
  const lanes: LaneResult[] = [];
  let aWins = 0, bWins = 0;
  let aPoints = 0, bPoints = 0;

  for (let i = 0; i < aPlays.length; i++) {
    const a = aPlays[i], b = bPlays[i];
    const outcome = resolveOutcome(a.mv, b.mv);
    let winner: LaneWinner;
    let points = 0;
    if (outcome.kind === "a_wins") { winner = "a"; points = 1; aWins++; aPoints++; }
    else if (outcome.kind === "b_wins") { winner = "b"; points = 1; bWins++; bPoints++; }
    else { winner = "draw"; }
    lanes.push({ a_play: a, b_play: b, outcome, winner, points });
  }

  const roundWinner: LaneWinner =
    aWins > bWins ? "a" : bWins > aWins ? "b" : "draw";
  return { lanes, aPoints, bPoints, roundWinner };
}

/* ──────────── AI strategies for Lanes ──────────── */

/** Weighted-random pick using a mood (mirrors game.ts's `moodPick`). */
function moodPick(mood: AiMood): Move {
  const W: Record<AiMood, Record<Move, number>> = {
    random:     { rock: 1, paper: 1, scissors: 1, lizard: 1, spock: 1 },
    aggressive: { rock: 3, paper: 1, scissors: 3, lizard: 2, spock: 1 },
    logical:    { rock: 1, paper: 3, scissors: 1, lizard: 1, spock: 3 },
  };
  const w = W[mood];
  const total = MOVES.reduce((s, m) => s + w[m], 0);
  let r = Math.random() * total;
  for (const m of MOVES) {
    r -= w[m];
    if (r <= 0) return m;
  }
  return MOVES[MOVES.length - 1];
}

export interface LanesAiContext {
  mood: AiMood;
  /** Difficulty hint — same scale as the existing CPU game. */
  difficulty: "easy" | "normal" | "hard";
  /** Recent picks made by the human player, in order. Used by hard AI to
   *  detect patterns. */
  playerHistory: Move[];
}

export function cpuLanesPicks(ctx: LanesAiContext, laneCount: number): LanePlay[] {
  const picks: Move[] = [];
  switch (ctx.difficulty) {
    case "easy":
      // Plays *into* the player's last move — easy to counter.
      for (let i = 0; i < laneCount; i++) {
        const last = ctx.playerHistory[ctx.playerHistory.length - 1];
        picks.push(last ? counterableBy(last) : moodPick(ctx.mood));
      }
      break;
    case "normal": {
      // Normal is no longer a pure coin-flip: it lightly reads the player so
      // mindlessly spamming one move gets punished ~40% of the time, while
      // staying very beatable. Counters the most-frequent recent pick.
      const top = mostFrequent(ctx.playerHistory.slice(-5));
      for (let i = 0; i < laneCount; i++) {
        if (top && Math.random() < 0.4) picks.push(counterTo(top));
        else picks.push(moodPick(ctx.mood));
      }
      break;
    }
    case "hard": {
      // Hard reads hard. Counters the most-frequent recent pick from the very
      // first repeat (recent ≥1) at 75%, so spam is heavily punished — but
      // counterTo() randomises between the two valid counters, so the player
      // can still mix to throw it off.
      const recent = ctx.playerHistory.slice(-5);
      const top = mostFrequent(recent);
      for (let i = 0; i < laneCount; i++) {
        if (top && recent.length >= 1 && Math.random() < 0.75) {
          picks.push(counterTo(top));
        } else {
          picks.push(moodPick(ctx.mood));
        }
      }
      break;
    }
  }
  return picks.map((mv) => ({ mv, mana: 0 }));
}

/** The move the player has thrown most in `hist` (null if empty). Ties break
 *  toward the most RECENT of the tied moves so the AI tracks momentum. */
function mostFrequent(hist: Move[]): Move | null {
  if (hist.length === 0) return null;
  const freq: Record<Move, number> = { rock: 0, paper: 0, scissors: 0, lizard: 0, spock: 0 };
  for (const m of hist) freq[m]++;
  let best = hist[hist.length - 1];
  for (const m of MOVES) if (freq[m] > freq[best]) best = m;
  return best;
}

/** Returns a RANDOM move that *loses* to `m` — used by easy AI to throw
 *  matches. Randomising among the two valid losers (instead of always the
 *  first in MOVES order) stops the CPU being trivially predictable. */
function counterableBy(m: Move): Move {
  const losers = MOVES.filter((o) => rpslsBeats(m, o));
  return losers.length ? losers[Math.floor(Math.random() * losers.length)] : "rock";
}

/** Returns a RANDOM move that *beats* `m`. Each move is beaten by exactly
 *  two others in RPSLS; picking randomly between them means a player can't
 *  learn "if I play rock, hard-CPU always plays paper" and hard-counter the
 *  counter — the previous deterministic version was fully exploitable. */
function counterTo(m: Move): Move {
  const winners = MOVES.filter((o) => rpslsBeats(o, m));
  return winners.length ? winners[Math.floor(Math.random() * winners.length)] : "spock";
}

/* ──────────── Local Battle state (server-less) ──────────── */

export interface LocalBattleConfig {
  lanes: number;
  winTo: number;
  pickDeadlineMs: number;
}

export interface LocalBattleState {
  roundWinsA: number;
  roundWinsB: number;
  roundsPlayed: number;
  history: RoundOutcome[];
}

export function makeLocalBattle(): LocalBattleState {
  return { roundWinsA: 0, roundWinsB: 0, roundsPlayed: 0, history: [] };
}

export type BattleStatus =
  | { kind: "in_progress" }
  | { kind: "won"; winner: PlayerSlot };

export function battleStatus(
  state: LocalBattleState,
  cfg: LocalBattleConfig,
): BattleStatus {
  if (state.roundWinsA >= cfg.winTo) return { kind: "won", winner: "a" };
  if (state.roundWinsB >= cfg.winTo) return { kind: "won", winner: "b" };
  return { kind: "in_progress" };
}
