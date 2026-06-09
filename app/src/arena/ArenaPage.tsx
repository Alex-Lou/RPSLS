/**
 * ArenaPage — menu entry point for Constellation Pro.
 *
 * Now goes through THREE stages so the player has time to learn + see
 * the coin flip determine the theme BEFORE the match starts:
 *   1. PREP — ArenaPrepScreen (VS face-off, coin flip, "?" button)
 *   2. GAME — ArenaGame wrapped with the prep's theme + pad override
 *   3. (game ends → "Rematch" cycles back to PREP for a fresh coin)
 *
 * Theme override is applied via CSS-var snapshot/restore around the
 * GAME stage so the menu theme isn't permanently overwritten. Pad
 * override goes through ArenaPadProvider (match-scoped context).
 */

import { useEffect, useRef, useState } from "react";
import { ArenaGame } from "./ArenaGame";
import { ArenaPrepScreen, type ArenaPrepResult } from "./ArenaPrepScreen";
import { ArenaPadProvider } from "../ranked/arena";
import { applyTheme } from "../theme/theme";
import { useStore } from "../store/store";

export function ArenaPage({ onBack }: { onBack: () => void }) {
  const [stage, setStage] = useState<"prep" | "game">("prep");
  const [prep, setPrep] = useState<ArenaPrepResult | null>(null);
  const playerThemeId = useStore((s) => s.player.themeId ?? "violet");
  // Snapshot the CSS-var theme at mount so we restore it on quit.
  const snapshotRef = useRef<{ theme: string; primary: string; secondary: string } | null>(null);

  useEffect(() => {
    // Capture the CURRENT theme vars on mount so we can restore them when
    // the player quits the Arena (Alex: "je dépend du theme de l'opp" →
    // now the coin chooses; on exit, the menu's theme comes back intact).
    const root = document.documentElement;
    snapshotRef.current = {
      theme: root.style.getPropertyValue("--theme-primary"),
      primary: root.style.getPropertyValue("--theme-primary"),
      secondary: root.style.getPropertyValue("--theme-secondary"),
    };
    return () => {
      // Restore the player's own theme on unmount.
      applyTheme(playerThemeId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the prep resolves, apply its theme to the document. ArenaGame's
  // BattlePad reads the override via ArenaPadProvider below.
  useEffect(() => {
    if (stage === "game" && prep) {
      applyTheme(prep.themeId);
    }
  }, [stage, prep]);

  function handlePrepConfirm(result: ArenaPrepResult) {
    setPrep(result);
    setStage("game");
  }

  function handleQuitGame() {
    // Quit the whole Arena — restore menu theme + bubble up to menu.
    applyTheme(playerThemeId);
    onBack();
  }

  function handleRematch() {
    // Fresh match → fresh coin: clear prep, restore player's theme so the
    // prep screen renders against the menu palette (then coin re-picks
    // theme/pad), bounce back to prep stage.
    applyTheme(playerThemeId);
    setPrep(null);
    setStage("prep");
  }

  if (stage === "prep") {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <ArenaPrepScreen onConfirm={handlePrepConfirm} onCancel={onBack} />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <ArenaPadProvider value={prep?.padId ?? null}>
        <ArenaGame onQuit={handleQuitGame} onRematch={handleRematch} />
      </ArenaPadProvider>
    </div>
  );
}
