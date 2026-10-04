/**
 * menuFx — tiny global switch for the menu touch-particles effect.
 *
 * Screens that should NOT show the effect (match views, deck manager, …) call
 * `useNoMenuFx()` once; while any such screen is mounted, `menuFxSuppressed()`
 * returns true and ThemeTouchFX stays quiet. A plain ref-count, no store: the
 * effect just reads the flag synchronously when a pointer event fires.
 */
import { useEffect } from "react";

let suppressCount = 0;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((cb) => cb());
}

/** Abonnement aux changements de `menuFxSuppressed()` OU `matchActive()` : les
 *  boucles de fond s'arrêtent d'elles-mêmes, ce signal sert à les relancer. */
export function onFxGateChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** Increment the suppression count; returns a release fn. */
export function suppressMenuFx(): () => void {
  suppressCount++;
  if (suppressCount === 1) notify();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    suppressCount = Math.max(0, suppressCount - 1);
    if (suppressCount === 0) notify();
  };
}

/** True when at least one screen has asked to suppress the touch effect. */
export function menuFxSuppressed(): boolean {
  return suppressCount > 0;
}

/** Mount-scoped suppression — call inside any full-screen game/match/deck view
 *  (or anywhere the playful menu particles would be out of place). */
export function useNoMenuFx(): void {
  useEffect(() => suppressMenuFx(), []);
}

/* ── Surface de match (chauffe) ──────────────────────────────────────────────
 * Distinct de la suppression ci-dessus (boutique / decks la posent aussi) :
 * ce compteur ne vaut que pendant un MATCH. Les fonds animés continus
 * (ThemedBackdrop, StormRain) s'y abonnent pour se FIGER pendant la partie :
 * le plateau les cache, les dessiner à 60 fps ne fait que chauffer le tél. */

let matchCount = 0;

/** True tant qu'au moins un écran de match est monté. */
export function matchActive(): boolean {
  return matchCount > 0;
}

function setMatchCount(n: number): void {
  const was = matchCount > 0;
  matchCount = Math.max(0, n);
  if (was !== matchCount > 0) notify();
}

/** À appeler dans chaque écran de match (monté = match en cours). */
export function useMatchSurface(): void {
  useEffect(() => {
    setMatchCount(matchCount + 1);
    return () => setMatchCount(matchCount - 1);
  }, []);
}
