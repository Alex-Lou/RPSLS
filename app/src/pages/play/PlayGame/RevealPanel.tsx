import { useEffect } from "react";
import { motion } from "motion/react";
import { RoundResult } from "../../../engine/game";
import { MOVE_PALETTE } from "../../../icons";
import { useT } from "../../../i18n";
import { hapticWin, hapticLoss, hapticTap } from "../../../haptic";
import { RevealHand } from "./RevealHand";
import { ParticleBurst } from "./ParticleBurst";

export function RevealPanel({
  round, labelA, labelB, streakA, streakB, matchOver, atoutNote, onNext,
}: {
  round: RoundResult;
  labelA: string; labelB: string;
  streakA: number; streakB: number;
  matchOver: boolean; atoutNote?: string; onNext: () => void;
}) {
  const t = useT();
  const { move_a, move_b, outcome } = round;
  const aWon = outcome.kind === "a_wins";
  const bWon = outcome.kind === "b_wins";
  const draw = outcome.kind === "draw";

  // Buzz once when the result lands. The reveal animation timing is ~0.6 s
  // after mount so we delay the haptic to land with the verb appearing.
  useEffect(() => {
    const id = setTimeout(() => {
      if (aWon) hapticWin();
      else if (bWon) hapticLoss();
      else hapticTap();
    }, 280);
    return () => clearTimeout(id);
    // Effect must re-run if a different round is shown — keyed on outcome.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  // Translate the canonical RPSLS verb returned by the core engine
  const verb =
    outcome.kind === "a_wins" || outcome.kind === "b_wins"
      ? t("verb." + outcome.verb.toLowerCase())
      : null;

  const winnerMove = aWon ? move_a : bWon ? move_b : null;
  const flashColor = winnerMove ? MOVE_PALETTE[winnerMove].hex : "#ffffff";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className="relative bg-surface-raised rounded-2xl sm:rounded-3xl shadow-xl ring-1 ring-white/10 px-3 py-5 sm:p-12 border border-hairline flex flex-col items-center gap-6 sm:gap-8 max-w-full"
    >
      {/* Winner flash — a radial-gradient glow (NO blur filter). The old
          w-96 h-96 blur-3xl recomposited a huge blurred area every frame over
          the live WebGL backdrop → the reveal stutter/lag. A soft-edged radial
          gradient reads the same but is nearly free. */}
      {!draw && (
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: [0, 0.55, 0], scale: [0.7, 1.5, 2] }}
          transition={{ duration: 0.55, delay: 0.06, ease: "easeOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${flashColor} 0%, transparent 66%)`, willChange: "transform, opacity" }}
        />
      )}

      <div className="relative grid grid-cols-[1fr_auto_1fr] items-center w-full gap-4 sm:gap-8">
        <RevealHand label={labelA} move={move_a} winner={aWon} loser={bWon} side="left" streak={streakA} />

        <div className="relative h-32 sm:h-40 flex items-center justify-center px-2 sm:px-4">
          <motion.div
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.08, type: "spring", stiffness: 380, damping: 16 }}
            className="flex flex-col items-center"
          >
            <span className="text-ink-muted uppercase tracking-[0.4em] text-sm sm:text-base font-bold">
              vs
            </span>
            <span className="block w-8 h-px bg-zinc-500 mt-1.5" />
          </motion.div>
          {!draw && <ParticleBurst color={flashColor} />}
        </div>

        <RevealHand label={labelB} move={move_b} winner={bWon} loser={aWon} side="right" streak={streakB} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 18 }}
        className="text-center min-h-[3rem] relative"
      >
        {draw && <p className="text-3xl font-bold text-ink-muted">{t("match.draw")}</p>}
        {!draw && verb && (
          <p className="text-xl sm:text-3xl font-bold">
            <span className={aWon ? "text-violet-300" : "text-teal-300"}>
              {t("element." + (aWon ? move_a : move_b))}
            </span>{" "}
            <span className="text-ink-muted font-normal italic">{verb}</span>{" "}
            <span className="text-ink">
              {t("element." + (aWon ? move_b : move_a))}
            </span>
          </p>
        )}
      </motion.div>

      {atoutNote && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.42 }}
          className="-mt-3 text-sm font-bold text-amber-300 text-center"
        >
          {atoutNote}
        </motion.div>
      )}

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.97 }}
        onClick={onNext}
        className="mt-2 px-7 py-3.5 rounded-2xl font-semibold text-base bg-hairline hover:bg-white/20 border border-hairline hover:border-white/30 transition relative z-10"
      >
        {matchOver ? t("match.seeResults") : t("match.next")}
      </motion.button>
    </motion.div>
  );
}
