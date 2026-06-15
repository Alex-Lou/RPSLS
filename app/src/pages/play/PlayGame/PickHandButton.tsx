import { useState } from "react";
import { motion } from "motion/react";
import { Move } from "../../../engine/game";
import { MoveGlyph, MOVE_PALETTE, moveRim, moveGlow } from "../../../icons";
import { PickShock, hapticTick } from "../../../match/sharedMatchUI";

export function PickHandButton({
  move, label, index, disabled, onPick,
}: {
  move: Move;
  label: string;
  index: number;
  disabled: boolean;
  onPick: (m: Move) => void;
}) {
  const [shock, setShock] = useState(false);
  const pal = MOVE_PALETTE[move];

  function handleClick() {
    if (disabled) return;
    hapticTick();
    setShock(true);
    // Auto-clear so the same button can be re-armed if the parent doesn't
    // unmount (rare here, but keeps the component resilient).
    setTimeout(() => setShock(false), 500);
    onPick(move);
  }

  return (
    <motion.button
      onClick={handleClick}
      disabled={disabled}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 * index, duration: 0.25 }}
      whileHover={{ y: -4, scale: 1.04 }}
      whileTap={{ scale: 0.86 }}
      aria-label={label}
      className="relative aspect-[4/5] rounded-xl flex flex-col items-center justify-center gap-0.5 py-1 text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
      // Dark glass + theme-blended rim — identical treatment to the Lanes /
      // Ranked pickers so every mode's move buttons look consistent and adapt
      // to the active background accent.
      style={{
        background: "linear-gradient(160deg, rgba(20,22,32,0.92) 0%, rgba(10,12,20,0.92) 100%)",
        border: `2px solid ${moveRim(pal.hex)}`,
        boxShadow: `0 0 12px -2px ${moveGlow(pal.hex)}, inset 0 1px 0 rgba(255,255,255,0.08)`,
      }}
    >
      <PickShock show={shock} />
      <MoveGlyph move={move} className="w-9 h-9 sm:w-11 sm:h-11" />
      <span
        className="text-[10px] sm:text-[11px] uppercase tracking-wider font-bold leading-none"
        style={{ color: moveRim(pal.hex) }}
      >
        {label}
      </span>
    </motion.button>
  );
}
