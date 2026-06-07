/**
 * LpBar — the rank-progress track shared by every ranked surface (RankedLobby's
 * profile card, ClasseLobby's rank card). Pulled out so the bar markup lives in
 * ONE place instead of being copy-pasted per lobby. Pair it with
 * `rankProgress(lp)` from engine/rank.ts for the fill fraction.
 */

import { motion } from "motion/react";

export function LpBar({
  progress,
  animated = true,
  className = "",
}: {
  /** Fill fraction 0–1 (e.g. rankProgress(lp).progress). */
  progress: number;
  /** Spring the fill in on mount (lobby entrances). Off = static width. */
  animated?: boolean;
  /** Extra classes on the track (height/width overrides). */
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(1, progress));
  const pct = `${(clamped * 100).toFixed(1)}%`;
  // Subtle rectangular top sheen only — NO rounded fill and NO leading-edge
  // glow (both read as a "ball/nub" at low progress, the thing Alex flagged).
  // The track clips the ends, so the fill stays a clean modern bar.
  const fillInner = (
    <span
      aria-hidden
      className="absolute inset-x-0 top-0 h-1/2"
      style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.28), transparent)" }}
    />
  );
  return (
    <div className={"relative h-2.5 rounded-full bg-black/35 ring-1 ring-white/10 overflow-hidden shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)] " + className}>
      {animated ? (
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: pct }}
          transition={{ duration: 0.8, type: "spring", stiffness: 120, damping: 20 }}
          className="relative h-full bg-themed"
        >
          {fillInner}
        </motion.div>
      ) : (
        <div className="relative h-full bg-themed" style={{ width: pct }}>
          {fillInner}
        </div>
      )}
    </div>
  );
}
