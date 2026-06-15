import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { MysteryHand } from "../../../icons";
import { useT } from "../../../i18n";
import { vibrate } from "../../../haptic";

const COUNTDOWN_IDS = ["rock", "paper", "scissors", "lizard", "spock"] as const;
const BEAT_MS = 360;

export function Countdown({
  labelA, labelB, onDone,
}: { labelA: string; labelB: string; onDone: () => void }) {
  const tr = useT();
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    // Tiny buzz on every beat (Rock, Paper, Scissors, Lizard, Spock…) so
    // the player physically feels the rhythm. The final beat is the
    // SHOOT moment — give it a slightly stronger pulse.
    if (beat < COUNTDOWN_IDS.length) {
      vibrate(beat === COUNTDOWN_IDS.length - 1 ? 28 : 12);
      const t = setTimeout(() => setBeat(beat + 1), BEAT_MS);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(onDone, 220);
      return () => clearTimeout(t);
    }
  }, [beat, onDone]);

  const id = COUNTDOWN_IDS[Math.min(beat, COUNTDOWN_IDS.length - 1)];
  const label = tr("element." + id) + "!";

  const shakeVariant = {
    animate: {
      y: [0, -22, 0],
      rotate: [0, -8, 0],
      transition: { duration: BEAT_MS / 1000, ease: "easeInOut" as const },
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="bg-surface-raised rounded-2xl sm:rounded-3xl shadow-xl ring-1 ring-white/10 p-4 sm:p-6 border border-hairline flex flex-col items-center gap-6"
    >
      <div className="grid grid-cols-3 items-center w-full">
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-ink-muted">{labelA}</span>
          <motion.div key={`a-${Math.min(beat, COUNTDOWN_IDS.length - 1)}`} variants={shakeVariant} animate="animate">
            <MysteryHand size="lg" />
          </motion.div>
        </div>

        <motion.div
          key={`label-${Math.min(beat, COUNTDOWN_IDS.length - 1)}`}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.4, opacity: 0 }}
          transition={{ type: "spring", stiffness: 350, damping: 18 }}
          className="text-center"
        >
          <span className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-br from-fuchsia-300 to-violet-400 bg-clip-text text-transparent">
            {label}
          </span>
        </motion.div>

        <div className="flex flex-col items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-ink-muted">{labelB}</span>
          <motion.div key={`b-${Math.min(beat, COUNTDOWN_IDS.length - 1)}`} variants={shakeVariant} animate="animate">
            <MysteryHand size="lg" />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
