/** Constantes de rythme du match Classé vs CPU (extraites VERBATIM de RankedGame). */

export const LANE_COUNT = 3;
export const PICK_DEADLINE_MS = 20_000;
export const ROUND_PAUSE_MS = 5_500; // Alex 2026-06-17 (Ranked-2) : -2s vs origine (7.5s), attente post-manche réduite (4.5s trop rapide)
export const REVEAL_SUSPENSE_MS = 1_400;
export const MATCH_FOUND_SPLASH_MS = 2_500;
export const MAX_MANA = 4;
/** Sudden Death cadence — kept tight so the duel feels punchy, not laggy.
 *  PRE  = how long the reveal sits before the overlay slides in.
 *  POST = how long the verdict banner sits before applySuddenDeath fires.
 *  DUEL_TIE = how long a tied duel sits before re-picking. */
export const SUDDEN_DEATH_PRE_MS = 1_500;
export const SUDDEN_DEATH_POST_MS = 2_200;
export const SUDDEN_DEATH_DUEL_TIE_MS = 1_700;
