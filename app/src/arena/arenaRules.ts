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

import { alog, alogSetTurn, csnap } from "./arenaLog";
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
  type PlayedSpell,
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
 *  Ranked are IGNORED in Arena — they don't exist as concept here.
 *  `affinity` is the Constellation Pro v2 Voie picked by this player. */
export function makeHero(deckIds: CardId[], affinity?: Move): HeroState {
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
    affinity,
  };
}

export function makeInitialBoard(
  deckA: CardId[],
  deckB: CardId[],
  affinityA?: Move,
  affinityB?: Move,
): BoardState {
  return {
    a: makeHero(deckA, affinityA),
    b: makeHero(deckB, affinityB),
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
 *  cards are "burned" (lost to the void — classic overdraw rule). */
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

export function makeCreature(move: Move, side: Side, affinity?: Move): Creature {
  const stats = CREATURE_STATS[move];
  const matchesAffinity = affinity !== undefined && affinity === move;
  // Voie bonuses (Constellation Pro v2 Couche 1) — applied at summon if the
  // creature's move matches the hero's affinity. See ArenaLobby's VOIE_BONUS
  // for the user-facing description.
  //   Pierre  : provocationCharges 2 (au lieu de 1)
  //   Ciseaux : hp +1 (HP 2 au lieu de 1 — survit à un échange)
  //   Spock   : voieAtkBonus +1 (ATK perm 3 au lieu de 2)
  //   Feuille / Lézard : à câbler dans une 2e passe (Fanaison ralentie +
  //     Esquive 2 charges nécessitent de refactor wiltedSteps + dodgeCharge).
  const voieRockCharges = matchesAffinity && move === "rock" ? 2 : (move === "rock" ? 1 : 0);
  const voieScissorsHpBonus = matchesAffinity && move === "scissors" ? 1 : 0;
  const voieAtkBonus = matchesAffinity && move === "spock" ? 1 : 0;
  return {
    move,
    side,
    hp: stats.hp + voieScissorsHpBonus,
    atkBuff: 0,
    divineShield: false,
    anchored: false,
    ripostePrimed: false,
    // Innate RPSLS passives — one per symbol, tied to RPSLS identity.
    taunt:       move === "rock",     // 🛡 Provocation
    stifles:     move === "paper",    // 🌿 Étouffe (UI badge only — actual
                                       //   check uses move === "paper" || "spock")
    pierces:     move === "scissors", // ⚔ Tranchant
    dodgeCharge: move === "lizard",   // ✨ Esquive
    spellImmune: move === "spock",    // 🧬 Logique
    summonedThisTurn: true,           // Lente (Pierre 0 ATK) / Lent (Lézard 1)
    wiltedSteps: 0,                    // Fanaison (Feuille: -1/turn)
    combatBlunted: false,              // Émoussé (Ciseaux: -1 after 1st combat)
    provocationCharges: voieRockCharges,
    voieAtkBonus,
  };
}

export function creatureEffectiveAtk(c: Creature): number {
  const base = CREATURE_STATS[c.move].atk + c.atkBuff + c.voieAtkBonus;
  // ── Lente / Lent : the turn a Pierre or Lézard is summoned, its ATK is
  //    suppressed (Pierre → 0, Lézard → 1). All other moves attack normally
  //    the turn they land. Buff stacking still applies (a Surge on Pierre
  //    the turn it's summoned still goes through).
  if (c.summonedThisTurn) {
    if (c.move === "rock")   return Math.max(0, 0 + c.atkBuff + c.voieAtkBonus);
    if (c.move === "lizard") return Math.max(0, 1 + c.atkBuff + c.voieAtkBonus);
  }
  // ── Fanaison : Feuille loses 1 ATK per turn elapsed since summon, floor 1.
  //    So a freshly summoned Paper is 3, next turn 2, then 1, then stays 1.
  if (c.move === "paper" && c.wiltedSteps > 0) {
    return Math.max(1, CREATURE_STATS.paper.atk - c.wiltedSteps + c.atkBuff + c.voieAtkBonus);
  }
  // ── Émoussé : Ciseaux loses 1 ATK permanently after its first combat.
  if (c.combatBlunted) {
    return Math.max(0, base - 1);
  }
  return Math.max(0, base);
}

/** Apply damage to a creature, honoring its defenses in order:
 *   1. Esquive (Lézard 1-charge) — intrinsèque, prioritaire sur divineShield.
 *   2. Divine Shield (Aegis spell) — consommé au 1er dégât.
 *  Returns the new creature, or null if it died. */
export function damageCreature(c: Creature, dmg: number): Creature | null {
  if (dmg <= 0) return c;
  if (c.dodgeCharge) return { ...c, dodgeCharge: false };
  if (c.divineShield) return { ...c, divineShield: false };
  const hp = c.hp - dmg;
  if (hp <= 0) return null;
  return { ...c, hp };
}

/** Set combatBlunted on a surviving Scissors. Idempotent — re-flagging an
 *  already-blunted Scissors is a no-op. */
function bluntOnCombat(c: Creature): Creature {
  if (c.move === "scissors" && !c.combatBlunted) {
    return { ...c, combatBlunted: true };
  }
  return c;
}

/** Variant used by Tranchant (Scissors) attackers — bypasses divineShield.
 *  Esquive still applies (it's intrinsic to the defender's nature). */
function damageCreaturePierce(c: Creature, dmg: number): Creature | null {
  if (dmg <= 0) return c;
  if (c.dodgeCharge) return { ...c, dodgeCharge: false };
  // skip divineShield — pierced by Tranchant
  const hp = c.hp - dmg;
  if (hp <= 0) return null;
  return { ...c, hp };
}

/** A creature's "per-turn" buffs (atkBuff, anchored, riposte) reset at the
 *  END of the turn so they don't snowball forever. Persistent damage stays.
 *  Innate passives (taunt, stifles, pierces, spellImmune) and consumed
 *  resources (dodgeCharge, combatBlunted) persist across turns.
 *  - divineShield: persists across turns until consumed by damage.
 *  - summonedThisTurn: cleared (the "Lente/Lent" malus only bites turn 1).
 *  - wiltedSteps: incremented for Paper (drives Fanaison). */
export function endOfTurnReset(c: Creature): Creature {
  const wilted = c.move === "paper" ? c.wiltedSteps + 1 : c.wiltedSteps;
  return {
    ...c,
    atkBuff: 0,
    anchored: false,
    ripostePrimed: false,
    summonedThisTurn: false,
    wiltedSteps: wilted,
  };
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

  // ─── 1. Spell phase ─── (fairness fix: intercalate sides by priority)
  b = applyAllSpells(b, intentA, intentB);

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
 *  can't be paid for at the moment they'd fire are skipped silently.
 *
 *  NOTE — kept for backwards compatibility / single-side callers. The
 *  resolver should use applyAllSpells (below) which intercales the two
 *  sides by priority for fairness. See docs/CONSTELLATION_PRO_AUDIT.md
 *  bug #1 for the asymmetry this single-side helper would cause if used
 *  for both sides sequentially. */
export function applySpellPhase(board: BoardState, intent: TurnIntent, side: Side): BoardState {
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

/** Apply BOTH sides' spells, INTERCALATED by priority — fixes the audit
 *  bug #1 where A's offensive spells fired before B's defensive spells
 *  could react. Same priority across sides : tie-break by side a first
 *  (documented bias — alternative is random which breaks reproducibility).
 *  Same priority WITHIN a side : original tap order (intent.spells order). */
export function applyAllSpells(board: BoardState, intentA: TurnIntent, intentB: TurnIntent): BoardState {
  const combined: Array<{ spell: PlayedSpell; side: Side; idx: number }> = [
    ...intentA.spells.map((spell, idx) => ({ spell, side: "a" as Side, idx })),
    ...intentB.spells.map((spell, idx) => ({ spell, side: "b" as Side, idx })),
  ];
  combined.sort((x, y) => {
    const pdiff = spellPriority(x.spell.id) - spellPriority(y.spell.id);
    if (pdiff !== 0) return pdiff;
    // Same priority — break by side (a before b), then by original order
    // within the side. Keeps the resolution reproducible and predictable.
    if (x.side !== y.side) return x.side === "a" ? -1 : 1;
    return x.idx - y.idx;
  });
  let b = board;
  for (const { spell, side } of combined) {
    const card = CARDS[spell.id as CardId];
    const hero = side === "a" ? b.a : b.b;
    if (hero.mana < card.cost) continue;
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
 *  stack). Costs 1 mana per summon; skipped if mana runs out. Uses the
 *  hero's `affinity` to apply the Voie bonus at makeCreature time. */
export function applySummons(board: BoardState, intent: TurnIntent, side: Side): BoardState {
  let b = board;
  for (const summon of intent.summons) {
    const hero = side === "a" ? b.a : b.b;
    if (hero.mana < 1) {
      alog("summon", `SKIP ${side} ${summon.move} L${summon.lane} (no mana)`);
      break;
    }
    const lanes = b.lanes.slice() as [LaneState, LaneState, LaneState];
    const lane = { ...lanes[summon.lane] };
    const replaced = lane[side];
    lane[side] = makeCreature(summon.move, side, hero.affinity);
    lanes[summon.lane] = lane;
    if (replaced) {
      alog("summon", `${side} pose ${summon.move} L${summon.lane} (REMPLACE ${csnap(replaced)}) affinity=${hero.affinity ?? "∅"}`);
    } else {
      alog("summon", `${side} pose ${summon.move} L${summon.lane} affinity=${hero.affinity ?? "∅"}`);
    }
    b = {
      ...b,
      lanes,
      [side]: { ...hero, mana: hero.mana - 1 },
    } as BoardState;
  }
  return b;
}

/** Run combat on a SINGLE lane — exported so the UI can sequence the
 *  3-lane combat phase one lane at a time (better readability + per-lane
 *  shake/death anim cues). The full-board resolver below just chains this. */
export function resolveLaneCombatAt(board: BoardState, laneIdx: LaneIndex): BoardState {
  return resolveLaneCombat(board, laneIdx);
}

/** Run combat across all 3 lanes. Damage is applied SIMULTANEOUSLY (both
 *  creatures' new HP computed from the original state of the lane). Empty
 *  lane → attacker hits the opposing hero for its effective ATK.
 *  Exported for UI sequencing. */
export function resolveCombat(board: BoardState): BoardState {
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
  // ENTRY log : confirme que resolveLaneCombat est bien appelée pour cette
  // lane avec quelles créatures. Permet de diagnostiquer "combat T0 L0 n'a
  // pas eu lieu" — si on voit pas cet entry log alors que post-summons
  // montre 2 créatures, c'est que resolveLaneCombatAt n'est pas appelée.
  alog("combat", `L${laneIdx} ENTER ca=${ca?.move ?? "∅"} cb=${cb?.move ?? "∅"}`);

  if (ca && cb) {
    const counterAB = moveCountersMove(ca.move, cb.move);
    const counterBA = moveCountersMove(cb.move, ca.move);
    alog("combat", `L${laneIdx} BOTH-PRESENT counterAB=${counterAB} counterBA=${counterBA}`);

    if (counterAB && !counterBA) {
      alog("combat", `L${laneIdx} branch=A-wins (counterAB && !counterBA)`);
      // A counters B in RPSLS. Save order (highest priority first):
      //  1. Esquive (B Lézard dodgeCharge) → B survives, A doesn't pursue.
      //  2. Aegis (B divineShield) UNLESS A is Tranchant (Scissors pierce
      //     Aegis at combat). Aegis consumes, B survives, A doesn't pursue.
      //  3. Otherwise: B dies AND A's ATK pursues to B's hero (counter
      //     "swing-through" 2026-06-09). Pursuit can still be deflected
      //     by a charged Pierre on B's side (consumes 1 charge).
      const winnerA = bluntOnCombat(ca);
      const lanes = board.lanes.slice() as [LaneState, LaneState, LaneState];
      if (cb.dodgeCharge) {
        alog("combat", `L${laneIdx} A wins → ESQUIVE save B (dodge consumed)`);
        lanes[laneIdx] = { a: winnerA, b: { ...cb, dodgeCharge: false } };
        return { ...board, lanes };
      }
      if (cb.divineShield && !ca.pierces) {
        alog("combat", `L${laneIdx} A wins → AEGIS save B (shield consumed)`);
        lanes[laneIdx] = { a: winnerA, b: { ...cb, divineShield: false } };
        return { ...board, lanes };
      }
      lanes[laneIdx] = { a: winnerA, b: null };
      // Alex feedback D : kill bonus pour le côté attaquant (A a tué B).
      const updatedBoard = { ...board, lanes, a: { ...board.a, killBonusPending: true } };
      const deflect = findDeflector(updatedBoard, "b");
      if (deflect) {
        alog("combat", `L${laneIdx} A wins → B die. Poursuite hero b → DEFLECTED par Pierre L${deflect.lane}`);
        return consumeProvocation(updatedBoard, deflect);
      }
      const atkA = creatureEffectiveAtk(winnerA);
      alog("combat", `L${laneIdx} A wins → B die. Poursuite hero b atk=${atkA}`);
      return { ...updatedBoard, b: damageHero(updatedBoard.b, atkA) };
    }
    if (counterBA && !counterAB) {
      alog("combat", `L${laneIdx} branch=B-wins (counterBA && !counterAB)`);
      const winnerB = bluntOnCombat(cb);
      const lanes = board.lanes.slice() as [LaneState, LaneState, LaneState];
      if (ca.dodgeCharge) {
        alog("combat", `L${laneIdx} B wins → ESQUIVE save A (dodge consumed)`);
        lanes[laneIdx] = { a: { ...ca, dodgeCharge: false }, b: winnerB };
        return { ...board, lanes };
      }
      if (ca.divineShield && !cb.pierces) {
        alog("combat", `L${laneIdx} B wins → AEGIS save A (shield consumed)`);
        lanes[laneIdx] = { a: { ...ca, divineShield: false }, b: winnerB };
        return { ...board, lanes };
      }
      lanes[laneIdx] = { a: null, b: winnerB };
      // Alex feedback D : kill bonus pour le côté attaquant (B a tué A).
      const updatedBoard = { ...board, lanes, b: { ...board.b, killBonusPending: true } };
      const deflect = findDeflector(updatedBoard, "a");
      if (deflect) {
        alog("combat", `L${laneIdx} B wins → A die. Poursuite hero a → DEFLECTED par Pierre L${deflect.lane}`);
        return consumeProvocation(updatedBoard, deflect);
      }
      const atkB = creatureEffectiveAtk(winnerB);
      alog("combat", `L${laneIdx} B wins → A die. Poursuite hero a atk=${atkB}`);
      return { ...updatedBoard, a: damageHero(updatedBoard.a, atkB) };
    }

    // Mirror match (same symbol on both sides) → normal ATK/HP trade.
    // Damage values computed BEFORE either dies so trades are symmetric.
    const atkA = creatureEffectiveAtk(ca);
    const atkB = creatureEffectiveAtk(cb);
    // Tranchant (Scissors) bypasses opp Aegis. The attacker's flag controls
    // what the DEFENDER's shield can do.
    let newA: Creature | null = cb.pierces
      ? damageCreaturePierce(ca, atkB)
      : damageCreature(ca, atkB);
    let newB: Creature | null = ca.pierces
      ? damageCreaturePierce(cb, atkA)
      : damageCreature(cb, atkA);
    // Riposte: if a creature died AND was riposte-primed, its killer dies too.
    if (!newA && ca.ripostePrimed && newB) newB = null;
    if (!newB && cb.ripostePrimed && newA) newA = null;
    // Émoussé — Ciseaux that SURVIVED a combat exchange lose 1 ATK
    // permanently. The flag is consumed: subsequent combats keep it but
    // creatureEffectiveAtk reads it once (−1 cap stays).
    if (newA && newA.move === "scissors" && !newA.combatBlunted) {
      newA = { ...newA, combatBlunted: true };
    }
    if (newB && newB.move === "scissors" && !newB.combatBlunted) {
      newB = { ...newB, combatBlunted: true };
    }
    const lanes = board.lanes.slice() as [LaneState, LaneState, LaneState];
    lanes[laneIdx] = { a: newA, b: newB };
    // Alex feedback D : mirror trade kill bonus — chaque side qui a tué
    // récupère un bonus. Si A killed B → A gets bonus. Si both died → both
    // bonus (mutual destruction = double récompense, agressivité OK).
    const heroA = !newB ? { ...board.a, killBonusPending: true } : board.a;
    const heroB = !newA ? { ...board.b, killBonusPending: true } : board.b;
    return { ...board, lanes, a: heroA, b: heroB };
  }

  // TAUNT (Provocation): if the would-be-attacked side has a CHARGED
  // taunt creature anywhere on the board, the undefended-lane attack is
  // deflected onto that creature AND it consumes 1 provocationCharge.
  // EXCEPT if the ATTACKER's side has a Paper (Étouffe) or Spock (Logique)
  // alive — RPSLS-coherent anti-taunt suppression.
  //
  // 🔴 BUG FIX 2026-06-09 : findDeflector + hasAntiTaunt prennent maintenant
  // le board ACTUEL en paramètre (au lieu de lire le closure outer `board`).
  // Avant, après mort d'une créature en combat, le code lisait toujours le
  // board ORIGINAL → trouvait la créature qui venait de mourir comme
  // déflecteur valide → consumeProvocation no-op (rock=null) → hero ne
  // prenait pas son dégât (silent fail). Cause directe du "Pierre vs Paper
  // → aucun mort, aucun dégât" qu'Alex a flagué.
  const hasAntiTaunt = (b: BoardState, side: Side): boolean =>
    b.lanes.some((l) => {
      const c = side === "a" ? l.a : l.b;
      return !!c && (c.move === "paper" || c.move === "spock");
    });
  function findDeflector(b: BoardState, defenderSide: Side): { lane: LaneIndex; side: Side } | null {
    const attackerSide: Side = defenderSide === "a" ? "b" : "a";
    if (hasAntiTaunt(b, attackerSide)) return null;
    for (let i = 0; i < 3; i++) {
      const lane = i as LaneIndex;
      const c = defenderSide === "a" ? b.lanes[lane].a : b.lanes[lane].b;
      if (c && c.taunt && c.provocationCharges > 0) {
        return { lane, side: defenderSide };
      }
    }
    return null;
  }
  /** Apply 1 charge consumption to the deflecting Pierre — returns a new
   *  board with the rock's provocationCharges decremented. */
  function consumeProvocation(board: BoardState, deflector: { lane: LaneIndex; side: Side }): BoardState {
    const lanes = board.lanes.slice() as [LaneState, LaneState, LaneState];
    const cur = lanes[deflector.lane];
    const rock = deflector.side === "a" ? cur.a : cur.b;
    if (!rock) return board;
    const decremented: Creature = { ...rock, provocationCharges: Math.max(0, rock.provocationCharges - 1) };
    lanes[deflector.lane] = deflector.side === "a" ? { ...cur, a: decremented } : { ...cur, b: decremented };
    return { ...board, lanes };
  }

  if (ca && !cb) {
    const deflect = findDeflector(board, "b");
    if (deflect) {
      alog("combat", `L${laneIdx} ${csnap(ca)} undefended → hero b DEFLECTED par Pierre L${deflect.lane}`);
      return consumeProvocation(board, deflect);
    }
    const atk = creatureEffectiveAtk(ca);
    alog("combat", `L${laneIdx} ${csnap(ca)} undefended → hero b atk=${atk}`);
    return { ...board, b: damageHero(board.b, atk) };
  }

  if (cb && !ca) {
    const deflect = findDeflector(board, "a");
    if (deflect) {
      alog("combat", `L${laneIdx} ${csnap(cb)} undefended → hero a DEFLECTED par Pierre L${deflect.lane}`);
      return consumeProvocation(board, deflect);
    }
    const atk = creatureEffectiveAtk(cb);
    alog("combat", `L${laneIdx} ${csnap(cb)} undefended → hero a atk=${atk}`);
    return { ...board, a: damageHero(board.a, atk) };
  }

  return board; // both lanes empty
}

export function endOfTurnCleanup(board: BoardState): BoardState {
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
  alogSetTurn(nextTurn);
  alog("turn", `=== Tour ${nextTurn} === a.hp=${board.a.hp} b.hp=${board.b.hp}`);
  // Snapshot du board pour suivi externe (Alex flag : "tu dois avoir des
  // logs qui disent ce que je vois au front"). Format compact :
  // L0 a:rock(1/3,⚔1,🛡1) b:rock(3/3,⚔0L,🛡1)
  // L1 a:∅ b:scissors(1/1,⚔4)
  // L2 a:paper(1/3,⚔3F) b:∅
  for (let i = 0; i < 3; i++) {
    const la = board.lanes[i].a;
    const lb = board.lanes[i].b;
    const fmt = (c: typeof la): string => {
      if (!c) return "∅";
      const stats = CREATURE_STATS[c.move];
      const atk = creatureEffectiveAtk(c);
      const flags: string[] = [];
      if (c.divineShield) flags.push("🛡");
      if (c.dodgeCharge) flags.push("✨");
      if (c.taunt && c.provocationCharges > 0) flags.push(`P${c.provocationCharges}`);
      if (c.summonedThisTurn && (c.move === "rock" || c.move === "lizard")) flags.push("L");
      if (c.move === "paper" && c.wiltedSteps > 0) flags.push(`F${c.wiltedSteps}`);
      if (c.combatBlunted) flags.push("É");
      return `${c.move}(${c.hp}/${stats.hp},⚔${atk}${flags.length ? "," + flags.join("") : ""})`;
    };
    alog("state", `L${i} a:${fmt(la)} b:${fmt(lb)}`);
  }
  // Alex feedback 2026-06-09 D : "récompenser l'agression" → si tu as
  // tué une créature opp ce tour, tu pioches +1 carte bonus au tour
  // suivant. killBonusPending reset après la pioche bonus.
  const drawA = 2 + (board.a.killBonusPending ? 1 : 0);
  const drawB = 2 + (board.b.killBonusPending ? 1 : 0);
  const a = refreshHero({ ...drawCards(board.a, drawA), killBonusPending: false });
  const b = refreshHero({ ...drawCards(board.b, drawB), killBonusPending: false });
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
