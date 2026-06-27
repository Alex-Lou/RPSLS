/**
 * useSimController — pilote la sim sur le thread principal, en CHUNKS yieldés
 * (pas de Web Worker en V1 : KISS, et zéro risque d'import transitif impur).
 * Chaque chunk de N parties tourne en synchrone puis rend la main à l'event loop
 * → la barre de progression bouge, l'UI ne gèle pas. Un `runId` invalide tout
 * batch en vol quand un nouveau réglage relance (anti-résultat-périmé).
 */
import { useCallback, useRef, useState } from "react";
import { runMatch } from "./runMatch";
import { newAccumulator, foldResult, finalize, buildMatrix } from "./aggregate";
import { MOVES } from "./simTypes";
import type { SimOptions, SimResult } from "./simTypes";
import type { Move } from "../../engine/game";
import { applyBalance, resetBalance, type ArenaBalance } from "../../arena/arenaBalance";

// Tous les matchups ordonnés (25 = 5×5, mirrors inclus → diagonale neutre 50%).
// Chaque paire jouée dans les 2 sens sur le batch → symétrisation côté agrégat.
const ALL_PAIRS: [Move, Move][] = [];
for (const a of MOVES) for (const b of MOVES) ALL_PAIRS.push([a, b]);

const CHUNK = 400;

export interface SimController {
  result: SimResult | null;
  progress: { done: number; total: number } | null;
  running: boolean;
  run: (opts: SimOptions, balance: ArenaBalance) => void;
}

export function useSimController(): SimController {
  const [result, setResult] = useState<SimResult | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [running, setRunning] = useState(false);
  const runIdRef = useRef(0);

  const run = useCallback((opts: SimOptions, balance: ArenaBalance) => {
    const runId = ++runIdRef.current;
    // Le slider PILOTE le moteur : on remet les défauts puis on applique le
    // réglage courant AVANT de simuler (le moteur lit BALANCE.x inline).
    resetBalance();
    applyBalance(balance);
    const total = Math.max(ALL_PAIRS.length, opts.games);
    const base = opts.fixedSeed ? opts.seed : opts.seed + Math.floor(Math.random() * 1e9);
    const acc = newAccumulator();
    const t0 = performance.now();
    setRunning(true);
    setProgress({ done: 0, total });

    let k = 0;
    const step = () => {
      if (runIdRef.current !== runId) return; // un réglage plus récent a pris la main
      const end = Math.min(k + CHUNK, total);
      for (; k < end; k++) {
        const [ma, mb] = ALL_PAIRS[k % ALL_PAIRS.length];
        foldResult(acc, runMatch(ma, mb, opts.diff, base + k));
      }
      if (k < total) {
        setProgress({ done: k, total });
        setTimeout(step, 0); // yield → UI responsive
        return;
      }
      // terminé
      setResult({
        stats: finalize(acc),
        matchupMatrix: buildMatrix(acc),
        meta: { ms: performance.now() - t0, seed: base, games: total },
      });
      setProgress(null);
      setRunning(false);
    };
    setTimeout(step, 0);
  }, []);

  return { result, progress, running, run };
}
