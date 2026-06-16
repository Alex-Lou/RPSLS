import { motion } from "motion/react";

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
        {isBot ? "🤖 Practice match" : "Match found"}
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
          VS
        </motion.div>
        <NameTag name={opponentName} accent="rose" align="left" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.4 }}
        className="mt-8 text-sm uppercase tracking-[0.3em] text-zinc-400"
      >
        Best of {bestOf}
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ delay: 1.6, duration: 0.4 }}
        className="mt-12 text-xs text-zinc-500"
      >
        Get ready…
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
  const grad =
    accent === "emerald"
      ? "from-emerald-300 to-teal-400"
      : "from-rose-300 to-fuchsia-400";
  return (
    <div className={"flex flex-col " + (align === "right" ? "items-end" : "items-start")}>
      <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
        {accent === "emerald" ? "You" : "Opponent"}
      </div>
      <div
        className={
          "mt-1 text-xl sm:text-3xl font-black truncate max-w-[32vw] sm:max-w-[28vw] bg-gradient-to-r " +
          grad +
          " bg-clip-text text-transparent"
        }
      >
        {name || "Anonymous"}
      </div>
    </div>
  );
}

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
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between rounded-2xl bg-black/30 border border-white/10 px-4 py-3">
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">You</span>
          <span className="font-semibold truncate text-emerald-200">{youName}</span>
        </div>
        <div className="text-3xl sm:text-4xl font-black tabular-nums px-4">
          <motion.span
            key={youScore}
            initial={{ scale: 1.6, color: "#10b981" }}
            animate={{ scale: 1, color: "#6ee7b7" }}
            transition={{ duration: 0.4 }}
            className="text-emerald-300 inline-block"
          >
            {youScore}
          </motion.span>
          <span className="text-zinc-600 mx-2">:</span>
          <motion.span
            key={oppScore}
            initial={{ scale: 1.6, color: "#f43f5e" }}
            animate={{ scale: 1, color: "#fda4af" }}
            transition={{ duration: 0.4 }}
            className="text-rose-300 inline-block"
          >
            {oppScore}
          </motion.span>
        </div>
        <div className="flex flex-col text-right min-w-0 flex-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Opponent</span>
          <span className="font-semibold truncate text-rose-200">{opponentName || "—"}</span>
        </div>
      </div>
      <div className="text-center text-[11px] uppercase tracking-[0.25em] text-zinc-500">
        Round {round} · Best of {bestOf} · First to {target}
      </div>
    </div>
  );
}
