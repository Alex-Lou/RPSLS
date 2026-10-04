/**
 * TutorialOfferModal — proposée à la PREMIÈRE visite du lobby Arena Pro.
 * « Plus tard » ne la fait plus réapparaître (le tuto reste dans le lobby).
 */
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { useT } from "../../i18n";
import { TUTORIAL_XP } from "./tutorialScript";

export function TutorialOfferModal({ onStart, onLater }: { onStart: () => void; onLater: () => void }) {
  const t = useT();
  return createPortal(
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4"
      style={{ paddingBottom: "calc(var(--sai-bottom) + 16px)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ y: 40, scale: 0.96, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="w-full max-w-sm rounded-3xl bg-zinc-950 border border-amber-300/35 shadow-2xl p-5 text-center"
      >
        <motion.div
          className="text-5xl mb-2"
          animate={{ rotate: [0, -8, 8, -4, 0] }}
          transition={{ duration: 1.2, delay: 0.3 }}
          aria-hidden
        >
          🎓
        </motion.div>
        <h2 className="text-lg font-black text-white" style={{ fontFamily: "var(--font-headline)" }}>
          {t("tut.offer.title")}
        </h2>
        <p className="text-[13px] text-zinc-300 mt-1.5 leading-snug">{t("tut.offer.body")}</p>
        <div className="mt-3 inline-flex items-center gap-2 text-[11px] font-black">
          <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-300">⏱ {t("tut.offer.duration")}</span>
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-300/40 text-emerald-200 tabular-nums">+{TUTORIAL_XP} XP</span>
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={onStart}
            className="w-full py-3 rounded-2xl font-black text-white bg-themed-br shadow-xl"
          >
            {t("tut.offer.start")}
          </motion.button>
          <button
            type="button"
            onClick={onLater}
            className="w-full py-2.5 rounded-2xl text-sm font-bold text-zinc-400"
          >
            {t("tut.offer.later")}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
