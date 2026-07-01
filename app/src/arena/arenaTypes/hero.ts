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
  /** FATIGUE (Alex 2026-06-17 rethink Phase 1) : nombre de tours où ce héros a
   *  pioché alors que son deck était SEC (vide). Chaque tour à sec inflige
   *  `fatigueStacks` PV de dégât (1, 2, 3…) → horloge léthale qui FORCE la fin
   *  quand les cartes s'épuisent (fini le point mort RPSLS prévisible). 0/absent
   *  tant que le deck a des cartes. Match-local, jamais persisté. */
  fatigueStacks?: number;
  /** ENGINES de Voie (Alex 2026-06-23, pivot « Voie globale ») — un compteur héros
   *  par Voie qui monte sur la partie et booste tout le camp (cf. arenaEngines).
   *  Persistent tout le match, capés, 0 au boardInit. Montagne = pas de compteur
   *  héros (les Strates vivent sur les créatures via voieAtkBonus). */
  rockStack?: number;    // 🪨 Montagne — jauge vers Forteresse (boost = Strates sur les Pierres)
  seveStack?: number;    // 🌿 Forêt — régén héros/tour (cap 3)
  trancheStack?: number; // ✂️ Tranchant — +ATK global au camp (cap 3)
  mirageStack?: number;  // 🦎 Mirage — +Esquive au summon des Lézards (cap 3)
  cosmosCount?: number;  // 🖖 Cosmos — chip inévitable/tour (cap 3)
  /** 🌿 FORÊT — « Sève nourrie ce tour » (Alex 2026-06-27, refonte « Sève
   *  entretenue »). Posé en combat quand une Feuille remporte un counter
   *  (riseEngineOnCounterWin), lu en fin de tour par seveHealAmount (soin
   *  conditionnel) + decaySeveIfStarved (érosion), puis reset. Sustain à
   *  ENTRETENIR : pas de win Feuille ce tour = 0 soin + jauge −1. Match-local. */
  seveFedThisTurn?: boolean;
  /** Lot C — flag "Finisher déjà débloqué", évite de redéclencher l'effet
   *  d'unlock à chaque tour une fois la jauge d'engine pleine. Set à true au
   *  moment où engineMaxed(hero) devient vrai pour la 1ère fois (cf. resolver
   *  .refreshConstellation). */
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
  /** SILLAGE SPECTRAL (Mirage, 2026-06-28) — aura active après cast : la 1ère
   *  fois qu'un de mes Lézards esquive CHAQUE tour, je pioche 1. `sillageActive`
   *  persiste tout le match ; `sillageDodgedThisTurn` est posé en combat à
   *  l'esquive, lu + reset en endOfTurnCleanup (cap 1 pioche/tour). */
  sillageActive?: boolean;
  sillageDodgedThisTurn?: boolean;
  /** NUÉE SPECTRALE (Mirage, 2026-06-28) — CE TOUR, mes Lézards sont
   *  imblocables : ils ignorent le RPSLS-lock (ne meurent pas), bypassent leur
   *  lane et frappent le héros adverse. Posé au cast, lu en combat, reset en
   *  endOfTurnCleanup. */
  nueeActive?: boolean;
  /** ÉCRASEMENT TELLURIQUE (Montagne, 2026-06-30) — CE TOUR, ce héros ne peut PAS
   *  être soigné par la régen Forêt (Sève/Verger) : posé sur l'adverse au cast, lu
   *  par seveHealAmount en endOfTurnCleanup, reset juste après. Perce le mur de
   *  régen Forêt (talon Montagne #2). */
  healLockedThisTurn?: boolean;
  /** GRONDEMENT (Montagne, 2026-06-30) — aura PERSISTANTE : chaque fin de tour, le
   *  héros adverse subit des dégâts = mes Strates en jeu (cap grondementCap). Posé
   *  au cast, lu en endOfTurnCleanup (applyEnginesEndOfTurn), JAMAIS reset (aura
   *  tout le match). Counterable : wiper mes Pierres coupe le chip. */
  tremorActive?: boolean;
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
