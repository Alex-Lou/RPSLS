import { useState } from "react";
import type { Move } from "../../engine/game";
import type { LaneTarget } from "../rankedTypes";

/**
 * usePickPhase — état des 3 picks RPSLS du joueur + ses 2 handlers. Extrait
 * VERBATIM de RankedGame ; PUR (ne touche que `picks`, aucune dépendance
 * battle/timing). Sémantiquement identique à un useState inline. L'orchestrateur
 * destructure {picks, setPicks, handlePickMove, handleClearLane} → le cœur reste
 * byte-identique (il référence `picks`/`setPicks` comme avant).
 */
export function usePickPhase() {
  const [picks, setPicks] = useState<[Move | null, Move | null, Move | null]>([null, null, null]);

  function handlePickMove(mv: Move) {
    setPicks((cur) => {
      const i = cur.findIndex((p) => p === null);
      if (i === -1) return cur;
      const next = cur.slice() as [Move | null, Move | null, Move | null];
      next[i] = mv;
      return next;
    });
  }
  function handleClearLane(lane: LaneTarget) {
    setPicks((cur) => {
      const next = cur.slice() as [Move | null, Move | null, Move | null];
      next[lane] = null;
      return next;
    });
  }

  return { picks, setPicks, handlePickMove, handleClearLane };
}
