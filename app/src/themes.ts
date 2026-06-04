/**
 * themes.ts — central catalogue for the cosmetic theming layer.
 *
 * Two concerns live side-by-side here:
 *
 *  - BACKGROUNDS: full-screen images painted behind every page. They override
 *    the default radial-gradient body background. `src: null` means "keep the
 *    default gradient" — i.e. the original look.
 *
 *  - PAD_IMAGES: a PadId → PNG path mapping for the new image-based playmats
 *    (Ancient / Astrolab / Casino / Cyberpunk / Quantum / Steampunk). The
 *    classic 5 SVG pads (chalkboard / vintage / cosmos / neon / comics)
 *    live in BattlePad.tsx and don't appear here.
 *
 * Each background advertises a `defaultPadId` it pairs naturally with (set
 * automatically when the user picks the background, unless they later
 * override). Players are free to mix-and-match.
 *
 * To add a new background: drop the PNG in /public/Backgrounds/, append an
 * entry here, optionally extend PadId in types.ts + PAD_META + PAD_IMAGES.
 */

import type { BackgroundId, PadId } from "./types";
import { FONT_STACK, type FontStackKey } from "./fonts";
import type { BackdropScene } from "./backdrops/ThemedBackdrop";

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
    skin: { fontHeadline: "audiowide",    fontBody: "exo2",         fontMono: "spaceMono"  },
    miniature: null,
    accent: { from: "#a855f7", to: "#22d3ee" },
  },
  {
    id: "galaxy",    label: "Galaxy",         emoji: "✨",
    src: null, scene: "galaxy",               defaultPadId: "cosmos",
    skin: { fontHeadline: "audiowide",    fontBody: "exo2",         fontMono: "spaceMono"  },
    miniature: null,
    accent: { from: "#a855f7", to: "#22d3ee" },
  },
  {
    id: "aurora",    label: "Aurora",         emoji: "🌠",
    src: null, scene: "aurora",               defaultPadId: "cosmos",
    skin: { fontHeadline: "spaceGrotesk", fontBody: "exo2",         fontMono: "spaceMono"  },
    miniature: null,
    accent: { from: "#34d399", to: "#8b5cf6" },
  },
  {
    id: "holy",      label: "Holy",           emoji: "✝️",
    src: null, scene: "holy",                 defaultPadId: "holy",
    skin: { fontHeadline: "cinzel",       fontBody: "cormorant",    fontMono: "imFell"     },
    miniature: null,
    accent: { from: "#fbbf24", to: "#6366f1" },
  },
  {
    id: "quantum",   label: "Quantum",        emoji: "⚛️",
    src: null, scene: "quantum",              defaultPadId: "quantum",
    skin: { fontHeadline: "spaceGrotesk", fontBody: "ibmPlex",      fontMono: "fira"       },
    miniature: null,
    accent: { from: "#22d3ee", to: "#3b82f6" },
  },
  {
    id: "grid",      label: "Neon Grid",      emoji: "🌐",
    src: null, scene: "grid",                 defaultPadId: "neon",
    skin: { fontHeadline: "orbitron",     fontBody: "rajdhani",     fontMono: "shareTech"  },
    miniature: null,
    accent: { from: "#06b6d4", to: "#f0abfc" },
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

/** PNG playmats — the SVG ones are switched on padId inside BattlePad. */
export const PAD_IMAGES: Partial<Record<PadId, string>> = {
  ancient:   "/Pads/Ancient Mythical Pad.png",
  astrolab:  "/Pads/Astrolab.png",
  casino:    "/Pads/Casino Royale.png",
  cyberpunk: "/Pads/CyberPunk Pad.png",
  holy:      "/Pads/Holy Game.png",
  quantum:   "/Pads/Quantum.png",
  steampunk: "/Pads/Steampunk.png",
};

/** Reverse pairing for the "did I match my pad to my background?" affordance
 *  in the picker UI — handy when surfacing "Pair: Casino bg + Casino pad". */
export const PAD_DEFAULT_BG: Partial<Record<PadId, BackgroundId>> = Object.fromEntries(
  BACKGROUNDS.filter((b) => b.defaultPadId).map((b) => [b.defaultPadId!, b.id]),
);
