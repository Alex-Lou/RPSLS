/**
 * Constellation Pro — CPU brain.
 *
 * MVP-tier "greedy" AI: it plays its mana on what looks immediately useful
 * without long-term planning. The output is a TurnIntent the resolver can
 * consume directly. Good enough to be a sparring partner; replaced by a
 * proper search-based AI in a later phase.
 *
 * Heuristics, in priority order:
 *   1. Defensive emergencies — if a creature of mine is about to die from
 *      an obvious incoming attack, slap Aegis / Anchor on it.
 *   2. Burst lethal — if the opp hero is at ≤ 6 HP and I have Supernova,
 *      Heist, or a strong open-lane combo, send it.
 *   3. Develop board — empty lanes get summons (prefer the highest-stat
 *      RPSLS counter to whatever the opp has on the opposite lane).
 *   4. Spend remaining mana — buffs/draws/utility, biggest mana cost first
 *      so a 4-cost legendary doesn't sit in hand while we leak small spells.
 *
 * Difficulty (player.difficulty) modulates aggression and randomness:
 *   easy   — passive, no combos, sometimes skips lethal
 *   normal — full greedy
 *   hard   — full greedy + threat awareness (always plays Aegis on the
 *            creature that will be killed by the highest opp ATK)
 */

import { CARDS } from "../ranked/cards";
import { CREATURE_STATS, moveCountersMove } from "./arenaTypes";
import type {
  BoardState,
  PlayedSpell,
  Side,
  TurnIntent,
  LaneIndex,
  Creature,
} from "./arenaTypes";
import { arenaSupported, spellPriority } from "./arenaCardEffects";
import type { CardId } from "../ranked/rankedTypes";
import type { Move } from "../engine/game";
import type { Difficulty } from "../types";

const MOVES: Move[] = ["rock", "paper", "scissors", "lizard", "spock"];

