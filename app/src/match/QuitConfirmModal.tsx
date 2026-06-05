import { motion } from "motion/react";
import { useStore } from "../store";
import { activeAbandonCount, abandonPenaltyLp } from "./forfeit";

/**
 * QuitConfirmModal — one reusable, themed "leave the match?" dialog.
 *
 * Replaces the per-view inline modals so every surface (lanes, ranked,
 * classic) confirms an abandon the same way. For competitive modes it also
 * previews the escalating recidive LP penalty, so a repeat rage-quitter
 * sees the cost before tapping. The CTA gradient follows the active theme.
 */
export function QuitConfirmModal({
  competitive = false,
  onConfirm,
  onCancel,
}: {
  /** Ranked / online — enables the extra recidive penalty warning. */
  competitive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const abandons = useStore((s) => s.player.abandons);
  // Preview the penalty the NEXT forfeit would add (pure read, no mutation).
  const prior = activeAbandonCount(abandons, Date.now());
  const extra = competitive ? abandonPenaltyLp(prior) : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, y: 12, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 22 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-surface-raised border border-hairline p-6 shadow-2xl"
      >
        <div className="text-4xl mb-2 text-center" aria-hidden>🏳️</div>
        <h3 className="text-lg sm:text-xl font-bold text-white text-center mb-1.5">
          Quitter le match ?
        </h3>
        <p className="text-sm text-ink-muted leading-relaxed text-center mb-2">
          Tu vas perdre la manche en cours. Ce sera compté comme une défaite.
        </p>

        {/* Recidive penalty warning — only competitive + only when it bites. */}
        {extra < 0 && (
          <p className="text-[13px] font-semibold text-rose-300 text-center mb-4">
            ⚠️ Abandons répétés : <span className="font-black">{extra} LP</span> supplémentaires.
          </p>
        )}
        {extra === 0 && <div className="mb-4" />}

        <div className="flex gap-2.5">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm text-ink bg-hairline hover:bg-hairline border border-hairline transition"
          >
            Continuer
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white bg-rose-600/80 hover:bg-rose-600 border border-rose-400/40 transition"
          >
            Forfait
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
