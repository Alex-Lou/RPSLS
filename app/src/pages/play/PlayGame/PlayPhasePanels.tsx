import { AnimatePresence } from "motion/react";
import type { AiMood, MatchState, Move } from "../../../engine/game";
import type { GameMode } from "../../../types";
import { useT } from "../../../i18n";
import type { Streaks } from "./types";
import type { Phase } from "./playPhase";
import { PickPanel } from "./PickPanel";
import { PassPanel } from "./PassPanel";
import { Countdown } from "./Countdown";
import { RevealPanel } from "./RevealPanel";
import { EndPanel } from "./EndPanel";

/** Panneaux de phase du plateau (pick J1 / passe / pick J2 / décompte /
 *  reveal / fin), extraits VERBATIM de PlayGame.tsx — même AnimatePresence et
 *  mêmes clés. */
export function PlayPhasePanels({
  phase, labelA, labelB, isHotseat, match, streaks, mood, mode, isDailyActive, dailyBonus,
  onP1Pick, onP1Timeout, continueToP2, onP2Pick, onP2Timeout, finishCountdown, advance,
  onAgain, onQuit, onMatchResult,
}: {
  phase: Phase;
  labelA: string;
  labelB: string;
  isHotseat: boolean;
  match: MatchState;
  streaks: Streaks;
  mood: AiMood;
  mode: GameMode;
  isDailyActive: boolean;
  dailyBonus: number;
  onP1Pick: (m: Move) => void;
  onP1Timeout: () => void;
  continueToP2: () => void;
  onP2Pick: (m: Move) => void;
  onP2Timeout: () => void;
  finishCountdown: () => void;
  advance: () => void;
  onAgain: () => void;
  onQuit: () => void;
  onMatchResult?: (won: boolean) => void;
}) {
  const t = useT();
  return (
    <AnimatePresence mode="wait">
  {phase.kind === "p1-pick" && (
    <PickPanel
      key="p1"
      title={t("match.pickTitle", { name: labelA })}
      // « 8 secondes pour verrouiller » n'a de sens qu'avec le chrono
      // (hotseat) : vs CPU il n'y a pas de compte à rebours.
      subtitle={isHotseat ? t("match.pickHotseat") : undefined}
      onPick={onP1Pick}
      onTimeout={isHotseat ? undefined : onP1Timeout}
      // Solo vs CPU = no countdown (no move played for you). Hotseat keeps
      // the pass-and-play timer.
      withTimer={isHotseat}
      recentOppMoves={
        !isHotseat
          ? match.history.slice(-3).map((r) => r.move_b)
          : undefined
      }
    />
  )}

  {phase.kind === "pass" && (
    <PassPanel key="pass" labelB={labelB} onContinue={continueToP2} />
  )}

  {phase.kind === "p2-pick" && (
    <PickPanel
      key="p2"
      title={t("match.pickTitle", { name: labelB })}
      subtitle={t("match.pickP2Sub")}
      onPick={onP2Pick}
      onTimeout={onP2Timeout}
      withTimer
    />
  )}

  {phase.kind === "countdown" && (
    <Countdown
      key="countdown"
      labelA={labelA}
      labelB={labelB}
      onDone={finishCountdown}
    />
  )}

  {phase.kind === "reveal" && (
    <RevealPanel
      key="reveal"
      round={phase.round}
      labelA={labelA}
      labelB={labelB}
      streakA={streaks.a}
      streakB={streaks.b}
      matchOver={phase.matchOver}
      atoutNote={phase.atoutNote}
      onNext={advance}
    />
  )}

  {phase.kind === "match-end" && (
    <EndPanel
      key="end"
      labelA={labelA}
      labelB={labelB}
      match={match}
      streaks={streaks}
      mood={!isHotseat ? mood : null}
      mode={mode}
      isDaily={isDailyActive}
      dailyBonus={dailyBonus}
      onAgain={onAgain}
      onQuit={onQuit}
      onMatchResult={onMatchResult}
    />
  )}
    </AnimatePresence>
  );
}
