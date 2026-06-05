/**
 * CPU brain — 12 cards. Easy/normal = no cards. Hard = picks from hand.
 */

import type { LanePlay } from "../online/online";
import { cpuLanesPicks, type LanesAiContext } from "../engine/lanesEngine";
import { laneFavoursMove } from "../engine/lanesCombos";
import { CARDS } from "./cards";
import type { CardId, LaneTarget, PlayedCard } from "./rankedTypes";

export interface RankedCpuContext extends LanesAiContext {
  mana: number;
  hand: CardId[];
}

export function cpuRankedDecision(
  ctx: RankedCpuContext,
  laneCount: number,
): { plays: LanePlay[]; card: PlayedCard | null } {
  const plays = cpuLanesPicks(ctx, laneCount);
  const card = ctx.difficulty === "hard" ? chooseCpuCard(ctx, plays) : null;
  return { plays, card };
}

function chooseCpuCard(ctx: RankedCpuContext, picks: LanePlay[]): PlayedCard | null {
  // Filter to affordable cards in hand
  const playable = ctx.hand.filter((id) => CARDS[id].cost <= ctx.mana);
  if (playable.length === 0) return null;

  // Prioritize: surge on favoured lane > curse on random > aegis on random > precision
  for (const id of playable) {
    if (id === "surge" && Math.random() < 0.5) {
      for (let i = 0; i < picks.length; i++) {
        if (laneFavoursMove(i, picks[i].mv)) {
          return { id: "surge", lane: i as LaneTarget };
        }
      }
    }
    if (id === "curse" && Math.random() < 0.4) {
      return { id: "curse", lane: Math.floor(Math.random() * picks.length) as LaneTarget };
    }
    if (id === "aegis" && Math.random() < 0.4) {
      return { id: "aegis", lane: Math.floor(Math.random() * picks.length) as LaneTarget };
    }
    if (id === "precision" && Math.random() < 0.3) {
      return { id: "precision", lane: Math.floor(Math.random() * picks.length) as LaneTarget };
    }
    if (id === "tide" && Math.random() < 0.3) {
      return { id: "tide", lane: 0 as LaneTarget };
    }
    if (id === "heist" && Math.random() < 0.25) {
      // Aim Heist at the lane we expect to win — fallback to a random one.
      for (let i = 0; i < picks.length; i++) {
        if (laneFavoursMove(i, picks[i].mv)) {
          return { id: "heist", lane: i as LaneTarget };
        }
      }
      return { id: "heist", lane: Math.floor(Math.random() * picks.length) as LaneTarget };
    }
  }

  return null;
}
