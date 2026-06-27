/**
 * Constellation Pro — small pure helpers shared by every arena spell handler.
 *
 * Extracted out of arenaCardEffects.ts to keep that file focused on the
 * spell dispatch table (and to keep both files comfortably under 400 lines
 * as the spell roster grows toward the full 46 cards).
 */

import { CARDS } from "../ranked/cards";
import { BALANCE } from "./arenaBalance";
import type { CardId } from "../ranked/rankedTypes";
import type { BoardState, Creature, HeroState, LaneState, Side } from "./arenaTypes";

/** Coût mana effectif d'un sort pour CE héros — applique le Finisher CALCUL
 *  QUANTIQUE (Voie Spock : tous les sorts −1m, min 0). SOURCE UNIQUE partagée
 *  par l'engine (applyAllSpells), l'UI (intentCost, affordability plan phase)
 *  et l'IA (budget mana). Avant, le discount n'existait qu'à la résolution :
 *  l'UI bloquait au coût plein → le Finisher Spock était injouable en pratique. */
export function arenaSpellCost(
  hero: Pick<HeroState, "calculActive">, id: CardId,
): number {
  const base = CARDS[id].cost;
  return hero.calculActive ? Math.max(0, base - BALANCE.cosmos.calculDiscount) : base;
}

/** Read the creature on `lane` owned by `side`. Null if empty. */
export function getMyCreatureOnLane(
  board: BoardState, side: Side, lane: number,
): Creature | null {
  return side === "a" ? board.lanes[lane].a : board.lanes[lane].b;
}

/** Read the opponent's creature on `lane` from the perspective of `side`. */
export function getOppCreatureOnLane(
  board: BoardState, side: Side, lane: number,
): Creature | null {
  return side === "a" ? board.lanes[lane].b : board.lanes[lane].a;
}

/** Return a new board with `side`'s creature on `lane` replaced by `c` (or
 *  cleared if null). The opp's side of the lane is left untouched. */
export function withMyCreatureOnLane(
  board: BoardState, side: Side, lane: number, c: Creature | null,
): BoardState {
  const lanes = board.lanes.slice() as [LaneState, LaneState, LaneState];
  const cur = { ...lanes[lane] };
  if (side === "a") cur.a = c; else cur.b = c;
  lanes[lane] = cur;
  return { ...board, lanes };
}

/** Mirror of withMyCreatureOnLane — writes to the OPPONENT's slot. */
export function withOppCreatureOnLane(
  board: BoardState, side: Side, lane: number, c: Creature | null,
): BoardState {
  const lanes = board.lanes.slice() as [LaneState, LaneState, LaneState];
  const cur = { ...lanes[lane] };
  if (side === "a") cur.b = c; else cur.a = c;
  lanes[lane] = cur;
  return { ...board, lanes };
}

/** Return a new board with `side`'s hero replaced. */
export function withSideHero(
  board: BoardState, side: Side, hero: HeroState,
): BoardState {
  return side === "a" ? { ...board, a: hero } : { ...board, b: hero };
}

/** "a" ↔ "b". */
export function oppSide(side: Side): Side { return side === "a" ? "b" : "a"; }
