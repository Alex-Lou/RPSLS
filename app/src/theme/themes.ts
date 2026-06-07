/**
 * themes.ts — central catalogue for the cosmetic theming layer.
 *
 * Two concerns live side-by-side here:
 *
 *  - BACKGROUNDS: full-screen images painted behind every page. They override
 *    the default radial-gradient body background. `src: null` means "keep the
 *    default gradient" — i.e. the original look.
 *
 *  - Battle pads are now ALL coded animated SVGs (BattlePad.tsx) — there are
 *    no PNG playmats left. The only image-based pad is the player's own
 *    uploaded "custom" mat (player.customPadUrl).
 *
 * Each background advertises a `defaultPadId` it pairs naturally with (set
 * automatically when the user picks the background, unless they later
 * override). Players are free to mix-and-match.
 *
 * To add a new background: append an entry here; to add a pad, code it in
 * BattlePad.tsx and extend PadId in types.ts + PAD_META.
 */

import type { BackgroundId, PadId, ThemeId } from "../types";
import { FONT_STACK, type FontStackKey } from "./fonts";
import type { BackdropScene } from "../backdrops/ThemedBackdrop";

export interface ThemeSkin {
  /** Display family for big titles, headlines, banners. */
  fontHeadline: FontStackKey;
  /** Default UI text — labels, hints, body copy. */
  fontBody: FontStackKey;
  /** Numbers, timers, code-like info. */
  fontMono: FontStackKey;
}

export interface BackgroundDef {
  id: BackgroundId;
  label: string;
  emoji: string;
  /** Path to the PNG under /public, or null to fall back to the original
   *  CSS radial-gradient default. */
  src: string | null;
  /** When set, this background is a live CODED WebGL scene (no PNG). App.tsx
   *  renders <ThemedBackdrop scene=…> instead of painting an image. */
  scene?: BackdropScene;
  /** When set, this background is a premium SVG/SMIL scene that App.tsx
   *  dispatches to a hand-coded component (no shared WebGL context). The
   *  string is matched against the premium-scene registry in App.tsx. */
  premiumScene?: "quartz";
  /** When set, the player must own this set in `ownedPremiumSets` before the
   *  background is usable. Picker still shows it (with a Premium ribbon)
   *  but tapping opens the purchase modal until owned. */
  premiumSetId?: string;
  /** True when the scene reads as visually LIGHT (pearlescent, washed-out,
   *  pastel). App.tsx puts a `theme-light` class on the root so App.css can
   *  bump card opacity + text contrast — the default dark-glass surfaces
   *  blur out against Quartz-style pastels. */
  light?: boolean;
  /** True when the scene has FREQUENT bright flashes, lots of motion, or
   *  high-contrast highlights (Storm lightning, Galaxy stars, Holy beams,
   *  Aurora curtains, Casino sparkles, Grid neon). App.tsx adds a
   *  `theme-flashy` class so menu surfaces thicken up + ink darkens
   *  slightly and headline weight bumps, keeping text legible against the
   *  busier backdrop. */
  flashy?: boolean;
  /** When true, this entry is the player's OWN uploaded image (stored as a
   *  data URL on the player). App.tsx paints player.customBgUrl. */
  custom?: boolean;
  /** Pad that visually goes with this background. Selecting the background
   *  applies this pad too unless the user has manually overridden it. */
  defaultPadId: PadId | null;
  /** Per-theme typography (and later: colours, shapes). The "default" entry
   *  defines the baseline — every other theme overrides what it cares about
   *  and inherits the rest. */
  skin: ThemeSkin;
  /** Path to the small "miniature" badge icon used next to the theme label
   *  in the picker (instead of the generic emoji). null = fall back to emoji. */
  miniature: string | null;
  /** Accent palette extracted from this background's dominant tones. When
   *  set, these hex colors OVERRIDE the global theme primary/secondary CSS
   *  vars, so every "primary action" surface (Lock button, Fight button,
   *  rank badges) blends with the background instead of locking to the
   *  five default theme palettes. null = let the global theme drive. */
  accent: { from: string; to: string } | null;
}

