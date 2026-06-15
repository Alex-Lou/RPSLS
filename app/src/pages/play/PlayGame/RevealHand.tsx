import { motion } from "motion/react";
import { Move } from "../../../engine/game";
import { Hand } from "../../../icons";
import { useT } from "../../../i18n";

export function RevealHand({
  label, move, winner, loser, side, streak,
}: {
  label: string; move: Move;
  winner: boolean; loser: boolean;
  side: "left" | "right"; streak: number;
}) {
  const t = useT();
  // Winner: subtle nod toward the middle (never outward). Loser: stays put.
  const swing = winner ? (side === "left" ? 4 : -4) : 0;
  const rotateKick = winner ? (side === "left" ? 3 : -3) : 0;

  return (
    <div className="flex flex-col items-center gap-2 sm:gap-3 min-w-0">
      <span className="text-xs sm:text-sm uppercase tracking-wider text-ink-muted font-semibold truncate max-w-full">{label}</span>
      <motion.div
        initial={{ scale: 0.4, rotate: -15, opacity: 0, x: 0 }}
        animate={{
          // Capped peak so the winning card never bleeds past the frame.
          scale: winner ? [0.4, 1.06, 1.02] : loser ? [0.4, 1, 0.97] : 1,
          rotate: [(side === "left" ? -15 : 15), 0, rotateKick, 0],
          x: [0, 0, swing, swing * 0.4],
          opacity: 1,
        }}
        transition={{ duration: 0.5, times: [0, 0.45, 0.62, 1], ease: "easeOut" }}
        className={
          "relative " +
          (winner && streak >= 3
            ? "after:absolute after:inset-0 after:rounded-3xl after:ring-4 after:ring-orange-400/50 after:animate-pulse"
            : "")
        }
      >
        {/* Down-sized from "xl" → "lg": two xl cards + VS overflowed the
            viewport on phones (the winner card bled off-screen). "lg"
            matches the contained feel of the Constellation reveal. */}
        <Hand move={move} size="lg" emphasis={winner ? "winner" : loser ? "loser" : "default"} />
      </motion.div>
      <span className="text-sm sm:text-lg text-ink font-medium truncate max-w-full">{t("element." + move)}</span>
    </div>
  );
}
