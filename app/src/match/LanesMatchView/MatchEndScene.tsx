import { CinematicMatchEnd } from "../sharedMatchUI";
import type { LanesEndData } from "./types";

export function MatchEndScene({
  end, onBack, onRematch,
}: { end: LanesEndData; onBack: () => void; onRematch?: () => void }) {
  const youWon = end.roundWinsYou > end.roundWinsOpp;
  const draw = end.roundWinsYou === end.roundWinsOpp;
  const outcome: "win" | "loss" | "draw" = draw ? "draw" : youWon ? "win" : "loss";
  // Delegate to the shared compact match-end so Constellation and the
  // classic modes have identical sizing and never overflow the viewport.
  return (
    <CinematicMatchEnd
      outcome={outcome}
      forfeit={end.forfeit}
      forfeitByYou={end.forfeit && outcome === "loss"}
      scoreLine={`${end.roundWinsYou} — ${end.roundWinsOpp}`}
      youScore={end.roundWinsYou}
      oppScore={end.roundWinsOpp}
      bestOf={Math.max(end.roundWinsYou, end.roundWinsOpp) * 2 - 1}
      onRematch={onRematch}
      onBack={onBack}
      reward={end.eclatsGained ? { eclats: end.eclatsGained } : undefined}
    />
  );
}
