import { motion } from "motion/react";
import { useT } from "../../../i18n";

export function PassPanel({
  labelB, onContinue,
}: { labelB: string; onContinue: () => void }) {
  const t = useT();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25 }}
      className="bg-surface backdrop-blur-sm rounded-2xl sm:rounded-3xl shadow-xl ring-1 ring-white/10 p-5 sm:p-10 border border-hairline flex flex-col items-center gap-6 text-center"
    >
      <motion.span
        animate={{ rotate: [0, -10, 10, -10, 0] }}
        transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1 }}
        className="text-5xl"
      >
        📱
      </motion.span>
      <h2 className="text-xl font-semibold">{t("match.pass.title", { name: labelB })}</h2>
      <p className="text-ink-muted text-sm max-w-sm">{t("match.pass.subtitle")}</p>
      <motion.button
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.97 }}
        onClick={onContinue}
        className="px-6 py-3 rounded-2xl font-semibold bg-themed shadow-lg shadow-black/30"
      >
        {t("match.pass.continue", { name: labelB })}
      </motion.button>
    </motion.div>
  );
}
