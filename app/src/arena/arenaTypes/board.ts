import type { Move } from "../../engine/game";
import type { CardId } from "../../ranked/rankedTypes";
import type { Side, HeroState } from "./hero";
import type { LaneState, LaneIndex } from "./creatures";

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
  /** Compteur de tours restants avant clear du peek (Alex 2026-06-11 : "ne
   *  pas retirer la main trop vite"). 2 tours = tour de cast + tour suivant.
   *  Decrement dans advanceToNextTurn ; clear cards à 0. */
  augurTurnsLeftA?: number;
  augurTurnsLeftB?: number;
  /** ID de la dernière carte volée par chaque côté (Alex 2026-06-11). Lu par
   *  l'UI pour que l'anim Larcin reveal la VRAIE carte volée (sinon affichait
   *  une heuristique "première carte de la main adverse"). Mis à jour par
   *  applyHeist au cast. Pas besoin de clear : écrasée au cast suivant. */
  lastHeistStolenA?: CardId;
  lastHeistStolenB?: CardId;
  /** ⚗️ FORGE (2026-06-13) — la carte déposée sur la case Forge de chaque
   *  joueur (visible des deux camps, reprenable, persiste entre les tours).
   *  Fusion : carte partenaire de la main + Forge → carte fusionnée en main. */
  forgeA?: CardId | null;
  forgeB?: CardId | null;
  /** Réverbération (2026-06-12) : dernier sort NON-réverbération appliqué par
   *  chaque côté ce tour (tracké dans applyAllSpells). Réverbération le rejoue.
   *  Reset chaque tour (advanceToNextTurn). */
  lastSpellAppliedA?: PlayedSpell;
  lastSpellAppliedB?: PlayedSpell;
  /** Phénix (2026-06-12) : snapshot des créatures de chaque côté au moment du
   *  cast — celles qui meurent ce tour renaissent à 1 PV en fin de tour (sur
   *  leur lane si libre). Posé par applyPhenix, consommé par endOfTurnCleanup. */
  phenixReviveA?: { lane: LaneIndex; move: Move }[];
  phenixReviveB?: { lane: LaneIndex; move: Move }[];
}

export type ArenaPhase =
  | "draw"        // turn start, mana up, draw a card
  | "planning"    // both sides plan in parallel
  | "resolving"   // resolver running (spells → summons → combat)
  | "sudden-death" // Round 10 VRAI BUT D'OR : égalité parfaite → 1 lane RPSLS aveugle
  | "match-end";  // hero hit 0 HP

/* ───────────────────────── Match result ───────────────────────── */

export interface ArenaMatchResult {
  winner: Side | "draw";
  finalA: HeroState;
  finalB: HeroState;
  turns: number;
}
