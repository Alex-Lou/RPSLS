/**
 * SeasonRolloverModal — announces a season change.
 *
 * Fires once when App boot detects the 30-day window has elapsed and the
 * store has already credited the tier reward + softly reset LP. The modal
 * is informational: closing it just dismisses, no further action needed.
 */

import { motion } from "motion/react";
import { ModalShell } from "../ui/ModalShell";
import type { SeasonReward } from "../engine/economy";

interface Props {
  fromSeason: number;
  reward: SeasonReward;
  lpBefore: number;
  lpAfter: number;
  onClose: () => void;
}

export function SeasonRolloverModal({ fromSeason, reward, lpBefore, lpAfter, onClose }: Props) {
  return (
    <ModalShell onClose={onClose} z="z-50" padding="p-4" backdrop="bg-black/80" overlayTransition={{ duration: 0.2 }}>
      <motion.div
        initial={{ scale: 0.92, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 6 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-surface-raised border border-hairline rounded-3xl p-6 shadow-2xl flex flex-col gap-4 text-center"
      >
        <div>
          <div className="text-4xl mb-2">🏁</div>
          <h2 className="text-xl font-black bg-gradient-to-br from-amber-300 to-orange-400 bg-clip-text text-transparent">
            Saison {fromSeason} terminée
          </h2>
          <p className="text-[12px] text-ink-muted mt-1">
            Tu as fini en <b className="text-ink">{reward.tier}</b>. Une nouvelle saison
            commence — ton rang se rafraîchit.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-left">
          <div className="rounded-xl p-3 bg-cyan-500/10 border border-cyan-400/40">
            <div className="text-[10px] uppercase tracking-wider font-bold text-cyan-300">Récompense</div>
            <div className="mt-1 flex flex-col gap-0.5 text-sm font-black tabular-nums">
              <span className="text-cyan-200">+{reward.eclats} 💎</span>
              {reward.dust > 0 && <span className="text-violet-200">+{reward.dust} ✨</span>}
            </div>
          </div>
          <div className="rounded-xl p-3 bg-amber-500/10 border border-amber-400/30">
            <div className="text-[10px] uppercase tracking-wider font-bold text-amber-300">LP</div>
            <div className="mt-1 flex flex-col gap-0.5 text-sm tabular-nums">
              <span className="text-ink-muted line-through">{lpBefore}</span>
              <span className="text-amber-200 font-black">{lpAfter}</span>
            </div>
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onClose}
          className="mt-2 w-full py-3 rounded-2xl font-bold text-white bg-themed shadow-lg"
        >
          Lancer la saison
        </motion.button>
      </motion.div>
    </ModalShell>
  );
}
