import type { Move } from "../../engine/game";
import type { CardId } from "../rankedTypes";

/** Tables de domaine extraites VERBATIM de RankedGame. Les constantes de
 *  CADENCE (*_MS, MAX_MANA, LANE_COUNT) restent dans l'orchestrateur (elles
 *  cadencent la boucle de match). */

/** Canonical RPSLS counters — used by Le Choix de Schrödinger to compute
 *  the "superposed" second move for each lane. */
export const COUNTER_MOVE: Record<Move, Move> = {
  rock: "paper",
  paper: "scissors",
  scissors: "rock",
  lizard: "rock",
  spock: "lizard",
};

/** CPU's notional hand pool — the cards the AI may consider each round. The
 *  CPU doesn't track a real deck/hand, but we filter one-shots out across the
 *  match so it can't replay an epic/legendary it already played. */
export const BASE_CPU_HAND_POOL: CardId[] = [
  "aegis", "surge", "augur", "curse", "precision", "riposte",
  "heist", "tide", "vortex",
  // Bonus Lot 1 actives the CPU can throw (passives are player-only).
  "sangsue", "rempart", "trou-noir",
  // V3 actives the CPU can also play (simpler effects only — anything
  // requiring a player-side modal stays off the CPU's menu).
  "sablier", "remanence", "braise", "crepuscule", "cascade",
  "fardeau", "benediction",
];

/** Pool the player draws from when a successful Heist nets them a card. Heist
 *  itself is excluded (you can't steal someone's one-shot they've already
 *  burned). */
export const STEALABLE_FROM_CPU: CardId[] = [
  "aegis", "surge", "augur", "curse", "precision", "riposte", "tide", "vortex",
];
