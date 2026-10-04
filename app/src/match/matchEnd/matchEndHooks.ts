/**
 * Hooks partagés de l'écran de fin de match commun (MatchEndScreen).
 *
 * Aucun calcul d'économie ici : on ne fait que LIRE les valeurs que le store
 * vient de créditer (xp, classeLp, rankLp) et les deltas que chaque mode
 * affichait déjà, pour reconstituer « avant → après » côté affichage.
 */
import { useEffect, useRef, useState } from "react";
import { useReducedMotionConfig } from "motion/react";

/** Vrai si l'animation doit être coupée (MotionConfig reducedMotion global). */
export function useReduced(): boolean {
  return !!useReducedMotionConfig();
}

/** Délai (ms) avant de figer « avant/après » : l'enregistrement est fait. */
export const SETTLE_MS = 900;

/**
 * Valeur AVANT/APRÈS d'un compteur du store (xp, LP…) crédité par la fin de
 * match. Deux cas selon le mode :
 *  - le crédit a eu lieu AVANT le montage (Lanes, Classé cartes, en ligne) :
 *    avant = live − delta ;
 *  - le crédit arrive APRÈS le montage (PlayGame, Arena : effet post-rendu) :
 *    la valeur live bouge → avant = valeur figée au montage.
 * `settled` passe à vrai après `delayMs` : on ne lance l'animation qu'une fois
 * l'enregistrement fait (sinon la barre repartirait en arrière).
 */
export function useBeforeAfter(live: number, delta: number, delayMs = SETTLE_MS) {
  const atMount = useRef(live);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(true), delayMs);
    return () => window.clearTimeout(id);
  }, [delayMs]);
  const before = live !== atMount.current ? atMount.current : live - delta;
  return { before: Math.max(0, before), after: Math.max(0, before + delta), settled };
}

/** Compteur animé 0 → `to` (gère le négatif). Coupé net en mouvement réduit. */
export function useCountUp(to: number, { durationMs = 900, delayMs = 0 } = {}): number {
  const reduced = useReduced();
  const [n, setN] = useState(reduced ? to : 0);
  useEffect(() => {
    if (reduced) { setN(to); return; }
    let raf = 0;
    let start: number | null = null;
    const step = (ts: number) => {
      if (start == null) start = ts;
      const p = Math.min(1, (ts - start) / durationMs);
      // easeOutCubic : le chiffre « freine » en arrivant — lecture plus nette.
      setN(Math.round((1 - Math.pow(1 - p, 3)) * to));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    const id = window.setTimeout(() => { raf = requestAnimationFrame(step); }, delayMs);
    return () => { window.clearTimeout(id); cancelAnimationFrame(raf); };
  }, [to, durationMs, delayMs, reduced]);
  return n;
}

/** Passe à vrai après `ms` (immédiat en mouvement réduit). */
export function useAfter(ms: number, enabled = true): boolean {
  const reduced = useReduced();
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    if (reduced) { setOn(true); return; }
    const id = window.setTimeout(() => setOn(true), ms);
    return () => window.clearTimeout(id);
  }, [ms, enabled, reduced]);
  return on;
}
