import type { Move } from "../../engine/game";
import type { Side } from "./hero";
import { tNow } from "../../i18n/core";

/* ───────────────────────── Creatures ───────────────────────── */

/** Base stats for each RPSLS move when summoned as a creature. */
export interface CreatureStats {
  atk: number;
  hp: number;
}

/** Stats per symbole — balanced for the "passive identity" pass.
 *  Pierre: low ATK / high HP (mur défensif, ne finit pas un héros).
 *  Feuille: high ATK / low HP (glass cannon, anti-tank — voir CREATURE_PASSIVES).
 *  Ciseaux: high ATK / low HP (glass cannon, ignore Aegis).
 *  Lézard: medium ATK / medium HP (survit grâce à Esquive 1-charge).
 *  Spock: medium ATK / high HP (immun aux sorts opp). */
export const CREATURE_STATS: Record<Move, CreatureStats> = {
  rock:     { atk: 1, hp: 3 },
  paper:    { atk: 3, hp: 1 },
  scissors: { atk: 4, hp: 1 },
  lizard:   { atk: 2, hp: 2 },
  spock:    { atk: 2, hp: 3 },
};

/** Per-symbole INNATE passive — gratuit, lié à la nature RPSLS du symbole.
 *  UI-facing metadata + a stable id the engine pattern-matches against. */
export interface CreaturePassive {
  /** Stable engine id — used in switch statements (rules/cards). */
  id: "provocation" | "etouffe" | "tranchant" | "esquive" | "logique";
  /** Affiché en haut-droit de la créature (carte compacte). */
  glyph: string;
  /** Nom court (label de l'inspect modal + HowItWorks grid). */
  name: string;
  /** Description courte (1-2 phrases, localisée via tNow) — pour l'inspect. */
  desc: string;
  /** Tailwind text/bg color hint pour le halo / chip. */
  tone: "amber" | "emerald" | "rose" | "sky" | "violet";
}

/** Per-move design notes: bon / moins bon / 2 contres directs.
 *  Surfaced in HowItWorks and the inspect modal so the player has the full
 *  picture from turn 1. The "2 contres" are the 2 RPSLS symbols that beat
 *  this one in classic RPSLS — they one-shot the creature in lane combat,
 *  killing the passive with it. Provocation has an extra suppression layer
 *  because it's board-wide (see hasAntiTaunt in arenaRules). */
export interface MoveDesignNote {
  good: string;
  bad: string;
  counters: string;
}
/** Textes localisés (i18n) : getters → lus dans la langue courante à chaque accès. */
const moveNote = (m: Move): MoveDesignNote => ({
  get good() { return tNow(`arena.movenote.${m}.good`); },
  get bad() { return tNow(`arena.movenote.${m}.bad`); },
  get counters() { return tNow(`arena.movenote.${m}.counters`); },
});
export const MOVE_DESIGN_NOTES: Record<Move, MoveDesignNote> = {
  rock: moveNote("rock"),
  paper: moveNote("paper"),
  scissors: moveNote("scissors"),
  lizard: moveNote("lizard"),
  spock: moveNote("spock"),
};

export const CREATURE_PASSIVES: Record<Move, CreaturePassive> = {
  rock: {
    id: "provocation",
    glyph: "🛡",
    get name() { return tNow("arena.passive.rock.name"); },
    get desc() { return tNow("arena.passive.rock.desc"); },
    tone: "amber",
  },
  paper: {
    id: "etouffe",
    glyph: "🌿",
    get name() { return tNow("arena.passive.paper.name"); },
    get desc() { return tNow("arena.passive.paper.desc"); },
    tone: "emerald",
  },
  scissors: {
    id: "tranchant",
    glyph: "⚔",
    get name() { return tNow("arena.passive.scissors.name"); },
    get desc() { return tNow("arena.passive.scissors.desc"); },
    tone: "rose",
  },
  lizard: {
    id: "esquive",
    glyph: "✨",
    get name() { return tNow("arena.passive.lizard.name"); },
    get desc() { return tNow("arena.passive.lizard.desc"); },
    tone: "sky",
  },
  spock: {
    id: "logique",
    glyph: "🧬",
    get name() { return tNow("arena.passive.spock.name"); },
    get desc() { return tNow("arena.passive.spock.desc"); },
    tone: "violet",
  },
};

/** A creature sitting on a lane. Carries persistent damage between turns
 *  (CCG-style: wounded creatures stay wounded). Buffs are one-turn flags. */
