import { useT } from "../../i18n";
import { useStore } from "../../store/store";
import { MatchEndScreen, useEndPhrase, useRecordedReward } from "../../match/matchEnd";

/**
 * Fin de match 1v1 classique EN LIGNE (vs joueur ou bot de repli) —
 * adaptateur vers l'écran de fin COMMUN. Props inchangées pour OnlinePage ;
 * les gains sont relus de l'enregistrement fait juste avant (history[0]).
 */
export function MatchEndScene({
  winner,
  youAre,
  forfeit,
  youScore,
  oppScore,
  opponentName,
  onBack,
  onRematch,
}: {
  winner: "a" | "b" | null;
  youAre: "a" | "b";
  forfeit: boolean;
  youScore: number;
  oppScore: number;
  opponentName: string;
  onBack: () => void;
  onRematch?: () => void;
}) {
  const t = useT();
  const nickname = useStore((s) => s.player.nickname);
  const outcome: "win" | "loss" | "draw" = winner === null ? "draw" : winner === youAre ? "win" : "loss";
  const recorded = useRecordedReward(outcome);
  const phrase = useEndPhrase({
    youScore, oppScore, bestOf: recorded?.record.bestOf,
    forfeit, forfeitByYou: forfeit && outcome === "loss",
  });
  const lp = recorded?.lp || undefined;
  return (
    <MatchEndScreen
      outcome={outcome}
      forfeit={forfeit}
      subtitle={phrase}
      score={{
        you: youScore, opp: oppScore,
        youName: nickname || t("end.you"),
        oppName: opponentName || t("end.opponent"),
      }}
      rewards={recorded ? { xp: recorded.xp || undefined, xpNote: recorded.note ?? undefined, eclats: recorded.eclats || undefined, lp } : undefined}
      lpLadder={lp ? "rankLp" : undefined}
      primary={onRematch ? { label: t("end.rematch"), onClick: onRematch } : undefined}
      secondary={{ label: t("end.back"), onClick: onBack }}
    />
  );
}
