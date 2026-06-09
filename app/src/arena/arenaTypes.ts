/**
 * Constellation Pro — pure types for the mini-CCG mode.
 *
 * Separate from the Ranked types (`ranked/rankedTypes.ts`) because the
 * game shape is fundamentally different: persistent creatures on lanes,
 * hero HP instead of round wins, simultaneous turn loop with mana that
 * scales 1→10.
 *
 * Re-uses the existing CardId union from rankedTypes — the 46 cards
 * become "spells" with a separate effect table (see arenaCardEffects).
 *
 * See docs/CONSTELLATION_PRO_DESIGN.md for the locked design.
 */

import type { Move } from "../engine/game";
import type { CardId } from "../ranked/rankedTypes";

/* ───────────────────────── Hero ───────────────────────── */

export const HERO_MAX_HP = 20;
export const MANA_CAP = 10;
export const LANE_COUNT = 3;
export const HAND_CAP = 8;
export const STARTING_HAND_SIZE = 4;
/** Soft cap on turns — if neither hero is dead by then, the lower-HP loses
 *  (sudden-death fail-safe so an over-defensive match still ends). */
export const TURN_HARD_CAP = 30;

export type Side = "a" | "b";

export interface HeroState {
  hp: number;
  maxHp: number;
  /** Constellation Pro v2 — the Voie (RPSLS affinity) chosen by this hero
   *  before the match. Creatures of this exact move get a passive bonus
   *  at summon time (provocationCharges, hp, voieAtkBonus). null = no
   *  affinity picked (fallback to defaults, no bonus). */
  affinity?: import("../engine/game").Move;
  /** Mana available THIS turn. Refreshes to maxMana at the start of each turn. */
  mana: number;
  /** Mana ceiling — increments by 1 every turn up to MANA_CAP. */
  maxMana: number;
  /** Cards in hand, max HAND_CAP. */
  hand: CardId[];
  /** Cards remaining in the draw pile. */
  deck: CardId[];
  /** Used cards waiting to be reshuffled when the deck empties. */
  discard: CardId[];
  /** Aegis "divine shield" — next damage source is absorbed (then this drops to 0). */
  divineShield: boolean;
}

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
  /** Description courte (1-2 phrases, fr) — pour l'inspect. */
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
export const MOVE_DESIGN_NOTES: Record<Move, MoveDesignNote> = {
  rock: {
    good: "Provocation board-wide gratuite à 1 mana — héros intouchable par voie libre.",
    bad: "Lente — 0 ATK le tour de son invocation (ne frappe pas tour 1). Puis ATK 1 ridicule.",
    counters: "Feuille OU Spock opp vivants → Provocation suspendue. Et les deux la one-shot en combat de lane.",
  },
  paper: {
    good: "Étouffe — annule la Provocation Pierre opp board-wide. DPS 3 solide à l'arrivée.",
    bad: "Fanaison — perd 1 ATK à chaque fin de tour (3→2→1, plancher 1). À jouer vite. HP 1.",
    counters: "Ciseaux OU Lézard opp en lane = one-shot la Feuille.",
  },
  scissors: {
    good: "Tranchant — perce les Aegis adverses. ATK 4 (le plus haut du roster).",
    bad: "Émoussé — −1 ATK permanent après son 1er combat (4→3). HP 1, fragile.",
    counters: "Pierre OU Spock opp en lane = one-shot le Ciseau.",
  },
  lizard: {
    good: "Esquive — ignore la 1ère blessure (charge unique) puis redevient normal 2/2.",
    bad: "Lent — 1 ATK le tour de son invocation (devient 2 ensuite).",
    counters: "Pierre OU Ciseaux opp en lane doivent attaquer 2× (la 1ère avalée par Esquive).",
  },
  spock: {
    good: "Logique — vigile anti-sorts (Curse/Trou Noir/Sangsue ignorés) + casse Provocation Pierre opp.",
    bad: "Détaché — TES propres sorts (Surge/Tide/Aegis…) ignorent Spock aussi. Il vit en autarcie.",
    counters: "Feuille OU Lézard opp en lane = one-shot Spock.",
  },
};