export interface Creature {
  move: Move;
  /** Owner side. */
  side: Side;
  /** Current HP — at max it equals CREATURE_STATS[move].hp, decreases on damage. */
  hp: number;
  /** Per-turn ATK modifier (Surge +3, Precision +2, Tide +1 to all, Curse -2). */
  atkBuff: number;
  /** Toile Gluante (2026-06-12) : la créature ne peut pas attaquer ce tour —
   *  ATK effectif forcé à 0 ET son counter est annulé en combat (elle survit
   *  mais n'inflige rien). Per-turn (reset par endOfTurnReset). */
  cannotAttack?: boolean;
  /** ÉCLIPSE (Mirage, 2026-06-28) : la créature est EN PHASE ce tour —
   *  intouchable (sa lane est GELÉE en combat : ni elle ni l'adverse n'agit,
   *  elle survit) et ne peut pas attaquer. Per-turn (reset par endOfTurnReset). */
  phasedOut?: boolean;
  /** PHÉNIX (2026-06-12) : TRUE sur une créature qui vient de RENAÎTRE (revive à
   *  1 PV en endOfTurnCleanup) → CreatureSlot joue une flamme de renaissance.
   *  Per-turn (effacé au endOfTurnReset suivant). */
  justRevived?: boolean;
  /** Per-turn flags. */
  divineShield: boolean;
  /** Anchor: this creature is immune to ENEMY spell effects this turn. */
  anchored: boolean;
  /** Riposte: if THIS creature dies during combat resolution, the killer dies too. */
  ripostePrimed: boolean;
  /** TAUNT (TCG-classic): while this creature is on the board,
   *  opponent's lane creatures cannot bypass to hit my HERO directly
   *  (they hit nothing instead — opp must clear my taunt-bearer first).
   *  Set inherently on Rock creatures at summon. */
  taunt: boolean;
  /** Lézard's "Esquive" innate passive — chaque charge ignore 1 damage source.
   *  Lézard base : 1 charge. Voie Lézard (affinity match) : BALANCE.mirage.voieLizardDodge
   *  charges (+ jauge Mirage, borné dodgeCapOnSummon). Métamorphose finisher :
   *  recharge UNIQUE au cast jusqu'à BALANCE.mirage.dodgeCumulativeCap.
   *
   *  Round 8 refactor : était `dodgeCharge: boolean`, maintenant un compteur.
   *  > 0 = peut esquiver (consume 1 par save). 0 = plus de save Esquive. */
  dodgeCharges: number;
  /** Ciseaux' "Tranchant" — when this creature attacks in lane combat, the
   *  defender's divineShield is bypassed (full damage lands). Set inherently
   *  on Scissors at summon, never granted by spells. */
  pierces: boolean;
  /** Tranchant CHARGE (Alex 2026-06-11) : true tant que le Tranchant n'a
   *  pas encore percé une Aegis. Au 1er bypass, set true → les attaques
   *  suivantes respectent la divineShield comme tout le monde. La Lame
   *  Finisher (lameActive sur le hero) IGNORE cette charge — pierce
   *  permanent pour le reste du match. */
  pierceUsed: boolean;
  /** Spock's "Logique" — opponent's spells that target THIS creature fizzle
   *  silently. Doesn't affect combat damage or summons replacement. Set
   *  inherently on Spock at summon. */
  spellImmune: boolean;
  /** True for the turn a creature is summoned. Reset to false in
   *  endOfTurnReset. Drives the "Lente" malus on Pierre (ATK 0 turn-of-
   *  summon) and "Lent" on Lézard (ATK 1 turn-of-summon, base 2). */
  summonedThisTurn: boolean;
  /** Counter that increments at every endOfTurnReset for Paper creatures.
   *  Drives the "Fanaison" malus: Feuille loses 1 ATK per turn elapsed,
   *  floor 1 (so 3 → 2 → 1 → 1 → 1). Stays at 0 on all other moves. */
  wiltedSteps: number;
  /** Voie Feuille (affinity match) — Round 8 : Fanaison RALENTIE. La Feuille
   *  Voie wilt tous les 2 tours au lieu de chaque tour. Persistant — set true
   *  au summon si makeCreature(paper, affinity=paper). */
  voieFeuille: boolean;
  /** Toggle pour Voie Feuille uniquement : démarre true → endOfTurnReset SKIP
   *  ce tour et flip false → next tour wilt et flip true → next SKIP, etc.
   *  Pour non-Voie Feuille : reste false, wilt à chaque tour normalement. */
  wiltSkipNext: boolean;
  /** Set true on Scissors creatures AFTER their first combat exchange
   *  (whether they survive or not — kept for symmetry though only matters
   *  if they survive). Drives the "Émoussé" malus: −1 ATK permanent. */
  combatBlunted: boolean;
  /** Pierre's Provocation is now a CHARGE-LIMITED resource: 1 charge at
   *  summon, consumed by the first deflection. Once at 0, the Pierre stops
   *  redirecting attacks (badge + halo hide). Aegis (spell) cast on a Pierre
   *  recharge la Provocation À 1 si elle est épuisée (max(charges, 1) — cf.
   *  applyAegis ; comportement validé live, ce n'est PAS un "+1" cumulable).
   *  Always 0 on non-Rock moves.
   *
   *  Voie de la Pierre (affinity match) : BALANCE.montagne.voieProvocationCharges
   *  charges initiales au lieu d'1.
   *
   *  Why a charge instead of permanent: Alex flagged that a board with
   *  several Pierres becomes a permanent stalemate. The charge forces a
   *  rotation: tank → recharge → tank, instead of spam → never lose. */
  provocationCharges: number;
  /** Constellation Pro v2 — permanent ATK bonus granted by the Voie
   *  (affinity). Applied at summon if creature.move === hero.affinity.
   *  Persists across turns (NOT reset by endOfTurnReset, unlike atkBuff).
   *  Today : Voie de Spock = +1 ATK perm. Other Voies use other flags
   *  (rock provocationCharges, scissors hp+1). */
  voieAtkBonus: number;
}

export type LaneIndex = 0 | 1 | 2;

/** One lane = one creature slot per side (MVP: max 1 each). */
export interface LaneState {
  a: Creature | null;
  b: Creature | null;
}