export function cpuArenaDecision(
  board: BoardState,
  side: Side,
  difficulty: Difficulty,
): TurnIntent {
  const intent: TurnIntent = { spells: [], summons: [] };
  let mana = side === "a" ? board.a.mana : board.b.mana;
  const hero = side === "a" ? board.a : board.b;
  const oppSide: Side = side === "a" ? "b" : "a";
  // oppHero (the hero we're attacking) is now computed inside the lethal
  // block as `playerHero` — keep this local out so we don't shadow it.

  // Hand of playable spells (filter out cards we haven't adapted to Arena yet).
  const playableHand = hero.hand.filter(arenaSupported);

  // Easy CPU: skip ~40% of optional plays so the player has breathing room.
  const skipChance = difficulty === "easy" ? 0.4 : difficulty === "hard" ? 0 : 0.1;

  /* ─── 1. Defensive emergencies — save a creature about to die ─── */
  if (difficulty !== "easy") {
    for (let i = 0; i < 3; i++) {
      const lane = i as LaneIndex;
      const mine = sideCreature(board, side, lane);
      const opp = sideCreature(board, oppSide, lane);
      if (!mine || !opp) continue;
      // Will mine die this turn from the opp's incoming attack?
      const oppBaseAtk = CREATURE_STATS[opp.move].atk + opp.atkBuff;
      const incoming = oppBaseAtk + (moveCountersMove(opp.move, mine.move) ? 1 : 0);
      const wouldDie = mine.hp <= incoming && !mine.divineShield;
      if (!wouldDie) continue;
      // Try Aegis (1m) first — divine shield absorbs ALL the incoming dmg.
      if (mana >= 1 && playableHand.includes("aegis")) {
        intent.spells.push({ id: "aegis", kind: "lane", lane });
        consume(playableHand, "aegis");
        mana -= 1;
        continue;
      }
      // Else Anchor (1m) — doesn't help vs combat but at least blocks Curse/etc.
      // Only useful if the opp is likely to debuff. Skip for greedy.
    }
  }

  /* ─── 2. Lethal check — compute the damage WE can dump on the opp hero
   *      this turn and prioritize it if it kills. Includes:
   *      - Existing creatures' undefended ATK (lanes where player has none)
   *      - Supernova on hero (6 dmg, 4 mana)
   *      - Heist (3 dmg, 3 mana)
   *      - Paradoxe (5 dmg both, 3 mana — risky if we're also low)
   *      Adversaire AI is "side", so "us" attacks the hero on `oppSide`. */
  const playerHero = side === "a" ? board.b : board.a; // the hero we're trying to kill
  let lethalDmg = 0;
  for (let i = 0; i < 3; i++) {
    const lane = i as LaneIndex;
    const myC = sideCreature(board, side, lane);
    const oppC = sideCreature(board, oppSide, lane);
    if (myC && !oppC) {
      // Undefended → we'll hit hero for myC.atk
      lethalDmg += CREATURE_STATS[myC.move].atk + myC.atkBuff;
    }
  }
  const couldLethal = lethalDmg + (playableHand.includes("supernova") && mana >= 4 ? 6 : 0)
                                + (playableHand.includes("heist") && mana >= 3 ? 3 : 0)
                                >= playerHero.hp;

  /* ─── 2b. Burst lethal vs an exposed hero — push spells if lethal is on. */
  if ((playerHero.hp <= 6 || couldLethal) && Math.random() >= skipChance) {
    if (mana >= 4 && playableHand.includes("supernova")) {
      intent.spells.push({ id: "supernova", kind: "hero" });
      consume(playableHand, "supernova");
      mana -= 4;
    }
    if (mana >= 3 && playableHand.includes("heist")) {
      intent.spells.push({ id: "heist", kind: "self" }); // self because it draws + hits hero
      consume(playableHand, "heist");
      mana -= 3;
    }
  }

  /* ─── 3. Develop board — summon on empty lanes ─── */
  // Sort lanes by "openness" (empty mine + empty opp first, so we don't trade
  // immediately if we don't have to).
  const laneOrder: LaneIndex[] = [0, 1, 2];
  laneOrder.sort((l1, l2) => {
    const score = (l: LaneIndex) => {
      const mine = sideCreature(board, side, l);
      const opp = sideCreature(board, oppSide, l);
      // Empty mine + empty opp = best (free dmg to hero). Empty mine + opp = trade.
      // Mine present = skip.
      if (mine) return 0;
      if (!opp) return 2;
      return 1;
    };
    return score(l2) - score(l1);
  });

  // Summon skip chance — much lower than the spell skip so the CPU
  // RELIABLY develops board, instead of standing still on its mana.
  // Easy keeps a bit of randomness (30%), normal/hard always summon if
  // there's an open lane and mana for it.
  const summonSkip = difficulty === "easy" ? 0.3 : 0;
  // HARD CAP: max 2 summons per turn. Without this, the CPU stacks all 3
  // lanes every turn → player has zero undefended path to reach opp hero
  // (Alex's "opp ne perd jamais de vie" symptom). Leaving one lane open
  // also makes for real tactical games instead of "wall of creatures".
  const MAX_SUMMONS_PER_TURN = 2;
  // Count existing creatures already on the board — if the CPU already
  // has ≥ 2 lanes occupied, don't summon a 3rd (saturates the board).
  const myExistingCreatures = [0, 1, 2].reduce(
    (acc, i) => acc + (sideCreature(board, side, i as LaneIndex) ? 1 : 0),
    0,
  );
  const lanesAvailableForSummon = Math.max(0, MAX_SUMMONS_PER_TURN - myExistingCreatures);
  let summonsThisTurn = 0;
  for (const lane of laneOrder) {
    if (mana < 1) break;
    if (summonsThisTurn >= lanesAvailableForSummon) break;
    if (sideCreature(board, side, lane)) continue;
    if (Math.random() < summonSkip) continue;
    const opp = sideCreature(board, oppSide, lane);
    const choice = pickBestMove(opp);
    intent.summons.push({ lane, move: choice });
    mana -= 1;
    summonsThisTurn += 1;
  }
  // Fallback: if for any reason no summon happened and we still have ≥ 1
  // mana + at least one empty lane (under the cap), FORCE one — a boring
  // "CPU did nothing" turn is worse than a suboptimal summon.
  if (summonsThisTurn === 0 && mana >= 1 && difficulty !== "easy" && lanesAvailableForSummon > 0) {
    for (const lane of laneOrder) {
      if (sideCreature(board, side, lane)) continue;
      const opp = sideCreature(board, oppSide, lane);
      intent.summons.push({ lane, move: pickBestMove(opp) });
      mana -= 1;
      break;
    }
  }

  /* ─── 4. Spend remaining mana — biggest spells first ─── */
  // Sort remaining hand by cost desc; play whatever fits.
  const queue = playableHand.slice().sort((a, b) => CARDS[b].cost - CARDS[a].cost);
  for (const id of queue) {
    const cost = CARDS[id].cost;
    if (cost > mana) continue;
    if (Math.random() < skipChance) continue;
    const spell = buildSpellTarget(id, board, side);
    if (!spell) continue;
    intent.spells.push(spell);
    mana -= cost;
  }

  // Final priority sort — caller (resolver) will re-sort, but doing it here
  // keeps the intent legible if anyone inspects it for tests.
  intent.spells.sort((s1, s2) => spellPriority(s1.id) - spellPriority(s2.id));

  return intent;
}

