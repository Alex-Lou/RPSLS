/**
 * Constellation Pro — pure rules engine.
 *
 * Everything here is a pure function on BoardState: no React, no refs, no
 * I/O. The resolver below takes a snapshot of the board + both sides'
 * TurnIntent, applies spells → summons → combat → HP check, and returns
 * the new board. UI animates from the diff.
 *
 * Resolver order (per turn, AFTER both sides locked):
 *   1. Spells fire — defensive (Aegis, Anchor, Riposte) before offensive
 *      (Curse, Heist, Supernova). Same-priority both-side spells fire in
 *      parallel (state taken AT THE START of the spell phase).
 *   2. Summons land — new creatures arrive on their lanes; if the lane is
 *      already occupied by an ALLIED creature, the new one REPLACES (old
 *      dies silently, no damage taken).
 *   3. Combat — each lane resolves 1v1 (or attacker→hero if undefended)
 *      simultaneously. Both creatures take damage at the same step; one
 *      can die "to" a corpse and still trigger Riposte.
 *   4. HP check — if either hero ≤ 0, phase becomes "match-end".
 *
 * See docs/CONSTELLATION_PRO_DESIGN.md for the locked combat formulas.
 */

import {
  CREATURE_STATS,
  HERO_MAX_HP,
  MANA_CAP,
  STARTING_HAND_SIZE,
  moveCountersMove,
  type ArenaMatchResult,
  type BoardState,
  type Creature,
  type HeroState,
  type LaneIndex,
  type LaneState,
  type Side,
  type TurnIntent,
} from "./arenaTypes";
import {
  applyArenaSpell,
  spellPriority,
  type ArenaSpellContext,
} from "./arenaCardEffects";
import { CARDS } from "../ranked/cards";
import type { CardId } from "../ranked/rankedTypes";
import type { Move } from "../engine/game";

/* ───────────────────────── Board init ───────────────────────── */

/** Build a fresh hero from a deck (shuffled at match start). The deck is
 *  the 8 cards equipped in the player's saved deck; passives equipped in
 *  Ranked are IGNORED in Arena — they don't exist as concept here. */
export function makeHero(deckIds: CardId[]): HeroState {
  const cleaned = deckIds.filter(
    (id): id is CardId => Object.prototype.hasOwnProperty.call(CARDS, id),
  );
  const shuffled = shuffle(cleaned);
  const startingHand = shuffled.slice(0, STARTING_HAND_SIZE);
  const remaining = shuffled.slice(STARTING_HAND_SIZE);
  return {
    hp: HERO_MAX_HP,
    maxHp: HERO_MAX_HP,
    mana: 1,
    maxMana: 1,
    hand: startingHand,
    deck: remaining,
    discard: [],
    divineShield: false,
  };
}

export function makeInitialBoard(deckA: CardId[], deckB: CardId[]): BoardState {
  return {
    a: makeHero(deckA),
    b: makeHero(deckB),
    lanes: [makeEmptyLane(), makeEmptyLane(), makeEmptyLane()],
    turn: 1,
    phase: "planning",
    augurRevealedA: [],
    augurRevealedB: [],
  };
}

function makeEmptyLane(): LaneState { return { a: null, b: null }; }

