import { useEffect, useRef, useState } from "react";
import { hapticTap } from "../../haptic";
import type { CardId } from "../../ranked/rankedTypes";

/** Délai d'appui avant l'aperçu (Alex 2026-10 : 750 → 350 ms, inspection trop lente). */
const LONG_PRESS_MS = 350;

/** Geste d'une carte de la main :
 *  - tap court → `onTap` (jouer / armer la carte) ;
 *  - appui ≥ 350 ms → APERÇU agrandi (`peek`) au-dessus du doigt ;
 *    relâché sur la carte → `onInspect` (fiche complète) ; doigt sorti → rien.
 *  Les callbacks sont lus au moment du geste (ref) : jamais de version périmée. */
export function useCardPress(onTap: (id: CardId) => void, onInspect: (id: CardId) => void) {
  const timerRef = useRef<number | null>(null);
  const longPressedRef = useRef(false);
  const peekIdRef = useRef<CardId | null>(null);
  const [peek, setPeek] = useState<{ id: CardId; x: number } | null>(null);
  const cbRef = useRef({ onTap, onInspect });
  cbRef.current = { onTap, onInspect };
  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);

  function startPress(id: CardId, x: number) {
    longPressedRef.current = false;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      longPressedRef.current = true;
      hapticTap();
      peekIdRef.current = id;
      setPeek({ id, x });
    }, LONG_PRESS_MS);
  }

  function endPress(id: CardId, fire: boolean) {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (longPressedRef.current) {
      // Fin d'appui long. Un 2e appel (pointerleave qui suit le relâché) ne
      // rouvre rien : la ref est déjà vidée.
      const pid = peekIdRef.current;
      peekIdRef.current = null;
      setPeek(null);
      if (pid && fire) cbRef.current.onInspect(pid);
      return;
    }
    if (fire) cbRef.current.onTap(id);
  }

  return { peek, startPress, endPress };
}
