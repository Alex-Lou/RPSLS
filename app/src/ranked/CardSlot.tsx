/**
 * CardSlot — mini badge on a lane showing which card was played.
 *
 * When `flipReveal` is set, the badge first appears facing the camera with
 * its back (deck rear) visible, then rolls a quick horizontal flip to
 * unveil the face. This is the opponent-side dramatic reveal — the player
 * SEES the card arrive before the effect is interpreted, instead of a tiny
 * sticker just popping into existence.
 */

import { motion } from "motion/react";
import { CardImage } from "./CardImage";
import type { CardId } from "./rankedTypes";

export function CardSlot({
  id, position = "tl", pulse = false, flipReveal = false,
}: {
  id: CardId | null;
  position?: "tl" | "tr" | "bl" | "br";
  pulse?: boolean;
  /** Run the dramatic reveal: card slides in face-down, then flips. */
  flipReveal?: boolean;
}) {
  if (!id) return null;
  const pos =
    position === "tl" ? "-top-2 -left-2" :
    position === "tr" ? "-top-2 -right-2" :
    position === "bl" ? "-bottom-2 -left-2" :
                        "-bottom-2 -right-2";

  if (flipReveal) {
    return (
      <motion.div
        // Slide in from above (suggesting it was drawn from the deck) with
        // the back visible, then flip horizontally to show the face. A small
        // overshoot + spring lands the card with weight.
        initial={{ y: -16, opacity: 0, rotateY: 180, scale: 0.85 }}
        animate={{ y: 0, opacity: 1, rotateY: 0, scale: 1 }}
        transition={{
          y:       { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
          opacity: { duration: 0.18 },
          rotateY: { delay: 0.22, duration: 0.42, ease: [0.65, 0, 0.35, 1] },
          scale:   { type: "spring", stiffness: 240, damping: 18, delay: 0.55 },
        }}
        style={{ transformStyle: "preserve-3d", perspective: 600 }}
        className={"absolute " + pos + " z-20 w-7 h-9 sm:w-8 sm:h-10 rounded-md overflow-hidden ring-2 ring-white/40 shadow-lg"}
      >
        <CardImage id={id} glyphSize="text-sm" />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ scale: 0, rotate: -15 }}
      animate={pulse ? { scale: [1, 1.15, 1], rotate: 0 } : { scale: 1, rotate: 0 }}
      transition={pulse ? { duration: 1.4, repeat: Infinity } : { type: "spring", stiffness: 280, damping: 14 }}
      className={"absolute " + pos + " z-20 w-7 h-9 sm:w-8 sm:h-10 rounded-md overflow-hidden ring-2 ring-white/40 shadow-lg"}
    >
      <CardImage id={id} glyphSize="text-sm" />
    </motion.div>
  );
}
