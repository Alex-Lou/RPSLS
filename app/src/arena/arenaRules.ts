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
import { AFFINITY_TO_FINISHER } from "./arenaFinishers";
import { resolveLaneCombatAt as _rlCombatAt, resolveCombat as _rCombat } from "./arenaCombat";
import {
  CREATURE_STATS,
  HERO_MAX_HP,
  MANA_CAP,
  MAX_SPELLS_PER_TURN,
  STARTING_HAND_SIZE,
  type ArenaMatchResult,
  type BoardState,
  type Creature,
  type HeroState,
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
    constellationCount: 0,
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

/** Alex feedback 2026-06-09 Round 7 — limites de copies par rareté en main :
 *  common 3, rare 2, epic 1, legendary 1. Empêche le spam d'une seule carte
 *  puissante. Plus la carte est rare, plus son cap en main est restrictif. */
const HAND_RARITY_CAP: Record<string, number> = {
  common: 3,
  rare: 2,
  epic: 1,
  legendary: 1,
};

/** Pull `n` cards from the deck → hand (reshuffles discard into deck if the
 *  deck runs dry mid-draw). Returns the new HeroState. Cap at HAND_CAP — extra
 *  cards sont "burned" (lost to the void — classic overdraw rule).
 *
 *  Alex feedback Round 7 : si une pioche violerait le cap rareté en main
 *  (3 commons / 2 rares / 1 epic / 1 leg), retry une autre carte (option A
 *  "replace") jusqu'à 3 tentatives par slot avant burn. Préserve la curve
 *  CCG : le joueur garde un mix de raretés équilibré. */
export function drawCards(hero: HeroState, n: number): HeroState {
  let { hand, deck, discard } = hero;
  hand = hand.slice();
  deck = deck.slice();
  discard = discard.slice();
  for (let i = 0; i < n; i++) {
    // 3 tentatives par slot pour respecter le cap rareté (option A replace).
    let drawn: CardId | null = null;
    for (let attempt = 0; attempt < 3 && drawn === null; attempt++) {
      if (deck.length === 0) {
        if (discard.length === 0) break;
        deck = shuffle(discard);
        discard = [];
      }
      const card = deck.shift()!;
      const rarity = CARDS[card]?.rarity;
      const cap = rarity ? HAND_RARITY_CAP[rarity] : 99;
      const inHand = hand.filter((id) => id === card).length;
      if (inHand >= cap) {
        // Replace : retire cette carte au discard et retry une autre du deck.
        discard.push(card);
        continue;
      }
      drawn = card;
    }
    if (drawn === null) break; // 3 retries fail ou deck vide
    if (hand.length < 8) hand.push(drawn);
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
  //   Feuille : wiltSkipNext true → Fanaison ralentie (wilt tous les 2 tours)
  //   Lézard  : dodgeCharges 2 (au lieu de 1 — survit à 2 saves Esquive)
  const voieRockCharges = matchesAffinity && move === "rock" ? 2 : (move === "rock" ? 1 : 0);
  const voieScissorsHpBonus = matchesAffinity && move === "scissors" ? 1 : 0;
  const voieAtkBonus = matchesAffinity && move === "spock" ? 1 : 0;
  // Lot B Round 8 : Lézard base 1 charge dodge, Voie Lézard 2 charges.
  const dodgeCharges = move === "lizard" ? (matchesAffinity ? 2 : 1) : 0;
  // Voie Feuille : flag persistent + toggle wiltSkipNext démarre à true.
  // 1er endOfTurnReset SKIP (Feuille reste ATK 3 ce tour), 2e wilt à 1, 3e
  // SKIP, 4e wilt à 2, 5e SKIP, etc. → Fanaison divisée par 2.
  const voieFeuille = matchesAffinity && move === "paper";
  const wiltSkipNext = voieFeuille;
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
    dodgeCharges,                      // ✨ Esquive (Lézard 1 ou 2 charges)
    spellImmune: move === "spock",    // 🧬 Logique
    summonedThisTurn: true,           // Lente (Pierre 0 ATK) / Lent (Lézard 1)
    wiltedSteps: 0,                    // Fanaison (Feuille: -1/turn ou -1/2 turns Voie)
    voieFeuille,                       // Lot B Round 8 — flag Voie Feuille
    wiltSkipNext,                      // Voie Feuille slow wilt toggle
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
 *   1. Esquive (Lézard dodgeCharges) — intrinsèque, prioritaire sur divineShield.
 *      Consume 1 charge. Voie Lézard = 2 charges initiales.
 *   2. Divine Shield (Aegis spell) — consommé au 1er dégât.
 *  Returns the new creature, or null if it died. */
export function damageCreature(c: Creature, dmg: number): Creature | null {
  if (dmg <= 0) return c;
  if (c.dodgeCharges > 0) return { ...c, dodgeCharges: c.dodgeCharges - 1 };
  if (c.divineShield) return { ...c, divineShield: false };
  const hp = c.hp - dmg;
  if (hp <= 0) return null;
  return { ...c, hp };
}

// bluntOnCombat / damageCreaturePierce → déplacés dans ./arenaCombat.ts
// (refactor 2026-06-09 : arenaRules.ts dépassait 700 lignes).

/** A creature's "per-turn" buffs (atkBuff, anchored, riposte) reset at the
 *  END of the turn so they don't snowball forever. Persistent damage stays.
 *  Innate passives (taunt, stifles, pierces, spellImmune) and consumed
 *  resources (dodgeCharges, combatBlunted) persist across turns.
 *  - divineShield: persists across turns until consumed by damage.
 *  - summonedThisTurn: cleared (the "Lente/Lent" malus only bites turn 1).
 *  - wiltedSteps: incremented for Paper (drives Fanaison).
 *  - wiltSkipNext: Voie Feuille toggle — skip wilt this turn et flip false. */
export function endOfTurnReset(c: Creature): Creature {
  // Lot B Round 8 — Voie Feuille slow wilt (Fanaison ÷ 2) :
  //   voieFeuille=true + wiltSkipNext=true  → SKIP wilt ce tour, flip à false
  //   voieFeuille=true + wiltSkipNext=false → wilt + flip à true (skip prochain)
  //   voieFeuille=false (Feuille normale)   → wilt chaque tour, no toggle
  let wilted = c.wiltedSteps;
  let nextSkip = c.wiltSkipNext;
  if (c.move === "paper") {
    if (c.voieFeuille) {
      if (c.wiltSkipNext) {
        // Skip ce tour, prochain tour wilt.
        nextSkip = false;
      } else {
        // Wilt ce tour, prochain tour skip.
        wilted = c.wiltedSteps + 1;
        nextSkip = true;
      }
    } else {
      // Feuille normale (hors Voie) : wilt chaque tour.
      wilted = c.wiltedSteps + 1;
    }
  }
  return {
    ...c,
    atkBuff: 0,
    anchored: false,
    ripostePrimed: false,
    summonedThisTurn: false,
    wiltedSteps: wilted,
    wiltSkipNext: nextSkip,
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
  // Alex feedback 2026-06-09 v2 : aligné sur les caps UI (ArenaGame.addSpell)
  // — max MAX_SPELLS_PER_TURN sorts lane-target + 1 sort utility (self/hero)
  // par tour. Total max 3 sorts/tour. Le filet engine truncate selon les
  // mêmes règles pour rester cohérent avec ce que l'UI a laissé passer.
  const truncateByCaps = (intent: TurnIntent): TurnIntent => {
    let laneCount = 0;
    let utilityCount = 0;
    const kept: PlayedSpell[] = [];
    for (const s of intent.spells) {
      if (s.kind === "lane") {
        if (laneCount >= MAX_SPELLS_PER_TURN) continue;
        laneCount++;
      } else {
        if (utilityCount >= 1) continue;
        utilityCount++;
      }
      kept.push(s);
    }
    return kept.length === intent.spells.length ? intent : { ...intent, spells: kept };
  };
  const safeIntentA = truncateByCaps(intentA);
  const safeIntentB = truncateByCaps(intentB);
  if (safeIntentA !== intentA) {
    alog("spell", `BYPASS BLOCKED a — intent had ${intentA.spells.length} spells (cap lane=${MAX_SPELLS_PER_TURN} + utility=1), truncated to ${safeIntentA.spells.length}`);
  }
  if (safeIntentB !== intentB) {
    alog("spell", `BYPASS BLOCKED b — intent had ${intentB.spells.length} spells (cap lane=${MAX_SPELLS_PER_TURN} + utility=1), truncated to ${safeIntentB.spells.length}`);
  }
  const combined: Array<{ spell: PlayedSpell; side: Side; idx: number }> = [
    ...safeIntentA.spells.map((spell, idx) => ({ spell, side: "a" as Side, idx })),
    ...safeIntentB.spells.map((spell, idx) => ({ spell, side: "b" as Side, idx })),
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
    // Lot D — CALCUL QUANTIQUE : tous mes sorts coûtent −1m (min 0).
    const effectiveCost = hero.calculActive ? Math.max(0, card.cost - 1) : card.cost;
    if (hero.mana < effectiveCost) continue;
    b = {
      ...b,
      [side]: { ...hero, mana: hero.mana - effectiveCost },
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
    // Lot C — Constellation 3⭐ : Alex feedback 2026-06-09 — passage en mode
    // SIMULTANÉ (vs cumulé). Le compteur compte les Voie-créatures VIVANTES
    // sur le board, pas les poses cumulées. Force le joueur à garder ses 3
    // Voies en vie pour atteindre 3⭐.
    const aliveVoieCount = countAliveAffinity(lanes, side, hero.affinity);
    const unlocked = aliveVoieCount >= 3 && !hero.finisherUnlocked;
    if (hero.affinity && summon.move === hero.affinity) {
      alog("summon", `${side} constellation ⭐ ${aliveVoieCount}/3 ${unlocked ? "→ FINISHER UNLOCKED" : ""}`);
    }
    // Lot D — Injection automatique de la carte Finisher dans la main au
    // moment où on passe 3⭐ pour la 1ère fois. Choix selon l'Affinité.
    let nextHand = hero.hand;
    if (unlocked && hero.affinity) {
      const finisherId = AFFINITY_TO_FINISHER[hero.affinity];
      nextHand = [...hero.hand, finisherId];
      alog("summon", `${side} → carte Finisher [${finisherId}] injectée en main`);
    }
    b = {
      ...b,
      lanes,
      [side]: {
        ...hero,
        mana: hero.mana - 1,
        hand: nextHand,
        constellationCount: aliveVoieCount,
        finisherUnlocked: hero.finisherUnlocked || unlocked,
      },
    } as BoardState;
  }
  return b;
}

/** Lot C v2 — Count les créatures de `side` qui correspondent à son Affinité
 *  ET sont vivantes. Utilisé pour la Constellation 3⭐ SIMULTANÉE (Alex
 *  feedback 2026-06-09) : il faut maintenir 3 Voies en vie en même temps
 *  pour débloquer le Finisher, pas juste poser 3× cumulés. */
export function countAliveAffinity(
  lanes: readonly LaneState[],
  side: Side,
  affinity: Move | undefined,
): number {
  if (!affinity) return 0;
  let count = 0;
  for (const lane of lanes) {
    const c = lane[side];
    if (c && c.move === affinity) count++;
  }
  return count;
}

// resolveLaneCombat / resolveLaneCombatAt / resolveCombat → re-exportés
// depuis ./arenaCombat (refactor 2026-06-09 : arenaRules.ts dépassait 700
// lignes). Imports en haut du fichier, re-exports ici pour préserver le
// contract des callsites qui importent depuis "./arenaRules".
const resolveCombat = _rCombat;
export const resolveLaneCombatAt = _rlCombatAt;
export { resolveCombat };

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
      if (c.dodgeCharges > 0) flags.push(c.dodgeCharges > 1 ? `✨${c.dodgeCharges}` : "✨");
      if (c.taunt && c.provocationCharges > 0) flags.push(`P${c.provocationCharges}`);
      if (c.summonedThisTurn && (c.move === "rock" || c.move === "lizard")) flags.push("L");
      if (c.move === "paper" && c.wiltedSteps > 0) flags.push(`F${c.wiltedSteps}`);
      if (c.combatBlunted) flags.push("É");
      return `${c.move}(${c.hp}/${stats.hp},⚔${atk}${flags.length ? "," + flags.join("") : ""})`;
    };
    alog("state", `L${i} a:${fmt(la)} b:${fmt(lb)}`);
  }
  // Cartes dispos (Alex feedback : "ajouter les cartes de chacun dans les
  // logs pour voir ce que chacun aurait pu/du jouer"). Mains complètes
  // listées avec mana + flags (kill bonus pending, aegis lock).
  alog("hand", `a hand=[${board.a.hand.join(",")}] deck=${board.a.deck.length} discard=${board.a.discard.length} mana=${board.a.mana}/${board.a.maxMana}${board.a.killBonusPending ? " +K" : ""}${board.a.aegisCastThisMatch ? " [AEGIS-LOCK]" : ""}`);
  alog("hand", `b hand=[${board.b.hand.join(",")}] deck=${board.b.deck.length} discard=${board.b.discard.length} mana=${board.b.mana}/${board.b.maxMana}${board.b.killBonusPending ? " +K" : ""}${board.b.aegisCastThisMatch ? " [AEGIS-LOCK]" : ""}`);
  // Alex feedback 2026-06-09 D : "récompenser l'agression" → si tu as
  // tué une créature opp ce tour, tu pioches +1 carte bonus au tour
  // suivant. killBonusPending reset après la pioche bonus.
  const drawA = 2 + (board.a.killBonusPending ? 1 : 0);
  const drawB = 2 + (board.b.killBonusPending ? 1 : 0);
  // Lot D-bis Round 10 — hooks runtime Finishers persistants :
  // VERGER : si vergerActive, hero heal +1/tour (cumulé tant que actif)
  // MÉTAMORPHOSE : si metamorphoseActive, tous mes Lézard refill dodgeCharges
  // Note : LAME est traité in-combat (cf arenaCombat), pas ici.
  let lanesAfterFinishers = board.lanes;
  if (board.a.metamorphoseActive) {
    lanesAfterFinishers = lanesAfterFinishers.map((l) => ({
      ...l,
      a: l.a && l.a.move === "lizard" ? { ...l.a, dodgeCharges: Math.max(l.a.dodgeCharges, 1) } : l.a,
    })) as [LaneState, LaneState, LaneState];
    alog("turn", `a MÉTAMORPHOSE → Lézard dodge refresh`);
  }
  if (board.b.metamorphoseActive) {
    lanesAfterFinishers = lanesAfterFinishers.map((l) => ({
      ...l,
      b: l.b && l.b.move === "lizard" ? { ...l.b, dodgeCharges: Math.max(l.b.dodgeCharges, 1) } : l.b,
    })) as [LaneState, LaneState, LaneState];
    alog("turn", `b MÉTAMORPHOSE → Lézard dodge refresh`);
  }
  const heroAVerger = board.a.vergerActive ? { ...board.a, hp: Math.min(board.a.maxHp, board.a.hp + 1) } : board.a;
  const heroBVerger = board.b.vergerActive ? { ...board.b, hp: Math.min(board.b.maxHp, board.b.hp + 1) } : board.b;
  if (board.a.vergerActive) alog("turn", `a VERGER → +1 HP (${board.a.hp} → ${heroAVerger.hp})`);
  if (board.b.vergerActive) alog("turn", `b VERGER → +1 HP (${board.b.hp} → ${heroBVerger.hp})`);
  const a = refreshHero({ ...drawCards(heroAVerger, drawA), killBonusPending: false });
  const b = refreshHero({ ...drawCards(heroBVerger, drawB), killBonusPending: false });
  return {
    ...board,
    lanes: lanesAfterFinishers,
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
