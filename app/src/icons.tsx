import type { Move } from "./engine/game";

/** Per-move accent palette — used for halos, gradients, button focus. */
export const MOVE_PALETTE: Record<
  Move,
  { from: string; to: string; ring: string; glow: string; hex: string }
> = {
  rock:     { from: "from-stone-300", to: "to-amber-400",   ring: "ring-amber-400/40",   glow: "shadow-amber-500/30",   hex: "#fbbf24" },
  paper:    { from: "from-zinc-100",  to: "to-sky-200",     ring: "ring-sky-200/40",     glow: "shadow-sky-300/30",     hex: "#bae6fd" },
  scissors: { from: "from-rose-300",  to: "to-orange-400",  ring: "ring-rose-400/40",    glow: "shadow-rose-500/30",    hex: "#fb923c" },
  lizard:   { from: "from-lime-300",  to: "to-emerald-500", ring: "ring-emerald-400/40", glow: "shadow-emerald-500/30", hex: "#34d399" },
  spock:    { from: "from-cyan-300",  to: "to-violet-500",  ring: "ring-violet-400/40",  glow: "shadow-violet-500/30",  hex: "#8b5cf6" },
};

/** Blend a move's identity hex toward the active theme accent so the move
 *  frame harmonises with the chosen background while staying recognisable.
 *  `mix` = how much of the MOVE colour to keep (0.55 → 55% move, 45% theme).
 *  Returns a CSS color-mix() string driven by --theme-primary, which itself
 *  follows the background accent override set in App.tsx. */
export function moveRim(hex: string, mix = 55): string {
  return `color-mix(in oklab, ${hex} ${mix}%, var(--theme-primary))`;
}

/** Same blend but faded toward transparent — for soft outer glows. */
export function moveGlow(hex: string, mix = 55, alpha = 50): string {
  return `color-mix(in oklab, ${moveRim(hex, mix)} ${alpha}%, transparent)`;
}

interface HandProps {
  move: Move;
  size?: "sm" | "md" | "lg" | "xl";
  emphasis?: "default" | "winner" | "loser";
  className?: string;
}

const SIZE = {
  sm: { box: "w-12 h-12 sm:w-14 sm:h-14",                        icon: "w-6 h-6 sm:w-7 sm:h-7" },
  md: { box: "w-16 h-16 sm:w-20 sm:h-20",                        icon: "w-8 h-8 sm:w-10 sm:h-10" },
  lg: { box: "w-24 h-24 sm:w-28 sm:h-28",                        icon: "w-12 h-12 sm:w-14 sm:h-14" },
  xl: { box: "w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48",        icon: "w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24" },
};

const MYSTERY_SIZE = {
  sm: { box: "w-12 h-12 sm:w-14 sm:h-14",                        font: "text-2xl sm:text-3xl" },
  md: { box: "w-16 h-16 sm:w-20 sm:h-20",                        font: "text-3xl sm:text-4xl" },
  lg: { box: "w-24 h-24 sm:w-28 sm:h-28",                        font: "text-5xl sm:text-5xl" },
  xl: { box: "w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48",        font: "text-6xl sm:text-7xl md:text-8xl" },
};

/** Themed PNG silhouette for each move. Drops onto the per-move palette
 *  gradient inside Hand so the gesture is the user's eye-anchor and the
 *  colour identity comes from the gradient behind it. */
export const MOVE_PNG: Record<Move, string> = {
  rock:     "/Moves/rock.png",
  paper:    "/Moves/paper.png",
  scissors: "/Moves/scissors.png",
  lizard:   "/Moves/lizard.png",
  spock:    "/Moves/spock.png",
};

