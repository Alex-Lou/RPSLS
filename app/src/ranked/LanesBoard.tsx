/**
 * LanesBoard — the 3-lane board for ranked matches.
 * Supports onOppLaneClick for Augur targeting on the opponent row.
 */

import { AnimatePresence } from "motion/react";
import type { Move } from "../engine/game";
import type { LaneResult } from "../online/online";
import { BigCardReveal } from "./BigCardReveal";
import { OppHandIndicator } from "./OppHandIndicator";
import { useArenaPad } from "./arena";
import type { CardId, LaneTarget, PlayedCard } from "./rankedTypes";
import { useStore } from "../store/store";
import { BattlePad } from "../BattlePad";
import { useGfxAllows } from "../graphics/graphicsQuality";
import { OpponentRow, PlayerRow } from "./LanesBoardRows";

/** Crépuscule resolver — returns the lane sealed in twilight by either side
 *  this round (or null if no Crépuscule was played). When BOTH sides play it,
 *  the player's side wins the visual (rare double, doesn't matter mechanically
 *  because every other card on either lane is no-op'd anyway). */
function twilightFor(myCard: PlayedCard | null, oppCard: PlayedCard | null): LaneTarget | null {
  if (myCard?.id === "crepuscule") return (myCard as { lane: LaneTarget }).lane;
  if (oppCard?.id === "crepuscule") return (oppCard as { lane: LaneTarget }).lane;
  return null;
}

export interface LanesBoardProps {
  youName: string;
  opponentName: string;
  picks: [Move | null, Move | null, Move | null];
  oppPicks: [Move, Move, Move] | null;
  augurRevealed: { lane: LaneTarget; move: Move } | null;
  /** Oracle (3m epic) / Télépathie (3m epic V3): the opponent's 3 moves are
   *  revealed to the player face-up during the pick phase. Lane-by-lane. */
  oracleRevealed?: [Move, Move, Move] | null;
  myCard: PlayedCard | null;
  oppCard: PlayedCard | null;
  mode: "picking" | "locked" | "reveal";
  laneResults?: LaneResult[];
  /** Visible opponent hand count (face-down minicards above the opp row). */
  oppHandSize?: number;
  /** Boussole peek: which lane the opponent's card targets this round, or
   *  null if the opponent's card has no lane target (or no card played).
   *  When present, the targeted opp lane gets a cyan ghost-card badge so the
   *  player SEES where the incoming card will land and can react (anchor,
   *  aegis, crepuscule, etc.). Picking phase only — reveal already shows it.
   *  `cardId` is the opp card's identity for the chip; not used in board. */
  compassPeek?: { lane: LaneTarget | null; cardId?: CardId } | null;
  onLaneClick?: (lane: LaneTarget) => void;
  onOppLaneClick?: (lane: LaneTarget) => void;
  augurTargeting?: boolean;
  /** Une carte à cibler sur TES lanes est sélectionnée → surligne les 3 cases
   *  joueur dans la couleur du thème (Alex 2026-07). Pick phase uniquement. */
  myLaneTargeting?: boolean;
  /** When provided (the pick phase wraps the board in BoardFillSlot), the board
   *  pins itself to this measured px height and centres its content — a fixed
   *  frame like Constellation Pro, so chips appearing/disappearing below no
   *  longer make the layout rescale. Omitted (reveal phase, default) → natural
   *  height, identical to before. */
  fillHeight?: number;
}

export function LanesBoard({
  youName, opponentName,
  picks, oppPicks, augurRevealed, oracleRevealed,
  myCard, oppCard, mode, laneResults, oppHandSize, compassPeek,
  onLaneClick, onOppLaneClick, augurTargeting = false, myLaneTargeting = false, fillHeight,
}: LanesBoardProps) {
  // The pad is the player's own — unless a coin-flipped arena overrides it
  // for this duel (see ranked/arena.tsx).
  const padId = useArenaPad(useStore((s) => s.player.padId));
  // Fond de plateau animé seulement en qualité Haute (chauffe en longue partie).
  const padAnim = useGfxAllows("padAnim");
  return (
    <div
      className={
        "relative shrink-0 w-full max-w-2xl rounded-2xl overflow-hidden " +
        "border border-emerald-900/40 " +
        "shadow-[inset_0_0_36px_rgba(0,0,0,0.55)] " +
        "[@media(max-height:560px)]:max-w-md" +
        (fillHeight ? " flex flex-col justify-center" : "")
      }
      style={fillHeight ? { minHeight: fillHeight } : undefined}
    >
      {/* Battle-pad backdrop — the user-chosen pad IS the visible surface the
          lanes sit on. Fully opaque so the chosen theme actually shows. */}
      <div className="absolute inset-0 pointer-events-none">
        <BattlePad padId={padId} className="w-full h-full" compact frozen={!padAnim} />
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

      {/* Broadcast the cards over the board during the reveal so the player
          actually SEES what was thrown — the mini badge on the lane is too
          small for a learning moment. Opp side has more weight (you need to
          read it to counter), you side gets a smaller mirror. */}
      <AnimatePresence>
        {mode === "reveal" && oppCard && (
          <BigCardReveal key={"opp-" + oppCard.id} id={oppCard.id} side="opp" />
        )}
        {mode === "reveal" && myCard && (
          <BigCardReveal key={"you-" + myCard.id} id={myCard.id} side="you" />
        )}
      </AnimatePresence>

      <div className="relative p-1.5 sm:p-2 flex flex-col gap-1.5 sm:gap-2 [@media(max-height:560px)]:p-1 [@media(max-height:560px)]:gap-1">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <div className="min-w-0 flex-1 text-[10px] uppercase tracking-[0.25em] font-bold text-rose-300/90 truncate">
          ✦ {opponentName}
        </div>
        {oppHandSize !== undefined && (
          <div className="shrink-0"><OppHandIndicator size={oppHandSize} /></div>
        )}
      </div>
      {/* Crépuscule (Twilight): lane index that's been sealed card-immune by
          either side this round. Threaded into both rows for a consistent
          amber tint — "this lane is pure RPSLS, no cards apply". */}
      {(() => null)()}
      <OpponentRow
        oppPicks={oppPicks}
        oppCard={oppCard}
        augurRevealed={augurRevealed}
        oracleRevealed={oracleRevealed}
        mode={mode}
        laneResults={laneResults}
        compassPeek={compassPeek}
        twilightLane={twilightFor(myCard, oppCard)}
        onOppLaneClick={onOppLaneClick}
        augurTargeting={augurTargeting}
      />

      <div className="h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />

      <PlayerRow
        picks={picks}
        myCard={myCard}
        mode={mode}
        laneResults={laneResults}
        twilightLane={twilightFor(myCard, oppCard)}
        onLaneClick={onLaneClick}
        targeting={myLaneTargeting}
      />
      <div className="text-[10px] uppercase tracking-[0.25em] font-bold text-emerald-300/90 truncate px-0.5">
        ✦ {youName}
      </div>
      </div>
    </div>
  );
}