/* ───────────────────────── Helpers ───────────────────────── */

function sideCreature(board: BoardState, side: Side, lane: LaneIndex): Creature | null {
  return side === "a" ? board.lanes[lane].a : board.lanes[lane].b;
}

function consume(hand: CardId[], id: CardId): void {
  const i = hand.indexOf(id);
  if (i >= 0) hand.splice(i, 1);
}

/** Pick the best RPSLS move to summon against `opp`. If opp empty, pick the
 *  highest-ATK move (Scissors 4 ATK). Else pick the one that counters opp. */
function pickBestMove(opp: Creature | null): Move {
  if (!opp) return "scissors"; // highest ATK on empty lane = fastest dmg to hero
  for (const mv of MOVES) {
    if (moveCountersMove(mv, opp.move)) {
      // Among counters, pick the one with the best ATK/HP for this trade.
      // E.g. if opp is Rock, both Paper (2/3) and Spock (3/3) counter — pick Spock.
      let best: Move = mv;
      for (const candidate of MOVES) {
        if (!moveCountersMove(candidate, opp.move)) continue;
        const s = CREATURE_STATS[candidate];
        const bs = CREATURE_STATS[best];
        if (s.atk * 10 + s.hp > bs.atk * 10 + bs.hp) best = candidate;
      }
      return best;
    }
  }
  return "scissors";
}

/** Build a PlayedSpell with a sensible target chosen for the CPU. Returns null
 *  if no valid target exists (e.g. Mirror with no opp creature). */
function buildSpellTarget(
  id: CardId,
  board: BoardState,
  side: Side,
): PlayedSpell | null {
  const oppSide: Side = side === "a" ? "b" : "a";
  switch (id) {
    case "aegis":     return targetMyBestCreature(board, side, "lane", id) ?? { id, kind: "self" };
    case "anchor":    return targetMyBestCreature(board, side, "lane", id);
    case "riposte":   return targetMyBestCreature(board, side, "lane", id);
    case "precision": return targetMyBestCreature(board, side, "lane", id);
    case "surge":     return targetMyBestCreature(board, side, "lane", id);
    case "curse":     return targetOppBestCreature(board, oppSide, id);
    case "supernova": {
      // Prefer hero if exposed enough, else biggest threat creature.
      const oppHero = oppSide === "a" ? board.a : board.b;
      if (oppHero.hp <= 6) return { id, kind: "hero" };
      const threat = targetOppBestCreature(board, oppSide, id);
      return threat ?? { id, kind: "hero" };
    }
    case "heist":     return { id, kind: "self" };
    case "tide":      return { id, kind: "global" };
    case "prescience": return { id, kind: "self" };
    case "oracle":    return { id, kind: "self" };
    case "augur":     return { id, kind: "global" };
    case "second-wind": return { id, kind: "self" };
    case "mirror":    return targetEmptyMyLaneOppOccupied(board, side, id);
    case "vortex":    return { id, kind: "global" };
    default:          return null;
  }
}

function targetMyBestCreature(
  board: BoardState, side: Side, kind: "lane", id: CardId,
): PlayedSpell | null {
  let bestLane: LaneIndex | null = null;
  let bestScore = -1;
  for (let i = 0; i < 3; i++) {
    const lane = i as LaneIndex;
    const c = sideCreature(board, side, lane);
    if (!c) continue;
    const score = CREATURE_STATS[c.move].atk + c.hp;
    if (score > bestScore) { bestScore = score; bestLane = lane; }
  }
  if (bestLane === null) return null;
  return { id, kind, lane: bestLane };
}

function targetOppBestCreature(
  board: BoardState, oppSide: Side, id: CardId,
): PlayedSpell | null {
  let bestLane: LaneIndex | null = null;
  let bestScore = -1;
  for (let i = 0; i < 3; i++) {
    const lane = i as LaneIndex;
    const c = sideCreature(board, oppSide, lane);
    if (!c || c.anchored) continue;
    const score = CREATURE_STATS[c.move].atk * 2 + c.hp;
    if (score > bestScore) { bestScore = score; bestLane = lane; }
  }
  if (bestLane === null) return null;
  return { id, kind: "lane", lane: bestLane };
}

function targetEmptyMyLaneOppOccupied(
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
