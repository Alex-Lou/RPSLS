/**
 * Arena Phase-2 spell implementations (15 cards adapted after the initial 15).
 *
 * Extracted from arenaCardEffects.ts to keep that file under the project's
 * 400-line ceiling as the spell roster grows. Each function takes the same
 * (board, side, spell?) shape as the original handlers so the dispatch
 * switch in arenaCardEffects.ts can just import + delegate.
 *
 * The dispatch + priority table stay in arenaCardEffects.ts (single source
 * of truth for spell ordering); only the bodies live here.
 */

import { drawCards, damageHero, healHero, creatureEffectiveAtk } from "./arenaRules";
import {
  getMyCreatureOnLane,
  getOppCreatureOnLane,
  withMyCreatureOnLane,
  withOppCreatureOnLane,
  withSideHero,
  oppSide,
} from "./arenaSpellHelpers";
import { MANA_CAP, type BoardState, type Creature, type LaneState, type PlayedSpell, type Side } from "./arenaTypes";
import type { CardId } from "../ranked/rankedTypes";

/** Gaia — heal hero +6 HP. */
export function applyGaia(board: BoardState, side: Side): BoardState {
  const hero = side === "a" ? board.a : board.b;
  return withSideHero(board, side, healHero(hero, 6));
}

/** Sablier — +2 mana THIS turn, plafonné à MANA_CAP (8). Pure tempo. Le
 *  texte de carte Arena dit explicitement "plafond 8" — pas d'over-cap. */
export function applySablier(board: BoardState, side: Side): BoardState {
  const hero = side === "a" ? board.a : board.b;
  return withSideHero(board, side, { ...hero, mana: Math.min(MANA_CAP, hero.mana + 2) });
}

/** Offre — +2 to max mana permanently (cap MANA_CAP). L'illustration montre
 *  "+2" (Alex 2026-06-11), on suit l'image. Le mana courant grimpe aussi de
 *  +2 (capé au nouveau max) pour que le gain soit utilisable dès ce tour. */
export function applyOffre(board: BoardState, side: Side): BoardState {
  const hero = side === "a" ? board.a : board.b;
  const newMax = Math.min(MANA_CAP, hero.maxMana + 2);
  const newMana = Math.min(newMax, hero.mana + 2);
  return withSideHero(board, side, { ...hero, maxMana: newMax, mana: newMana });
}

/** Rempart — give every one of my creatures +2 max HP. Spock Détaché skipped. */
export function applyRempart(board: BoardState, side: Side): BoardState {
  const lanes = board.lanes.map((lane) => {
    const me = side === "a" ? lane.a : lane.b;
    if (!me || me.move === "spock") return lane;
    const buffed: Creature = { ...me, hp: me.hp + 2 };
    return side === "a" ? { ...lane, a: buffed } : { ...lane, b: buffed };
  }) as [LaneState, LaneState, LaneState];
  return { ...board, lanes };
}

/** Bénédiction — +1 ATK this turn to ALL my creatures. Spock Détaché skipped. */
export function applyBenediction(board: BoardState, side: Side): BoardState {
  const lanes = board.lanes.map((lane) => {
    const me = side === "a" ? lane.a : lane.b;
    if (!me || me.move === "spock") return lane;
    const buffed: Creature = { ...me, atkBuff: me.atkBuff + 1 };
    return side === "a" ? { ...lane, a: buffed } : { ...lane, b: buffed };
  }) as [LaneState, LaneState, LaneState];
  return { ...board, lanes };
}

/** Oracle Inverse — peek FULL opp hand (Augur shows the first 4 only).
 *  Reste affichée 2 tours comme Augur (Alex 2026-06-11). */
export function applyOracleInverse(board: BoardState, side: Side): BoardState {
  const opp = side === "a" ? board.b : board.a;
  if (side === "a") return { ...board, augurRevealedB: opp.hand.slice(), augurTurnsLeftB: 2 };
  return { ...board, augurRevealedA: opp.hand.slice(), augurTurnsLeftA: 2 };
}

