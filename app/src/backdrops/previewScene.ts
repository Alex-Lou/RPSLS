import { create } from "zustand";

/**
 * Backdrop "peek" — when true, App hides the whole menu shell so the live,
 * already-applied animated backdrop fills the screen for a real full-screen
 * preview. Selecting a background applies it for real (instant), then flips
 * this on; closing flips it back. No second WebGL context, no preview modal —
 * the actual backdrop IS the preview.
 */
interface PeekState {
  peek: boolean;
  setPeek: (v: boolean) => void;
}

export const useBackdropPeek = create<PeekState>((set) => ({
  peek: false,
  setPeek: (peek) => set({ peek }),
}));
