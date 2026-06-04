/**
 * InfoBubble — a tiny "?" trigger that opens a centred modal explaining
 * one concept. Drop next to any jargon term (MANA, LP, rarity badges,
 * Heist, etc.) so the user can get the rule on demand without crowding
 * the chrome with permanent tooltips.
 *
 * Click trigger ⇒ modal with title + body + dismiss button. Backdrop
 * tap also dismisses. Uses the same modal aesthetic as the forfeit
 * confirm so the surface feels consistent.
 *
 * Body accepts a ReactNode so callers can pass formatted content
 * (lists, multiple paragraphs, even inline emoji).
 */

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";

export function InfoBubble({
  title,
  body,
  size = "md",
  variant = "round",
  className = "",
}: {
  title: string;
  body: ReactNode;
  /** Trigger size. "sm" = inline, "md" = beside labels, "lg" = card header. */
  size?: "sm" | "md" | "lg";
  /** "round" = circular ? badge, "minimal" = thin border, no fill. */
  variant?: "round" | "minimal";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const sizeClass =
    size === "sm" ? "w-4 h-4 text-[10px]" :
    size === "lg" ? "w-7 h-7 text-sm" :
                    "w-5 h-5 text-[11px]";
  const skin =
    variant === "minimal"
      ? "border border-white/30 text-zinc-300 hover:border-white/60 hover:text-white"
      : "bg-white/10 text-zinc-200 hover:bg-white/20 ring-1 ring-white/15";

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        aria-label={title}
        title={title}
        className={
          "shrink-0 inline-flex items-center justify-center rounded-full font-bold transition active:scale-90 " +
          sizeClass + " " + skin + " " + className
        }
      >
        ?
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 22 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-zinc-950/95 border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="text-base sm:text-lg font-bold text-white">{title}</h3>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="shrink-0 w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition"
                >
                  ✕
                </button>
              </div>
              <div className="text-sm text-zinc-300 leading-relaxed">{body}</div>
              <button
                onClick={() => setOpen(false)}
                className="mt-5 w-full py-2.5 rounded-2xl bg-themed font-bold text-sm text-white shadow-lg shadow-violet-500/30 transition active:scale-[0.97]"
              >
                OK
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
