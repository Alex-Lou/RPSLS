import { motion, AnimatePresence } from "motion/react";

/* ──────────── RollingScore ──────────── */

/**
 * Score digit that slides up/out when its value changes, instead of letting
 * two glyphs stack on top of each other (the "binary score" bug we had in
 * Lanes before lifting state out of LanesMatchView).
 */
export function RollingScore({
  value, color, size = "lg",
}: {
  value: number;
  color: "emerald" | "rose" | "violet" | "amber" | "zinc";
  size?: "md" | "lg" | "xl";
}) {
  const palette: Record<typeof color, string> = {
    emerald: "text-emerald-300",
    rose:    "text-rose-300",
    violet:  "text-violet-300",
    amber:   "text-amber-300",
    zinc:    "text-ink-muted",
  };
  const sizeCls = size === "xl" ? "text-4xl sm:text-5xl"
                : size === "lg" ? "text-3xl sm:text-4xl"
                :                 "text-2xl sm:text-3xl";
  return (
    <span
      className={
        "relative inline-block min-w-[1.2em] text-center overflow-hidden font-black tabular-nums " +
        sizeCls + " " + palette[color]
      }
      style={{ height: "1.1em", lineHeight: "1.1em" }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: "-100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/* ──────────── MatchScoreBar ──────────── */

/**
 * The unified top-of-match score bar used by every mode (classic
 * Training/Casual/Ranked/Hot-seat AND Constellation Lanes). One component →
 * one look. Full-width score card with centered names + score; the back/quit
 * button is rendered separately by `FloatingMatchBackButton` so it docks next
 * to the burger and frees the whole row width for the score header.
 */
export function MatchScoreBar({
  youName, oppName, youScore, oppScore, caption,
  youTag, oppTag, youStreak = 0, oppStreak = 0, compact = false,
}: {
  youName: string;
  oppName: string;
  youScore: number;
  oppScore: number;
  caption?: string;
  /** Tiny uppercase label above each name (e.g. "You" / "Opponent"). */
  youTag?: string;
  oppTag?: string;
  youStreak?: number;
  oppStreak?: number;
  /** Opt-in slimmer bar (Alex 2026-07) : padding + chiffres réduits pour rendre
   *  de la hauteur quand une rangée de boutons vit AU-DESSUS (Constellation
   *  Classé). Défaut false → tous les autres modes gardent la taille pleine. */
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className={
        "flex items-center justify-between rounded-2xl bg-surface border border-hairline min-w-0 px-3 sm:px-4 " +
        (compact ? "py-1.5 sm:py-2" : "py-2.5 sm:py-3")
      }>
        <div className="flex flex-col min-w-0 flex-1">
          {youTag && (
            <span className="text-[12px] sm:text-xs uppercase tracking-wider text-ink-muted font-medium">{youTag}</span>
          )}
          <span className="text-base sm:text-lg font-bold truncate text-emerald-200 flex items-center gap-1.5">
            <span className="truncate">{youName}</span>
            <StreakBadge streak={youStreak} />
          </span>
        </div>
        <div className="shrink-0 px-2 sm:px-3 flex items-center justify-center gap-1">
          <RollingScore value={youScore} color="emerald" size={compact ? "md" : "lg"} />
          <span className="text-ink-muted px-0.5 font-bold">:</span>
          <RollingScore value={oppScore} color="rose" size={compact ? "md" : "lg"} />
        </div>
        <div className="flex flex-col text-right min-w-0 flex-1">
          {oppTag && (
            <span className="text-[12px] sm:text-xs uppercase tracking-wider text-ink-muted font-medium">{oppTag}</span>
          )}
          <span className="text-base sm:text-lg font-bold truncate text-rose-200 flex items-center gap-1.5 justify-end">
            <StreakBadge streak={oppStreak} />
            <span className="truncate">{oppName}</span>
          </span>
        </div>
      </div>
      {caption && (
        <div className="text-center text-[13px] sm:text-sm uppercase tracking-[0.2em] text-ink-muted font-medium">
          {caption}
        </div>
      )}
    </div>
  );
}

function StreakBadge({ streak }: { streak: number }) {
  return (
    <AnimatePresence>
      {streak >= 2 && (
        <motion.span
          key={streak}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 18 }}
          className={
            "shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full " +
            (streak >= 3
              ? "bg-orange-500/30 text-orange-300 ring-1 ring-orange-400/50"
              : "bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/40")
          }
        >
          🔥 {streak}
        </motion.span>
      )}
    </AnimatePresence>
  );
}
