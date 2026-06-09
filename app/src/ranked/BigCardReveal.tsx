/**
 * BigCardReveal — center-stage card flip overlay during the reveal phase.
 *
 * Extracted from LanesBoard.tsx so both Constellation Ranked AND
 * Constellation Pro (Arena) can reuse the EXACT same animation when a
 * card is played by either side. Pattern: rose-tinted top-right for opp,
 * emerald bottom-left for player.
 */

import { motion } from "motion/react";
import { CardImage } from "./CardImage";
import type { CardId } from "./rankedTypes";

export function BigCardReveal({ id, side }: { id: CardId; side: "opp" | "you" }) {
  const isOpp = side === "opp";
  // Mirror of the previous version per Alex's reread: opponent lands in the
  // TOP-RIGHT (sliding in from the right edge), yours in the BOTTOM-LEFT
  // (sliding in from the left). Matches the natural "their move comes at me
  // from above, mine comes out from where my thumb lives" reading.
  const startX = isOpp ? 160 : -160;
  const startY = isOpp ? -40 : 40;
  const restingTilt = isOpp ? 8 : -8;
  return (
    <motion.div
      initial={{ opacity: 0, x: startX, y: startY, rotateY: 180, rotateZ: restingTilt * 1.4, scale: 0.78 }}
      animate={{
        opacity: [0, 1, 1, 1, 0],
        x: [startX, 0, 0, 0, isOpp ? 8 : -8],
        y: [startY, 0, 0, 0, isOpp ? -6 : 6],
        rotateY: [180, 180, 0, 0, 0],
        rotateZ: [restingTilt * 1.4, restingTilt, restingTilt, restingTilt, restingTilt * 0.6],
        scale: [0.78, 1, 1.05, 1, 0.72],
      }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.6, times: [0, 0.22, 0.45, 0.72, 1], ease: "easeOut" }}
      style={{ transformStyle: "preserve-3d", perspective: 900, willChange: "transform" }}
      className={
        "absolute z-30 pointer-events-none " +
        (isOpp
          ? "top-2 right-2 sm:top-3 sm:right-3 w-20 h-28 sm:w-24 sm:h-32"
          : "bottom-2 left-2 sm:bottom-3 sm:left-3 w-16 h-22 sm:w-20 sm:h-28")
      }
    >
      {/* Rarity-coloured aura that pulses behind the card. */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: [0, 0.85, 0.5, 0], scale: [0.6, 1.5, 1.7, 1.9] }}
        transition={{ duration: 1.6, times: [0, 0.45, 0.75, 1], ease: "easeOut" }}
        className={
          "absolute inset-0 rounded-3xl blur-2xl " +
          (isOpp ? "bg-rose-400/55" : "bg-emerald-400/45")
        }
      />
      <div
        className={
          "relative w-full h-full rounded-xl overflow-hidden border-2 shadow-2xl " +
          (isOpp ? "border-rose-300/80 shadow-rose-900/50" : "border-emerald-300/80 shadow-emerald-900/50")
        }
      >
        <CardImage id={id} glyphSize="text-3xl" />
        <div className="absolute bottom-0 left-0 right-0 bg-black/65 py-0.5">
          <div className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-center text-white">
            {isOpp ? "Adv" : "Toi"}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
