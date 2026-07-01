/**
 * LanesBoard — the 3-lane board for ranked matches.
 * Supports onOppLaneClick for Augur targeting on the opponent row.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Hand, MoveGlyph } from "../icons";
import type { Move } from "../engine/game";
import type { LaneResult } from "../online/online";
import { laneIdentityAt, laneFavoursMove } from "../engine/lanesCombos";
import { CardSlot } from "./CardSlot";
import { BigCardReveal } from "./BigCardReveal";
import { OppHandIndicator } from "./OppHandIndicator";
import { useArenaPad } from "./arena";
import type { CardId, LaneTarget, PlayedCard } from "./rankedTypes";
import { useT } from "../i18n";
import { useStore } from "../store/store";
import { BattlePad } from "../BattlePad";

const IDENTITY_KEYS = [
  "lanes.identity.force",
  "lanes.identity.wisdom",
  "lanes.identity.cunning",
];

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

function OpponentRow({
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

function PlayerRow({
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

function FaceDownCard({ index: _index, pulsing: _pulsing, clickable = false, onClick, compassMarked = false, twilightMarked = false }: {
  index: number; pulsing: boolean; clickable?: boolean; onClick?: () => void;
  /** Boussole peek: opponent's card targets THIS lane → tint the placeholder
   *  cyan so the player's eye lands here before reading the ghost-card badge. */
  compassMarked?: boolean;
  /** Crépuscule: this lane is card-immune this round → amber tint reads "no
   *  card effects apply here, pure RPSLS". */
  twilightMarked?: boolean;
}) {
  // Static, solid card — no opacity pulse (that read as "unstable/random").
  // A clickable Augur target keeps a steady highlight instead of flickering.
  // Compass-marked lane gets a cyan tint that reads as "incoming danger".
  // Twilight gets an amber tint that reads as "sealed / immune".
  const cls =
    "aspect-square w-full rounded-xl border-2 flex items-center justify-center transition " +
    (clickable
      ? "border-violet-400/60 bg-violet-500/25 cursor-pointer hover:bg-violet-500/35 ring-2 ring-violet-400/40"
      : twilightMarked
      ? "border-amber-400/70 bg-amber-500/15 ring-2 ring-amber-300/40"
      : compassMarked
      ? "border-cyan-400/70 bg-cyan-500/20 ring-2 ring-cyan-300/50"
      : "border-dashed border-hairline bg-surface-2");
  const inner = (
    <div className={cls}>
      <span className={
        "text-3xl sm:text-4xl font-black " +
        (clickable ? "text-violet-300"
          : twilightMarked ? "text-amber-200/80"
          : compassMarked ? "text-cyan-200/80"
          : "text-zinc-600")
      }>
        {clickable ? "👁️" : "?"}
      </span>
    </div>
  );
  if (clickable) return <button onClick={onClick} className="w-full">{inner}</button>;
  return inner;
}

/** Crépuscule badge — small amber sun-sigil in the corner of the sealed lane.
 *  Pulses softly so the player feels the lane is "alive but neutral". */
function TwilightBadge() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      className="absolute -top-1 -left-1 z-20 pointer-events-none"
      aria-hidden
    >
      <motion.div
        initial={{ opacity: 0.3 }}
        animate={{ opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 rounded-md bg-amber-400/45 blur-md"
      />
      <div className="relative w-6 h-6 rounded-md bg-gradient-to-br from-amber-400/85 to-orange-700/85 border border-amber-300/70 shadow-lg shadow-amber-900/50 flex items-center justify-center">
        <span className="text-[12px] leading-none">🌅</span>
      </div>
    </motion.div>
  );
}

/** Boussole ghost card — a small cyan card silhouette in the top-right corner
 *  of the targeted opp lane. The compass icon + pulsing ring tell the player
 *  "an unknown card will hit THIS lane — react now (anchor/aegis/twilight)". */
function CompassGhostCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.7 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="absolute -top-1 -right-1 z-20 pointer-events-none"
      aria-hidden
    >
      {/* Pulsing aura behind the ghost card so it reads as "live, incoming". */}
      <motion.div
        initial={{ opacity: 0.3, scale: 0.9 }}
        animate={{ opacity: [0.3, 0.7, 0.3], scale: [0.9, 1.25, 0.9] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 rounded-md bg-cyan-400/45 blur-md"
      />
      <div className="relative w-7 h-9 sm:w-8 sm:h-10 rounded-md bg-gradient-to-br from-cyan-500/80 to-sky-700/80 border border-cyan-300/70 shadow-lg shadow-cyan-900/50 flex flex-col items-center justify-center gap-0.5">
        <span className="text-sm leading-none">🧭</span>
        <span className="text-[8px] sm:text-[9px] font-black leading-none text-white/95">?</span>
      </div>
    </motion.div>
  );
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
      className={"aspect-square w-full rounded-xl ring-2 flex items-center justify-center " + ring + " " + (preReveal ? "bg-violet-500/20" : "bg-surface-2")}
      style={{ transformPerspective: 800 }}
    >
      <Hand move={move} size="md" emphasis={verdict === "win" ? "winner" : verdict === "loss" ? "loser" : "default"} />
    </motion.div>
  );
}

function LaneSlot({ index, pick, favoured, verdict, cardHere, twilightMarked = false, onClick, disabled, targeting = false }: {
  index: number; pick: Move | null; favoured: boolean;
  verdict: "win" | "loss" | "draw" | null; cardHere: PlayedCard | null;
  /** Crépuscule: amber tint on this lane on the player's row. */
  twilightMarked?: boolean;
  onClick: () => void; disabled: boolean;
  /** Carte-lane sélectionnée → cette case peut l'accueillir : surlignage thème. */
  targeting?: boolean;
}) {
  const t = useT();
  const identity = laneIdentityAt(index);
  const idKey = IDENTITY_KEYS[index];
  const title = t(`${idKey}.title`);
  const accent = identity.accent;
  const ringIdle = accent === "amber" ? "ring-amber-400/30" : accent === "sky" ? "ring-sky-400/30" : "ring-emerald-400/30";
  const ringFav = accent === "amber" ? "ring-amber-400/80" : accent === "sky" ? "ring-sky-400/80" : "ring-emerald-400/80";
  const accentText = accent === "amber" ? "text-amber-300" : accent === "sky" ? "text-sky-300" : "text-emerald-300";
  const verdictRing =
    verdict === "win" ? "ring-emerald-400/70" : verdict === "loss" ? "ring-rose-400/60" : verdict === "draw" ? "ring-zinc-500/40" : null;
  // Twilight overrides identity rings — the amber tint reads "card-immune zone".
  const twilightRing = twilightMarked ? "ring-amber-400/80" : null;
  const twilightSurface = twilightMarked ? "border-amber-400/60 bg-amber-500/15" : null;

  return (
    <div className={"flex flex-col items-center gap-1 " + (twilightMarked ? "relative" : "")}>
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
          "aspect-square w-full rounded-xl border-2 transition flex items-center justify-center relative ring-2 " +
          (targeting
            ? "cursor-pointer border-transparent ring-transparent"
            : (verdictRing ?? twilightRing ?? (favoured ? ringFav : ringIdle)) + " " +
              (pick
                ? (twilightSurface ?? "border-emerald-400/50 bg-emerald-600/25")
                : (twilightSurface ?? "border-dashed border-hairline bg-surface-2")))
        }
        // Surlignage THÈME (Alex 2026-07) : case pouvant accueillir la carte-lane
        // sélectionnée. L'inline boxShadow remplace l'anneau Tailwind → glow thémé.
        style={targeting ? {
          borderColor: "color-mix(in oklab, var(--theme-primary) 75%, transparent)",
          background: "color-mix(in oklab, var(--theme-primary) 18%, rgba(10,12,20,0.5))",
          boxShadow: "0 0 0 2px color-mix(in oklab, var(--theme-primary) 60%, transparent), 0 0 20px -5px var(--theme-primary)",
        } : undefined}
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
        {twilightMarked && <TwilightBadge />}
      </button>
    </div>
  );
}

// BigCardReveal moved to its own file (ranked/BigCardReveal.tsx) so the
// Arena (Constellation Pro) can import and reuse the same animation.
