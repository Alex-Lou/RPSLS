/**
 * arenaOverride — match-scoped GLOBAL look swap.
 *
 * The pre-match coin flip (MatchPrepScreen) can hand the duel to the
 * opponent's WHOLE THEME: their backdrop, their HUD palette, their fonts,
 * their pad — not just the pad. App.tsx subscribes to this store, and when
 * `bg` is non-null it renders the override INSTEAD of the player's own
 * `backgroundId`. PlayPage sets it on `ranked_match` mount when
 * `arena.side === "opp"`, clears it on unmount.
 *
 * Why a store and not a context: App is the root; the player surfaces that
 * decide the duel arena (MatchPrep / PlayPage) live BELOW App in the tree,
 * so a context wouldn't reach the backdrop layer. A 1-key store solves it
 * without prop-drilling through every page.
 */

import { create } from "zustand";
import type { BackgroundId } from "../types";

interface ArenaOverride {
  /** When set, App renders this background INSTEAD of the player's own. The
   *  associated theme + pad are applied separately (theme via direct CSS-var
   *  mutation in PlayPage, pad via ArenaPadProvider). */
  bg: BackgroundId | null;
  setBg: (bg: BackgroundId | null) => void;
}

export const useArenaOverride = create<ArenaOverride>((set) => ({
  bg: null,
  setBg: (bg) => set({ bg }),
}));
