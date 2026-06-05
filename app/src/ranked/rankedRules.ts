/**
 * Constellation Ranked — pure round-resolution rules.
 * 12 cards, 4 rarities. All functions are pure and deterministic.
 *
 * Card effects by resolution order:
 * 1. Pre-lock: Augur/Oracle (reveal), Echo (copy pick), Vortex (rotate opp picks)
 * 2. Post-resolve: Aegis (loss→draw), Surge (double), Precision (+1 favoured),
 *    Curse (-1 to opponent), Tide (+1 all wins), Supernova (×3 or 0),
 *    Anchor (immune to opp cards), Second-wind (draw on loss)
 */

import type { LanePlay, LaneResult } from "../online";
import type { RoundOutcome } from "../lanesEngine";
import { laneFavoursMove, type ComboTheme } from "../lanesCombos";
import type { Move } from "../game";
import type {
  LaneTarget,
  PlayedCard,
  RoundBonusBreakdown,
} from "./rankedTypes";

function cloneLane(lr: LaneResult): LaneResult {
  return { ...lr };
}

/** Apply Vortex: rotate opponent's picks clockwise (0→1, 1→2, 2→0). */
export function applyVortex(oppPlays: LanePlay[]): LanePlay[] {
  if (oppPlays.length !== 3) return oppPlays;
  return [oppPlays[2], oppPlays[0], oppPlays[1]];
}

/** Apply Echo: copy your pick from one lane to another. */
export function applyEcho(
  picks: [Move | null, Move | null, Move | null],
  fromLane: LaneTarget,
  toLane: LaneTarget,
): [Move | null, Move | null, Move | null] {
  const next = picks.slice() as [Move | null, Move | null, Move | null];
  next[toLane] = next[fromLane];
  return next;
}

/**
 * Apply all post-resolve card effects.
 */
export function applyCardEffects(
  base: RoundOutcome,
  myCard: PlayedCard | null,
  oppCard: PlayedCard | null,
): {
  outcome: RoundOutcome;
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
} {
  const lanes = base.lanes.map(cloneLane);
  let aPoints = base.aPoints;
  let bPoints = base.bPoints;
  let aegisSavedA = false, aegisSavedB = false;
  let surgeBonusA = 0, surgeBonusB = 0;
  let surgePenaltyA = 0, surgePenaltyB = 0;
  let tideBonusA = 0, tideBonusB = 0;
  let cursePenaltyA = 0, cursePenaltyB = 0;

  // Check if lanes are anchored (immune to opponent card effects)
  const aAnchorLane = myCard?.id === "anchor" ? (myCard as { lane: LaneTarget }).lane : null;
  const bAnchorLane = oppCard?.id === "anchor" ? (oppCard as { lane: LaneTarget }).lane : null;

  // 1. Aegis: loss → draw
  if (myCard?.id === "aegis") {
    const i = (myCard as { lane: LaneTarget }).lane;
    if (lanes[i]?.winner === "b") {
      lanes[i] = { ...lanes[i], winner: "draw", points: 0 };
      bPoints -= 1;
      aegisSavedA = true;
    }
  }
  if (oppCard?.id === "aegis") {
    const i = (oppCard as { lane: LaneTarget }).lane;
    if (lanes[i]?.winner === "a") {
      lanes[i] = { ...lanes[i], winner: "draw", points: 0 };
      aPoints -= 1;
      aegisSavedB = true;
    }
  }

  // 1b. Second Wind (comeback): auto-rescue your FIRST lost lane (loss → draw).
  //     No targeting — it just refuses to let you go down on a lane this round.
  if (myCard?.id === "second-wind") {
    const i = lanes.findIndex((l) => l.winner === "b");
    if (i >= 0) {
      lanes[i] = { ...lanes[i], winner: "draw", points: 0 };
      bPoints -= 1;
    }
  }
  if (oppCard?.id === "second-wind") {
    const i = lanes.findIndex((l) => l.winner === "a");
    if (i >= 0) {
      lanes[i] = { ...lanes[i], winner: "draw", points: 0 };
      aPoints -= 1;
    }
  }

  // 2. Precision: lane treated as favoured → handled in computeRoundBonuses

  // 3. Surge: win = +1, lose = opponent +1. Blocked by opponent Aegis.
  if (myCard?.id === "surge") {
    const i = (myCard as { lane: LaneTarget }).lane;
    const blockedByOppAegis = oppCard?.id === "aegis" && (oppCard as { lane: LaneTarget }).lane === i;
    if (!blockedByOppAegis && bAnchorLane !== i) {
      if (lanes[i]?.winner === "a") surgeBonusA += 1;
      else if (lanes[i]?.winner === "b") surgePenaltyA += 1;
    }
  }
  if (oppCard?.id === "surge") {
    const i = (oppCard as { lane: LaneTarget }).lane;
    const blockedByMyAegis = myCard?.id === "aegis" && (myCard as { lane: LaneTarget }).lane === i;
    if (!blockedByMyAegis && aAnchorLane !== i) {
      if (lanes[i]?.winner === "b") surgeBonusB += 1;
      else if (lanes[i]?.winner === "a") surgePenaltyB += 1;
    }
  }

  // 4. Curse: if opponent wins the cursed lane, they lose 1pt from total
  if (myCard?.id === "curse") {
    const i = (myCard as { lane: LaneTarget }).lane;
    if (lanes[i]?.winner === "b" && bAnchorLane !== i) cursePenaltyB += 1;
  }
  if (oppCard?.id === "curse") {
    const i = (oppCard as { lane: LaneTarget }).lane;
    if (lanes[i]?.winner === "a" && aAnchorLane !== i) cursePenaltyA += 1;
  }

  // 5. Tide: if you win 2+ lanes, ALL your wins give +1
  const aWinCount = lanes.filter((l) => l.winner === "a").length;
  const bWinCount = lanes.filter((l) => l.winner === "b").length;
  if (myCard?.id === "tide" && aWinCount >= 2) tideBonusA = aWinCount;
  if (oppCard?.id === "tide" && bWinCount >= 2) tideBonusB = bWinCount;

  // Recount
  let finalAWins = 0, finalBWins = 0;
  for (const lr of lanes) {
    if (lr.winner === "a") finalAWins++;
    else if (lr.winner === "b") finalBWins++;
  }
  const roundWinner: "a" | "b" | "draw" =
    finalAWins > finalBWins ? "a" : finalBWins > finalAWins ? "b" : "draw";

  return {
    outcome: { lanes, aPoints, bPoints, roundWinner },
    surgeBonusA, surgeBonusB,
    surgePenaltyA, surgePenaltyB,
    aegisSavedA, aegisSavedB,
    tideBonusA, tideBonusB,
    cursePenaltyA, cursePenaltyB,
  };
}

