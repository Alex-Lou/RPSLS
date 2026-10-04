import { useT } from "../../i18n";
import { MatchEndScreen, useEndPhrase, useRecordedReward } from "../matchEnd";
import type { LanesEndData } from "./types";

/**
 * Fin de match Constellation (vs CPU local ET en ligne) — adaptateur vers
 * l'écran de fin COMMUN. Les gains viennent de l'enregistrement déjà fait
 * (history[0]) ; les 💎 restent ceux fournis par l'appelant quand il y en a.
 */
export function MatchEndScene({
  end, onBack, onRematch, youName, oppName, winTo,
}: {
  end: LanesEndData; onBack: () => void; onRematch?: () => void;
  youName: string; oppName: string; winTo: number;
}) {
  const t = useT();
  const youWon = end.roundWinsYou > end.roundWinsOpp;
  const draw = end.roundWinsYou === end.roundWinsOpp;
  const outcome: "win" | "loss" | "draw" = draw ? "draw" : youWon ? "win" : "loss";
  const recorded = useRecordedReward(outcome);
  const phrase = useEndPhrase({
    youScore: end.roundWinsYou, oppScore: end.roundWinsOpp, bestOf: winTo * 2 - 1,
    forfeit: end.forfeit, forfeitByYou: end.forfeit && outcome === "loss",
  });
  const lp = recorded?.lp || undefined;
  return (
    <MatchEndScreen
      outcome={outcome}
      forfeit={end.forfeit}
      subtitle={phrase}
      score={{ you: end.roundWinsYou, opp: end.roundWinsOpp, youName, oppName, caption: t("end.rounds") }}
      rewards={{
        xp: recorded?.xp || undefined,
        xpNote: recorded?.note ?? undefined,
        eclats: end.eclatsGained ?? (recorded?.eclats || undefined),
        lp,
      }}
      lpLadder={lp ? "rankLp" : undefined}
      primary={onRematch ? { label: t("end.playAgain"), onClick: onRematch } : undefined}
      secondary={{ label: t("end.back"), onClick: onBack }}
    />
  );
}
