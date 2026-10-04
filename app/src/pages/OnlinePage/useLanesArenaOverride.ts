/**
 * Surcharge d'arène Constellation (thème + décor) quand la pièce donne le duel
 * au côté adverse. Extrait verbatim d'OnlinePage (mêmes hooks, même ordre :
 * useArenaOverride → useMemo → useEffect).
 */
import { useEffect, useMemo } from "react";
import { oppPersona } from "../../ranked/personaSeed";
import { useArenaOverride } from "../../ranked/arenaOverride";
import { applyTheme } from "../../theme/theme";
import type { LanesMatchInfo } from "../../match/LanesMatchView";

// Lanes arena override — when the coin gave the duel to the opponent's
// side, swap the player's WHOLE LOOK (backdrop scene + HUD theme + pad)
// for the duration of the prep + match. Mirrors PlayPage's local-tournament
// setup: backdrop via `arenaOverride.bg`, theme via CSS-var mutation +
// snapshot/restore on cleanup, pad via <ArenaPadProvider> down in the
// match view. Effect deps stay narrow on purpose: phase changes
// (lanes_prep → lanes_match) MUST NOT trigger a cleanup/re-apply (would
// snapshot the opp theme as the "original" and never restore the player's
// own). Cleanup runs when the override should END — either the coin
// resolves to "you", the match ends (lanesOppPersona → null), or the user
// leaves.
export function useLanesArenaOverride(
  lanesMatch: LanesMatchInfo | null,
  prepCoinWinner: "you" | "opp" | null,
) {
  const setArenaBg = useArenaOverride((s) => s.setBg);
  const lanesOppPersona = useMemo(
    () => (lanesMatch ? oppPersona(lanesMatch.opponent || "Anonymous") : null),
    [lanesMatch?.opponent],
  );
  useEffect(() => {
    if (prepCoinWinner !== "opp" || !lanesOppPersona) return;
    const root = document.documentElement;
    const snap = {
      p: root.style.getPropertyValue("--theme-primary"),
      s: root.style.getPropertyValue("--theme-secondary"),
      b: root.style.getPropertyValue("--theme-bg"),
    };
    applyTheme(lanesOppPersona.themeId);
    setArenaBg(lanesOppPersona.backgroundId);
    return () => {
      if (snap.p) root.style.setProperty("--theme-primary", snap.p);
      if (snap.s) root.style.setProperty("--theme-secondary", snap.s);
      if (snap.b) root.style.setProperty("--theme-bg", snap.b);
      setArenaBg(null);
    };
  }, [prepCoinWinner, lanesOppPersona, setArenaBg]);
  return lanesOppPersona;
}