export const CREATURE_PASSIVES: Record<Move, CreaturePassive> = {
  rock: {
    id: "provocation",
    glyph: "🛡",
    name: "Provocation",
    desc: "Annule toutes les attaques en voie libre adverses tant qu'elle vit. SUSPENDUE si opp a une Feuille OU un Spock en jeu.",
    tone: "amber",
  },
  paper: {
    id: "etouffe",
    glyph: "🌿",
    name: "Étouffe",
    desc: "Casse la Provocation des Pierres adverses tant qu'elle vit. Anti-tank pur.",
    tone: "emerald",
  },
  scissors: {
    id: "tranchant",
    glyph: "⚔",
    name: "Tranchant",
    desc: "Au combat de lane, perce les boucliers divins (Aegis) adverses.",
    tone: "rose",
  },
  lizard: {
    id: "esquive",
    glyph: "✨",
    name: "Esquive",
    desc: "Ignore la 1ère blessure subie (charge unique). Ensuite redevient une créature 2/2 normale.",
    tone: "sky",
  },
  spock: {
    id: "logique",
    glyph: "🧬",
    name: "Logique",
    desc: "Vigile anti-magie : les sorts ciblés adverses (Curse/Trou Noir/Sangsue) fizzle sur lui. Casse aussi la Provocation Pierre opp.",
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
  /** Lézard's "Esquive" innate passive — the next damage source is ignored
   *  and this flag drops. Different from divineShield because it's INTRINSIC
   *  (not granted by a spell), and takes priority over divineShield when both
   *  are present. */
  dodgeCharge: boolean;
  /** Ciseaux' "Tranchant" — when this creature attacks in lane combat, the
   *  defender's divineShield is bypassed (full damage lands). Set inherently
   *  on Scissors at summon, never granted by spells. */
  pierces: boolean;
  /** Spock's "Logique" — opponent's spells that target THIS creature fizzle
   *  silently. Doesn't affect combat damage or summons replacement. Set
   *  inherently on Spock at summon. */
  spellImmune: boolean;
  /** Feuille's "Étouffe" — while this creature lives, OPP rocks lose their
   *  Provocation (taunt) effect. Set inherently on Paper at summon. The
   *  anti-taunt CHECK actually uses move === "paper" || "spock" so both
   *  RPSLS counters of Rock suppress its taunt; this flag is kept solely
   *  for the UI badge "🌿" on the Paper card. */
  stifles: boolean;
  /** True for the turn a creature is summoned. Reset to false in
   *  endOfTurnReset. Drives the "Lente" malus on Pierre (ATK 0 turn-of-
   *  summon) and "Lent" on Lézard (ATK 1 turn-of-summon, base 2). */
  summonedThisTurn: boolean;
  /** Counter that increments at every endOfTurnReset for Paper creatures.
   *  Drives the "Fanaison" malus: Feuille loses 1 ATK per turn elapsed,
   *  floor 1 (so 3 → 2 → 1 → 1 → 1). Stays at 0 on all other moves. */
  wiltedSteps: number;
  /** Set true on Scissors creatures AFTER their first combat exchange
   *  (whether they survive or not — kept for symmetry though only matters
   *  if they survive). Drives the "Émoussé" malus: −1 ATK permanent. */
  combatBlunted: boolean;
  /** Pierre's Provocation is now a CHARGE-LIMITED resource: 1 charge at
   *  summon, consumed by the first deflection. Once at 0, the Pierre stops
   *  redirecting attacks (badge + halo hide). Aegis (spell) cast on a Pierre
   *  refills +1 charge. Always 0 on non-Rock moves.
   *
   *  Voie de la Pierre (affinity match) : 2 charges initiales au lieu d'1.
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

/* ───────────────────────── Pending intents ───────────────────────── */

/** A side's planned actions for the current turn — locked at end-of-turn,
 *  consumed by the resolver. Both sides build this independently. */
export interface TurnIntent {
  /** Spells the side wants to play (in the order they tapped them). The
   *  resolver re-orders them by priority before firing. */
  spells: PlayedSpell[];
  /** Creatures the side wants to summon (one entry per lane it summons on). */
  summons: PlannedSummon[];
}

/** A spell card committed for this turn. Lane / target chosen at play-time. */
export type PlayedSpell =
  // Lane-targeted spell (aegis on a lane creature, surge buff a lane, etc.)
  | { id: CardId; kind: "lane"; lane: LaneIndex }
  // Self-targeted (heal hero, draw cards) — no further input
  | { id: CardId; kind: "self" }
  // Targeted on opp hero (heist deals 3 to opp face, supernova on hero)
  | { id: CardId; kind: "hero" }
  // No target — global / board-wide (tide, oracle, vortex)
  | { id: CardId; kind: "global" };

export interface PlannedSummon {
  lane: LaneIndex;
  move: Move;
}

/* ───────────────────────── Board state ───────────────────────── */

export interface BoardState {
  a: HeroState;
  b: HeroState;
  lanes: [LaneState, LaneState, LaneState];
  /** Current turn number, starts at 1, increments after each resolver fires. */
  turn: number;
  /** Active match phase — controls what each player can do. */
  phase: ArenaPhase;
  /** Cards Augur-revealed for the player about side A (i.e. what side A can
   *  see of side B's hand). Cleared each turn. */
  augurRevealedB: CardId[];
  augurRevealedA: CardId[];
}

export type ArenaPhase =
  | "draw"        // turn start, mana up, draw a card
  | "planning"    // both sides plan in parallel
  | "resolving"   // resolver running (spells → summons → combat)
  | "match-end";  // hero hit 0 HP

/* ───────────────────────── Match result ───────────────────────── */

export interface ArenaMatchResult {
  winner: Side | "draw";
  finalA: HeroState;
  finalB: HeroState;
  turns: number;
}

/* ───────────────────────── Targeting (UI-level) ───────────────────────── */

/** Spell target shape needed by a given card — drives the targeting UI.
 *  `lane`     = need a board lane (the next lane tap commits)
 *  `self`     = the spell hits my hero (auto-target, no further input)
 *  `hero`     = the spell hits the opp hero (auto-target)
 *  `global`   = board-wide / no target */
export type SpellTargetKind = "lane" | "self" | "hero" | "global";

/** Per-card target metadata. Used by the targeting machinery to decide
 *  whether tapping a card opens a lane picker or commits immediately.
 *  Typed as `Partial<Record<CardId, …>>` — cards without an entry default
 *  to "global" on lookup (see ArenaPlanPhase.CARD_TARGET_KIND fallback). */
export const CARD_TARGET_KIND: Partial<Record<CardId, SpellTargetKind>> = {
  aegis:        "lane",
  precision:    "lane",
  anchor:       "lane",
  "second-wind": "self",
  prescience:   "self",
  surge:        "lane",
  curse:        "lane",
  mirror:       "lane",
  riposte:      "lane",
  augur:        "global",
  heist:        "self",
  tide:         "global",
  oracle:       "self",
  vortex:       "global",
  supernova:    "hero",
  // Phase 2 spells
  gaia:         "self",
  sablier:      "self",
  offre:        "self",
  rempart:      "self",
  benediction:  "self",
  "oracle-inverse": "global",
  cascade:      "self",
  echappee:     "lane",
  mascarade:    "global",
  sangsue:      "lane",
  "trou-noir":  "lane",
  "marchand-ames": "self",
  paradoxe:     "global",
  juge:         "global",
  genese:       "global",
};

/** Active targeting state shared across the board + plan phase so that
 *  tapping a lane on the board can commit the same spell/summon the
 *  player started picking in the hand. Held in ArenaGame, passed down. */
export type ArenaTargeting =
  | { kind: "summon"; move: Move }
  | { kind: "spell"; id: CardId; targetKind: SpellTargetKind }
  | null;

/** For lane-targeted spells, WHICH side + WHICH slot kind they need so the
 *  board can highlight ONLY the valid slots (instead of "all empty mine"
 *  for everything). Drives the per-lane "✦ Cible ta créature" / "✦ Cible
 *  cette créature" / "✦ Invoquer ici" labels.
 *
 *  - "my-creature"             → highlight MY lanes that have a creature
 *  - "opp-creature"            → highlight OPP lanes that have a creature
 *  - "my-empty-opp-occupied"   → highlight MY lanes that are empty AND opp has a creature
 *  - "my-empty"                → highlight MY empty lanes (used by summons) */
export type LaneTargetSide = "my-creature" | "opp-creature" | "my-empty-opp-occupied" | "my-empty";

export const LANE_SPELL_TARGET_SIDE: Partial<Record<CardId, LaneTargetSide>> = {
  aegis:      "my-creature",
  precision:  "my-creature",
  anchor:     "my-creature",
  surge:      "my-creature",
  riposte:    "my-creature",
  echappee:   "my-creature",
  curse:      "opp-creature",
  sangsue:    "opp-creature",
  "trou-noir": "opp-creature",
  mirror:     "my-empty-opp-occupied",
};

/** Returns whether `lane` on `side` is a valid drop target for the active
 *  ArenaTargeting. Used by ArenaLaneSlot's clickable + label so each card
 *  highlights ONLY the slots it can actually target. */
export function isValidLaneTarget(
  targeting: ArenaTargeting,
  side: Side,
  lane: LaneIndex,
  lanes: { a: { move: Move } | null; b: { move: Move } | null }[],
  playerSide: Side,
): boolean {
  if (!targeting) return false;
  const isPlayerRow = side === playerSide;
  const mine = lanes[lane][playerSide];
  const opp  = lanes[lane][playerSide === "a" ? "b" : "a"];
  if (targeting.kind === "summon") {
    return isPlayerRow && !mine;
  }
  if (targeting.kind === "spell" && targeting.targetKind === "lane") {
    const tgtSide = LANE_SPELL_TARGET_SIDE[targeting.id] ?? "my-creature";
    if (tgtSide === "my-creature") return isPlayerRow && !!mine;
    if (tgtSide === "opp-creature") return !isPlayerRow && !!opp;
    if (tgtSide === "my-empty-opp-occupied") return isPlayerRow && !mine && !!opp;
    if (tgtSide === "my-empty") return isPlayerRow && !mine;
  }
  return false;
}

/** Human-readable label shown ON the valid slot (instead of generic "play here"). */
export function targetLabelFor(targeting: ArenaTargeting): string {
  if (!targeting) return "";
  if (targeting.kind === "summon") return "✦ Invoquer ici";
  if (targeting.kind === "spell" && targeting.targetKind === "lane") {
    const tgtSide = LANE_SPELL_TARGET_SIDE[targeting.id] ?? "my-creature";
    if (tgtSide === "my-creature") return "✦ Cible ta créature";
    if (tgtSide === "opp-creature") return "✦ Cible cette créature";
    if (tgtSide === "my-empty-opp-occupied") return "✦ Mirror ici";
    if (tgtSide === "my-empty") return "✦ Ici";
  }
  return "✦";
}

/* ───────────────────────── RPSLS counter table ───────────────────────── */

/** Returns true when `attacker` "counters" `defender" per RPSLS rules
 *  (deal +1 ATK bonus this exchange). Bidirectional table for clarity. */
export function moveCountersMove(attacker: Move, defender: Move): boolean {
  switch (attacker) {
    case "rock":     return defender === "scissors" || defender === "lizard";
    case "paper":    return defender === "rock"     || defender === "spock";
    case "scissors": return defender === "paper"    || defender === "lizard";
    case "lizard":   return defender === "paper"    || defender === "spock";
    case "spock":    return defender === "scissors" || defender === "rock";
  }
}