export function computeRoundBonuses(
  outcome: RoundOutcome,
  aPlays: LanePlay[], bPlays: LanePlay[],
  myCard: PlayedCard | null, oppCard: PlayedCard | null,
  aCombo: ComboTheme | null, bCombo: ComboTheme | null,
  fx: ReturnType<typeof applyCardEffects>,
): RoundBonusBreakdown {
  const aPrecisionLane = myCard?.id === "precision" ? (myCard as { lane: LaneTarget }).lane : null;
  const bPrecisionLane = oppCard?.id === "precision" ? (oppCard as { lane: LaneTarget }).lane : null;

  let favouredBonusA = 0, favouredBonusB = 0;
  for (let i = 0; i < outcome.lanes.length; i++) {
    const lr = outcome.lanes[i];
    const lane = i as LaneTarget;
    if (lr.winner === "a") {
      if (laneFavoursMove(lane, aPlays[i].mv) || aPrecisionLane === lane) favouredBonusA += 1;
    } else if (lr.winner === "b") {
      if (laneFavoursMove(lane, bPlays[i].mv) || bPrecisionLane === lane) favouredBonusB += 1;
    }
  }

  const comboBonusA = aCombo?.bonus && outcome.aPoints >= outcome.bPoints ? aCombo.bonus : 0;
  const comboBonusB = bCombo?.bonus && outcome.bPoints >= outcome.aPoints ? bCombo.bonus : 0;

  return {
    comboBonusA, comboBonusB,
    favouredBonusA, favouredBonusB,
    surgeBonusA: fx.surgeBonusA, surgeBonusB: fx.surgeBonusB,
    surgePenaltyA: fx.surgePenaltyA, surgePenaltyB: fx.surgePenaltyB,
    aegisSavedA: fx.aegisSavedA, aegisSavedB: fx.aegisSavedB,
    tideBonusA: fx.tideBonusA, tideBonusB: fx.tideBonusB,
    cursePenaltyA: fx.cursePenaltyA, cursePenaltyB: fx.cursePenaltyB,
  };
}

/** Supernova: if sweep (3-0) → ×3 score. If any loss → 0 score. */
export function applySupernovaToTotal(
  total: number,
  lanesWon: number,
  played: boolean,
): number {
  if (!played) return total;
  if (lanesWon === 3) return total * 3;
  return 0;
}

export function finalRoundWinner(
  outcome: RoundOutcome,
  bonuses: RoundBonusBreakdown,
  myCard: PlayedCard | null,
  oppCard: PlayedCard | null,
): "a" | "b" | "draw" {
  const aLanesWon = outcome.lanes.filter((l) => l.winner === "a").length;
  const bLanesWon = outcome.lanes.filter((l) => l.winner === "b").length;

  let aTotal =
    outcome.aPoints + bonuses.comboBonusA + bonuses.favouredBonusA +
    bonuses.surgeBonusA + bonuses.surgePenaltyB + bonuses.tideBonusA -
    bonuses.cursePenaltyA;
  let bTotal =
    outcome.bPoints + bonuses.comboBonusB + bonuses.favouredBonusB +
    bonuses.surgeBonusB + bonuses.surgePenaltyA + bonuses.tideBonusB -
    bonuses.cursePenaltyB;

  aTotal = applySupernovaToTotal(aTotal, aLanesWon, myCard?.id === "supernova");
  bTotal = applySupernovaToTotal(bTotal, bLanesWon, oppCard?.id === "supernova");

  aTotal = Math.max(0, aTotal);
  bTotal = Math.max(0, bTotal);

  if (aTotal > bTotal) return "a";
  if (bTotal > aTotal) return "b";
  return "draw";
}

export function totalBonusForSide(
  side: "a" | "b",
  bonuses: RoundBonusBreakdown,
): number {
  if (side === "a")
    return bonuses.comboBonusA + bonuses.favouredBonusA + bonuses.surgeBonusA + bonuses.tideBonusA;
  return bonuses.comboBonusB + bonuses.favouredBonusB + bonuses.surgeBonusB + bonuses.tideBonusB;
}
