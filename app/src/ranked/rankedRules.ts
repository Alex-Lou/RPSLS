/**
 * Constellation Ranked — pure round-resolution rules.
 * 26 cards, 4 rarities. All functions are pure and deterministic.
 *
 * Card effects by resolution order:
 * 1. Pre-lock: Augur/Oracle (reveal), Echo (copy pick), Vortex (rotate opp picks)
 * 2. Post-resolve: Aegis (loss→draw), Surge (double), Precision (+1 favoured),
 *    Curse (-1 to opponent), Tide (+1 all wins), Supernova (×3 or 0),
 *    Anchor (immune to opp cards), Second-wind (draw on loss)
 */

import type { LanePlay, LaneResult } from "../online/online";
import type { RoundOutcome } from "../engine/lanesEngine";
import { laneFavoursMove, type ComboTheme } from "../engine/lanesCombos";
import type { Move } from "../engine/game";
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
 *
 * Extra context lets bonus mechanics reach in without bloating the PlayedCard
 * shape: `gaiaChargedA/B` = a Bouclier de Gaïa passive is still loaded for
 * that side and may consume itself this round; the result `gaiaSavedA/B`
 * flags tell the caller to spend the charge.
 */
export function applyCardEffects(
  base: RoundOutcome,
  myCard: PlayedCard | null,
  oppCard: PlayedCard | null,
  ctx?: { gaiaChargedA?: boolean; gaiaChargedB?: boolean },
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
  leechPenaltyA: number;
  leechPenaltyB: number;
  gaiaSavedA: boolean;
  gaiaSavedB: boolean;
  /** Crépuscule (Twilight): lane index that was set "card-immune" this round,
   *  or null. Both sides' lane-targeted cards are skipped on it. */
  twilightLane: LaneTarget | null;
} {
  const lanes = base.lanes.map(cloneLane);
  let aPoints = base.aPoints;
  let bPoints = base.bPoints;
  let aegisSavedA = false, aegisSavedB = false;
  let surgeBonusA = 0, surgeBonusB = 0;
  let surgePenaltyA = 0, surgePenaltyB = 0;
  let tideBonusA = 0, tideBonusB = 0;
  let cursePenaltyA = 0, cursePenaltyB = 0;
  let leechPenaltyA = 0, leechPenaltyB = 0;
  let gaiaSavedA = false, gaiaSavedB = false;

  // Crépuscule (Twilight): one lane goes card-immune for the whole round.
  // The card that SET twilight still counts as a non-lane card (it has its
  // own immune lane) — every OTHER lane-targeted card on that lane is no-op.
  const twilightLaneA = myCard?.id === "crepuscule" ? (myCard as { lane: LaneTarget }).lane : null;
  const twilightLaneB = oppCard?.id === "crepuscule" ? (oppCard as { lane: LaneTarget }).lane : null;
  const twilightLane = twilightLaneA ?? twilightLaneB;

  // Échappée (Escape): your move on this lane is gone — the lane is empty for
  // you. Wipe the points the engine awarded so the lane is a 0-0 no-score.
  // Card cancels nothing else; if both sides played Échappée on the same lane
  // it's still a no-score for both.
  const escapeLaneA = myCard?.id === "echappee" ? (myCard as { lane: LaneTarget }).lane : null;
  const escapeLaneB = oppCard?.id === "echappee" ? (oppCard as { lane: LaneTarget }).lane : null;
  if (escapeLaneA !== null && lanes[escapeLaneA]) {
    if (lanes[escapeLaneA].winner === "a") aPoints -= 1;
    if (lanes[escapeLaneA].winner === "b") bPoints -= 1;
    lanes[escapeLaneA] = { ...lanes[escapeLaneA], winner: "draw", points: 0 };
  }
  if (escapeLaneB !== null && lanes[escapeLaneB]) {
    if (lanes[escapeLaneB].winner === "a") aPoints -= 1;
    if (lanes[escapeLaneB].winner === "b") bPoints -= 1;
    lanes[escapeLaneB] = { ...lanes[escapeLaneB], winner: "draw", points: 0 };
  }

  // Check if lanes are anchored (immune to opponent card effects)
  const aAnchorLane = myCard?.id === "anchor" ? (myCard as { lane: LaneTarget }).lane : null;
  const bAnchorLane = oppCard?.id === "anchor" ? (oppCard as { lane: LaneTarget }).lane : null;
  const isImmuneA = (i: number) => aAnchorLane === i || twilightLane === i;
  const isImmuneB = (i: number) => bAnchorLane === i || twilightLane === i;

  // 1. Aegis: loss → draw (skipped on twilight lane)
  if (myCard?.id === "aegis") {
    const i = (myCard as { lane: LaneTarget }).lane;
    if (lanes[i]?.winner === "b" && twilightLane !== i) {
      lanes[i] = { ...lanes[i], winner: "draw", points: 0 };
      bPoints -= 1;
      aegisSavedA = true;
    }
  }
  if (oppCard?.id === "aegis") {
    const i = (oppCard as { lane: LaneTarget }).lane;
    if (lanes[i]?.winner === "a" && twilightLane !== i) {
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

  // 1c. Rempart (global aegis): EVERY lane you lose this round becomes a draw —
  //     a panic button against a big opposing hand. No points gained, just the
  //     bleeding stopped. An anchored or twilight lane is left untouched.
  if (myCard?.id === "rempart") {
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i]?.winner === "b" && !isImmuneB(i)) {
        lanes[i] = { ...lanes[i], winner: "draw", points: 0 };
        bPoints -= 1;
      }
    }
  }
  if (oppCard?.id === "rempart") {
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i]?.winner === "a" && !isImmuneA(i)) {
        lanes[i] = { ...lanes[i], winner: "draw", points: 0 };
        aPoints -= 1;
      }
    }
  }

  // 2. Precision: lane treated as favoured → handled in computeRoundBonuses

  // 3. Surge: win = +1, lose = opponent +1. Blocked by opponent Aegis or twilight.
  if (myCard?.id === "surge") {
    const i = (myCard as { lane: LaneTarget }).lane;
    const blockedByOppAegis = oppCard?.id === "aegis" && (oppCard as { lane: LaneTarget }).lane === i;
    if (!blockedByOppAegis && !isImmuneB(i)) {
      if (lanes[i]?.winner === "a") surgeBonusA += 1;
      else if (lanes[i]?.winner === "b") surgePenaltyA += 1;
    }
  }
  if (oppCard?.id === "surge") {
    const i = (oppCard as { lane: LaneTarget }).lane;
    const blockedByMyAegis = myCard?.id === "aegis" && (myCard as { lane: LaneTarget }).lane === i;
    if (!blockedByMyAegis && !isImmuneA(i)) {
      if (lanes[i]?.winner === "b") surgeBonusB += 1;
      else if (lanes[i]?.winner === "a") surgePenaltyB += 1;
    }
  }

  // 4. Curse: if opponent wins the cursed lane, they lose 1pt from total
  if (myCard?.id === "curse") {
    const i = (myCard as { lane: LaneTarget }).lane;
    if (lanes[i]?.winner === "b" && !isImmuneB(i)) cursePenaltyB += 1;
  }
  if (oppCard?.id === "curse") {
    const i = (oppCard as { lane: LaneTarget }).lane;
    if (lanes[i]?.winner === "a" && !isImmuneA(i)) cursePenaltyA += 1;
  }

  // 4b. Sangsue (Leech): if YOU win the targeted lane, the opponent loses 1pt
  //     from their total (offensive mirror of Curse). Blocked if that lane is
  //     anchored or in twilight.
  if (myCard?.id === "sangsue") {
    const i = (myCard as { lane: LaneTarget }).lane;
    if (lanes[i]?.winner === "a" && !isImmuneB(i)) leechPenaltyB += 1;
  }
  if (oppCard?.id === "sangsue") {
    const i = (oppCard as { lane: LaneTarget }).lane;
    if (lanes[i]?.winner === "b" && !isImmuneA(i)) leechPenaltyA += 1;
  }

  // 5b. Bouclier de Gaïa (Gaia Shield) — PASSIVE: once-per-match auto-save.
  //     If after all preceding fx you'd still lose the round on lane count,
  //     EVERY lane you lose becomes a draw and the shield consumes itself.
  //     The caller decides whether to spend the charge based on gaiaSavedA/B.
  const aLanesLost = lanes.filter((l) => l.winner === "b").length;
  const bLanesLost = lanes.filter((l) => l.winner === "a").length;
  const aWillLose = aLanesLost > lanes.filter((l) => l.winner === "a").length;
  const bWillLose = bLanesLost > lanes.filter((l) => l.winner === "b").length;
  if (ctx?.gaiaChargedA && aWillLose) {
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i]?.winner === "b") {
        lanes[i] = { ...lanes[i], winner: "draw", points: 0 };
        bPoints -= 1;
      }
    }
    gaiaSavedA = true;
  }
  if (ctx?.gaiaChargedB && bWillLose) {
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i]?.winner === "a") {
        lanes[i] = { ...lanes[i], winner: "draw", points: 0 };
        aPoints -= 1;
      }
    }
    gaiaSavedB = true;
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
    leechPenaltyA, leechPenaltyB,
    gaiaSavedA, gaiaSavedB,
    twilightLane,
  };
}

