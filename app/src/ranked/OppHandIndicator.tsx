/**
 * OppHandIndicator — the opponent's face-down hand, fanned and mirrored to
 * match CardHand's geometry. Cards animate out (drift + fade) when the size
 * shrinks, e.g. after a successful player Heist.
 *
 * Purely visual: the real CPU "hand" is the BASE_CPU_HAND_POOL constant in
 * RankedGame; this widget just animates a counter so the player can see the
 * impact of Heist on the table.
 */

import { motion, AnimatePresence } from "motion/react";
import { fanGeometry } from "./handFan";

export function OppHandIndicator({
  size,
  maxSize = 4,
}: {
  /** Current hand size (0–maxSize). */
  size: number;
  /** Total slots ever shown — defines the fan geometry so the centre stays
   *  stable even as cards drop out. Defaults to 4 to leave room for Heist. */
  maxSize?: number;
}) {
  const slots = Math.max(0, Math.min(maxSize, size));
  const geo = fanGeometry(Math.max(1, slots));
  const mid = (slots - 1) / 2;

  return (
    <div
      className="flex items-start justify-center relative"
      // Opponent fan sits at the TOP of the board so cards are anchored to
      // the top of the container and droop downward. paddingBottom must hold
      // the droop entirely or it spills onto the OpponentRow underneath.
      style={{
        paddingTop: 2,
        paddingBottom: geo.lift + 6,
        minHeight: 30 + geo.lift,
      }}
    >
      <AnimatePresence>
        {Array.from({ length: slots }, (_, i) => {
          const offset = i - mid;
          // Mirror the player's fan — opponent's cards "hang" from the top,
          // outer cards droop downward and rotate outward.
          const angle = -offset * geo.spread;
          const yLift = Math.abs(offset) * geo.lift;
          return (
            <motion.div
              key={i}
              layout
              initial={{ opacity: 0, scale: 0.6, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: yLift }}
              exit={{ opacity: 0, scale: 0.7, y: -20, rotate: angle - 18 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              style={{
                marginLeft: i === 0 ? 0 : -geo.overlap,
                transformOrigin: "top center",
                rotate: angle,
              }}
              className={
                "w-[18px] h-[24px] sm:w-[22px] sm:h-[30px] rounded-md " +
                "bg-gradient-to-br from-rose-900/80 via-zinc-900 to-fuchsia-950/80 " +
                "ring-1 ring-rose-400/30 shadow-md shadow-rose-500/20 " +
                "flex items-center justify-center"
              }
            >
              <span className="text-[8px] sm:text-[9px] text-rose-300/60 font-black select-none">
                ✦
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
