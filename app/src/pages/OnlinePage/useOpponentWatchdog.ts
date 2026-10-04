/**
 * Veille adversaire du match Classique en ligne. Extrait verbatim d'OnlinePage
 * (même effet, mêmes dépendances) ; l'état `oppWaitLevel` reste au composant.
 */
import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { Phase, MatchState } from "./types";

export function useOpponentWatchdog(
  phase: Phase,
  m: MatchState,
  vsBot: boolean,
  setOppWaitLevel: Dispatch<SetStateAction<number>>,
) {
  // Opponent watchdog — only against a real player. While we're waiting on the
  // opponent (move locked, or just matched waiting for round 1), escalate a
  // hint after 15s, then a "probably disconnected" + clean exit after 35s.
  // Resets the instant the match advances (new round / reveal / move cleared).
  useEffect(() => {
    const waiting = !vsBot && ((phase === "round" && !!m.myMove) || phase === "matched");
    if (!waiting) { setOppWaitLevel(0); return; }
    setOppWaitLevel(0);
    const t1 = window.setTimeout(() => setOppWaitLevel(1), 15_000);
    const t2 = window.setTimeout(() => setOppWaitLevel(2), 35_000);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps d'origine (setter stable)
  }, [phase, m.myMove, m.roundNo, vsBot]);
}
