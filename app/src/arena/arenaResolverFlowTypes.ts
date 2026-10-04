/**
 * Types du résolveur séquencé (arenaResolverFlow) : étapes de résolution et
 * arguments (setters React + callbacks). Extraits d'arenaResolverFlow.ts
 * (cap <400 lignes/fichier) — réexportés depuis arenaResolverFlow.
 */

import type { BoardState, LaneIndex, Side, TurnIntent } from "./arenaTypes";
import type { Move } from "../engine/game";
import type { RngPair } from "../engine/rng";
import type { CardId } from "../ranked/rankedTypes";
import type { ProjectileFX } from "./ArenaProjectileFX";
import type { LaneOutcome } from "./arenaTelemetry";

/** Resolver step labels — kept in sync with ArenaBoard's banner switch. */
export type ResolveStep =
  | "reveal-opp"   // showing CPU intent before any effect
  | "spells"       // both sides' spells just fired
  | "summons"      // new creatures just landed
  | "combat"       // lane combat just resolved
  | "settle";      // post-combat, before next turn

export interface ResolverFlowArgs {
  /** Board AFTER hand-cleanup (spells removed from hand) but BEFORE spell effects fire. */
  startBoard: BoardState;
  playerIntent: TurnIntent;
  cpuIntent: TurnIntent;
  /** Paire de PRNG seedés (un par camp, cf. engine/rng.ts) — résolution
   *  DÉTERMINISTE (lockstep Pro online / replay). Optionnel : absent →
   *  Math.random (comportement historique). */
  rng?: RngPair;
  /** Camp CANONIQUE du joueur local (défaut "a"). `playerIntent`/`cpuIntent`
   *  restent en PERSPECTIVE (moi / adversaire) ; ce champ sert UNIQUEMENT à
   *  replacer les deux intents dans l'ordre canonique a/b au moment de résoudre,
   *  pour que les DEUX clients (moi camp "a" OU "b") calculent le MÊME board
   *  (le résolveur départage a-avant-b → l'ordre canonique doit être partagé).
   *  Défaut "a" → intentA=moi, intentB=adversaire = comportement vs-CPU inchangé. */
  mySide?: Side;
  /** Pro online : la MORT SUBITE (ArenaSuddenDeath) tire au `Math.random` NON
   *  seedé → elle desyncrait les deux clients. En online on la NEUTRALISE : une
   *  égalité parfaite (double KO ou hard-cap à PV égaux) devient un NUL propre
   *  (match-end, les deux à 0). Défaut false → comportement vs-CPU inchangé. */
  noSuddenDeath?: boolean;
  /** Facteur appliqué aux SEULES pauses de lecture (révélation, invocations,
   *  fin de tour, victoire) — réglage « combat rapide ». 1 = rythme posé.
   *  Les durées d'animation (sorts, charges de lane) ne sont jamais réduites. */
  holdScale?: number;
  setBoard: (b: BoardState) => void;
  setOppPreview: (i: TurnIntent | null) => void;
  setPlayerPreview: (i: TurnIntent | null) => void;
  setResolveStep: (s: ResolveStep | null) => void;
  setCombatLane: (l: LaneIndex | null) => void;
  /** Camps qui CHARGENT sur la lane en combat (anti-mush, Alex 2026-06-17) :
   *  seul l'attaquant fonce ; le défenseur garde sa réaction au dégât.
   *  Optionnel (tests/headless). */
  setCombatChargers?: (sides: ("a" | "b")[]) => void;
  setHeroHit: (h: { side: "you" | "opp"; lane: LaneIndex; key: number } | null) => void;
  /** Set when an undefended-lane attack is DEFLECTED by a taunt creature.
   *  `defenderSide` owns the taunt. `rockLane` is the lane of the Pierre
   *  that ate the deflection — used by the UI to pull a dotted line from
   *  the attacker's lane to the Pierre + decrement its charge badge. */
  setTauntBlock: (b: { defenderSide: "a" | "b"; rockLane: LaneIndex; key: number } | null) => void;
  /** Anti-taunt bypass — set when an attack reaches a hero despite a charged
   *  Pierre, because the attacker carries Étouffe (Paper) / Logique (Spock)
   *  which cancel Provocation. `bypassedSide` owns the bypassed Pierre. */
  setAntiTaunt: (b: { bypassedSide: "a" | "b"; rockLane: LaneIndex; cause: "paper" | "spock"; key: number } | null) => void;
  /** Riposte d'esquive (Mirage) — set quand un Lézard va esquiver un counter et
   *  contre-attaquer : pop un chip sur la lane de l'ATTAQUANT (« meurt sans raison »
   *  → enfin expliqué, Alex 2026-06-28). Optionnel (tests/headless). */
  setRiposteFX?: (b: { attackerSide: "a" | "b"; lane: LaneIndex; key: number } | null) => void;
  /** Signature FX plein-board (Genèse, Supernova…) — déclenché au step SPELLS
   *  avec les ids de TOUS les sorts joués ce tour. ArenaSpellFX ne joue que
   *  ceux qui ont une signature ; le reste s'appuie sur les réactions
   *  par-créature (ArenaLaneSlot). Optionnel (tests/headless). */
  setSpellFX?: (fx: { ids: CardId[]; key: number } | null) => void;
  /** IMPACT FX plein-écran (Alex 2026-06-13) — déclenché sur un coup PUISSANT
   *  ou FATAL au héros, typé par le MOVE de l'attaquant (Ciseaux → entaille,
   *  Pierre → ébranlement…). Cf. ArenaImpactFX. */
  setImpactFX?: (fx: { move: Move; power: "strong" | "fatal"; key: number } | null) => void;
  /** Projectiles « cailloux » lane→lane — Jet de Caillou (1) + Éboulement AOE (N).
   *  Liste de tirs posée d'un coup (Alex 2026-06-24/25). Optionnel (tests/headless). */
  setProjectileFX?: (shots: ProjectileFX[]) => void;
  /** Called BEFORE the resolver advances to the next turn — clears the
   *  player's pending intent and stops the "resolving" lock. */
  onSettle: (finalBoard: BoardState) => void;
  /** Called AFTER the resolver's settle pause — advances board to next turn. */
  onAdvanceTurn: () => void;
  /** Match-end haptics — fired once if either hero hit 0 HP. */
  onMatchEnd?: (winnerIsPlayer: boolean) => void;
  /** Télémétrie Watcher (observationnel, fail-soft) — appelé 1× par lane APRÈS
   *  résolution du combat, avec l'issue DÉJÀ calculée par le résolveur (aucune
   *  logique de combat dupliquée). Optionnel (tests/headless). ZÉRO effet gameplay. */
  onLaneResolved?: (outcome: LaneOutcome) => void;
}