/** Cascade — draw 3 cards, then discard 1 random from hand (cycle a bad hand). */
export function applyCascade(board: BoardState, side: Side): BoardState {
  const hero = side === "a" ? board.a : board.b;
  let after = drawCards(hero, 3);
  if (after.hand.length > 0) {
    const idx = Math.floor(Math.random() * after.hand.length);
    const droppedHand = [...after.hand.slice(0, idx), ...after.hand.slice(idx + 1)];
    after = { ...after, hand: droppedHand, discard: [...after.discard, after.hand[idx]] };
  }
  return withSideHero(board, side, after);
}

/** Échappée — destroy 1 of my own creatures on the chosen lane, draw 2.
 *  "Cycle" a bad creature into fresh cards. */
export function applyEchappee(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const c = getMyCreatureOnLane(board, side, spell.lane);
  if (!c) return board;
  let after = withMyCreatureOnLane(board, side, spell.lane, null);
  const hero = side === "a" ? after.a : after.b;
  after = withSideHero(after, side, drawCards(hero, 2));
  return after;
}

/** Mascarade — opp discards 1 random card from hand. */
export function applyMascarade(board: BoardState, side: Side): BoardState {
  const oppS = oppSide(side);
  const opp = oppS === "a" ? board.a : board.b;
  if (opp.hand.length === 0) return board;
  const idx = Math.floor(Math.random() * opp.hand.length);
  const newHand = [...opp.hand.slice(0, idx), ...opp.hand.slice(idx + 1)];
  const newDiscard = [...opp.discard, opp.hand[idx]];
  return withSideHero(board, oppS, { ...opp, hand: newHand, discard: newDiscard });
}

/** Sangsue — heal hero by the effective ATK of my creature on the lane.
 *  Uses creatureEffectiveAtk so the value matches what the creature
 *  actually deals in combat (CREATURE_STATS + atkBuff). */
export function applySangsue(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const c = getMyCreatureOnLane(board, side, spell.lane);
  if (!c) return board;
  const atk = creatureEffectiveAtk(c);
  const hero = side === "a" ? board.a : board.b;
  return withSideHero(board, side, healHero(hero, atk));
}

/** Trou Noir — destroy the opp's creature on a lane outright (ignores Anchor
 *  — this is a Singularity, not a poke). Spock's Logique IS strong enough to
 *  resist a single-target removal — the only sort that can clear Spock is
 *  combat or a board-wide (Genèse, Vortex). */
export function applyTrouNoir(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const opp = getOppCreatureOnLane(board, side, spell.lane);
  if (opp?.spellImmune) return board;
  return withOppCreatureOnLane(board, side, spell.lane, null);
}

/** Marchand d'Âmes — pay 2 HP, draw 3 cards. Faustian. */
export function applyMarchandAmes(board: BoardState, side: Side): BoardState {
  const hero = side === "a" ? board.a : board.b;
  const wounded = { ...hero, hp: Math.max(0, hero.hp - 2) };
  return withSideHero(board, side, drawCards(wounded, 3));
}

/** Paradoxe Temporel — both heroes take 5 damage. Self-harm board reset. */
export function applyParadoxe(board: BoardState): BoardState {
  return { ...board, a: damageHero(board.a, 5), b: damageHero(board.b, 5) };
}

/** Le Juge — both sides discard their full hand and draw 4 fresh. */
export function applyJuge(board: BoardState): BoardState {
  const reset = (h: BoardState["a"]): BoardState["a"] => {
    const discardAll = { ...h, discard: [...h.discard, ...h.hand], hand: [] as CardId[] };
    return drawCards(discardAll, 4);
  };
  return { ...board, a: reset(board.a), b: reset(board.b) };
}

/** Genèse — destroy ALL creatures on the board, both sides draw 3. */
export function applyGenese(board: BoardState): BoardState {
  const emptyLanes = board.lanes.map(() => ({ a: null, b: null })) as [LaneState, LaneState, LaneState];
  return {
    ...board,
    lanes: emptyLanes,
    a: drawCards(board.a, 3),
    b: drawCards(board.b, 3),
  };
}
