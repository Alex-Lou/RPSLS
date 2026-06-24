/**
 * arenaTrace — arêtes du pentagone d'une Voie.
 *
 * `affinityEdges(affinity)` = les 2 symboles que `affinity` bat dans le
 * pentagone RPSLS. Utilisé par l'IA (arenaAI) pour savoir quels counters la
 * Voie adverse cherche à remporter (Le Tracé) et les esquiver.
 *
 * NOTE : la progression du Tracé vit désormais dans arenaEngines
 * (riseEngineOnCounterWin / engineGauge) — la jauge monte de +1 quand ton
 * symbole de Voie REMPORTE un counter en lane. Source UNIQUE, lue par le combat.
 */

import { MOVES, type Move } from "../engine/game";
import { moveCountersMove } from "./arenaTypes";

/** Les 2 symboles que `affinity` bat dans le pentagone = ses 2 arêtes. */
export function affinityEdges(affinity: Move): Move[] {
  return MOVES.filter((m) => moveCountersMove(affinity, m));
}
