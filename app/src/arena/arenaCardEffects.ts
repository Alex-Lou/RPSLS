/**
 * Constellation Pro — card-as-spell effect table.
 *
 * Each of the 46 existing CardIds (from ranked/cards.ts) gets an Arena-mode
 * effect distinct from its Ranked effect (since the underlying mechanics
 * are different: HP/board state vs round wins). For MVP we ship effects
 * for ~15 cards; the rest fall back to a no-op + console warning so they
 * can be filtered out of the deck-builder in Arena context.
 *
 * Spell priorities (lower = earlier in the spell phase):
 *   100  defensive setup — Aegis, Anchor, Riposte
 *   200  buffs / debuffs — Precision, Surge, Curse, Tide
 *   300  utility / draw  — Prescience, Augur, Oracle, Mirror, Heist
 *   400  direct damage / removal — Supernova, Vortex
 *
 * Cards not yet ported to Arena have spellPriority 999 and `arenaSupported`
 * false — the Arena DeckManager filters those out so they can't be loaded.
 *
 * See docs/CONSTELLATION_PRO_DESIGN.md for the locked adaptations.
 */

import { drawCards, damageHero, healHero, damageCreature, makeCreature } from "./arenaRules";
import {
  getMyCreatureOnLane,
  getOppCreatureOnLane,
  withMyCreatureOnLane,
  withOppCreatureOnLane,
  withSideHero,
  oppSide,
} from "./arenaSpellHelpers";
import {
  applyGaia, applySablier, applyOffre, applyRempart, applyBenediction,
  applyOracleInverse, applyCascade, applyEchappee, applyMascarade, applySangsue,
  applyTrouNoir, applyMarchandAmes, applyParadoxe, applyJuge, applyGenese,
} from "./arenaPhase2Spells";
import { type BoardState, type Creature, type LaneState, type PlayedSpell, type Side } from "./arenaTypes";
import type { CardId } from "../ranked/rankedTypes";

export interface ArenaSpellContext {
  board: BoardState;
  side: Side;
  spell: PlayedSpell;
}

/* ───────────────────────── Priority table ───────────────────────── */

const PRIORITY_TABLE: Partial<Record<CardId, number>> = {
  // Defensive setup (100)
  aegis:        100,
  anchor:       110,
  riposte:      120,
  // Healing / hp recovery (140) — lands BEFORE buffs so a healed creature
  // benefits from a same-turn ATK boost.
  "second-wind": 140,
  gaia:         145,
  // Mana / tempo (160) — fires early so the extra mana can be spent on
  // the same turn.
  sablier:      160,
  offre:        170,
  // Buffs / debuffs (200)
  precision:    200,
  surge:        210,
  tide:         220,
  rempart:      225,
  benediction:  228,
  curse:        230,
  // Utility / draw (300)
  prescience:   300,
  augur:        310,
  oracle:       320,
  "oracle-inverse": 325,
  mirror:       330,
  cascade:      335,
  echappee:     340,
  mascarade:    345,
  // Direct damage / removal (400)
  heist:        400,
  sangsue:      405,
  supernova:    410,
  vortex:       420,
  "trou-noir":  430,
  "marchand-ames": 440,
  paradoxe:     450,
  // Hand / board wipes (500) — fire LAST so prior effects are accounted for.
  juge:         500,
  genese:       510,
};

export function spellPriority(id: CardId): number {
  return PRIORITY_TABLE[id] ?? 999;
}

/** Whether a card has an Arena adaptation. The Arena DeckManager hides
 *  cards that return false here so the deck-builder doesn't allow a 0-effect
 *  card to be slotted. Will grow as Phase 2 adapts the remaining 30 cards. */
export function arenaSupported(id: CardId): boolean {
  return id in PRIORITY_TABLE;
}

/* ───────────────────────── Effect dispatch ───────────────────────── */

