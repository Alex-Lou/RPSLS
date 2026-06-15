import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { useStore } from "../../store/store";
import { BattlePad } from "../../BattlePad";
import { PAD_META } from "../../types";
import type { PadId } from "../../types";
import { hapticMatchStart } from "../../haptic";

/** Pad preview modal (portal to body so it escapes scroll/stacking). The
 *  preview is a CARD popup, not a fullscreen swap: the user sees the pad at
 *  its actual game proportions (3:2) in a contained frame. */
export function PadPreviewModal({ previewPad, onClose }: { previewPad: PadId | null; onClose: () => void }) {
  const player = useStore((s) => s.player);
  const updateProfile = useStore((s) => s.updateProfile);
  return createPortal(
    <AnimatePresence>
      {previewPad && (
        <motion.div
          key="pad-preview"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          // Dimmed backdrop blur — NOT full-black takeover, the preview
          // is a CARD popup, not a fullscreen swap. The user sees the
          // pad at its actual game proportions in a contained frame.
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/75 backdrop-blur-md px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.94, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            // Card with the pad rendered at REAL game proportions (3:2
            // landscape) — bounded by max-w-md so it never explodes to
            // fullscreen. The framed border + corner ticks signal "this
            // is what your table will look like in a match".
            className="w-full max-w-md rounded-3xl overflow-hidden border border-white/15 bg-zinc-950/85 shadow-2xl"
          >
            {/* The pad at its true 3:2 aspect ratio, framed. */}
            <div className="relative w-full aspect-[3/2] bg-black overflow-hidden">
              <BattlePad padId={previewPad} className="absolute inset-0 w-full h-full" />
              {/* Subtle corner brackets to telegraph "game table". */}
              <div className="pointer-events-none absolute inset-3 border border-white/15 rounded-2xl" />
              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-white/85 text-[10px] font-bold uppercase tracking-wider">
                Aperçu tapis
              </span>
            </div>
            {/* Label + tagline. */}
            <div className="p-4 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-white">{PAD_META[previewPad]?.label}</span>
                {PAD_META[previewPad]?.premiumSetId && (
                  <span className="text-[9px] uppercase tracking-wider font-black text-amber-300">✦ Premium</span>
                )}
              </div>
              <span className="text-xs text-ink-muted">{PAD_META[previewPad]?.tagline}</span>
            </div>
            {/* Action buttons. */}
            <div className="px-4 pb-4 flex flex-col gap-2">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  hapticMatchStart();
                  updateProfile({ padId: previewPad, padChosen: true });
                  onClose();
                }}
                className={
                  "py-2.5 rounded-xl font-black text-sm uppercase tracking-wider shadow-lg transition " +
                  (player.padId === previewPad
                    ? "bg-emerald-500/85 text-white"
                    : "bg-themed text-white")
                }
              >
                {player.padId === previewPad ? "✓ Tapis actif" : "Choisir ce tapis"}
              </motion.button>
              <button
                onClick={onClose}
                className="py-2 rounded-xl font-bold text-xs uppercase tracking-wider bg-white/10 text-ink hover:bg-white/15 transition"
              >
                Fermer
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
