/**
 * RankedRevealPhase — shows the resolved round.
 *
 * Sequential lane reveal is driven by `LanesBoard` (mode="reveal").
 * On top of that we surface a verdict line, a breakdown of bonuses
 * (Aegis save, Combo, Favoured, Surge) and any combo banner.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { Move } from "../engine/game";
import type { LaneResult } from "../online/online";
import { detectPlayerCombo, detectOutcomeCombo, type ComboTheme } from "../engine/lanesCombos";
import { LanesBoard } from "./LanesBoard";
import type { LaneTarget, PlayedCard, RoundBonusBreakdown } from "./rankedTypes";
import { useT } from "../i18n";
import { BonusBreakdown } from "./RevealBonusBreakdown";
import { CardLine, ComboBanner } from "./RevealRecap";

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
  /** Hauteur de board mesurée en phase pick — le reveal la RÉUTILISE pour un
   *  plateau strictement identique d'une phase à l'autre (0 = hauteur naturelle). */
  boardH?: number;
}

export function RankedRevealPhase({
  youName, opponentName,
  yourPicks, oppPicks, myCard, oppCard, augurRevealed,
  laneResults, bonuses, roundWinner, yourTotal, oppTotal, oppHandSize, boardH = 0,
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
  // Who owns the headline combo — drives the visible "Toi" / "Adv." chip on
  // the banner so the player understands whose hand earned it.
  const headlineAttribution: "you" | "opp" | "both" | null = (() => {
    if (!headlineCombo) return null;
    if (headlineCombo === outcomeCombo) {
      if (outcomeCombo?.id === "sweep") return "you";
      if (outcomeCombo?.id === "wipeout") return "opp";
      return "both";
    }
    if (headlineCombo === oppCombo) return "opp";
    if (headlineCombo === yourCombo) return "you";
    return null;
  })();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full flex flex-col items-center gap-2 sm:gap-3"
    >
      <div className="w-full flex items-center justify-center">
        <LanesBoard
          fillHeight={boardH || undefined}
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

      {/* Verdict + combo + bonus — kept in a shrink-0 block so they ALWAYS
          have their own room and the board (flex-1, min-h-0) absorbs any
          vertical squeeze instead of clipping the combo punch-line. */}
      <div className="shrink-0 w-full flex flex-col items-center gap-1">
        <AnimatePresence>
          {showAfter && (
            <motion.div
              key="verdict"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center px-2"
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
                <div className="text-ink-muted text-lg font-bold">
                  {t("lanes.roundDraw", { a: yourTotal, b: oppTotal })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cards played this round — a plain-language line per side so the
            player understands what each card did and why the result changed. */}
        <AnimatePresence>
          {showAfter && (myCard || oppCard) && (
            <motion.div
              key="cards-recap"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="flex flex-col items-center gap-1 mt-1 w-full px-2"
            >
              {myCard && <CardLine side="you" card={myCard} t={t} />}
              {oppCard && <CardLine side="opp" card={oppCard} t={t} />}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Combo banner — the custom punch-line for the hand played. */}
        <AnimatePresence>
          {showAfter && headlineCombo && (
            <ComboBanner combo={headlineCombo} attribution={headlineAttribution} />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showAfter && (
            <BonusBreakdown
              bonuses={bonuses}
              t={t}
              yourPicks={yourPicks}
              oppPicks={oppPicks}
              laneResults={laneResults}
              myCard={myCard}
              oppCard={oppCard}
              yourCombo={yourCombo}
              oppCombo={oppCombo}
            />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
