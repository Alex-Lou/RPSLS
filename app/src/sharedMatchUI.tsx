/**
 * Shared "cinematic" match UI bits — extracted so the classic 1v1 modes
 * (Training / Casual / Ranked / Hot-seat) can wear the same look-and-feel
 * as the Constellation Lanes mode.
 *
 * Components exported:
 *   - RollingScore: AnimatePresence popLayout digit, no pile-up on change.
 *   - CinematicMatchEnd: trophy/skull/handshake glyph that springs in then
 *     gently floats, gradient VICTOIRE/ÉGALITÉ/DÉFAITE wordmark that
 *     breathes, optional forfeit pill, score card, Rematch + Back buttons,
 *     end-of-match author quote (random per mount).
 *   - AmbientFlavor: ~10 rotating geek one-liners. Atmosphere, not signal.
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useT } from "./i18n";

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
    zinc:    "text-zinc-300",
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
 * one look. Optional back button, optional per-side streak badge, caption
 * underneath.
 */
export function MatchScoreBar({
  youName, oppName, youScore, oppScore, caption,
  youTag, oppTag, youStreak = 0, oppStreak = 0,
  onBack, backLabel,
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
  onBack?: () => void;
  backLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {onBack && (
          <button
            onClick={onBack}
            aria-label={backLabel}
            className="shrink-0 w-10 h-10 rounded-xl border border-white/10 hover:border-white/30 bg-zinc-950/40 backdrop-blur-sm transition flex items-center justify-center text-zinc-300 hover:text-white"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        <div className="flex-1 flex items-center justify-between rounded-2xl bg-black/30 border border-white/10 px-3 sm:px-4 py-2.5 sm:py-3 min-w-0">
          <div className="flex flex-col min-w-0 flex-1">
            {youTag && (
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">{youTag}</span>
            )}
            <span className="font-semibold truncate text-emerald-200 flex items-center gap-1.5">
              <span className="truncate">{youName}</span>
              <StreakBadge streak={youStreak} />
            </span>
          </div>
          <div className="px-2 sm:px-3 flex items-center gap-1">
            <RollingScore value={youScore} color="emerald" size="lg" />
            <span className="text-zinc-600 px-0.5">:</span>
            <RollingScore value={oppScore} color="rose" size="lg" />
          </div>
          <div className="flex flex-col text-right min-w-0 flex-1">
            {oppTag && (
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">{oppTag}</span>
            )}
            <span className="font-semibold truncate text-rose-200 flex items-center gap-1.5 justify-end">
              <StreakBadge streak={oppStreak} />
              <span className="truncate">{oppName}</span>
            </span>
          </div>
        </div>
      </div>
      {caption && (
        <div className="text-center text-[11px] uppercase tracking-[0.25em] text-zinc-500">
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

/* ──────────── CinematicMatchEnd ──────────── */

export interface CinematicMatchEndProps {
  /** Outcome from the player's perspective. */
  outcome: "win" | "loss" | "draw";
  /** Optional small forfeit pill. */
  forfeit?: boolean;
  /** Score line (already formatted, e.g. "3 — 1"). */
  scoreLine?: string;
  /** Rematch action (omit → no button). */
  onRematch?: () => void;
  /** Back / quit action (always shown). */
  onBack: () => void;
  /** Override the rematch button label. */
  rematchLabel?: string;
  /** Override the back button label. */
  backLabel?: string;
}

const QUOTE_COUNT = 10;

export function CinematicMatchEnd({
  outcome, forfeit, scoreLine, onRematch, onBack,
  rematchLabel, backLabel,
}: CinematicMatchEndProps) {
  const t = useT();
  const youWon = outcome === "win";
  const draw = outcome === "draw";
  // Stable random pick per mount.
  const quoteIdx = useRef(Math.floor(Math.random() * QUOTE_COUNT)).current;

  const glyph = youWon ? "🏆" : draw ? "🤝" : "💀";
  const wordmark =
    youWon ? t("lanes.victory") :
    draw   ? t("lanes.endDraw") :
             t("lanes.defeat");
  const gradient =
    youWon ? "from-emerald-300 to-teal-400" :
    draw   ? "from-zinc-200 to-zinc-400"   :
             "from-rose-300 to-fuchsia-400";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-5 py-6"
    >
      {/* Glyph: spring in, then idle-float forever. */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{
          scale: 1,
          rotate: 0,
          y: [0, -8, 0, -4, 0],
        }}
        transition={{
          scale:  { type: "spring", stiffness: 200, damping: 12, delay: 0.1 },
          rotate: { type: "spring", stiffness: 200, damping: 12, delay: 0.1 },
          y:      { duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 1.0 },
        }}
        className="text-7xl sm:text-8xl"
      >
        {glyph}
      </motion.div>

      {/* Wordmark: enter then breathe. */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{
          opacity: 1,
          y: 0,
          scale: [1, 1.04, 1],
        }}
        transition={{
          opacity: { delay: 0.5 },
          y:       { delay: 0.5 },
          scale:   { duration: 2.6, repeat: Infinity, ease: "easeInOut", delay: 1.2 },
        }}
        className={
          "text-4xl sm:text-5xl font-black bg-gradient-to-br bg-clip-text text-transparent " +
          gradient
        }
      >
        {wordmark}
      </motion.div>

      {forfeit && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-xs uppercase tracking-[0.3em] text-amber-300"
        >
          {t("lanes.byForfeit")}
        </motion.div>
      )}

      {scoreLine && (
        <div className="text-2xl font-mono">{scoreLine}</div>
      )}

      {/* Author quote. */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.4 }}
        className="max-w-md mx-auto px-6 mt-1 text-center"
      >
        <div className="text-sm italic text-zinc-300 leading-relaxed">
          « {t(`lanes.endQuote.${quoteIdx}.text`)} »
        </div>
        <div className="text-xs text-zinc-500 mt-1 tracking-wide">
          {t(`lanes.endQuote.${quoteIdx}.author`)}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5 }}
        className="flex flex-col sm:flex-row gap-2 mt-2 w-full max-w-md px-4"
      >
        {onRematch && (
          <button
            onClick={onRematch}
            className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 font-bold text-white shadow-lg shadow-emerald-500/30 transition"
          >
            {rematchLabel ?? t("lanes.rematch")}
          </button>
        )}
        <button
          onClick={onBack}
          className="flex-1 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 font-semibold text-zinc-200 transition"
        >
          {backLabel ?? t("lanes.backToMenu")}
        </button>
      </motion.div>
    </motion.div>
  );
}

/* ──────────── Ambient flavor (atmosphere only) ──────────── */

const FLAVOR_COUNT = 10;

/**
 * Random tiny one-liner from the `lanes.flavor.*` i18n bucket, rotating
 * every ~3.5s with soft fades. Used wherever there's idle pick time.
 */
export function AmbientFlavor() {
  const t = useT();
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * FLAVOR_COUNT));
  useEffect(() => {
    const id = setInterval(
      () => setIdx((cur) =>
        (cur + 1 + Math.floor(Math.random() * (FLAVOR_COUNT - 1))) % FLAVOR_COUNT),
      3500,
    );
    return () => clearInterval(id);
  }, []);
  return (
    <div className="min-h-[1.4em] flex items-center justify-center px-4 text-center">
      <AnimatePresence mode="wait">
        <motion.span
          key={idx}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 0.55, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.4 }}
          className="text-[10px] italic text-zinc-500 font-light tracking-wide"
        >
          {t(`lanes.flavor.${idx}`)}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
