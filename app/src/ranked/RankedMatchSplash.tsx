import { motion } from "motion/react";
import { useT } from "../i18n";
import { LoadingTip } from "../flavor/LoadingTip";

/* Écrans transitoires du match Classé (splash « adversaire trouvé » +
 * décompte de reveal), extraits VERBATIM de RankedMatchView. */

export function MatchFoundSplash({ you, opp }: { you: string; opp: string }) {
  const t = useT();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md"
    >
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-xs tracking-[0.5em] text-fuchsia-300/80 uppercase mb-3 text-center px-4"
      >
        {t("ranked.match.foundKicker")}
      </motion.div>
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.15, type: "spring", stiffness: 220, damping: 12 }}
        className="flex items-center justify-center gap-4 sm:gap-8 w-full max-w-md px-4"
      >
        <NameTag name={you} accent="emerald" align="right" />
        <motion.div
          animate={{ rotate: [0, -8, 8, -4, 4, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 0.9, delay: 0.4 }}
          className="shrink-0 text-5xl sm:text-7xl font-black bg-gradient-to-br from-fuchsia-300 to-rose-400 bg-clip-text text-transparent"
        >
          VS
        </motion.div>
        <NameTag name={opp} accent="rose" align="left" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="mt-8 text-sm uppercase tracking-[0.3em] text-ink-muted text-center px-4"
      >
        {t("ranked.match.introSub")}
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.4 }}
        className="mt-6 max-w-sm px-4"
      >
        <LoadingTip category="strategy" rotateMs={0} className="justify-center text-center" />
      </motion.div>
    </motion.div>
  );
}

function NameTag({
  name, accent, align,
}: { name: string; accent: "emerald" | "rose"; align: "left" | "right" }) {
  const t = useT();
  const grad = accent === "emerald"
    ? "from-emerald-300 to-teal-400"
    : "from-rose-300 to-fuchsia-400";
  return (
    <div className={"flex-1 min-w-0 flex flex-col " + (align === "right" ? "items-end" : "items-start")}>
      <div className="text-[10px] uppercase tracking-[0.3em] text-ink-faint">
        {accent === "emerald" ? t("lanes.you") : t("lanes.opponent")}
      </div>
      <div className={
        "mt-1 text-xl sm:text-3xl font-black truncate w-full bg-gradient-to-r " +
        (align === "right" ? "text-right " : "text-left ") +
        grad + " bg-clip-text text-transparent"
      }>
        {name || t("ranked.anonymous")}
      </div>
    </div>
  );
}

export function RevealCountdown() {
  const t = useT();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center gap-3 px-4 text-center"
    >
      <div className="text-[10px] uppercase tracking-[0.4em] text-ink-faint">{t("lanes.reveal")}</div>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xl sm:text-3xl font-black leading-tight">
        {[t("online.reveal.rock"), t("online.reveal.paper"), t("online.reveal.scissors"), t("online.reveal.lizard"), t("online.reveal.spock")].map((w, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 + i * 0.13 }}
            className="bg-gradient-to-br from-zinc-100 to-zinc-400 bg-clip-text text-transparent"
          >
            {w}
          </motion.span>
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: [0.7, 1.3, 1] }}
        transition={{ delay: 0.9, duration: 0.4 }}
        className="text-3xl sm:text-5xl font-black bg-gradient-to-br from-amber-300 to-rose-400 bg-clip-text text-transparent"
      >
        {t("lanes.shoot")}
      </motion.div>
    </motion.div>
  );
}
