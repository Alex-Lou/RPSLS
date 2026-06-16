import { motion } from "motion/react";

export function MatchEndScene({
  winner,
  youAre,
  forfeit,
  youScore,
  oppScore,
  opponentName,
  onBack,
  onRematch,
}: {
  winner: "a" | "b" | null;
  youAre: "a" | "b";
  forfeit: boolean;
  youScore: number;
  oppScore: number;
  opponentName: string;
  onBack: () => void;
  onRematch?: () => void;
}) {
  const youWon = winner === youAre;
  const draw = winner === null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-5 py-8"
    >
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
        className="text-7xl sm:text-8xl"
      >
        {youWon ? "🏆" : draw ? "🤝" : "💀"}
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className={
          "text-4xl sm:text-5xl font-black bg-gradient-to-br bg-clip-text text-transparent " +
          (youWon
            ? "from-emerald-300 to-teal-400"
            : draw
            ? "from-zinc-200 to-zinc-400"
            : "from-rose-300 to-fuchsia-400")
        }
      >
        {youWon ? "VICTORY" : draw ? "DRAW" : "DEFEAT"}
      </motion.div>
      {forfeit && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-xs uppercase tracking-[0.3em] text-amber-300"
        >
          (by forfeit)
        </motion.div>
      )}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="rounded-2xl bg-black/40 border border-white/10 px-6 py-3 flex items-center gap-4"
      >
        <div className="text-right">
          <div className="text-[10px] uppercase text-zinc-500">You</div>
          <div className="text-3xl font-black text-emerald-300 tabular-nums">{youScore}</div>
        </div>
        <div className="text-zinc-700 text-2xl">—</div>
        <div className="text-left">
          <div className="text-[10px] uppercase text-zinc-500 truncate max-w-[20ch]">
            {opponentName || "Opponent"}
          </div>
          <div className="text-3xl font-black text-rose-300 tabular-nums">{oppScore}</div>
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
        className="mt-4 flex flex-row gap-2 w-full max-w-md px-2"
      >
        {onRematch && (
          <button
            onClick={onRematch}
            className="flex-1 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 font-bold text-white shadow-lg shadow-emerald-500/30 active:scale-[0.98] transition"
          >
            🔁 Rematch
          </button>
        )}
        <button
          onClick={onBack}
          className="flex-1 px-5 py-3 rounded-xl bg-themed hover:brightness-110 font-semibold text-white shadow-lg shadow-themed active:scale-[0.98] transition"
        >
          Back to menu
        </button>
      </motion.div>
    </motion.div>
  );
}
