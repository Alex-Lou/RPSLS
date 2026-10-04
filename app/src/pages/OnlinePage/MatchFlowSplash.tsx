import { motion } from "motion/react";
import { MatchScoreBar } from "../../match/sharedMatchUI";
import { useT } from "../../i18n";

/* ──────────── Cinematic match flow components ──────────── */

export function MatchFoundSplash({
  youName,
  opponentName,
  bestOf,
  isBot = false,
}: {
  youName: string;
  opponentName: string;
  bestOf: number;
  isBot?: boolean;
}) {
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
        transition={{ delay: 0.1, type: "spring", stiffness: 240, damping: 16 }}
        className="text-xs tracking-[0.5em] text-violet-300/80 uppercase mb-3"
      >
        {isBot ? t("online.splash.practice") : t("online.splash.found")}
      </motion.div>
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.15, type: "spring", stiffness: 220, damping: 12 }}
        className="flex items-center gap-6 sm:gap-10"
      >
        <NameTag name={youName} accent="emerald" align="right" />
        <motion.div
          animate={{ rotate: [0, -8, 8, -4, 4, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 0.9, delay: 0.4 }}
          className="text-5xl sm:text-7xl font-black bg-gradient-to-br from-amber-300 to-rose-400 bg-clip-text text-transparent drop-shadow-[0_4px_24px_rgba(251,191,36,0.4)]"
        >
          {t("match.vs")}
        </motion.div>
        <NameTag name={opponentName} accent="rose" align="left" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.4 }}
        className="mt-8 text-sm uppercase tracking-[0.3em] text-zinc-400"
      >
        {t("lobby.bestOf", { n: bestOf })}
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ delay: 1.6, duration: 0.4 }}
        className="mt-12 text-xs text-zinc-500"
      >
        {t("online.splash.getReady")}
      </motion.div>
    </motion.div>
  );
}

function NameTag({
  name,
  accent,
  align,
}: {
  name: string;
  accent: "emerald" | "rose";
  align: "left" | "right";
}) {
  const t = useT();
  const grad =
    accent === "emerald"
      ? "from-emerald-300 to-teal-400"
      : "from-rose-300 to-fuchsia-400";
  return (
    <div className={"flex flex-col " + (align === "right" ? "items-end" : "items-start")}>
      <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
        {accent === "emerald" ? t("online.you") : t("online.opponent")}
      </div>
      <div
        className={
          "mt-1 text-xl sm:text-3xl font-black truncate max-w-[32vw] sm:max-w-[28vw] bg-gradient-to-r " +
          grad +
          " bg-clip-text text-transparent"
        }
      >
        {name || t("online.anonymous")}
      </div>
    </div>
  );
}

/** Score header du match en ligne classique. Délègue au composant PARTAGÉ
 *  MatchScoreBar (Alex 2026-07) — avant, ce header avait son propre rendu de
 *  score qui héritait de la fonte du thème (chiffres serif rognés/empilés
 *  « 23:2 ») et échappait au fix. Un seul composant de score pour TOUS les
 *  modes → une seule vérité, chiffres mono nets sur les 12 thèmes. */
export function ScoreHeader({
  youName,
  opponentName,
  youScore,
  oppScore,
  round,
  target,
  bestOf,
}: {
  youName: string;
  opponentName: string;
  youScore: number;
  oppScore: number;
  round: number;
  target: number;
  bestOf: number;
}) {
  const t = useT();
  return (
    <MatchScoreBar
      youName={youName}
      oppName={opponentName || "—"}
      youScore={youScore}
      oppScore={oppScore}
      youTag={t("online.you")}
      oppTag={t("online.opponent")}
      caption={t("online.score.caption", { round, bestOf, target })}
    />
  );
}
