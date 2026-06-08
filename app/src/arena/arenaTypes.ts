/**
 * Constellation Pro — pure types for the mini-Hearthstone-like mode.
 *
 * Separate from the Ranked types (`ranked/rankedTypes.ts`) because the
 * game shape is fundamentally different: persistent creatures on lanes,
 * hero HP instead of round wins, simultaneous turn loop with mana that
 * scales 1→10.
 *
 * Re-uses the existing CardId union from rankedTypes — the 46 cards
 * become "spells" with a separate effect table (see arenaCardEffects).
 *
 * See docs/CONSTELLATION_PRO_DESIGN.md for the locked design.
 */

import type { Move } from "../engine/game";
import type { CardId } from "../ranked/rankedTypes";

/* ───────────────────────── Hero ───────────────────────── */

export const HERO_MAX_HP = 20;
export const MANA_CAP = 10;
export const LANE_COUNT = 3;
export const HAND_CAP = 8;
export const STARTING_HAND_SIZE = 4;
/** Soft cap on turns — if neither hero is dead by then, the lower-HP loses
 *  (sudden-death fail-safe so an over-defensive match still ends). */
export const TURN_HARD_CAP = 30;

export type Side = "a" | "b";

export interface HeroState {
  hp: number;
  maxHp: number;
  /** Mana available THIS turn. Refreshes to maxMana at the start of each turn. */
  mana: number;
  /** Mana ceiling — increments by 1 every turn up to MANA_CAP. */
  maxMana: number;
  /** Cards in hand, max HAND_CAP. */
  hand: CardId[];
  /** Cards remaining in the draw pile. */
  deck: CardId[];
  /** Used cards waiting to be reshuffled when the deck empties. */
  discard: CardId[];
  /** Aegis "divine shield" — next damage source is absorbed (then this drops to 0). */
  divineShield: boolean;
}

/* ───────────────────────── Creatures ───────────────────────── */

/** Base stats for each RPSLS move when summoned as a creature. */
export interface CreatureStats {
  atk: number;
  hp: number;
}

export const CREATURE_STATS: Record<Move, CreatureStats> = {
  rock:     { atk: 3, hp: 2 },
  paper:    { atk: 2, hp: 3 },
  scissors: { atk: 4, hp: 1 },
  lizard:   { atk: 2, hp: 2 },
  spock:    { atk: 3, hp: 3 },
};

/** A creature sitting on a lane. Carries persistent damage between turns
 *  (HS-style: wounded creatures stay wounded). Buffs are one-turn flags. */
export interface Creature {
  move: Move;
  /** Owner side. */
  side: Side;
  /** Current HP — at max it equals CREATURE_STATS[move].hp, decreases on damage. */
  hp: number;
  /** Per-turn ATK modifier (Surge +3, Precision +2, Tide +1 to all, Curse -2). */
  atkBuff: number;
  /** Per-turn flags. */
  divineShield: boolean;
  /** Anchor: this creature is immune to ENEMY spell effects this turn. */
  anchored: boolean;
  /** Riposte: if THIS creature dies during combat resolution, the killer dies too. */
  ripostePrimed: boolean;
}

export type LaneIndex = 0 | 1 | 2;

/** One lane = one creature slot per side (MVP: max 1 each). */
export interface LaneState {
  a: Creature | null;
  b: Creature | null;
}

/* ───────────────────────── Pending intents ───────────────────────── */

/** A side's planned actions for the current turn — locked at end-of-turn,
 *  consumed by the resolver. Both sides build this independently. */
export interface TurnIntent {
  /** Spells the side wants to play (in the order they tapped them). The
   *  resolver re-orders them by priority before firing. */
  spells: PlayedSpell[];
  /** Creatures the side wants to summon (one entry per lane it summons on). */
  summons: PlannedSummon[];
}

/** A spell card committed for this turn. Lane / target chosen at play-time. */
export type PlayedSpell =
  // Lane-targeted spell (aegis on a lane creature, surge buff a lane, etc.)
  | { id: CardId; kind: "lane"; lane: LaneIndex }
  // Self-targeted (heal hero, draw cards) — no further input
  | { id: CardId; kind: "self" }
  // Targeted on opp hero (heist deals 3 to opp face, supernova on hero)
  | { id: CardId; kind: "hero" }
  // No target — global / board-wide (tide, oracle, vortex)
  | { id: CardId; kind: "global" };

export interface PlannedSummon {
  lane: LaneIndex;
  move: Move;
}

/* ───────────────────────── Board state ───────────────────────── */

export interface BoardState {
  a: HeroState;
  b: HeroState;
  lanes: [LaneState, LaneState, LaneState];
  /** Current turn number, starts at 1, increments after each resolver fires. */
  turn: number;
  /** Active match phase — controls what each player can do. */
  phase: ArenaPhase;
  /** Cards Augur-revealed for the player about side A (i.e. what side A can
   *  see of side B's hand). Cleared each turn. */
  augurRevealedB: CardId[];
  augurRevealedA: CardId[];
}

export type ArenaPhase =
  | "draw"        // turn start, mana up, draw a card
  | "planning"    // both sides plan in parallel
  | "resolving"   // resolver running (spells → summons → combat)
  | "match-end";  // hero hit 0 HP

/* ───────────────────────── Match result ───────────────────────── */

export interface ArenaMatchResult {
  winner: Side | "draw";
  finalA: HeroState;
  finalB: HeroState;
  turns: number;
}

/* ───────────────────────── RPSLS counter table ───────────────────────── */

/** Returns true when `attacker` "counters" `defender" per RPSLS rules
 *  (deal +1 ATK bonus this exchange). Bidirectional table for clarity. */
export function moveCountersMove(attacker: Move, defender: Move): boolean {
  switch (attacker) {
    case "rock":     return defender === "scissors" || defender === "lizard";
    case "paper":    return defender === "rock"     || defender === "spock";
    case "scissors": return defender === "paper"    || defender === "lizard";
    case "lizard":   return defender === "paper"    || defender === "spock";
    case "spock":    return defender === "scissors" || defender === "rock";
  }
}
