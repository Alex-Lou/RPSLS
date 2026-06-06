/**
 * LanesBoard — the 3-lane board for ranked matches.
 * Supports onOppLaneClick for Augur targeting on the opponent row.
 */

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Hand, MoveGlyph } from "../icons";
import type { Move } from "../engine/game";
import type { LaneResult } from "../online/online";
import { LANE_IDENTITIES, laneFavoursMove } from "../engine/lanesCombos";
import { CardSlot } from "./CardSlot";
import { OppHandIndicator } from "./OppHandIndicator";
import type { LaneTarget, PlayedCard } from "./rankedTypes";
import { useT } from "../i18n";
import { useStore } from "../store/store";
import { BattlePad } from "../BattlePad";

const IDENTITY_KEYS = [
  "lanes.identity.force",
  "lanes.identity.wisdom",
  "lanes.identity.cunning",
];

export interface LanesBoardProps {
  youName: string;
  opponentName: string;
  picks: [Move | null, Move | null, Move | null];
  oppPicks: [Move, Move, Move] | null;
  augurRevealed: { lane: LaneTarget; move: Move } | null;
  myCard: PlayedCard | null;
  oppCard: PlayedCard | null;
  mode: "picking" | "locked" | "reveal";
  laneResults?: LaneResult[];
  /** Visible opponent hand count (face-down minicards above the opp row). */
  oppHandSize?: number;
  onLaneClick?: (lane: LaneTarget) => void;
  onOppLaneClick?: (lane: LaneTarget) => void;
  augurTargeting?: boolean;
}

