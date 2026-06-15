import type { CardId } from "../../ranked/rankedTypes";

export type Side = "a" | "b";

/** Persona CPU — pick aléatoire au match start, garde la cohérence tout le
 *  match (Alex 2026-06-11 "varier les niveaux et mentalités"). Chaque persona
 *  module les choix de l'IA : focus Voie, agression, blocage de la Voie
 *  adverse, etc. */
export type CpuPersona = "tactician" | "aggressor" | "builder" | "defender";

export const CPU_PERSONAS: CpuPersona[] = ["tactician", "aggressor", "builder", "defender"];

export const CPU_PERSONA_LABEL: Record<CpuPersona, string> = {
  tactician: "Tacticien",
  aggressor: "Agresseur",
  builder:   "Bâtisseur",
  defender:  "Gardien",
};

/* ───────────────────────── Cast When Drawn ⚡ ───────────────────────── */

/** Famille visuelle d'une carte « à la pioche » (Cast When Drawn) → pilote la
 *  couleur + l'animation de ArenaCastOnDrawFX. */
export type CastFxKind = "mana" | "heal" | "draw" | "risk" | "chaos";

/** Événement émis quand une carte Cast-When-Drawn se déclenche AU TIRAGE
 *  (cf. arenaCastOnDraw.ts). `label` = résumé lisible de l'effet réellement
 *  appliqué (« +2 MANA », « PIOCHE 2 · −2 PV », « PILE → +3 MANA »…). */
export interface CastOnDrawEvent {
  id: CardId;
  fxKind: CastFxKind;
  label: string;
}

export interface HeroState {
  hp: number;
  maxHp: number;
  affinity?: import("../../engine/game").Move;
  /** Aegis : lock 1×/match RETIRÉ (Alex 2026-06-11). Le champ reste optional
   *  pour la back-compat des saves persistées ; jamais set ni lu côté code
   *  vivant. À nettoyer du save schema dans une migration future. */
  aegisCastThisMatch?: boolean;
  /** Alex feedback D 2026-06-09 : "récompenser l'agression" → si ce hero
   *  a tué une créature opp ce tour, il pioche +1 carte bonus au prochain
   *  tour. Set à true dans resolveLaneCombat quand une mort est causée,
   *  reset à false au début du tour suivant après la pioche bonus. */
  killBonusPending?: boolean;
  /** Lot C — Constellation 3⭐ : compteur cumulé de summons d'Affinité.
   *  Chaque fois que le hero pose son symbole d'Affinité, on incrémente.
   *  À 3 / 3, la constellation est complète → le Finisher se débloque
   *  (Lot D injecte la carte Finisher dans la main). Persiste tout le
   *  match (pas de reset). 0 si pas d'affinité choisie ou si aucune
   *  Affinité-summon faite jusqu'ici. Cap visuel à 3 mais la valeur
   *  peut dépasser — le Finisher est unique, déclencher 1× par match. */
  constellationCount: number;
  /** Lot C — flag "Finisher déjà débloqué", évite de redéclencher l'effet
   *  d'unlock à chaque tour une fois passé 3 ⭐. Set à true au moment où
   *  constellationCount atteint 3 pour la 1ère fois. */
  finisherUnlocked?: boolean;
  /** Lot D — Finisher déjà cast ce match (1× par match max). La carte
   *  Finisher est injectée dans la main à 3⭐ ; après usage elle est
   *  consommée et ne peut pas être ré-injectée. */
  finisherUsed?: boolean;
  /** Lot D — flag VERGER ÉTERNEL : Fanaison off + heal hero +1/tour persistent
   *  jusqu'à la fin du match. Vérifié dans endOfTurnReset + creatureEffectiveAtk. */
  vergerActive?: boolean;
  /** Lot D — flag LAME COSMIQUE : Tranchant pierce TOUT (Aegis, Provoc,
   *  anti-taunt) pour toutes mes créatures Tranchant. Vérifié dans
   *  resolveLaneCombat (save check) et findDeflector (skip). */
  lameActive?: boolean;
  /** Lot D — flag MÉTAMORPHOSE : Esquive infinie pour mes Lézard (dodge
   *  refresh à chaque endOfTurnReset). */
  metamorphoseActive?: boolean;
  /** Lot D — flag CALCUL QUANTIQUE : tous mes sorts coûtent −1m (min 0).
   *  Vérifié dans applyAllSpells.cost. */
  calculActive?: boolean;
  /** Persona du CPU (Alex 2026-06-11) — choisie au match start côté CPU.
   *  Module les heuristiques de l'IA : agression, focus sur sa Voie, focus
   *  sur contrer la Voie joueur, défensivité. undefined côté joueur. */
  cpuPersona?: CpuPersona;
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
  /** Cartes LÉGENDAIRES jouées — EXILÉES (Alex 2026-06-13 économie expert) :
   *  jamais reshufflées, 1 usage par partie. Une légendaire défaussée SANS
   *  être jouée (Juge, Cascade) recycle normalement — l'exil sanctionne le
   *  CAST, pas la défausse. */
  exiled: CardId[];
  /** Aegis "divine shield" — next damage source is absorbed (then this drops to 0). */
  divineShield: boolean;
  /** ⚡ Cartes « à la pioche » (Cast When Drawn) déclenchées par le DERNIER
   *  drawCards (pioche de tour / pioche d'effet). Transient : lu par l'UI pour
   *  jouer l'anim ⚡, ré-écrit à chaque drawCards. JAMAIS persisté (le board
   *  Arena est match-local). Alex 2026-06-13. */
  castOnDrawEvents?: CastOnDrawEvent[];
}
