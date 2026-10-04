import { AnimatePresence, motion } from "motion/react";

export type DeckMsg = { text: string; tone: "good" | "warn" | "info"; key: number };

/** Toast (Alex 2026-06-13) — message d'ajout/retrait/refus, TOUJOURS
 *  visible (fixed, sous l'en-tête) : plus besoin de remonter le deck.
 *  Extrait VERBATIM du DeckManager. */
export function DeckToast({ deckMsg }: { deckMsg: DeckMsg | null }) {
  return (
    <AnimatePresence>
      {deckMsg && (
        <motion.div
          key={deckMsg.key}
          initial={{ opacity: 0, y: -14, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ type: "spring", stiffness: 320, damping: 24 }}
          className={
            "fixed left-1/2 -translate-x-1/2 z-[9998] px-4 py-2 rounded-2xl text-[12.5px] font-bold shadow-2xl backdrop-blur border whitespace-nowrap max-w-[90vw] truncate " +
            (deckMsg.tone === "good"
              ? "bg-emerald-500/25 border-emerald-400/60 text-emerald-100"
              : deckMsg.tone === "warn"
              ? "bg-amber-500/25 border-amber-400/60 text-amber-100"
              : "bg-zinc-700/60 border-zinc-500/60 text-zinc-100")
          }
          style={{ top: "calc(var(--sai-top) + 3.5rem)" }}
        >
          {deckMsg.tone === "good" ? "✓ " : deckMsg.tone === "warn" ? "⚠ " : "↺ "}
          {deckMsg.text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
