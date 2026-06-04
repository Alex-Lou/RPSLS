import type { ThemeId } from "./types";

export interface ThemeDef {
  id: ThemeId;
  label: string;
  emoji: string;
  primary: string;
  secondary: string;
  bg: string;
}

export const THEMES: Record<ThemeId, ThemeDef> = {
  violet: { id: "violet", label: "Violet",  emoji: "🔮", primary: "#7c5cff", secondary: "#2dd4bf", bg: "#0b0d12" },
  neon:   { id: "neon",   label: "Neon",    emoji: "⚡", primary: "#22d3ee", secondary: "#ec4899", bg: "#0a0a12" },
  pastel: { id: "pastel", label: "Pastel",  emoji: "🌸", primary: "#fda4af", secondary: "#86efac", bg: "#1a1620" },
  sunset: { id: "sunset", label: "Sunset",  emoji: "🌅", primary: "#fb923c", secondary: "#f43f5e", bg: "#1a0f12" },
  forest: { id: "forest", label: "Forest",  emoji: "🌲", primary: "#34d399", secondary: "#fbbf24", bg: "#0a1410" },
};

export function applyTheme(themeId: ThemeId) {
  const t = THEMES[themeId];
  const root = document.documentElement;
  root.style.setProperty("--theme-primary", t.primary);
  root.style.setProperty("--theme-secondary", t.secondary);
  root.style.setProperty("--theme-bg", t.bg);
}

/** Single source of truth for the "primary → secondary" linear gradient
 *  used by buttons / banners / headers across the app. Previously this
 *  exact `linear-gradient(...)` string was hand-written in 6 files; now
 *  they all call this. Defaults to the live CSS vars so the gradient
 *  follows the active background's accent override (see App.tsx), not just
 *  the global theme.
 *
 *  Pass an explicit ThemeDef only when you need a STATIC gradient that
 *  ignores the background accent override (rare — e.g. the theme picker
 *  swatches that must each show their own colours). */
export function gradientFromTheme(theme?: ThemeDef, angle = "135deg"): string {
  const from = theme ? theme.primary : "var(--theme-primary)";
  const to = theme ? theme.secondary : "var(--theme-secondary)";
  return `linear-gradient(${angle}, ${from}, ${to})`;
}
