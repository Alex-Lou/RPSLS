import {
  FaHandRock,
  FaHandPaper,
  FaHandScissors,
  FaHandLizard,
  FaHandSpock,
} from "react-icons/fa";
import type { IconType } from "react-icons";
import type { Move } from "./game";

export const MOVE_ICON: Record<Move, IconType> = {
  rock: FaHandRock,
  paper: FaHandPaper,
  scissors: FaHandScissors,
  lizard: FaHandLizard,
  spock: FaHandSpock,
};

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

  const base =
    `relative ${s.box} rounded-2xl sm:rounded-3xl flex items-center justify-center ` +
    `bg-gradient-to-br ${pal.from} ${pal.to} ` +
    `text-zinc-900 ring-2 ${pal.ring} shadow-xl ${pal.glow} ` +
    `transition-all`;

  const emp =
    emphasis === "winner"
      ? "scale-[1.06]"
      : emphasis === "loser"
      ? "opacity-50 grayscale"
      : "";

  return (
    <div className={`${base} ${emp} ${className}`}>
      <MoveGlyph move={move} className={s.icon} />
    </div>
  );
}

/** Renders a move silhouette via CSS mask so the baked-in dark backdrop in
 *  the source PNG disappears and only the bright silhouette shows, filled
 *  with `color` (defaults to white). Uses mask-mode: luminance so the PNG's
 *  brightness drives the mask — bright pixels visible, dark bg invisible
 *  (the source PNGs are NOT alpha-transparent). A small drop-shadow gives
 *  the silhouette a faint white halo for that "lit from below" feel. */
export function MoveGlyph({
  move,
  className = "",
  color = "white",
}: {
  move: Move;
  className?: string;
  color?: string;
}) {
  const url = `url("${MOVE_PNG[move]}")`;
  return (
    <div
      className={className + " select-none pointer-events-none"}
      style={{
        WebkitMaskImage: url,
        maskImage: url,
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        backgroundColor: color,
        filter: "drop-shadow(0 0 4px rgba(255,255,255,0.45)) drop-shadow(0 0 1px rgba(0,0,0,0.6))",
        // TS lib types haven't caught up with mask-mode yet, hence the cast.
        ...({ WebkitMaskMode: "luminance", maskMode: "luminance" } as React.CSSProperties),
      }}
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