export function computeRoundBonuses(
  outcome: RoundOutcome,
  aPlays: LanePlay[], bPlays: LanePlay[],
  myCard: PlayedCard | null, oppCard: PlayedCard | null,
  aCombo: ComboTheme | null, bCombo: ComboTheme | null,
  fx: ReturnType<typeof applyCardEffects>,
  /** Conduit (passive): the side's combos pay +1 extra. */
  aConduit = false, bConduit = false,
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

  // Conduit (passive) adds +1 to a side's combo payoff — but only when that
  // side actually has a combo this round, so it never grants points from thin air.
  const aComboBase = aCombo?.bonus && outcome.aPoints >= outcome.bPoints ? aCombo.bonus : 0;
  const bComboBase = bCombo?.bonus && outcome.bPoints >= outcome.aPoints ? bCombo.bonus : 0;
  const comboBonusA = aComboBase > 0 ? aComboBase + (aConduit ? 1 : 0) : 0;
  const comboBonusB = bComboBase > 0 ? bComboBase + (bConduit ? 1 : 0) : 0;

  // Bénédiction (Blessing): a SHARED bonus — when either side plays it, every
  // lane won by EITHER side scores +1 extra. Mutual buff; you pick the round
  // where you think you'll out-win, otherwise you're handing the opponent points.
  const benedictionActive = myCard?.id === "benediction" || oppCard?.id === "benediction";
  let benedictionBonusA = 0, benedictionBonusB = 0;
  if (benedictionActive) {
    for (const lr of outcome.lanes) {
      if (lr.winner === "a") benedictionBonusA += 1;
      else if (lr.winner === "b") benedictionBonusB += 1;
    }
  }

  return {
    comboBonusA, comboBonusB,
    favouredBonusA, favouredBonusB,
    surgeBonusA: fx.surgeBonusA, surgeBonusB: fx.surgeBonusB,
    surgePenaltyA: fx.surgePenaltyA, surgePenaltyB: fx.surgePenaltyB,
    aegisSavedA: fx.aegisSavedA, aegisSavedB: fx.aegisSavedB,
    tideBonusA: fx.tideBonusA, tideBonusB: fx.tideBonusB,
    cursePenaltyA: fx.cursePenaltyA, cursePenaltyB: fx.cursePenaltyB,
    leechPenaltyA: fx.leechPenaltyA, leechPenaltyB: fx.leechPenaltyB,
    benedictionBonusA, benedictionBonusB,
    gaiaSavedA: fx.gaiaSavedA, gaiaSavedB: fx.gaiaSavedB,
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
    bonuses.surgeBonusA + bonuses.surgePenaltyB + bonuses.tideBonusA +
    bonuses.benedictionBonusA -
    bonuses.cursePenaltyA - bonuses.leechPenaltyA;
  let bTotal =
    outcome.bPoints + bonuses.comboBonusB + bonuses.favouredBonusB +
    bonuses.surgeBonusB + bonuses.surgePenaltyA + bonuses.tideBonusB +
    bonuses.benedictionBonusB -
    bonuses.cursePenaltyB - bonuses.leechPenaltyB;

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
    return bonuses.comboBonusA + bonuses.favouredBonusA + bonuses.surgeBonusA + bonuses.tideBonusA + bonuses.benedictionBonusA;
  return bonuses.comboBonusB + bonuses.favouredBonusB + bonuses.surgeBonusB + bonuses.tideBonusB + bonuses.benedictionBonusB;
}
