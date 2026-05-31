/**
 * RankedMatchView — top-level match UI orchestrator.
 *
 * Picks/cards/mana state lives in `RankedGame`; this view receives it as
 * props and decides which phase to render (splash → picking → reveal-intro
 * → reveal → match-end). Thin assembler — pick/reveal heavy lifting is in
 * `RankedPickPhase` and `RankedRevealPhase`.
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { Move } from "../game";
import type { LaneResult, PlayerSlot } from "../online";
import { useT } from "../i18n";
import {
  MatchScoreBar,
  CinematicMatchEnd,
  FloatingMatchBackButton,
  useAndroidBackPrompt,
  type MatchBackHandle,
} from "../sharedMatchUI";
import { RankedPickPhase } from "./RankedPickPhase";
import { RankedRevealPhase } from "./RankedRevealPhase";
import type {
  CardId,
  LaneTarget,
  PlayedCard,
  RoundBonusBreakdown,
} from "./rankedTypes";

/* ──────────── Public surface ──────────── */

export interface RankedMatchInfo {
  matchId: string;
  opponent: string;
  youAre: PlayerSlot;
  lanes: number;
  winTo: number;
}

export interface RankedRoundData {
  no: number;
  deadlineMs: number;
  startedAt: number;
}

export interface RankedRoundResultData {
  yourPicks: [Move, Move, Move];
  oppPicks: [Move, Move, Move];
  myCard: PlayedCard | null;
  oppCard: PlayedCard | null;
  augurRevealed: { lane: LaneTarget; move: Move } | null;
  laneResults: LaneResult[];
  bonuses: RoundBonusBreakdown;
  roundWinner: "a" | "b" | "draw";
  yourTotal: number;
  oppTotal: number;
  roundWinsYou: number;
  roundWinsOpp: number;
}

export interface RankedEndData {
  winner: PlayerSlot | null;
  roundWinsYou: number;
  roundWinsOpp: number;
  forfeit: boolean;
}

export interface RankedMatchViewProps {
  nickname: string;
  match: RankedMatchInfo;
  round: RankedRoundData | null;
  lastResult: RankedRoundResultData | null;
  end: RankedEndData | null;
  // Round-time state
  picks: [Move | null, Move | null, Move | null];
  cardPlayed: PlayedCard | null;
  augurRevealed: { lane: LaneTarget; move: Move } | null;
  mana: number;
  hand: CardId[];
  oppHandSize: number;
  // Actions
  onPickMove: (mv: Move) => void;
  onClearLane: (lane: LaneTarget) => void;
  onPlayCard: (card: PlayedCard) => void;
  onCancelCard: () => void;
  onLock: () => void;
  revealAugurFor: (lane: LaneTarget) => Move;
  /** Persistent round-win counts — never resets between rounds. */
  roundWinsYou: number;
  roundWinsOpp: number;
  /** Rounds remaining before Augur/Oracle can be played. 0 = available. */
  augurCooldown: number;
  onLeave?: () => void;
  onRematch?: () => void;
  /** Tournament flow: "Suivant" button after match end. */
  onNext?: () => void;
}

type Phase = "matched" | "picking" | "reveal-intro" | "reveal" | "match-end";

export function RankedMatchView({
  nickname, match,
  round, lastResult, end,
  picks, cardPlayed, augurRevealed, mana, hand, oppHandSize,
  roundWinsYou, roundWinsOpp, augurCooldown,
  onPickMove, onClearLane, onPlayCard, onCancelCard, onLock,
  revealAugurFor, onLeave, onRematch, onNext,
}: RankedMatchViewProps) {
  const t = useT();
  const phase: Phase = (() => {
    if (end) return "match-end";
    if (lastResult && !round) return "reveal";
    if (round) return "picking";
    return "matched";
  })();

  // Splash visible 2.5s after mount.
  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => {
    const id = window.setTimeout(() => setShowSplash(false), 2500);
    return () => window.clearTimeout(id);
  }, [match.matchId]);

  // Reveal-intro suspense countdown.
  const [revealReady, setRevealReady] = useState(false);
  useEffect(() => {
    if (!lastResult) {
      setRevealReady(false);
      return;
    }
    setRevealReady(false);
    const id = window.setTimeout(() => setRevealReady(true), 1400);
    return () => window.clearTimeout(id);
  }, [lastResult]);

  const youWins = roundWinsYou;
  const oppWins = roundWinsOpp;

  return (
    <div className="relative flex flex-col gap-2 sm:gap-3 flex-1 min-h-0 overflow-hidden">
      {onLeave && (
        <RankedBackGuard onLeave={onLeave} label={t("lanes.forfeitMatch")} />
      )}

      <AnimatePresence>
        {showSplash && (
          <MatchFoundSplash
            you={nickname}
            opp={match.opponent}
          />
        )}
      </AnimatePresence>

      <MatchScoreBar
        youName={nickname}
        oppName={match.opponent || "—"}
        youScore={youWins}
        oppScore={oppWins}
        youTag={t("lanes.you")}
        oppTag={t("lanes.opponent")}
        caption={t("lanes.scoreCaption", { round: round?.no ?? 1, target: match.winTo })}
      />

      <div className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden">
        {phase === "matched" && !showSplash && (
          <div className="text-sm text-zinc-400">{t("lanes.preparingFirstRound")}</div>
        )}

        {phase === "picking" && round && (
          <RankedPickPhase
            youName={nickname}
            opponentName={match.opponent}
            picks={picks}
            augurRevealed={augurRevealed}
            cardPlayed={cardPlayed}
            mana={mana}
            hand={hand}
            oppHandSize={oppHandSize}
            augurCooldown={augurCooldown}
            startedAt={round.startedAt}
            deadlineMs={round.deadlineMs}
            onPickMove={onPickMove}
            onClearLane={onClearLane}
            onPlayCard={onPlayCard}
            onCancelCard={onCancelCard}
            onLock={onLock}
            revealAugurFor={revealAugurFor}
          />
        )}

        {phase === "reveal" && lastResult && !revealReady && <RevealCountdown />}
        {phase === "reveal" && lastResult && revealReady && (
          <RankedRevealPhase
            youName={nickname}
            opponentName={match.opponent}
            yourPicks={lastResult.yourPicks}
            oppPicks={lastResult.oppPicks}
            myCard={lastResult.myCard}
            oppCard={lastResult.oppCard}
            augurRevealed={lastResult.augurRevealed}
            laneResults={lastResult.laneResults}
            bonuses={lastResult.bonuses}
            roundWinner={lastResult.roundWinner}
            yourTotal={lastResult.yourTotal}
            oppTotal={lastResult.oppTotal}
            oppHandSize={oppHandSize}
          />
        )}

        {phase === "match-end" && end && (
          <CinematicMatchEnd
            outcome={
              end.roundWinsYou > end.roundWinsOpp ? "win" :
              end.roundWinsYou < end.roundWinsOpp ? "loss" : "draw"
            }
            forfeit={end.forfeit}
            scoreLine={`${end.roundWinsYou} — ${end.roundWinsOpp}`}
            onRematch={onNext ? undefined : onRematch}
            onBack={onNext ? onNext : onLeave!}
            backLabel={onNext ? "Suivant →" : undefined}
          />
        )}
      </div>
    </div>
  );
}