export function Hand({ move, size = "md", emphasis = "default", className = "" }: HandProps) {
  const pal = MOVE_PALETTE[move];
  const s = SIZE[size];

  // Dark surface + theme-blended coloured border + soft glow. The rim
  // keeps each move recognisable (rock=amber-ish, spock=violet-ish) while
  // bending ~45% toward the active theme accent so the frame harmonises
  // with the chosen background instead of being a fixed rainbow.
  const rim = moveRim(pal.hex);
  const dark = "linear-gradient(160deg, rgba(20,22,32,0.92) 0%, rgba(10,12,20,0.92) 100%)";
  const glow = `0 0 18px -2px ${moveGlow(pal.hex)}, inset 0 1px 0 rgba(255,255,255,0.08)`;

  const emp =
    emphasis === "winner"
      ? "scale-[1.06]"
      : emphasis === "loser"
      ? "opacity-50 grayscale"
      : "";

  return (
    <div
      className={`relative ${s.box} rounded-2xl sm:rounded-3xl flex items-center justify-center text-white transition-all ${emp} ${className}`}
      style={{
        background: dark,
        border: `2.5px solid ${rim}`,
        boxShadow: glow,
      }}
    >
      <MoveGlyph move={move} className={s.icon} />
    </div>
  );
}

/** Renders a move silhouette as a direct <img>. We tried the CSS mask
 *  approaches (luminance + alpha mode) and both failed on at least one
 *  Android WebView version Alex tested on (either invisible glyph OR
 *  unmasked white square depending on which mode-mode the device honoured).
 *  Going back to a plain <img> is the universal-compat option — every
 *  WebView renders an <img> correctly. The PNGs ship as white silhouettes
 *  with a subtle violet glow on transparent bg, so as long as the parent
 *  button has a DARK background (which we enforce in PickerBar / Hand
 *  below), the silhouette reads clearly. */
export function MoveGlyph({
  move,
  className = "",
}: {
  move: Move;
  className?: string;
  /** Legacy prop kept for API back-compat. The colour now comes from the
   *  PNG itself (white silhouette + violet glow). Ignored. */
  color?: string;
}) {
  return (
    <img
      src={MOVE_PNG[move]}
      alt={move}
      draggable={false}
      className={className + " select-none pointer-events-none object-contain"}
    />
  );
}

/** Placeholder shown during the countdown — neither side is revealed yet. */
export function MysteryHand({ size = "lg" }: { size?: "sm" | "md" | "lg" | "xl" }) {
  const s = MYSTERY_SIZE[size];
  return (
    <div
      className={
        `${s.box} rounded-2xl sm:rounded-3xl flex items-center justify-center ` +
        `bg-gradient-to-br from-zinc-700 to-zinc-900 ` +
        `text-zinc-300 ring-2 ring-white/15 shadow-xl shadow-black/40`
      }
    >
      <span className={`${s.font} font-black opacity-70`}>?</span>
    </div>
  );
}

/* ───────────────────────── Glyphes SVG monochromes ─────────────────────────
 * Remplacent les émojis user-facing (règle dure « zéro émoji », Alex 2026-06-24).
 * Monochromes via currentColor → teintés par la couleur de texte du parent (donc
 * par le thème). Tailles via className (w-/h-). Inline, sans canvas, cross-WebView. */

interface GlyphProps { className?: string }

/** ✦ — étoile 4 branches (déco / premium). */
export function SparkleGlyph({ className = "" }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 1.5l1.9 8.6 8.6 1.9-8.6 1.9L12 22.5l-1.9-8.6L1.5 12l8.6-1.9z" />
    </svg>
  );
}

/** ⚡ — éclair (mana / cast-à-la-pioche). */
export function BoltGlyph({ className = "" }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M13 2L4 14h6l-2 8 11-13h-7z" />
    </svg>
  );
}

/** ⚠ — triangle d'alerte. */
export function WarnGlyph({ className = "" }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" aria-hidden className={className}>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="17" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** ⚗ — fiole/alambic (Forge / fusion). */
export function FuseGlyph({ className = "" }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" aria-hidden className={className}>
      <path d="M9.5 3h5M10.5 3v6.5L6 18.5Q5.4 20.5 7.5 20.5h9Q18.6 20.5 18 18.5L13.5 9.5V3" />
    </svg>
  );
}

/** 🎴 — éventail de cartes (main vide / dos de carte). */
export function CardFanGlyph({ className = "" }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden className={className}>
      <rect x="7.5" y="5" width="9" height="13" rx="1.4" transform="rotate(-13 12 12)" />
      <rect x="7.5" y="5" width="9" height="13" rx="1.4" transform="rotate(13 12 12)" />
    </svg>
  );
}
