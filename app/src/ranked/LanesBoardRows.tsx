import { useEffect, useState } from "react";
import type { Move } from "../engine/game";
import type { LaneResult } from "../online/online";
import { laneFavoursMove } from "../engine/lanesCombos";
import { CardSlot } from "./CardSlot";
import type { LaneTarget, PlayedCard } from "./rankedTypes";
import { FaceDownCard, TwilightBadge, CompassGhostCard, FaceUpOppCard, LaneSlot } from "./LanesBoardCards";

/**
 * Rangées adversaire / joueur du LanesBoard (extraites VERBATIM de LanesBoard.tsx).
 */

export function OpponentRow({
  oppPicks, oppCard, augurRevealed, oracleRevealed, mode, laneResults, compassPeek,
  twilightLane, onOppLaneClick, augurTargeting,
}: {
  oppPicks: [Move, Move, Move] | null;
  oppCard: PlayedCard | null;
  augurRevealed: { lane: LaneTarget; move: Move } | null;
  oracleRevealed?: [Move, Move, Move] | null;
  mode: "picking" | "locked" | "reveal";
  laneResults?: LaneResult[];
  compassPeek?: { lane: LaneTarget | null } | null;
  twilightLane?: LaneTarget | null;
  onOppLaneClick?: (lane: LaneTarget) => void;
  augurTargeting: boolean;
}) {
  const [revealedLanes, setRevealedLanes] = useState(mode === "reveal" ? 0 : 3);
  useEffect(() => {
    if (mode !== "reveal") { setRevealedLanes(3); return; }
    setRevealedLanes(0);
    const timers = [
      window.setTimeout(() => setRevealedLanes(1), 200),
      window.setTimeout(() => setRevealedLanes(2), 800),
      window.setTimeout(() => setRevealedLanes(3), 1400),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [mode]);

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3 [@media(max-height:560px)]:gap-1.5">
      {[0, 1, 2].map((i) => {
        const lane = i as LaneTarget;
        const isAugurLane = augurRevealed?.lane === lane;
        // Oracle reveals all 3 moves; Augur reveals just one. Augur wins when
        // both are on the same lane (more precise / recent) — Oracle fills the
        // others. Both pre-lock and persist through the reveal.
        const augurMove = isAugurLane ? augurRevealed.move : (oracleRevealed?.[i] ?? null);
        const oppMove = mode === "reveal" && oppPicks ? oppPicks[i] : augurMove;
        const lr = laneResults?.[i];
        const verdict: "win" | "loss" | "draw" | null =
          lr ? (lr.winner === "b" ? "win" : lr.winner === "a" ? "loss" : "draw") : null;
        const revealed = mode !== "reveal" || i < revealedLanes;
        const showCard = mode === "reveal" && oppCard && "lane" in oppCard && oppCard.lane === lane;

        // Boussole ghost-card peek: only during pick/locked (the reveal phase
        // already shows the real card via showCard below), and only on the
        // exact lane the opponent's card targets.
        const showCompassPeek =
          mode !== "reveal" &&
          compassPeek?.lane !== null &&
          compassPeek?.lane === lane;
        const isTwilight = twilightLane === lane;
        return (
          <div key={i} className={"relative " + (isTwilight ? "twilight-lane" : "")}>
            {oppMove ? (
              <FaceUpOppCard move={oppMove} verdict={verdict} revealed={revealed} preReveal={mode !== "reveal"} />
            ) : (
              <FaceDownCard
                index={i}
                pulsing={!augurTargeting}
                clickable={augurTargeting}
                onClick={() => onOppLaneClick?.(lane)}
                compassMarked={showCompassPeek}
                twilightMarked={isTwilight}
              />
            )}
            {showCard && oppCard && <CardSlot id={oppCard.id} position="tr" flipReveal />}
            {showCompassPeek && <CompassGhostCard />}
            {isTwilight && <TwilightBadge />}
          </div>
        );
      })}
    </div>
  );
}

export function PlayerRow({
  picks, myCard, mode, laneResults, twilightLane, onLaneClick, targeting = false,
}: {
  picks: [Move | null, Move | null, Move | null];
  myCard: PlayedCard | null;
  mode: "picking" | "locked" | "reveal";
  laneResults?: LaneResult[];
  twilightLane?: LaneTarget | null;
  onLaneClick?: (lane: LaneTarget) => void;
  /** Une carte-lane est sélectionnée → toutes tes cases peuvent l'accueillir. */
  targeting?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3 [@media(max-height:560px)]:gap-1.5">
      {picks.map((mv, i) => {
        const lane = i as LaneTarget;
        const lr = laneResults?.[i];
        const verdict: "win" | "loss" | "draw" | null =
          lr ? (lr.winner === "a" ? "win" : lr.winner === "b" ? "loss" : "draw") : null;
        const favoured = mv ? laneFavoursMove(lane, mv) : false;
        const cardHere = myCard && "lane" in myCard && myCard.lane === lane ? myCard : null;
        return (
          <LaneSlot
            key={i}
            index={i}
            pick={mv}
            favoured={favoured}
            verdict={verdict}
            cardHere={cardHere}
            twilightMarked={twilightLane === lane}
            onClick={() => onLaneClick?.(lane)}
            disabled={mode !== "picking"}
            targeting={targeting}
          />
        );
      })}
    </div>
  );
}
