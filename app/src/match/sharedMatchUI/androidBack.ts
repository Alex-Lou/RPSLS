import { useEffect, useRef } from "react";
import { useNoMenuFx } from "../../fx/menuFx";

/**
 * Hook: while a match is mounted, intercept the Android system back button
 * (and the WebView's history-back) so it routes to `onBack` instead of
 * exiting the match silently. We push a sentinel history entry on mount and
 * re-push it on every popstate so successive back-presses keep firing the
 * handler until the caller actually unmounts the view.
 *
 * `onBack` is wrapped in a ref internally so passing a fresh closure every
 * render doesn't re-register the listener.
 */
/** Nombre d'écrans qui gèrent EUX-MÊMES le retour (match, lobby…). Tant qu'il
 *  est > 0, les écouteurs `popstate` de navigation (App, PlayPage) doivent
 *  s'abstenir : sinon un appui sur retour démontait le match AVANT la modale
 *  de confirmation → sortie sans forfait ni abandon enregistré. */
let backPromptCount = 0;
export function backPromptActive(): boolean {
  return backPromptCount > 0;
}

export function useAndroidBackPrompt(onBack: () => void) {
  // A match/game surface is mounted → silence the playful menu touch particles.
  useNoMenuFx();
  const cbRef = useRef(onBack);
  useEffect(() => { cbRef.current = onBack; }, [onBack]);
  useEffect(() => {
    history.pushState({ rpslsMatch: true }, "");
    const handler = () => {
      // Re-arm the back so the user has to confirm again.
      history.pushState({ rpslsMatch: true }, "");
      cbRef.current();
    };
    window.addEventListener("popstate", handler);
    backPromptCount++;
    return () => {
      backPromptCount = Math.max(0, backPromptCount - 1);
      window.removeEventListener("popstate", handler);
    };
  }, []);
}

/** Imperative handle exposed by FloatingMatchBackButton so the parent can
 *  trigger the same confirm flow from elsewhere (Android back gesture). */
export interface MatchBackHandle {
  triggerConfirm: () => void;
}
