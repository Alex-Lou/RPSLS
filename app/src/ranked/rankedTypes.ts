/**
 * Constellation Ranked — pure types.
 * 12 cards across 4 rarities. Deck of 8, hand of 3.
 */

import type { Move } from "../game";
import type { LanePlay } from "../online";

/* ──────────── Cards ──────────── */

export type CardId =
  | "aegis" | "precision" | "anchor" | "second-wind"   // commons (1 mana)
  | "surge" | "augur" | "echo" | "curse" | "heist"      // rares (2 mana)
  | "tide" | "oracle" | "vortex"                        // epics (3 mana)
  | "supernova";                                        // legendary (4 mana)

export type CardRarity = "common" | "rare" | "epic" | "legendary";

export type LaneTarget = 0 | 1 | 2;

export interface RankedCard {
  id: CardId;
  cost: 1 | 2 | 3 | 4;
  rarity: CardRarity;
  target: "lane" | "lane-reveal" | "lane-reveal-all" | "lane-copy" | "lane-rotate" | "self" | "gamble";
  palette: string;
  glyph: string;
  nameKey: string;
  descKey: string;
  targetHintKey: string;
  /** Path to card art PNG if available, null = use glyph fallback. */
  art: string | null;
}

export type PlayedCard =
  | { id: "aegis" | "surge" | "precision" | "anchor" | "curse" | "tide" | "heist"; lane: LaneTarget }
  | { id: "augur"; lane: LaneTarget; revealed: Move }
  | { id: "oracle"; revealed: [Move, Move, Move] }
  | { id: "echo"; fromLane: LaneTarget; toLane: LaneTarget }
  | { id: "vortex" }
  | { id: "supernova" }
  | { id: "second-wind" };

/* ──────────── Round / battle state ──────────── */

export type RankedPhase =
  | "splash" | "drawing" | "picking" | "locking"
  | "reveal-intro" | "reveal" | "inter-round" | "match-end";

export interface RankedRoundState {
  no: number;
  mana: number;
  picks: [Move | null, Move | null, Move | null];
  cardPlayed: PlayedCard | null;
  augurRevealed: { lane: LaneTarget; move: Move } | null;
  oracleRevealed: [Move, Move, Move] | null;
}

export interface RankedBattleState {
  deck: CardId[];
  hand: CardId[];
  discard: CardId[];
  usedOneShotCards: CardId[];
  roundWinsA: number;
  roundWinsB: number;
  roundsPlayed: number;
  bonusHistory: RoundBonusBreakdown[];
}

export interface RoundBonusBreakdown {
  comboBonusA: number;
  comboBonusB: number;
  favouredBonusA: number;
  favouredBonusB: number;
  surgeBonusA: number;
  surgeBonusB: number;
  surgePenaltyA: number;
  surgePenaltyB: number;
  aegisSavedA: boolean;
  aegisSavedB: boolean;
  tideBonusA: number;
  tideBonusB: number;
  cursePenaltyA: number;
  cursePenaltyB: number;
}

export interface CpuRoundDecision {
  plays: LanePlay[];
  card: PlayedCard | null;
}
