import { forwardRef, useImperativeHandle, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import type { MatchBackHandle } from "./androidBack";

/**
 * Floating back/quit button that docks at the top-left of the screen, right
 * next to the mobile hamburger (or just inside the desktop sidebar gutter).
 * Pulled out of MatchScoreBar so the score header can stretch full-width on
 * its own line.
 */
export const FloatingMatchBackButton = forwardRef<
  MatchBackHandle,
  {
    onClick: () => void;
    label: string;
    /** When set, clicking the button (or the parent calling triggerConfirm
     *  via the imperative handle) opens a confirmation modal first. */
    confirm?: {
      title: string;
      body: string;
      confirmLabel?: string;
      cancelLabel?: string;
      /** "danger" colors the confirm CTA red to flag a punitive action. */
      severity?: "default" | "danger";
    };
    /** Hidden mode (Alex 2026-06-11) : ne render PAS le bouton visible mais
     *  garde l'imperative handle (triggerConfirm) + le modal de confirm.
     *  Utilisé quand l'exit est exposé via le drawer burger (matchExitStore)
     *  pour éviter d'avoir 2 boutons HUD en haut de l'écran. */
    hidden?: boolean;
  }
>(function FloatingMatchBackButtonImpl({ onClick, label, confirm, hidden = false }, ref) {
  const [open, setOpen] = useState(false);
  const handleClick = () => {
    if (confirm) setOpen(true);
    else onClick();
  };
  useImperativeHandle(ref, () => ({
    triggerConfirm: () => {
      if (confirm) setOpen(true);
      else onClick();
    },
  }), [confirm, onClick]);
  // Render in a portal anchored to document.body so the button (position:
  // fixed) escapes any ancestor `transform` — Motion animates parents with
  // `transform: translate(...)`, which silently re-roots `position: fixed`
  // to that transformed ancestor instead of the viewport. The visible bug
  // was the back arrow drifting from mid-screen into its corner on every
  // view enter.
  return createPortal(
    <>
      {!hidden && (
        <button
          onClick={handleClick}
          aria-label={label}
          title={label}
          className="
            fixed z-30 w-11 h-11 rounded-2xl bg-black/55 backdrop-blur border border-hairline
            flex items-center justify-center text-ink active:scale-95 transition shadow-lg
            hover:bg-black/70
            top-[max(env(safe-area-inset-top),32px)]
            left-[calc(max(env(safe-area-inset-left),12px)+44px+8px)]
            md:top-3
            md:left-3
          "
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}
      <AnimatePresence>
        {open && confirm && (
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
              className="w-full max-w-sm bg-surface-raised border border-hairline rounded-3xl p-5 sm:p-6 shadow-2xl"
            >
              <h3 className="text-base sm:text-lg font-bold text-white mb-1.5">{confirm.title}</h3>
              <p className="text-sm text-ink-muted leading-relaxed mb-5">{confirm.body}</p>
              <div className="flex gap-2.5">
                <button
                  onClick={() => setOpen(false)}
                  className="flex-1 py-2.5 rounded-2xl bg-hairline hover:bg-hairline border border-hairline font-semibold text-sm text-ink transition active:scale-[0.97]"
                >
                  {confirm.cancelLabel ?? "Annuler"}
                </button>
                <button
                  onClick={() => { setOpen(false); onClick(); }}
                  className={
                    "flex-1 py-2.5 rounded-2xl font-bold text-sm text-white shadow-lg transition active:scale-[0.97] " +
                    (confirm.severity === "danger"
                      ? "bg-gradient-to-r from-rose-500 to-red-600 shadow-rose-500/30"
                      : "bg-themed shadow-themed")
                  }
                >
                  {confirm.confirmLabel ?? "Quitter"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body,
  );
});
