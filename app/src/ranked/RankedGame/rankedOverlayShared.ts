import type { Move } from "../../engine/game";

/** Partagé par RiposteOverlay + SuddenDeathOverlay (le picker RPSLS).
 *  (LANE_LABEL reste co-localisé dans RiposteOverlay, son seul consommateur.) */
export const RANKED_MOVES: Move[] = ["rock", "paper", "scissors", "lizard", "spock"];
