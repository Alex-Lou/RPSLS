/**
 * CardSlot — mini badge on a lane showing which card was played.
 */

import { motion } from "motion/react";
import { CardImage } from "./CardImage";
import type { CardId } from "./rankedTypes";

export function CardSlot({
  id, position = "tl", pulse = false,
}: {
  id: CardId | null;
  position?: "tl" | "tr" | "bl" | "br";
  pulse?: boolean;
}) {
  if (!id) return null;
  const pos =
    position === "tl" ? "-top-2 -left-2" :
    position === "tr" ? "-top-2 -right-2" :
    position === "bl" ? "-bottom-2 -left-2" :
                        "-bottom-2 -right-2";
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