/* ──────────── Sub-pieces ──────────── */

/** Wraps FloatingMatchBackButton so the Android system back button (which
 *  would otherwise blow past every confirm) routes to the same modal as the
 *  visible back arrow. */
function RankedBackGuard({ onLeave, label }: { onLeave: () => void; label: string }) {
  const handleRef = useRef<MatchBackHandle | null>(null);
  useAndroidBackPrompt(() => handleRef.current?.triggerConfirm());
  return (
    <FloatingMatchBackButton
      ref={handleRef}
      onClick={onLeave}
      label={label}
      confirm={{
        title: "Quitter le match ?",
        body: "Tu vas perdre la manche en cours. Ce sera compté comme défaite et appliquera la pénalité de LP si applicable.",
        confirmLabel: "Forfait",
        cancelLabel: "Continuer",
        severity: "danger",
      }}
    />
  );
}

function MatchFoundSplash({ you, opp }: { you: string; opp: string }) {
  const t = useT();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md"
    >
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-xs tracking-[0.5em] text-fuchsia-300/80 uppercase mb-3 text-center px-4"
      >
        {t("ranked.match.foundKicker")}
      </motion.div>
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.15, type: "spring", stiffness: 220, damping: 12 }}
        className="flex items-center gap-6 sm:gap-10"
      >
        <NameTag name={you} accent="emerald" align="right" />
        <motion.div
          animate={{ rotate: [0, -8, 8, -4, 4, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 0.9, delay: 0.4 }}
          className="text-5xl sm:text-7xl font-black bg-gradient-to-br from-fuchsia-300 to-rose-400 bg-clip-text text-transparent"
        >
          VS
        </motion.div>
        <NameTag name={opp} accent="rose" align="left" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="mt-8 text-sm uppercase tracking-[0.3em] text-zinc-400 text-center px-4"
      >
        Best of 5 · Mana & Cartes
      </motion.div>
    </motion.div>
  );
}

function NameTag({
  name, accent, align,
}: { name: string; accent: "emerald" | "rose"; align: "left" | "right" }) {
  const t = useT();
  const grad = accent === "emerald"
    ? "from-emerald-300 to-teal-400"
    : "from-rose-300 to-fuchsia-400";
  return (
    <div className={"flex flex-col " + (align === "right" ? "items-end" : "items-start")}>
      <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
        {accent === "emerald" ? t("lanes.you") : t("lanes.opponent")}
      </div>
      <div className={
        "mt-1 text-xl sm:text-3xl font-black truncate max-w-[32vw] sm:max-w-[28vw] bg-gradient-to-r " +
        grad + " bg-clip-text text-transparent"
      }>
        {name || "Anonymous"}
      </div>
    </div>
  );
}

function RevealCountdown() {
  const t = useT();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center gap-3 px-4 text-center"
    >
      <div className="text-[10px] uppercase tracking-[0.4em] text-zinc-500">{t("lanes.reveal")}</div>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xl sm:text-3xl font-black leading-tight">
        {[t("online.reveal.rock"), t("online.reveal.paper"), t("online.reveal.scissors")].map((w, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.18 }}
            className="bg-gradient-to-br from-zinc-100 to-zinc-400 bg-clip-text text-transparent"
          >
            {w}
          </motion.span>
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: [0.7, 1.3, 1] }}
        transition={{ delay: 0.78, duration: 0.4 }}
        className="text-3xl sm:text-5xl font-black bg-gradient-to-br from-amber-300 to-rose-400 bg-clip-text text-transparent"
      >
        {t("lanes.shoot")}
      </motion.div>
    </motion.div>
  );
}