function shuffle<T>(input: readonly T[]): T[] {
  const out = input.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* ───────────────────────── Hero helpers ───────────────────────── */

/** Apply damage to a hero, honoring Divine Shield (Aegis on hero). Returns
 *  the new HeroState. If shielded, the shield is consumed and HP unchanged. */
export function damageHero(hero: HeroState, dmg: number): HeroState {
  if (dmg <= 0) return hero;
  if (hero.divineShield) return { ...hero, divineShield: false };
  return { ...hero, hp: Math.max(0, hero.hp - dmg) };
}

export function healHero(hero: HeroState, amount: number): HeroState {
  if (amount <= 0) return hero;
  return { ...hero, hp: Math.min(hero.maxHp, hero.hp + amount) };
}

/** Pull `n` cards from the deck → hand (reshuffles discard into deck if the
 *  deck runs dry mid-draw). Returns the new HeroState. Cap at HAND_CAP — extra
 *  cards are "burned" (lost to the void, HS-style overdraw). */
export function drawCards(hero: HeroState, n: number): HeroState {
  let { hand, deck, discard } = hero;
  hand = hand.slice();
  deck = deck.slice();
  discard = discard.slice();
  for (let i = 0; i < n; i++) {
    if (deck.length === 0) {
      if (discard.length === 0) break;
      deck = shuffle(discard);
      discard = [];
    }
    const card = deck.shift()!;
    if (hand.length < 8) hand.push(card);
    // else: burn (overdraw — design choice to discourage over-stuffing the hand)
  }
  return { ...hero, hand, deck, discard };
}

/* ───────────────────────── Creature helpers ───────────────────────── */

export function makeCreature(move: Move, side: Side): Creature {
  return {
    move,
    side,
    hp: CREATURE_STATS[move].hp,
    atkBuff: 0,
    divineShield: false,
    anchored: false,
    ripostePrimed: false,
  };
}

export function creatureEffectiveAtk(c: Creature): number {
  return Math.max(0, CREATURE_STATS[c.move].atk + c.atkBuff);
}

/** Apply damage to a creature, honoring its Divine Shield. Returns the new
 *  creature (or null if it died). */
export function damageCreature(c: Creature, dmg: number): Creature | null {
  if (dmg <= 0) return c;
  if (c.divineShield) return { ...c, divineShield: false };
  const hp = c.hp - dmg;
  if (hp <= 0) return null;
  return { ...c, hp };
}

/** A creature's "per-turn" buffs (atkBuff, divineShield, anchored, riposte)
 *  reset at the END of the turn so they don't snowball forever. Persistent
 *  damage (hp loss) stays. */
export function endOfTurnReset(c: Creature): Creature {
  return { ...c, atkBuff: 0, anchored: false, ripostePrimed: false };
  // NB: divineShield persists across turns intentionally (HS-style: until consumed).
}

/* ───────────────────────── Resolver ───────────────────────── */

/** Top-level turn resolver. Called when both sides have locked their intents.
 *  Returns the post-resolution board. The caller renders the diff with
 *  animations (combat hits, deaths, hero damage). */
export function resolveTurn(
  board: BoardState,
  intentA: TurnIntent,
  intentB: TurnIntent,
): BoardState {
  let b = board;

  // ─── 1. Spell phase ───
  b = applySpellPhase(b, intentA, "a");
  b = applySpellPhase(b, intentB, "b");

  // ─── 2. Summon phase ───
  b = applySummons(b, intentA, "a");
  b = applySummons(b, intentB, "b");

  // ─── 3. Combat phase ───
  b = resolveCombat(b);

  // ─── 4. End-of-turn reset (buffs drop, but persistent dmg stays) ───
  b = endOfTurnCleanup(b);

  // ─── 5. HP check ───
  if (b.a.hp <= 0 || b.b.hp <= 0) {
    return { ...b, phase: "match-end" };
  }

  return b;
}

/** Apply one side's spells, ordered by spellPriority asc (defensive first).
 *  Each spell consumes its mana cost from the side's pool. Spells that
 *  can't be paid for at the moment they'd fire are skipped silently. */
function applySpellPhase(board: BoardState, intent: TurnIntent, side: Side): BoardState {
  const ordered = intent.spells.slice().sort((s1, s2) => {
    return spellPriority(s1.id) - spellPriority(s2.id);
  });
  let b = board;
  for (const spell of ordered) {
    const card = CARDS[spell.id];
    const hero = side === "a" ? b.a : b.b;
    if (hero.mana < card.cost) continue;
    // Spend mana up-front so the same card can't be "fizzled" twice for cost.
    b = {
      ...b,
      [side]: { ...hero, mana: hero.mana - card.cost },
    } as BoardState;
    const ctx: ArenaSpellContext = { board: b, side, spell };
    b = applyArenaSpell(ctx);
  }
  return b;
}

/** Drop new creatures from the side's summons onto their chosen lanes. If
 *  the side already has a creature on a lane, the new one REPLACES (the old
 *  dies silently — design choice so summons can't be wasted but also can't
 *  stack). Costs 1 mana per summon; skipped if mana runs out. */
function applySummons(board: BoardState, intent: TurnIntent, side: Side): BoardState {
  let b = board;
  for (const summon of intent.summons) {
    const hero = side === "a" ? b.a : b.b;
    if (hero.mana < 1) break;
    const lanes = b.lanes.slice() as [LaneState, LaneState, LaneState];
    const lane = { ...lanes[summon.lane] };
    lane[side] = makeCreature(summon.move, side);
    lanes[summon.lane] = lane;
    b = {
      ...b,
      lanes,
      [side]: { ...hero, mana: hero.mana - 1 },
    } as BoardState;
  }
  return b;
}

/** Run combat across all 3 lanes. Damage is applied SIMULTANEOUSLY (both
 *  creatures' new HP computed from the original state of the lane). Empty
 *  lane → attacker hits the opposing hero for its effective ATK. */
function resolveCombat(board: BoardState): BoardState {
  let b = board;
  for (let i = 0; i < b.lanes.length; i++) {
    b = resolveLaneCombat(b, i as LaneIndex);
    if (b.a.hp <= 0 || b.b.hp <= 0) break; // short-circuit on lethal
  }
  return b;
}

function resolveLaneCombat(board: BoardState, laneIdx: LaneIndex): BoardState {
  const lane = board.lanes[laneIdx];
  const ca = lane.a;
  const cb = lane.b;

  if (ca && cb) {
    // Both creatures present → trade. Damage values computed BEFORE either
    // dies so trades are symmetric (Hearthstone-style).
    const atkA = creatureEffectiveAtk(ca);
    const atkB = creatureEffectiveAtk(cb);
    const dmgToA = atkB + (moveCountersMove(cb.move, ca.move) ? 1 : 0);
    const dmgToB = atkA + (moveCountersMove(ca.move, cb.move) ? 1 : 0);
    let newA: Creature | null = damageCreature(ca, dmgToA);
    let newB: Creature | null = damageCreature(cb, dmgToB);
    // Riposte: if a creature died AND was riposte-primed, its killer dies too.
    if (!newA && ca.ripostePrimed && newB) newB = null;
    if (!newB && cb.ripostePrimed && newA) newA = null;
    const lanes = board.lanes.slice() as [LaneState, LaneState, LaneState];
    lanes[laneIdx] = { a: newA, b: newB };
    return { ...board, lanes };
  }

  if (ca && !cb) {
    // A's creature attacks B's hero unopposed.
    return { ...board, b: damageHero(board.b, creatureEffectiveAtk(ca)) };
  }

  if (cb && !ca) {
    // B's creature attacks A's hero unopposed.
    return { ...board, a: damageHero(board.a, creatureEffectiveAtk(cb)) };
  }

  return board; // both lanes empty
}

function endOfTurnCleanup(board: BoardState): BoardState {
  const lanes = board.lanes.map((lane) => ({
    a: lane.a ? endOfTurnReset(lane.a) : null,
    b: lane.b ? endOfTurnReset(lane.b) : null,
  })) as [LaneState, LaneState, LaneState];
  return { ...board, lanes };
}

/* ───────────────────────── Turn lifecycle ───────────────────────── */

/** Advance the board to the next planning turn: mana ↑ by 1 (cap MANA_CAP),
 *  mana refreshes to maxMana, each hero draws 1 card. Clears any per-turn
 *  reveal state (Augur, etc.). */
export function advanceToNextTurn(board: BoardState): BoardState {
  const nextTurn = board.turn + 1;
  const a = refreshHero(drawCards(board.a, 1));
  const b = refreshHero(drawCards(board.b, 1));
  return {
    ...board,
    turn: nextTurn,
    phase: "planning",
    a, b,
    augurRevealedA: [],
    augurRevealedB: [],
  };
}

function refreshHero(hero: HeroState): HeroState {
  const newMaxMana = Math.min(MANA_CAP, hero.maxMana + 1);
  return { ...hero, maxMana: newMaxMana, mana: newMaxMana };
}

/* ───────────────────────── Match result ───────────────────────── */

export function matchResult(board: BoardState): ArenaMatchResult | null {
  if (board.phase !== "match-end") return null;
  const aLost = board.a.hp <= 0;
  const bLost = board.b.hp <= 0;
  const winner: Side | "draw" =
    aLost && bLost ? "draw" :
    aLost ? "b" :
    bLost ? "a" : "draw";
  return {
    winner,
    finalA: board.a,
    finalB: board.b,
    turns: board.turn,
  };
}
