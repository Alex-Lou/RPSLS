import { useT } from "../../i18n";
import { MatchScoreBar } from "../sharedMatchUI";

export function ScoreHeader({
  you, opp, youWins, oppWins, target, round,
}: {
  you: string; opp: string;
  youWins: number; oppWins: number; target: number; round: number;
}) {
  const t = useT();
  // Same shared component the classic modes use — guaranteed uniformity.
  return (
    <MatchScoreBar
      youName={you}
      oppName={opp || "—"}
      youScore={youWins}
      oppScore={oppWins}
      youTag={t("lanes.you")}
      oppTag={t("lanes.opponent")}
      caption={t("lanes.scoreCaption", { round, target })}
    />
  );
}
