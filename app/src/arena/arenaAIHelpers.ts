/**
 * Helpers purs du cerveau CPU (arenaAI) : accès lanes, consommation de main
 * et choix de cible de base (meilleure créature alliée / adverse, lane vide).
 * Aucun appel RNG ici.
 */
import { CREATURE_STATS } from "./arenaTypes";
import type { BoardState, PlayedSpell, Side, LaneIndex, Creature } from "./arenaTypes";
import { creatureEffectiveAtk } from "./arenaRules";
import type { CardId } from "../ranked/rankedTypes";

/** Sorts de buff allié que Spock DÉTACHÉ ignore (isDetached → fizzle dans
 *  arenaPhase1Spells) : ne jamais les viser sur un Spock à soi. */
const DETACHED_FIZZLE = new Set<CardId>([
  "aegis", "anchor", "riposte", "precision", "surge", "surcharge", "double-mot",
]);

export function sideCreature(board: BoardState, side: Side, lane: LaneIndex): Creature | null {
  return side === "a" ? board.lanes[lane].a : board.lanes[lane].b;
}

export function consume(hand: CardId[], id: CardId): void {
  const i = hand.indexOf(id);
  if (i >= 0) hand.splice(i, 1);
}

export function targetMyBestCreature(
  board: BoardState, side: Side, kind: "lane", id: CardId,
): PlayedSpell | null {
  let bestLane: LaneIndex | null = null;
  let bestScore = -1;
  for (let i = 0; i < 3; i++) {
    const lane = i as LaneIndex;
    const c = sideCreature(board, side, lane);
    if (!c) continue;
    // Spock Détaché ignore ces buffs alliés → le sort fizzlerait.
    if (c.move === "spock" && DETACHED_FIZZLE.has(id)) continue;
    const score = creatureEffectiveAtk(c) + c.hp;
    if (score > bestScore) { bestScore = score; bestLane = lane; }
  }
  if (bestLane === null) return null;
  return { id, kind, lane: bestLane };
}

export function targetOppBestCreature(
  board: BoardState, oppSide: Side, id: CardId,
): PlayedSpell | null {
  let bestLane: LaneIndex | null = null;
  let bestScore = -1;
  for (let i = 0; i < 3; i++) {
    const lane = i as LaneIndex;
    const c = sideCreature(board, oppSide, lane);
    // Anchor (spell) AND Logique (Spock innate) both fizzle hostile spells —
    // skip them or the CPU wastes mana on a no-op.
    if (!c || c.anchored || c.spellImmune) continue;
    const score = CREATURE_STATS[c.move].atk * 2 + c.hp;
    if (score > bestScore) { bestScore = score; bestLane = lane; }
  }
  if (bestLane === null) return null;
  return { id, kind: "lane", lane: bestLane };
}

export function targetEmptyMyLaneOppOccupied(
  board: BoardState, side: Side, id: CardId,
): PlayedSpell | null {
  const oppSide: Side = side === "a" ? "b" : "a";
  for (let i = 0; i < 3; i++) {
    const lane = i as LaneIndex;
    if (sideCreature(board, side, lane)) continue;
    if (!sideCreature(board, oppSide, lane)) continue;
    return { id, kind: "lane", lane };
  }
  return null;
}