export function LanesBoard({
  youName, opponentName,
  picks, oppPicks, augurRevealed,
  myCard, oppCard, mode, laneResults, oppHandSize,
  onLaneClick, onOppLaneClick, augurTargeting = false,
}: LanesBoardProps) {
  const padId = useStore((s) => s.player.padId);
  return (
    <div
      className="relative w-full max-w-2xl rounded-2xl overflow-hidden
                 border border-emerald-900/40
                 shadow-[inset_0_0_36px_rgba(0,0,0,0.55)]
                 [@media(max-height:560px)]:max-w-md"
    >
      {/* Battle-pad backdrop — the user-chosen pad IS the visible surface the
          lanes sit on. Fully opaque so the chosen theme actually shows. */}
      <div className="absolute inset-0 pointer-events-none">
        <BattlePad padId={padId} className="w-full h-full" compact />
      </div>
      {/* Radial vignette: very dark in the centre (where the lanes sit) so
          busy pad decorations — Cosmos atom orbit, Quantum particle traces,
          Casino medallion etc. — don't compete with the move icons; thinner
          at the edges so the pad's perimeter motifs still read. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(closest-side, rgba(0,0,0,0.7), rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.18) 100%)",
        }}
      />

      <div className="relative p-3 sm:p-4 flex flex-col gap-3 sm:gap-4 [@media(max-height:560px)]:p-1.5 [@media(max-height:560px)]:gap-1.5">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <div className="text-[10px] uppercase tracking-[0.25em] font-bold text-rose-300/90 truncate">
          ✦ {opponentName}
        </div>
        {oppHandSize !== undefined && <OppHandIndicator size={oppHandSize} />}
      </div>
      <OpponentRow
        oppPicks={oppPicks}
        oppCard={oppCard}
        augurRevealed={augurRevealed}
        mode={mode}
        laneResults={laneResults}
        onOppLaneClick={onOppLaneClick}
        augurTargeting={augurTargeting}
      />

      <div className="h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />

      <PlayerRow
        picks={picks}
        myCard={myCard}
        mode={mode}
        laneResults={laneResults}
        onLaneClick={onLaneClick}
      />
      <div className="text-[10px] uppercase tracking-[0.25em] font-bold text-emerald-300/90 truncate px-0.5">
        ✦ {youName}
      </div>
      </div>
    </div>
  );
}

function OpponentRow({
  oppPicks, oppCard, augurRevealed, mode, laneResults,
  onOppLaneClick, augurTargeting,
}: {
  oppPicks: [Move, Move, Move] | null;
  oppCard: PlayedCard | null;
  augurRevealed: { lane: LaneTarget; move: Move } | null;
  mode: "picking" | "locked" | "reveal";
  laneResults?: LaneResult[];
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
        const augurMove = isAugurLane ? augurRevealed.move : null;
        const oppMove = mode === "reveal" && oppPicks ? oppPicks[i] : augurMove;
        const lr = laneResults?.[i];
        const verdict: "win" | "loss" | "draw" | null =
          lr ? (lr.winner === "b" ? "win" : lr.winner === "a" ? "loss" : "draw") : null;
        const revealed = mode !== "reveal" || i < revealedLanes;
        const showCard = mode === "reveal" && oppCard && "lane" in oppCard && oppCard.lane === lane;

        return (
          <div key={i} className="relative">
            {oppMove ? (
              <FaceUpOppCard move={oppMove} verdict={verdict} revealed={revealed} preReveal={mode !== "reveal"} />
            ) : (
              <FaceDownCard
                index={i}
                pulsing={!augurTargeting}
                clickable={augurTargeting}
                onClick={() => onOppLaneClick?.(lane)}
              />
            )}
            {showCard && oppCard && <CardSlot id={oppCard.id} position="tr" flipReveal />}
          </div>
        );
      })}
    </div>
  );
}

function PlayerRow({
  picks, myCard, mode, laneResults, onLaneClick,
}: {
  picks: [Move | null, Move | null, Move | null];
  myCard: PlayedCard | null;
  mode: "picking" | "locked" | "reveal";
  laneResults?: LaneResult[];
  onLaneClick?: (lane: LaneTarget) => void;
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
            onClick={() => onLaneClick?.(lane)}
            disabled={mode !== "picking"}
          />
        );
      })}
    </div>
  );
}

function FaceDownCard({ index: _index, pulsing: _pulsing, clickable = false, onClick }: {
  index: number; pulsing: boolean; clickable?: boolean; onClick?: () => void;
}) {
  // Static, solid card — no opacity pulse (that read as "unstable/random").
  // A clickable Augur target keeps a steady highlight instead of flickering.
  const cls =
    "aspect-[5/4] w-full rounded-xl border-2 flex items-center justify-center " +
    (clickable
      ? "border-violet-400/60 bg-violet-500/25 cursor-pointer hover:bg-violet-500/35 ring-2 ring-violet-400/40"
      : "border-dashed border-hairline bg-surface-2");
  const inner = (
    <div className={cls}>
      <span className={"text-3xl sm:text-4xl font-black " + (clickable ? "text-violet-300" : "text-zinc-600")}>
        {clickable ? "👁️" : "?"}
      </span>
    </div>
  );
  if (clickable) return <button onClick={onClick} className="w-full">{inner}</button>;
  return inner;
}

function FaceUpOppCard({ move, verdict, revealed, preReveal }: {
  move: Move; verdict: "win" | "loss" | "draw" | null; revealed: boolean; preReveal: boolean;
}) {
  const ring =
    verdict === "win"  ? "ring-emerald-400/60" :
    verdict === "loss" ? "ring-rose-400/50"    :
    verdict === "draw" ? "ring-zinc-500/30"    :
    "ring-violet-400/70";
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7, rotateY: 90 }}
      animate={revealed ? { opacity: 1, scale: 1, rotateY: 0 } : { opacity: 0.3, scale: 0.85, rotateY: 90 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      className={"aspect-[5/4] w-full rounded-xl ring-2 flex items-center justify-center " + ring + " " + (preReveal ? "bg-violet-500/20" : "bg-surface-2")}
      style={{ transformPerspective: 800 }}
    >
      <Hand move={move} size="md" emphasis={verdict === "win" ? "winner" : verdict === "loss" ? "loser" : "default"} />
    </motion.div>
  );
}

function LaneSlot({ index, pick, favoured, verdict, cardHere, onClick, disabled }: {
  index: number; pick: Move | null; favoured: boolean;
  verdict: "win" | "loss" | "draw" | null; cardHere: PlayedCard | null;
  onClick: () => void; disabled: boolean;
}) {
  const t = useT();
  const identity = LANE_IDENTITIES[index];
  const idKey = IDENTITY_KEYS[index];
  const title = t(`${idKey}.title`);
  const accent = identity.accent;
  const ringIdle = accent === "amber" ? "ring-amber-400/30" : accent === "sky" ? "ring-sky-400/30" : "ring-emerald-400/30";
  const ringFav = accent === "amber" ? "ring-amber-400/80" : accent === "sky" ? "ring-sky-400/80" : "ring-emerald-400/80";
  const accentText = accent === "amber" ? "text-amber-300" : accent === "sky" ? "text-sky-300" : "text-emerald-300";
  const verdictRing =
    verdict === "win" ? "ring-emerald-400/70" : verdict === "loss" ? "ring-rose-400/60" : verdict === "draw" ? "ring-zinc-500/40" : null;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={"flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold " + accentText}>
        <span>{identity.glyph}</span>
        <span>{title}</span>
      </div>
      {/* Permanent hint: the moves this lane favours. Win the lane with one of
          them → +1 bonus. Shown as small glyphs so the rule is readable at a
          glance, no memorising needed. */}
      <div className="flex items-center gap-0.5 -mt-0.5 mb-0.5 opacity-60" aria-hidden title="Coups favorisés ici">
        {identity.favours.map((mv) => (
          <MoveGlyph key={mv} move={mv} className="w-3 h-3" />
        ))}
      </div>
      <button
        onClick={onClick}
        disabled={disabled}
        className={
          "aspect-[5/4] w-full rounded-xl border-2 transition flex items-center justify-center relative ring-2 " +
          (verdictRing ?? (favoured ? ringFav : ringIdle)) + " " +
          (pick ? "border-emerald-400/50 bg-emerald-600/25" : "border-dashed border-hairline bg-surface-2")
        }
      >
        {pick ? (
          <Hand move={pick} size="md" emphasis={verdict === "win" ? "winner" : verdict === "loss" ? "loser" : "default"} />
        ) : (
          <span className="text-3xl sm:text-4xl text-zinc-700 font-black">?</span>
        )}
        {cardHere && <CardSlot id={cardHere.id} position="br" />}
        {favoured && pick && !verdictRing && (
          <span className={
            "absolute -top-1.5 -right-1.5 px-1 py-0.5 rounded-full text-[8px] font-black text-zinc-900 shadow " +
            (accent === "amber" ? "bg-amber-300" : accent === "sky" ? "bg-sky-300" : "bg-emerald-300")
          }>✨</span>
        )}
      </button>
    </div>
  );
}
