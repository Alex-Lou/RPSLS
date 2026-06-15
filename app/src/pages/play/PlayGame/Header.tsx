import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { GameMode } from "../../../types";
import { useT } from "../../../i18n";
import {
  MatchScoreBar,
  FloatingMatchBackButton,
  useAndroidBackPrompt,
} from "../../../match/sharedMatchUI";
import { QuitConfirmModal } from "../../../match/QuitConfirmModal";

export function Header({
  mode, labelA, labelB, scoreA, scoreB, target,
  streakA, streakB, onQuit,
}: {
  mode: GameMode;
  labelA: string; labelB: string; scoreA: number; scoreB: number;
  target: number; streakA: number; streakB: number;
  onQuit: () => void;
}) {
  const t = useT();
  const [confirmQuit, setConfirmQuit] = useState(false);
  const isMidMatch = scoreA > 0 || scoreB > 0;
  // Classé is competitive — always confirm a quit (even at 0-0) so a stray tap
  // can't silently forfeit. Casual/training only confirm once a match is live.
  const ranked = mode === "ranked";

  const handleQuitClick = () => {
    if (isMidMatch || ranked) setConfirmQuit(true);
    else onQuit();
  };

  // Android system back routes to the same confirm flow so a stray
  // back-press mid-match can't silently abandon the game.
  useAndroidBackPrompt(handleQuitClick);

  // Same caption shape as the Constellation ScoreHeader, classic wording.
  const round = scoreA + scoreB + 1;
  const caption = t("match.scoreCaption", { round, target });

  return (
    <>
      {/* Quit button docks next to the burger so the score bar can take the
          full row width on its own line. */}
      <FloatingMatchBackButton onClick={handleQuitClick} label={t("match.quit")} />

      {/* Unified score bar — identical component used by Constellation. */}
      <MatchScoreBar
        youName={labelA}
        oppName={labelB}
        youScore={scoreA}
        oppScore={scoreB}
        youTag={t("lanes.you")}
        oppTag={t("lanes.opponent")}
        youStreak={streakA}
        oppStreak={streakB}
        caption={caption}
      />

      {/* Quit confirmation modal */}
      <AnimatePresence>
        {confirmQuit && (
          <QuitConfirmModal
            onCancel={() => setConfirmQuit(false)}
            onConfirm={() => { setConfirmQuit(false); onQuit(); }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