export const BACKGROUNDS: BackgroundDef[] = [
  // Default: no override — the global theme picker still drives the colours.
  {
    id: "default",   label: "Original",       emoji: "🌌",
    src: null,                                          defaultPadId: null,
    skin: { fontHeadline: "inter",        fontBody: "inter",        fontMono: "jetbrains"  },
    miniature: null,
    accent: null,
  },

  // ── CODED / ANIMATED backdrops (live WebGL, no PNG). The ONLY built-in
  //    backgrounds now — the old static PNG themes were retired. ──
  {
    id: "nebula",    label: "Nebula",         emoji: "🌌",
    src: null, scene: "nebula",               defaultPadId: "cosmos",
    skin: { fontHeadline: "orbitron",     fontBody: "exo2",         fontMono: "spaceMono"  },
    miniature: null,
    accent: { from: "#a855f7", to: "#22d3ee" },
  },
  {
    id: "galaxy",    label: "Galaxy",         emoji: "✨",
    src: null, scene: "galaxy",               defaultPadId: "galaxy",
    flashy: true,
    skin: { fontHeadline: "audiowide",    fontBody: "exo2",         fontMono: "spaceMono"  },
    miniature: null,
    accent: { from: "#a855f7", to: "#22d3ee" },
  },
  {
    id: "aurora",    label: "Aurora",         emoji: "🌠",
    src: null, scene: "aurora",               defaultPadId: "cosmos",
    flashy: true,
    skin: { fontHeadline: "exo2",         fontBody: "rajdhani",     fontMono: "spaceMono"  },
    miniature: null,
    accent: { from: "#34d399", to: "#8b5cf6" },
  },
  {
    id: "holy",      label: "Holy",           emoji: "✝️",
    src: null, scene: "holy",                 defaultPadId: "holy",
    flashy: true,
    skin: { fontHeadline: "cinzel",       fontBody: "cormorant",    fontMono: "imFell"     },
    miniature: null,
    accent: { from: "#fbbf24", to: "#6366f1" },
  },
  {
    id: "quantum",   label: "Quantum",        emoji: "⚛️",
    src: null, scene: "quantum",              defaultPadId: "quantum",
    skin: { fontHeadline: "spaceGrotesk", fontBody: "rajdhani",     fontMono: "fira"       },
    miniature: null,
    accent: { from: "#22d3ee", to: "#3b82f6" },
  },
  {
    id: "grid",      label: "Neon Grid",      emoji: "🌐",
    src: null, scene: "grid",                 defaultPadId: "neon",
    flashy: true,
    skin: { fontHeadline: "orbitron",     fontBody: "rajdhani",     fontMono: "shareTech"  },
    miniature: null,
    accent: { from: "#06b6d4", to: "#f0abfc" },
  },
  {
    id: "casino",    label: "Casino Royale",  emoji: "🎰",
    src: null, scene: "casino",               defaultPadId: "casino",
    flashy: true,
    skin: { fontHeadline: "playfair",     fontBody: "cormorant",    fontMono: "bebas"      },
    miniature: null,
    accent: { from: "#10b981", to: "#f5c543" },
  },

  {
    id: "volcanic",  label: "Volcanic",       emoji: "🌋",
    src: null, scene: "volcanic",             defaultPadId: "volcanic",
    skin: { fontHeadline: "bebas",        fontBody: "rajdhani",     fontMono: "shareTech"  },
    miniature: null,
    accent: { from: "#ff4500", to: "#ff8c00" },
  },
  {
    id: "abyss",     label: "Abyss",          emoji: "🐙",
    src: null, scene: "abyss",               defaultPadId: "abyss",
    skin: { fontHeadline: "orbitron",     fontBody: "ibmPlex",      fontMono: "spaceMono"  },
    miniature: null,
    accent: { from: "#00e5c8", to: "#6040c0" },
  },

  // ── Eclipse set ──
  // Total solar eclipse: onyx void, golden corona ring, orbiting diamond-ring
  // flare, wispy radial streamers. Dark centre keeps menu cards fully legible.
  {
    id: "eclipse",   label: "Eclipse",        emoji: "🌑",
    src: null, scene: "eclipse",              defaultPadId: "eclipse",
    premiumSetId: "eclipse",
    flashy: true,
    skin: { fontHeadline: "cinzel",       fontBody: "cormorant",    fontMono: "jetbrains" },
    miniature: null,
    accent: { from: "#d4a745", to: "#8b7fcf" },
  },

  // ── Phantom set ──
  // Haunted mist realm: pale lavender-grey void, wandering spectral wisps,
  // teardrop silhouettes with drip lines, faint floating motes.
  {
    id: "phantom",   label: "Phantom Realm",   emoji: "👻",
    src: null, scene: "phantom",              defaultPadId: "phantom",
    premiumSetId: "phantom",
    flashy: true,
    skin: { fontHeadline: "cinzel",       fontBody: "cormorant",    fontMono: "jetbrains" },
    miniature: null,
    accent: { from: "#5a7a9a", to: "#8a9bb5" },
  },

  // ── Emberforge set ──
  // Dwarven smithy: deep forge coal, molten ember rivers, pulsing orange
  // veins, hammered copper texture, rising fire motes.
  {
    id: "emberforge", label: "Ember Forge",     emoji: "🔥",
    src: null, scene: "emberforge",            defaultPadId: "emberforge",
    premiumSetId: "emberforge",
    skin: { fontHeadline: "bebas",        fontBody: "rajdhani",     fontMono: "jetbrains" },
    miniature: null,
    accent: { from: "#ff6a14", to: "#ff9426" },
  },

  // ── Tempus set ──
  // Sands of time: warm sepia dunes, rotating ancient gears, falling sand
  // grains, hourglass glow, bronze vignette.
  {
    id: "tempus",    label: "Tempus Aeternum",  emoji: "⏳",
    src: null, scene: "tempus",                defaultPadId: "tempus",
    premiumSetId: "tempus",
    flashy: true,
    skin: { fontHeadline: "cinzel",       fontBody: "cormorant",    fontMono: "jetbrains" },
    miniature: null,
    accent: { from: "#b8956a", to: "#d4a76a" },
  },

  // ── Storm set ──
  // Tempest fury: deep thunderhead sky, rolling clouds, jagged lightning
  // bolts, electric cyan+purple flash, falling rain curtains.
  {
    id: "storm",     label: "Tempest Fury",     emoji: "⚡",
    src: null, scene: "storm",                 defaultPadId: "storm",
    premiumSetId: "storm",
    flashy: true,
    skin: { fontHeadline: "orbitron",     fontBody: "rajdhani",     fontMono: "jetbrains" },
    miniature: null,
    accent: { from: "#4af0ff", to: "#a078ff" },
  },

  // ── Premium sets ──
  // Quartz: crystalline shards refracting prismatic light. SVG/SMIL only —
  // no WebGL context (the splash already owns it). Behaviour-gated: appears
  // in the picker but tapping it opens the purchase modal until owned.
  {
    id: "quartz",    label: "Quartz",         emoji: "💠",
    src: null,       premiumScene: "quartz",  premiumSetId: "quartz",
    light: true,
    defaultPadId: "quartz",
    skin: { fontHeadline: "cinzel",       fontBody: "cormorant",    fontMono: "spaceMono" },
    miniature: null,
    accent: { from: "#c8aef0", to: "#f6a5b8" },
  },

  // ── 2026-06-07 premium lineup (see docs/PREMIUM_THEMES.md). Each set has
  //    a brand-new shader (added in ThemedBackdrop.tsx), a dedicated SVG
  //    pad, its own HUD palette + font stack, and premium-set gating so the
  //    picker shows a Premium ribbon + ✦ price until the player owns it.
  //    Ink / Bloom / Void are LIGHT scenes — App.css picks up `theme-light`. ──
  {
    id: "coral",     label: "Coral",          emoji: "🪸",
    src: null, scene: "coral",                defaultPadId: "coral",
    premiumSetId: "coral",
    skin: { fontHeadline: "playfair",     fontBody: "cormorant",    fontMono: "jetbrains" },
    miniature: null,
    accent: { from: "#ff6b6b", to: "#4ecdc4" },
  },
  {
    id: "rust",      label: "Rust",           emoji: "🏭",
    src: null, scene: "rust",                 defaultPadId: "rust",
    premiumSetId: "rust",
    skin: { fontHeadline: "bebas",        fontBody: "rajdhani",     fontMono: "shareTech" },
    miniature: null,
    accent: { from: "#d2691e", to: "#8b4513" },
  },
  {
    id: "void",      label: "Void",           emoji: "◼️",
    src: null, scene: "void",                 defaultPadId: "void",
    premiumSetId: "void",
    skin: { fontHeadline: "jetbrains",    fontBody: "jetbrains",    fontMono: "jetbrains" },
    miniature: null,
    accent: { from: "#ffffff", to: "#666666" },
  },
  {
    id: "prism",     label: "Prism",          emoji: "💎",
    src: null, scene: "prism",                defaultPadId: "prism",
    premiumSetId: "prism",
    flashy: true,
    skin: { fontHeadline: "spaceGrotesk", fontBody: "inter",        fontMono: "jetbrains" },
    miniature: null,
    accent: { from: "#ffffff", to: "#8b5cf6" },
  },
  {
    id: "ink",       label: "Ink",            emoji: "🖋️",
    src: null, scene: "ink",                  defaultPadId: "ink",
    premiumSetId: "ink",
    light: true,
    skin: { fontHeadline: "ebGaramond",   fontBody: "cormorant",    fontMono: "jetbrains" },
    miniature: null,
    accent: { from: "#1a1a1a", to: "#8c8c8c" },
  },
  {
    id: "bloom",     label: "Bloom",          emoji: "🌸",
    src: null, scene: "bloom",                defaultPadId: "bloom",
    premiumSetId: "bloom",
    // 2026-06-07 — bloom backdrop was darkened to a dusky meadow, so the
    // light-scaffolding (white-mixed panels + dark ink) no longer fits;
    // it painted near-white modals over the dark meadow = HUD aveuglant.
    // Switching to the default dark-glass surfaces + light ink: panels
    // read as tinted dark sheets against the meadow, text stays bright.
    skin: { fontHeadline: "playfair",     fontBody: "inter",        fontMono: "jetbrains" },
    miniature: null,
    accent: { from: "#c45a86", to: "#5f9367" },
  },

  // Player's OWN image — uploaded in Profile, stored as a data URL. The
  // recommended format is shown in the picker (portrait 9:16, cover-fit).
  {
    id: "custom",    label: "Mon image",      emoji: "🖼️",
    src: null, custom: true,                  defaultPadId: null,
    skin: { fontHeadline: "inter",        fontBody: "inter",        fontMono: "jetbrains"  },
    miniature: null,
    accent: null,
  },
];

