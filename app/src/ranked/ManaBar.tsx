/**
 * ManaBar — prominent mana display with number + pips.
 * Positioned to be clearly visible during picking phase.
 */

import { motion } from "motion/react";
import { InfoBubble } from "../flavor/InfoBubble";

export function ManaBar({
  mana, max = 4, spent = 0,
}: {
  mana: number;
  max?: number;
  spent?: number;
}) {
  const available = mana - spent;
  return (
    <div className="flex items-center gap-2 bg-violet-500/15 border border-violet-400/30 rounded-xl px-3 py-1.5">
      {/* Big number */}
      <motion.span
        key={available}
        initial={{ scale: 1.4, opacity: 0.5 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 15 }}
        className="text-lg sm:text-xl font-black tabular-nums text-violet-300 min-w-[1.2em] text-center"
      >
        {available}
      </motion.span>
      {/* Label + pips */}
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1">
          <span className="text-[8px] sm:text-[9px] uppercase tracking-wider font-bold text-violet-400/80 leading-none">
            Mana
          </span>
          <InfoBubble
            size="sm"
            variant="minimal"
            title="Mana"
            body={
              <>
                Le mana sert à jouer des cartes. Il vaut <b>1</b> au round 1 et <b>monte de 1 chaque round</b> jusqu'à <b>4</b>.
                Communes coûtent 1, rares 2, épiques 3, légendaire 4.
                Le mana ne s'accumule pas — celui non utilisé est perdu en fin de round.
              </>
            }
          />
        </div>
        <div className="flex items-center gap-1">
          {Array.from({ length: max }, (_, i) => {
            const filled = i < mana;
            const willSpend = filled && i >= mana - spent;
            return <Pip key={i} filled={filled} willSpend={willSpend} index={i} />;
          })}
        </div>
      </div>
    </div>
  );
}

function Pip({
  filled, willSpend, index,
}: { filled: boolean; willSpend: boolean; index: number }) {
  const colour = willSpend
    ? "#fbbf24"
    : filled
    ? "#a78bfa"
    : "#3f3f46";
  return (
    <motion.div
      initial={false}
      animate={{
        backgroundColor: colour,
        scale: filled ? 1 : 0.75,
        opacity: filled ? 1 : 0.35,
        boxShadow: willSpend
          ? ["0 0 0px rgba(251,191,36,0)", "0 0 6px rgba(251,191,36,0.7)", "0 0 0px rgba(251,191,36,0)"]
          : "none",
      }}
      transition={{
        backgroundColor: { delay: index * 0.05, duration: 0.25 },
        scale: { delay: index * 0.05, type: "spring", stiffness: 280, damping: 20 },
        boxShadow: willSpend ? { duration: 1.2, repeat: Infinity } : { duration: 0.2 },
      }}
      className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ring-1 ring-violet-300/30"
    />
  );
}
