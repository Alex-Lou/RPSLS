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
}

export const BACKGROUNDS: BackgroundDef[] = [
  { id: "default",   label: "Original",       emoji: "🌌", src: null,                                            defaultPadId: null         },
  { id: "ancient",   label: "Ancient",        emoji: "📜", src: "/Backgrounds/Ancient Playmat Backgruond.png",   defaultPadId: "ancient"    },
  { id: "astrolab",  label: "Astrolab",       emoji: "🔭", src: "/Backgrounds/AstroLab Bckground.png",           defaultPadId: "astrolab"   },
  { id: "casino",    label: "Casino Royale",  emoji: "🎰", src: "/Backgrounds/CasinoRoyale Background.png",      defaultPadId: "casino"     },
  { id: "cyberpunk", label: "Cyberpunk",      emoji: "🌆", src: "/Backgrounds/CyberPunk Background.png",         defaultPadId: "cyberpunk"  },
  { id: "galaxy",    label: "Galaxy",         emoji: "✨", src: "/Backgrounds/Galaxy Background.png",            defaultPadId: "cosmos"     },
  { id: "quantum",   label: "Quantum Lab",    emoji: "⚛️", src: "/Backgrounds/Quantum Lab Background.png",       defaultPadId: "quantum"    },
  { id: "steampunk", label: "Steampunk",      emoji: "⚙️", src: "/Backgrounds/SteamPunk Workshop Background.png", defaultPadId: "steampunk" },
];

export const BACKGROUNDS_BY_ID: Record<BackgroundId, BackgroundDef> = Object.fromEntries(
  BACKGROUNDS.map((b) => [b.id, b]),
) as Record<BackgroundId, BackgroundDef>;

/** PNG playmats — the SVG ones are switched on padId inside BattlePad. */
export const PAD_IMAGES: Partial<Record<PadId, string>> = {
  ancient:   "/Pads/Ancient Mythical Pad.png",
  astrolab:  "/Pads/Astrolab.png",
  casino:    "/Pads/Casino Royale.png",
  cyberpunk: "/Pads/CyberPunk Pad.png",
  quantum:   "/Pads/Quantum.png",
  steampunk: "/Pads/Steampunk.png",
};

/** Reverse pairing for the "did I match my pad to my background?" affordance
 *  in the picker UI — handy when surfacing "Pair: Casino bg + Casino pad". */
export const PAD_DEFAULT_BG: Partial<Record<PadId, BackgroundId>> = Object.fromEntries(
  BACKGROUNDS.filter((b) => b.defaultPadId).map((b) => [b.defaultPadId!, b.id]),
);