/** Resolve a skin entry to the actual CSS font-family string, with the
 *  font fallback chain already baked in. */
export function resolveFontFamily(key: FontStackKey): string {
  return FONT_STACK[key];
}

export const BACKGROUNDS_BY_ID: Record<BackgroundId, BackgroundDef> = Object.fromEntries(
  BACKGROUNDS.map((b) => [b.id, b]),
) as Record<BackgroundId, BackgroundDef>;

/** Reverse pairing for the "did I match my pad to my background?" affordance
 *  in the picker UI — handy when surfacing "Pair: Casino bg + Casino pad". */
export const PAD_DEFAULT_BG: Partial<Record<PadId, BackgroundId>> = Object.fromEntries(
  BACKGROUNDS.filter((b) => b.defaultPadId).map((b) => [b.defaultPadId!, b.id]),
);

/** HUD colour palette that pairs with each coded background. Selecting the
 *  background auto-applies this palette (and its `defaultPadId`) so the whole
 *  look stays coherent — the player can still re-pick a palette in the
 *  Couleurs tab afterwards (mix & match). To add a style: one line here.
 *  Omitted backgrounds (default / custom) keep the player's current palette. */
export const BG_DEFAULT_THEME: Partial<Record<BackgroundId, ThemeId>> = {
  nebula:   "violet",
  galaxy:   "aurora",
  aurora:   "aurora",
  holy:     "gold",
  quantum:  "ocean",
  grid:     "neon",
  casino:   "forest",
  volcanic: "sunset",
  abyss:    "ocean",
  eclipse:    "eclipse",
  phantom:    "phantom",
  emberforge: "emberforge",
  tempus:     "tempus",
  storm:      "storm",
  quartz:     "quartz",
  coral:      "coral",
  rust:       "rust",
  void:       "void",
  prism:      "prism",
  ink:        "ink",
  bloom:      "bloom",
};
