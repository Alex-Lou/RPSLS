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

/** Increment the suppression count; returns a release fn. */
export function suppressMenuFx(): () => void {
  suppressCount++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    suppressCount = Math.max(0, suppressCount - 1);
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
