/**
 * CPU brain — Easy = no cards. Normal/Hard pick from a notional pool
 * (active cards only; passives are player-deck-building rewards).
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
  // Easy stays card-free (gentle). Normal AND hard now actually commit cards
  // at a decent rate — otherwise the opponent's hand counter moves (draw /
  // discard) yet the player never SEES a card played: no reveal, empty
  // end-of-match recap. That disconnect read as a bug.
  const card = ctx.difficulty === "easy" ? null : chooseCpuCard(ctx, plays);
  return { plays, card };
}

function chooseCpuCard(ctx: RankedCpuContext, picks: LanePlay[]): PlayedCard | null {
  const playable = ctx.hand.filter((id) => CARDS[id].cost <= ctx.mana);
  if (playable.length === 0) return null;

  // Difficulty-tuned chance to actually commit a card this round (when it can
  // afford one). High enough that the player regularly sees opponent cards.
  const playChance = ctx.difficulty === "hard" ? 0.72 : 0.5;
  if (Math.random() > playChance) return null;

  // Best lane for offensive cards = a lane the opponent's own move favours;
  // fall back to a random lane.
  let favLane: LaneTarget = Math.floor(Math.random() * picks.length) as LaneTarget;
  for (let i = 0; i < picks.length; i++) {
    if (laneFavoursMove(i, picks[i].mv)) { favLane = i as LaneTarget; break; }
  }
  const randLane = () => Math.floor(Math.random() * picks.length) as LaneTarget;
  const has = (id: CardId) => playable.includes(id);

  // Priority order — strongest/most impactful affordable card first. Only
  // cards whose PlayedCard shape we can construct without extra reveal data
  // (so Augur/Oracle are skipped for the CPU).
  if (has("supernova")) return { id: "supernova" };
  if (has("trou-noir")) return { id: "trou-noir" };
  if (has("surge"))     return { id: "surge", lane: favLane };
  if (has("benediction")) return { id: "benediction" };
  if (has("tide"))      return { id: "tide", lane: 0 as LaneTarget };
  if (has("heist"))     return { id: "heist", lane: favLane };
  if (has("sangsue"))   return { id: "sangsue", lane: favLane };
  if (has("fardeau"))   return { id: "fardeau" };
  if (has("curse"))     return { id: "curse", lane: randLane() };
  if (has("vortex"))    return { id: "vortex" };
  if (has("gambit"))    return { id: "gambit" };
  if (has("precision")) return { id: "precision", lane: favLane };
  if (has("rempart"))   return { id: "rempart" };
  if (has("cascade"))   return { id: "cascade" };
  if (has("crepuscule")) return { id: "crepuscule", lane: randLane() };
  if (has("aegis"))     return { id: "aegis", lane: randLane() };
  if (has("anchor"))    return { id: "anchor", lane: randLane() };
  if (has("riposte"))   return { id: "riposte", lane: randLane() };
  if (has("remanence")) return { id: "remanence", lane: randLane() };
  if (has("mirror"))    return { id: "mirror", lane: randLane() };
  if (has("braise"))    return { id: "braise" };
  if (has("sablier"))   return { id: "sablier" };
  if (has("second-wind")) return { id: "second-wind" };

  return null;
}
