/**
 * Calques de la poignée de main « revanche » (cf. useRematch) — rendus une
 * fois par OnlinePage, ils couvrent Classique et Constellation en ligne.
 */
import { AnimatePresence, motion } from "motion/react";
import { useT } from "../../i18n";
import type { RematchHandshake } from "./useRematch";

export function RematchOverlays({ rematch }: { rematch: RematchHandshake }) {
  const t = useT();
  const { offered, waiting, toast } = rematch;
  return (
    <AnimatePresence>
      {offered && (
        <motion.div
          key="rematch-offer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-5 bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            role="dialog"
            aria-modal
            initial={{ scale: 0.9, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 6 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="w-full max-w-sm rounded-3xl bg-zinc-950 border border-white/15 p-6 shadow-2xl text-center flex flex-col gap-4"
          >
            <div className="text-4xl">🔁</div>
            <div className="text-lg font-black text-white">{t("online.rematch.offer")}</div>
            <div className="text-xs text-zinc-400 -mt-2">{t("online.rematch.offerHint")}</div>
            <div className="flex gap-2">
              <button
                onClick={rematch.accept}
                className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 font-bold text-white shadow-lg shadow-emerald-500/30 active:scale-[0.98] transition"
              >
                {t("online.rematch.accept")}
              </button>
              <button
                onClick={rematch.decline}
                className="flex-1 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 font-semibold text-zinc-200 active:scale-[0.98] transition"
              >
                {t("online.rematch.decline")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {waiting !== null && !offered && (
        <motion.div
          key="rematch-wait"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-5 bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            role="status"
            initial={{ scale: 0.9, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95 }}
            className="w-full max-w-sm rounded-3xl bg-zinc-950 border border-white/15 p-6 shadow-2xl text-center flex flex-col gap-4"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
              className="text-4xl mx-auto"
            >
              🔁
            </motion.div>
            <div className="flex flex-col gap-1">
              <div className="text-xs uppercase tracking-wider font-bold text-emerald-300">
                {t(waiting === "sent" ? "online.rematch.sent" : "online.rematch.accepted")}
              </div>
              <div className="text-base font-bold text-white">
                {t(waiting === "sent" ? "online.rematch.waiting" : "online.rematch.starting")}
              </div>
            </div>
            <button
              onClick={rematch.cancelWait}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 font-semibold text-zinc-300 text-sm transition"
            >
              {t("online.rematch.cancel")}
            </button>
          </motion.div>
        </motion.div>
      )}

      {toast && (
        <motion.div
          key="rematch-toast"
          role="status"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[60] px-4 py-2.5 rounded-xl bg-rose-500/90 text-white text-sm font-semibold shadow-lg"
        >
          {t(toast)}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
