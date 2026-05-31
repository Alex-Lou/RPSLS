/**
 * RankedRevealPhase — shows the resolved round.
 *
 * Sequential lane reveal is driven by `LanesBoard` (mode="reveal").
 * On top of that we surface a verdict line, a breakdown of bonuses
 * (Aegis save, Combo, Favoured, Surge) and any combo banner.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { Move } from "../game";
import type { LaneResult } from "../online";
import {
  detectPlayerCombo,
  detectOutcomeCombo,
  type ComboTheme,
} from "../lanesCombos";
import { LanesBoard } from "./LanesBoard";
import type { LaneTarget, PlayedCard, RoundBonusBreakdown } from "./rankedTypes";
import { totalBonusForSide } from "./rankedRules";
import { useT } from "../i18n";

export interface RankedRevealPhaseProps {
  youName: string;
  opponentName: string;
  yourPicks: [Move, Move, Move];
  oppPicks: [Move, Move, Move];
  myCard: PlayedCard | null;
  oppCard: PlayedCard | null;
  augurRevealed: { lane: LaneTarget; move: Move } | null;
  laneResults: LaneResult[];
  bonuses: RoundBonusBreakdown;
  /** Final round-winner once all bonuses were tallied. */
  roundWinner: "a" | "b" | "draw";
  yourTotal: number;
  oppTotal: number;
  oppHandSize: number;
}

