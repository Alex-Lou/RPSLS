import { motion } from "motion/react";
import { Hand } from "../../icons";
import type { Move } from "../../engine/game";
import { useT } from "../../i18n";
import { GameTable, FaceDownLaneCard } from "./GameTable";

export function LockedStage({
  picks, opponentName, youName,
}: { picks: Move[]; opponentName: string; youName: string }) {
  const t = useT();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full flex flex-col items-center gap-2 sm:gap-4"
    >
      <div className="w-full flex items-center justify-center">
      <GameTable
        opponentName={opponentName}
        youName={youName}
        oppStatus={t("lanes.tableOppThinking")}
        youStatus={t("lanes.lockedIn")}
        oppRow={
          <div className="grid grid-cols-3 gap-3 sm:gap-5">
            {[0, 1, 2].map((i) => (
              <FaceDownLaneCard key={i} index={i} pulsing />
            ))}
          </div>
        }
        youRow={
          <div className="grid grid-cols-3 gap-3 sm:gap-5">
            {picks.map((mv, i) => (
              <motion.div
                key={i}
                // One-shot settle on lock — then perfectly still. No infinite
                // bob (the old y-loop made the locked cards feel jittery).
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="aspect-square w-full rounded-2xl border-2 border-emerald-400/50 bg-emerald-600/25
                           flex flex-col items-center justify-center gap-1 ring-2 ring-emerald-400/30"
              >
                <Hand move={mv} size="md" />
                <span className="text-[9px] uppercase tracking-wider text-emerald-200/90">L{i + 1}</span>
              </motion.div>
            ))}
          </div>
        }
      />
      </div>
      <div className="shrink-0 text-sm text-ink-muted font-medium">{t("lanes.waitingOpponent")}</div>
    </motion.div>
  );
}

export function RevealCountdown() {
  const tCount = useT();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center gap-3 px-4 text-center"
    >
      <div className="text-[10px] uppercase tracking-[0.4em] text-ink-faint">{tCount("lanes.reveal")}</div>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xl sm:text-3xl font-black leading-tight">
        {[tCount("online.reveal.rock"), tCount("online.reveal.paper"), tCount("online.reveal.scissors"), tCount("online.reveal.lizard"), tCount("online.reveal.spock")].map((w, i) => (
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
        {tCount("lanes.shoot")}
      </motion.div>
    </motion.div>
  );
}