export function applyArenaSpell(ctx: ArenaSpellContext): BoardState {
  const { board, side, spell } = ctx;
  switch (spell.id) {
    // ── Defensive setup ──
    case "aegis":       return applyAegis(board, side, spell);
    case "anchor":      return applyAnchor(board, side, spell);
    case "riposte":     return applyRiposte(board, side, spell);
    case "second-wind": return applySecondWind(board, side);
    // ── Buffs / debuffs ──
    case "precision":   return applyPrecision(board, side, spell);
    case "surge":       return applySurge(board, side, spell);
    case "tide":        return applyTide(board, side);
    case "curse":       return applyCurse(board, side, spell);
    // ── Utility / draw ──
    case "prescience":  return applyPrescience(board, side);
    case "augur":       return applyAugur(board, side);
    case "oracle":      return applyOracle(board, side);
    case "mirror":      return applyMirror(board, side, spell);
    // ── Healing ──
    case "gaia":        return applyGaia(board, side);
    // ── Mana / tempo ──
    case "sablier":     return applySablier(board, side);
    case "offre":       return applyOffre(board, side);
    // ── Buffs / debuffs ──
    case "rempart":     return applyRempart(board, side);
    case "benediction": return applyBenediction(board, side);
    // ── Utility / draw ──
    case "oracle-inverse": return applyOracleInverse(board, side);
    case "cascade":     return applyCascade(board, side);
    case "echappee":    return applyEchappee(board, side, spell);
    case "mascarade":   return applyMascarade(board, side);
    // ── Direct damage / removal ──
    case "heist":       return applyHeist(board, side);
    case "sangsue":     return applySangsue(board, side, spell);
    case "supernova":   return applySupernova(board, side, spell);
    case "vortex":      return applyVortex(board, side);
    case "trou-noir":   return applyTrouNoir(board, side, spell);
    case "marchand-ames": return applyMarchandAmes(board, side);
    case "paradoxe":    return applyParadoxe(board);
    // ── Hand / board wipes ──
    case "juge":        return applyJuge(board);
    case "genese":      return applyGenese(board);
    default:
      // Unadapted card — no-op for MVP. Phase 2 fills these in.
      // eslint-disable-next-line no-console
      console.warn(`[arena] card "${spell.id}" has no Arena effect yet`);
      return board;
  }
}

/* ───────────────────────── Individual spells ───────────────────────── */

/** Spock's Détaché malus — ANY of MY buffs (Aegis, Surge, Tide, etc.) that
 *  target a Spock creature get ignored silently. Spock lives in autarky.
 *  Sangsue/Échappée are NOT buffs (they read or destroy), they go through. */
function isDetached(c: Creature | null | undefined): boolean {
  return !!c && c.move === "spock";
}

/** Aegis — Divine Shield: lane-target → my creature there absorbs next dmg.
 *  Self-target → my HERO gets the shield. Spock Détaché ignores it.
 *  BONUS on a Pierre target: ALSO refills its Provocation charge to 1 — Aegis
 *  becomes the dedicated "rebuild the tank" tool when its charge is spent. */
function applyAegis(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind === "lane") {
    const c = getMyCreatureOnLane(board, side, spell.lane);
    if (!c || isDetached(c)) return board;
    const refilled = c.move === "rock"
      ? { ...c, divineShield: true, provocationCharges: Math.max(c.provocationCharges, 1) }
      : { ...c, divineShield: true };
    return withMyCreatureOnLane(board, side, spell.lane, refilled);
  }
  if (spell.kind === "self") {
    const hero = side === "a" ? board.a : board.b;
    return withSideHero(board, side, { ...hero, divineShield: true });
  }
  return board;
}

/** Anchor — my creature on that lane is IMMUNE to enemy spells this turn.
 *  Spock Détaché ignores it (Spock has Logique anyway, doesn't need it). */
function applyAnchor(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const c = getMyCreatureOnLane(board, side, spell.lane);
  if (!c || isDetached(c)) return board;
  return withMyCreatureOnLane(board, side, spell.lane, { ...c, anchored: true });
}

/** Riposte — if my creature dies in combat this turn, its killer dies too.
 *  Spock Détaché ignores it. */
function applyRiposte(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const c = getMyCreatureOnLane(board, side, spell.lane);
  if (!c || isDetached(c)) return board;
  return withMyCreatureOnLane(board, side, spell.lane, { ...c, ripostePrimed: true });
}

/** Second Wind — heal +4 HP to my hero. */
function applySecondWind(board: BoardState, side: Side): BoardState {
  const hero = side === "a" ? board.a : board.b;
  return withSideHero(board, side, healHero(hero, 4));
}

/** Precision — +2 ATK this turn to my creature. Spock Détaché ignores it. */
function applyPrecision(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const c = getMyCreatureOnLane(board, side, spell.lane);
  if (!c || isDetached(c)) return board;
  return withMyCreatureOnLane(board, side, spell.lane, { ...c, atkBuff: c.atkBuff + 2 });
}

/** Surge — +3 ATK this turn to my creature. Spock Détaché ignores it. */
function applySurge(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const c = getMyCreatureOnLane(board, side, spell.lane);
  if (!c || isDetached(c)) return board;
  return withMyCreatureOnLane(board, side, spell.lane, { ...c, atkBuff: c.atkBuff + 3 });
}

