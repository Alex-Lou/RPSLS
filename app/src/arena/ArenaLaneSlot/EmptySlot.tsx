/**
 * EmptySlot — render branch for an EMPTY lane cell. Hosts the death-ghost
 * overlay (kept ~650ms after a death) + the "bouclier percé" chip, and becomes
 * a pulsing drop-target button when clickable. Présentationnel pur.
 */

import { AnimatePresence, motion } from "motion/react";

export function EmptySlot({
  pierced, clickable, clickableLabel, onClick,
}: {
  pierced: { key: number } | null;
  clickable: boolean;
  clickableLabel: string;
  onClick?: () => void;
}) {
  // Empty slot — but wrapped as a BUTTON when clickable, with pulsing amber
  // ring so the targeting flow shows valid drops directly on the board.
  // Also hosts the death-ghost overlay (kept for ~650ms after a death).
  const baseEmpty = (
    <div className="aspect-[5/4] w-full rounded-xl border-2 border-dashed border-hairline bg-black/35 flex items-center justify-center relative overflow-hidden">
      <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-600 font-bold">vide</span>
      {/* Aegis pierced chip — the shielded creature here was just pierced
       *  (Tranchant / LAME). Red "bouclier percé" so the pierce is visible. */}
      <AnimatePresence>
        {pierced && (
          <motion.div
            key={pierced.key}
            initial={{ opacity: 0, scale: 0.5, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: -22 }}
            exit={{ opacity: 0, y: -34 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
          >
            <span className="px-1.5 py-0.5 rounded bg-rose-400/95 text-black text-[9px] uppercase tracking-wider font-black shadow-lg whitespace-nowrap">
              🩸 Bouclier percé
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
  if (clickable) {
    return (
      <button
        onClick={onClick}
        className="w-full focus:outline-none"
        aria-label={clickableLabel}
      >
        <motion.div
          animate={{ scale: [1, 1.04, 1], boxShadow: [
            "0 0 0 0 rgba(252,211,77,0)",
            "0 0 14px 2px rgba(252,211,77,0.55)",
            "0 0 0 0 rgba(252,211,77,0)",
          ] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          className="aspect-[5/4] w-full rounded-xl border-2 border-amber-300/80 bg-amber-500/20 flex items-center justify-center relative overflow-hidden"
        >
          <span className="text-[10px] uppercase tracking-[0.2em] text-amber-100 font-black text-center px-1">
            {clickableLabel}
          </span>
        </motion.div>
      </button>
    );
  }
  return baseEmpty;
}
