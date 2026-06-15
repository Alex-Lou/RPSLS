import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { CardDetailContent } from "./CardDetailContent";
import type { CardId } from "../rankedTypes";

/* ────────────── Card detail modal ────────────── */

/** Card detail modal — fullscreen portal overlay opened when a collection
 *  card is tapped. Replaces the old in-flow panel that forced the player
 *  to scroll back to the top to read details. Click backdrop or X to close.
 *  Inside, CardDetailContent is reused as-is. */
export function CardDetailModal({
  id, masteryXp, owned, inDeck, deckFull, onClose, onPickForDeck, t,
}: {
  id: CardId | null;
  masteryXp: number;
  owned: boolean;
  inDeck: boolean;
  /** Deck plein (0 slot libre) — change le CTA en "Remplacer une carte". */
  deckFull: boolean;
  /** Called by the backdrop / ✕ button : closes the modal AND clears
   *  the selection. The card is "forgotten". */
  onClose: () => void;
  /** Called by the "Mettre dans mon deck" button : closes the modal
   *  but KEEPS the selection so the next slot tap assigns it. Only
   *  available if the card is OWNED. */
  onPickForDeck: () => void;
  t: (key: string) => string;
}) {
  return createPortal(
    <AnimatePresence>
      {id && (
        <motion.div
          key="card-detail-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.92, y: 14, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md"
          >
            <CardDetailContent
              key={id}
              id={id}
              masteryXp={masteryXp}
              owned={owned}
              inDeck={inDeck}
              t={t}
            />
            {/* "Mettre dans mon deck" CTA — only meaningful for owned cards.
             *  Closes the modal but keeps the card selected so the next
             *  slot-tap assigns it (Alex flag : modal cassait l'assign). */}
            {owned && (
              <button
                onClick={onPickForDeck}
                className="mt-2 w-full py-2.5 rounded-2xl bg-themed shadow-lg font-black text-white text-sm transition active:scale-[0.97]"
                style={{ fontFamily: "var(--font-headline)", letterSpacing: "0.08em" }}
              >
                {inDeck ? "✕ Retirer du deck" : deckFull ? "🔁 Remplacer une carte…" : "✓ Mettre dans mon deck"}
              </button>
            )}
            <button
              onClick={onClose}
              className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-zinc-900 border-2 border-hairline text-white text-lg font-bold flex items-center justify-center shadow-2xl hover:bg-zinc-800 transition"
              aria-label="Fermer"
            >
              ✕
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