/** Tide — +1 ATK this turn to ALL my creatures. Spock Détaché skipped. */
function applyTide(board: BoardState, side: Side): BoardState {
  const lanes = board.lanes.map((lane) => {
    const me = side === "a" ? lane.a : lane.b;
    if (!me || isDetached(me)) return lane;
    const bumped: Creature = { ...me, atkBuff: me.atkBuff + 1 };
    return side === "a" ? { ...lane, a: bumped } : { ...lane, b: bumped };
  }) as [LaneState, LaneState, LaneState];
  return { ...board, lanes };
}

/** Curse — -2 ATK this turn on the opp's creature on the chosen lane.
 *  Blocked by Anchor OR by Logique (Spock's spell immunity). */
function applyCurse(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const opp = getOppCreatureOnLane(board, side, spell.lane);
  if (!opp || opp.anchored || opp.spellImmune) return board;
  return withOppCreatureOnLane(board, side, spell.lane, { ...opp, atkBuff: opp.atkBuff - 2 });
}

/** Prescience — draw 2 cards. */
function applyPrescience(board: BoardState, side: Side): BoardState {
  const hero = side === "a" ? board.a : board.b;
  return withSideHero(board, side, drawCards(hero, 2));
}

/** Augur — reveal the opp's hand to the casting side. (Stored on the board
 *  so the UI can render the peek for one turn.) */
function applyAugur(board: BoardState, side: Side): BoardState {
  const opp = side === "a" ? board.b : board.a;
  if (side === "a") return { ...board, augurRevealedB: opp.hand.slice(0, 4) };
  return { ...board, augurRevealedA: opp.hand.slice(0, 4) };
}

/** Oracle — draw 3 cards. */
function applyOracle(board: BoardState, side: Side): BoardState {
  const hero = side === "a" ? board.a : board.b;
  return withSideHero(board, side, drawCards(hero, 3));
}

/** Mirror — copy the opp's creature on a lane onto YOUR side of the same
 *  lane (if your side of that lane is empty). The copy starts at full HP. */
function applyMirror(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind !== "lane") return board;
  const opp = getOppCreatureOnLane(board, side, spell.lane);
  const mine = getMyCreatureOnLane(board, side, spell.lane);
  if (!opp || mine) return board;
  // Pass my affinity so the copy gets the Voie bonus if applicable.
  const myAffinity = (side === "a" ? board.a : board.b).affinity;
  return withMyCreatureOnLane(board, side, spell.lane, makeCreature(opp.move, side, myAffinity));
}

/** Heist — 3 damage to the opp HERO + draw 1 card. */
function applyHeist(board: BoardState, side: Side): BoardState {
  const oppS = oppSide(side);
  const oppHero = oppS === "a" ? board.a : board.b;
  const damaged = damageHero(oppHero, 3);
  let after = withSideHero(board, oppS, damaged);
  const mine = side === "a" ? after.a : after.b;
  after = withSideHero(after, side, drawCards(mine, 1));
  return after;
}

/** Supernova — 6 damage to a target (lane creature OR opp hero). */
function applySupernova(board: BoardState, side: Side, spell: PlayedSpell): BoardState {
  if (spell.kind === "hero") {
    const oppS = oppSide(side);
    const oppHero = oppS === "a" ? board.a : board.b;
    return withSideHero(board, oppS, damageHero(oppHero, 6));
  }
  if (spell.kind === "lane") {
    const opp = getOppCreatureOnLane(board, side, spell.lane);
    // Spock's Logique fizzle hostile spells, just like Anchor.
    if (!opp || opp.anchored || opp.spellImmune) return board;
    const damaged = damageCreature(opp, 6);
    return withOppCreatureOnLane(board, side, spell.lane, damaged);
  }
  return board;
}

/** Vortex — rotate the opp's creatures clockwise across their 3 lanes. */
function applyVortex(board: BoardState, side: Side): BoardState {
  const oppS = oppSide(side);
  const lanes = board.lanes.slice() as [LaneState, LaneState, LaneState];
  const c0 = oppS === "a" ? lanes[0].a : lanes[0].b;
  const c1 = oppS === "a" ? lanes[1].a : lanes[1].b;
  const c2 = oppS === "a" ? lanes[2].a : lanes[2].b;
  // 0→1, 1→2, 2→0
  const newC: [Creature | null, Creature | null, Creature | null] = [c2, c0, c1];
  for (let i = 0; i < 3; i++) {
    if (oppS === "a") lanes[i] = { ...lanes[i], a: newC[i] };
    else lanes[i] = { ...lanes[i], b: newC[i] };
  }
  return { ...board, lanes };
}

/* Phase 2 spells (gaia, sablier, offre, rempart, benediction, oracle-inverse,
 * cascade, echappee, mascarade, sangsue, trou-noir, marchand-ames, paradoxe,
 * juge, genese) live in arenaPhase2Spells.ts — imported above. */
