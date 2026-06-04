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

const MINI = "/Backgrounds/Miniatures Icons Theme";

export const BACKGROUNDS: BackgroundDef[] = [
  // Default: no override — the global theme picker still drives the colours.
  {
    id: "default",   label: "Original",       emoji: "🌌",
    src: null,                                          defaultPadId: null,
    skin: { fontHeadline: "inter",        fontBody: "inter",        fontMono: "jetbrains"  },
    miniature: `${MINI}/default.png`,
    accent: null,
  },
  // Ancient: dark navy parchment + warm bronze sigils + amethyst gems.
  {
    id: "ancient",   label: "Ancient",        emoji: "📜",
    src: "/Backgrounds/ancient.png", defaultPadId: "ancient",
    skin: { fontHeadline: "cinzel",       fontBody: "cormorant",    fontMono: "imFell"     },
    miniature: `${MINI}/ancient.png`,
    accent: { from: "#c9a55a", to: "#9d6ef7" },
  },
  // Astrolab: warm brass instruments on midnight blue, occasional cyan glow.
  {
    id: "astrolab",  label: "Astrolab",       emoji: "🔭",
    src: "/Backgrounds/astrolab.png",         defaultPadId: "astrolab",
    skin: { fontHeadline: "cinzel",       fontBody: "ebGaramond",   fontMono: "jetbrains"  },
    miniature: `${MINI}/astrolab.png`,
    accent: { from: "#d4a849", to: "#4adbe8" },
  },
  // Casino: emerald felt + gold filigree + crimson chip accents.
  {
    id: "casino",    label: "Casino Royale",  emoji: "🎰",
    src: "/Backgrounds/casino.png",    defaultPadId: "casino",
    skin: { fontHeadline: "playfair",     fontBody: "cormorant",    fontMono: "bebas"      },
    miniature: `${MINI}/casino.png`,
    accent: { from: "#16a34a", to: "#facc15" },
  },
  // Cyberpunk: saturated magenta + electric cyan neons on wet asphalt.
  {
    id: "cyberpunk", label: "Cyberpunk",      emoji: "🌆",
    src: "/Backgrounds/cyberpunk.png",       defaultPadId: "cyberpunk",
    skin: { fontHeadline: "orbitron",     fontBody: "rajdhani",     fontMono: "shareTech"  },
    miniature: `${MINI}/cyberpunk.png`,
    accent: { from: "#f0abfc", to: "#06b6d4" },
  },
  // Galaxy: deep violet nebula + fuchsia + cyan starlight.
  {
    id: "galaxy",    label: "Galaxy",         emoji: "✨",
    src: "/Backgrounds/galaxy.png",          defaultPadId: "cosmos",
    skin: { fontHeadline: "audiowide",    fontBody: "exo2",         fontMono: "spaceMono"  },
    miniature: `${MINI}/galaxy.png`,
    accent: { from: "#a855f7", to: "#22d3ee" },
  },
  // Holy: divine amber gold + cathedral indigo + stained-glass jewel tones.
  {
    id: "holy",      label: "Holy Game",      emoji: "✝️",
    src: "/Backgrounds/holy.png",       defaultPadId: "holy",
    skin: { fontHeadline: "cinzel",       fontBody: "cormorant",    fontMono: "imFell"     },
    miniature: `${MINI}/holy.png`,
    accent: { from: "#fbbf24", to: "#6366f1" },
  },
  // Quantum: bright cyan plasma + electric blue arcs + steel.
  {
    id: "quantum",   label: "Quantum Lab",    emoji: "⚛️",
    src: "/Backgrounds/quantum.png",     defaultPadId: "quantum",
    skin: { fontHeadline: "spaceGrotesk", fontBody: "ibmPlex",      fontMono: "fira"       },
    miniature: `${MINI}/quantum.png`,
    accent: { from: "#22d3ee", to: "#3b82f6" },
  },
  // Steampunk: copper + brass + amber gaslight on dark wood.
  {
    id: "steampunk", label: "Steampunk",      emoji: "⚙️",
    src: "/Backgrounds/steampunk.png", defaultPadId: "steampunk",
    skin: { fontHeadline: "medieval",     fontBody: "imFell",       fontMono: "bevan"      },
    miniature: `${MINI}/steampunk.png`,
    accent: { from: "#b45309", to: "#f59e0b" },
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
