import type { ThemeId } from "../types";
import type { FontStackKey } from "./fonts";

export interface ThemeDef {
  id: ThemeId;
  label: string;
  emoji: string;
  primary: string;
  secondary: string;
  bg: string;
  /** Typography identity for this palette — applied when the active background
   *  is the plain "default" or the player's own "custom" image (a coded scene
   *  background overrides these with its own bespoke skin). Headline = titles,
   *  body = UI text, mono = numbers/timers. Picking a colour palette now also
   *  shifts the font mood, so each HUD theme feels like a complete identity. */
  fontHeadline: FontStackKey;
  fontBody: FontStackKey;
  fontMono: FontStackKey;
}

export const THEMES: Record<ThemeId, ThemeDef> = {
  violet: { id: "violet", label: "Violet",  emoji: "🔮", primary: "#7c5cff", secondary: "#2dd4bf", bg: "#0b0d12", fontHeadline: "spaceGrotesk", fontBody: "inter",   fontMono: "jetbrains" },
  neon:   { id: "neon",   label: "Neon",    emoji: "⚡", primary: "#22d3ee", secondary: "#ec4899", bg: "#0a0a12", fontHeadline: "audiowide",    fontBody: "exo2",    fontMono: "shareTech" },
  pastel: { id: "pastel", label: "Pastel",  emoji: "🌸", primary: "#fda4af", secondary: "#86efac", bg: "#1a1620", fontHeadline: "inter",        fontBody: "inter",   fontMono: "jetbrains" },
  sunset: { id: "sunset", label: "Sunset",  emoji: "🌅", primary: "#fb923c", secondary: "#f43f5e", bg: "#1a0f12", fontHeadline: "bebas",        fontBody: "rajdhani", fontMono: "jetbrains" },
  forest: { id: "forest", label: "Forest",  emoji: "🌲", primary: "#34d399", secondary: "#fbbf24", bg: "#0a1410", fontHeadline: "ebGaramond",   fontBody: "inter",   fontMono: "jetbrains" },
  ocean:  { id: "ocean",  label: "Ocean",   emoji: "🌊", primary: "#38bdf8", secondary: "#22d3ee", bg: "#08111a", fontHeadline: "spaceGrotesk", fontBody: "ibmPlex", fontMono: "fira" },
  ember:  { id: "ember",  label: "Ember",   emoji: "🔥", primary: "#fb7185", secondary: "#f59e0b", bg: "#160a0a", fontHeadline: "bebas",        fontBody: "rajdhani", fontMono: "fira" },
  aurora: { id: "aurora", label: "Aurora",  emoji: "🌌", primary: "#a78bfa", secondary: "#34d399", bg: "#0a0f16", fontHeadline: "exo2",         fontBody: "exo2",    fontMono: "spaceMono" },
  gold:   { id: "gold",   label: "Gold",    emoji: "👑", primary: "#fcd34d", secondary: "#f97316", bg: "#14100a", fontHeadline: "cinzel",       fontBody: "cormorant", fontMono: "jetbrains" },
  cyber:  { id: "cyber",  label: "Cyber",   emoji: "🤖", primary: "#22d3ee", secondary: "#a3e635", bg: "#0a0f0d", fontHeadline: "orbitron",     fontBody: "rajdhani", fontMono: "shareTech" },
  rose:   { id: "rose",   label: "Rosé",    emoji: "🌹", primary: "#fb7185", secondary: "#c084fc", bg: "#160a12", fontHeadline: "playfair",     fontBody: "cormorant", fontMono: "jetbrains" },
  mono:   { id: "mono",   label: "Mono",    emoji: "🪐", primary: "#e5e7eb", secondary: "#9ca3af", bg: "#0b0d12", fontHeadline: "ibmPlex",      fontBody: "inter",   fontMono: "jetbrains" },
  // ── Premium palettes ──
  quartz: { id: "quartz", label: "Quartz",  emoji: "💠", primary: "#c8aef0", secondary: "#f6a5b8", bg: "#1a142a", fontHeadline: "cinzel",       fontBody: "cormorant", fontMono: "spaceMono" },
  // ── Eclipse set ──
  eclipse: { id: "eclipse", label: "Eclipse", emoji: "🌑", primary: "#d4a745", secondary: "#8b7fcf", bg: "#06050e", fontHeadline: "cinzel",       fontBody: "cormorant", fontMono: "jetbrains" },
  // ── Phantom + Emberforge ──
  phantom: { id: "phantom", label: "Phantom", emoji: "👻", primary: "#5a7a9a", secondary: "#8a9bb5", bg: "#0c0e14", fontHeadline: "cinzel",       fontBody: "cormorant", fontMono: "jetbrains" },
  emberforge: { id: "emberforge", label: "Emberforge", emoji: "🔥", primary: "#ff6a14", secondary: "#ff9426", bg: "#0a0503", fontHeadline: "bebas",       fontBody: "rajdhani",  fontMono: "jetbrains" },
  tempus: { id: "tempus", label: "Tempus", emoji: "⏳", primary: "#b8956a", secondary: "#d4a76a", bg: "#0a0703", fontHeadline: "cinzel",       fontBody: "cormorant", fontMono: "jetbrains" },
  storm: { id: "storm", label: "Storm", emoji: "⚡", primary: "#4af0ff", secondary: "#a078ff", bg: "#060a16", fontHeadline: "orbitron",     fontBody: "rajdhani",  fontMono: "jetbrains" },
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