export function RankedRevealPhase({
  youName, opponentName,
  yourPicks, oppPicks, myCard, oppCard, augurRevealed,
  laneResults, bonuses, roundWinner, yourTotal, oppTotal, oppHandSize,
}: RankedRevealPhaseProps) {
  const t = useT();

  // Wait for the board cascade to finish (~1.4 s) before flooding the bonus
  // breakdown in.
  const [showAfter, setShowAfter] = useState(false);
  useEffect(() => {
    setShowAfter(false);
    const id = window.setTimeout(() => setShowAfter(true), 1500);
    return () => window.clearTimeout(id);
  }, [laneResults]);

  const yourCombo = detectPlayerCombo(yourPicks);
  const oppCombo = detectPlayerCombo(oppPicks);
  // Outcome combo from raw lane points (use the base counts, not bonuses).
  const baseYou = laneResults.filter((lr) => lr.winner === "a").length;
  const baseOpp = laneResults.filter((lr) => lr.winner === "b").length;
  const outcomeCombo = detectOutcomeCombo(baseYou, baseOpp, yourPicks, oppPicks);

  const youWonRound = roundWinner === "a";
  const oppWonRound = roundWinner === "b";
  const headlineCombo: ComboTheme | null =
    outcomeCombo ??
    (oppWonRound ? oppCombo : null) ??
    (youWonRound ? yourCombo : null) ??
    (yourCombo || oppCombo);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full h-full flex flex-col items-center gap-2 sm:gap-3"
    >
      <div className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden">
        <LanesBoard
          youName={youName}
          opponentName={opponentName}
          picks={yourPicks as [Move, Move, Move]}
          oppPicks={oppPicks}
          augurRevealed={augurRevealed}
          myCard={myCard}
          oppCard={oppCard}
          mode="reveal"
          laneResults={laneResults}
          oppHandSize={oppHandSize}
        />
      </div>

      {/* Verdict line */}
      <AnimatePresence>
        {showAfter && (
          <motion.div
            key="verdict"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mt-1 px-2"
          >
            {youWonRound && (
              <div className="text-emerald-300 text-lg font-bold">
                {t("lanes.roundWon", { a: yourTotal, b: oppTotal })}
              </div>
            )}
            {oppWonRound && (
              <div className="text-rose-300 text-lg font-bold">
                {t("lanes.roundLost", { a: yourTotal, b: oppTotal })}
              </div>
            )}
            {!youWonRound && !oppWonRound && (
              <div className="text-zinc-300 text-lg font-bold">
                {t("lanes.roundDraw", { a: yourTotal, b: oppTotal })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Combo banner */}
      <AnimatePresence>
        {showAfter && headlineCombo && (
          <ComboBanner combo={headlineCombo} />
        )}
      </AnimatePresence>

      {/* Bonus breakdown */}
      <AnimatePresence>
        {showAfter && (
          <BonusBreakdown bonuses={bonuses} t={t} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ──────────── Bonus breakdown ──────────── */

function BonusBreakdown({
  bonuses, t,
}: {
  bonuses: RoundBonusBreakdown;
  t: (k: string, vars?: Record<string, string | number>) => string;
}) {
  const youTotal = totalBonusForSide("a", bonuses);
  const oppTotal = totalBonusForSide("b", bonuses);
  if (youTotal === 0 && oppTotal === 0 &&
      !bonuses.aegisSavedA && !bonuses.aegisSavedB) {
    return null;
  }
  return (
    <motion.div
      key="breakdown"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ delay: 0.3 }}
      className="flex flex-col items-center gap-0.5 text-[11px] text-zinc-300 mt-1"
    >
      <Row label={t("ranked.bonus.combo")}    you={bonuses.comboBonusA}    opp={bonuses.comboBonusB} />
      <Row label={t("ranked.bonus.favoured")} you={bonuses.favouredBonusA} opp={bonuses.favouredBonusB} />
      <Row label={t("ranked.bonus.surge")}    you={bonuses.surgeBonusA}    opp={bonuses.surgeBonusB} />
      {(bonuses.aegisSavedA || bonuses.aegisSavedB) && (
        <div className="text-[10px] text-sky-300 mt-0.5 flex items-center gap-2">
          {bonuses.aegisSavedA && (
            <span>🛡️ {t("ranked.bonus.aegisSaved")} ({t("lanes.you")})</span>
          )}
          {bonuses.aegisSavedB && (
            <span>🛡️ {t("ranked.bonus.aegisSaved")} ({t("lanes.opponent")})</span>
          )}
        </div>
      )}
    </motion.div>
  );
}

function Row({ label, you, opp }: { label: string; you: number; opp: number }) {
  if (you === 0 && opp === 0) return null;
  return (
    <div className="flex items-center gap-3 px-1">
      <span className={"font-mono w-6 text-right " + (you > 0 ? "text-emerald-300" : "text-zinc-600")}>
        {you > 0 ? `+${you}` : "·"}
      </span>
      <span className="uppercase tracking-[0.2em] text-[9px] text-zinc-500 min-w-[5rem] text-center">
        {label}
      </span>
      <span className={"font-mono w-6 " + (opp > 0 ? "text-rose-300" : "text-zinc-600")}>
        {opp > 0 ? `+${opp}` : "·"}
      </span>
    </div>
  );
}

/* ──────────── Combo banner (compact version) ──────────── */

function ComboBanner({ combo }: { combo: ComboTheme }) {
  const t = useT();
  const epic = combo.tier === "epic";
  const rare = combo.tier === "rare";
  const name = t(`combo.${combo.id}.name`);
  const tag = t(`combo.${combo.id}.tag`);
  return (
    <motion.div
      key={combo.id}
      initial={{ opacity: 0, scale: 0.6, y: -8 }}
      animate={{
        opacity: 1,
        scale: epic ? [0.6, 1.2, 1] : 1,
        y: 0,
        x: epic ? [0, -4, 4, -2, 2, 0] : 0,
      }}
      exit={{ opacity: 0, scale: 0.85, y: -6 }}
      transition={{ duration: epic ? 0.6 : 0.4, type: "spring", stiffness: 220, damping: 16 }}
      className="flex flex-col items-center gap-0.5 mt-1"
    >
      <div className="flex items-center gap-1.5">
        <span className="text-2xl">{combo.glyph}</span>
        <span
          className={
            (epic ? "text-2xl sm:text-3xl" : rare ? "text-xl sm:text-2xl" : "text-lg sm:text-xl") +
            " font-black tracking-wider bg-gradient-to-br " + combo.gradient +
            " bg-clip-text text-transparent"
          }
        >
          {name}
        </span>
        <span className="text-2xl">{combo.glyph}</span>
      </div>
      <div className={
        "text-[10px] uppercase tracking-[0.2em] text-center px-3 " +
        (epic ? "text-amber-300/90" : rare ? "text-fuchsia-300/80" : "text-zinc-400")
      }>
        {tag}
      </div>
      {combo.bonus != null && combo.bonus > 0 && (
        <div className="text-[10px] uppercase tracking-wider text-amber-300/70">
          +{combo.bonus}
        </div>
      )}
    </motion.div>
  );
}
