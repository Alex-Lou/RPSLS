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
import type { Move } from "../engine/game";
import type { LaneResult, PlayerSlot } from "../online/online";
import { useT } from "../i18n";
import {
  MatchScoreBar,
  CinematicMatchEnd,
  FloatingMatchBackButton,
  useAndroidBackPrompt,
  ScaleToFit,
  type MatchBackHandle,
} from "../match/sharedMatchUI";
import { LoadingTip } from "../flavor/LoadingTip";
import { RankedPickPhase } from "./RankedPickPhase";
import { RankedRevealPhase } from "./RankedRevealPhase";
import { CARDS } from "./cards";
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
  /** XP awarded for this match — shown as an animated reward on the end screen. */
  xpGained?: number;
  /** Boutique éclats granted on this match end — same logic as LanesEndData. */
  eclatsGained?: number;
  /** Every card the player played during the match — fed into a "Cartes
   *  utilisées" recap below the cinematic so the player gradually learns
   *  the cards by reading them in context, no rulebook open. */
  youCardsPlayed?: CardId[];
  /** Same on the opponent side — visible to the player so they understand
   *  what was thrown at them and can plan a counter next time. */
  oppCardsPlayed?: CardId[];
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
  /** Show the pick countdown. Ranked vs CPU passes false (no time pressure,
   *  no move auto-played for you). */
  showTimer?: boolean;
}

type Phase = "matched" | "picking" | "reveal-intro" | "reveal" | "match-end";

export function RankedMatchView({
  nickname, match,
  round, lastResult, end,
  picks, cardPlayed, augurRevealed, mana, hand, oppHandSize,
  roundWinsYou, roundWinsOpp, augurCooldown,
  onPickMove, onClearLane, onPlayCard, onCancelCard, onLock,
  revealAugurFor, onLeave, onRematch, onNext, showTimer = true,
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

      {/* ScaleToFit guarantees the whole phase (board + cards + picker + LOCK)
          always fits the available height — the player NEVER scrolls to reach
          the Lock button; it shrinks uniformly on short screens instead. */}
      <ScaleToFit className="relative">
        <div className="w-full flex flex-col items-center py-1">
        {phase === "matched" && !showSplash && (
          <div className="flex flex-col items-center gap-3 max-w-sm px-4">
            <div className="text-sm text-ink-muted">{t("lanes.preparingFirstRound")}</div>
            <LoadingTip category="strategy" rotateMs={4000} className="justify-center text-center" />
          </div>
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
            showTimer={showTimer}
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
          <>
            <CinematicMatchEnd
              outcome={
                end.roundWinsYou > end.roundWinsOpp ? "win" :
                end.roundWinsYou < end.roundWinsOpp ? "loss" : "draw"
              }
              forfeit={end.forfeit}
              forfeitByYou={end.forfeit && end.winner === "b"}
              scoreLine={`${end.roundWinsYou} — ${end.roundWinsOpp}`}
              youScore={end.roundWinsYou}
              oppScore={end.roundWinsOpp}
              bestOf={match.winTo * 2 - 1}
              onRematch={onNext ? undefined : onRematch}
              onBack={onNext ? onNext : onLeave!}
              backLabel={onNext ? "Suivant →" : undefined}
              reward={{ xp: end.xpGained, eclats: end.eclatsGained }}
            />
            <MatchCardsRecap
              youCards={end.youCardsPlayed ?? []}
              oppCards={end.oppCardsPlayed ?? []}
            />
          </>
        )}
        </div>
      </ScaleToFit>
    </div>
  );
}

/* ──────────── End-of-match cards recap ──────────── */

/**
 * MatchCardsRecap — small "Cartes utilisées" block under the cinematic.
 *
 * Lists the unique cards each side actually played during the match, with
 * their name and short description. Stays inside the same panel so the
 * screen never overflows: the player learns by reading the cards in
 * context instead of opening a rulebook.
 */
function MatchCardsRecap({ youCards, oppCards }: { youCards: CardId[]; oppCards: CardId[] }) {
  const t = useT();
  const youUnique = unique(youCards);
  const oppUnique = unique(oppCards);
  if (youUnique.length === 0 && oppUnique.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.4, duration: 0.35 }}
      className="mt-3 w-full max-w-md mx-auto rounded-2xl bg-surface border border-hairline p-3"
    >
      <div className="text-[10px] uppercase tracking-[0.25em] font-bold text-ink-faint text-center mb-2">
        Cartes utilisées
      </div>
      <div className="grid grid-cols-2 gap-3">
        <CardsColumn label="Toi" cards={youUnique} tone="emerald" t={t} />
        <CardsColumn label="Adv." cards={oppUnique} tone="rose" t={t} />
      </div>
    </motion.div>
  );
}

function CardsColumn({
  label, cards, tone, t,
}: {
  label: string;
  cards: CardId[];
  tone: "emerald" | "rose";
  t: (k: string) => string;
}) {
  const ring = tone === "emerald" ? "ring-emerald-400/30" : "ring-rose-400/30";
  const head = tone === "emerald" ? "text-emerald-300" : "text-rose-300";
  return (
    <div>
      <div className={"text-[10px] uppercase tracking-wider font-bold mb-1 " + head}>{label}</div>
      {cards.length === 0 ? (
        <p className="text-[11px] text-ink-faint italic">Aucune carte jouée</p>
      ) : (
        <div className="flex flex-col gap-1">
          {cards.map((id) => {
            const c = CARDS[id];
            return (
              <div key={id} className={"rounded-lg p-2 bg-hairline ring-1 " + ring}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-base">{c.glyph}</span>
                  <span className="text-[11px] font-bold text-ink">{t(c.nameKey)}</span>
                </div>
                <p className="text-[10px] text-ink-muted leading-snug">{t(c.descKey)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Dedupe while keeping first-seen order. */
function unique<T>(arr: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const x of arr) {
    if (!seen.has(x)) { seen.add(x); out.push(x); }
  }
  return out;
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
        className="mt-8 text-sm uppercase tracking-[0.3em] text-ink-muted text-center px-4"
      >
        Best of 5 · Mana & Cartes
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.4 }}
        className="mt-6 max-w-sm px-4"
      >
        <LoadingTip category="strategy" rotateMs={0} className="justify-center text-center" />
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
      <div className="text-[10px] uppercase tracking-[0.3em] text-ink-faint">
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
      <div className="text-[10px] uppercase tracking-[0.4em] text-ink-faint">{t("lanes.reveal")}</div>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xl sm:text-3xl font-black leading-tight">
        {[t("online.reveal.rock"), t("online.reveal.paper"), t("online.reveal.scissors"), t("online.reveal.lizard"), t("online.reveal.spock")].map((w, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 + i * 0.13 }}
            className="bg-gradient-to-br from-zinc-100 to-zinc-400 bg-clip-text text-transparent"
          >
            {w}
          </motion.span>
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: [0.7, 1.3, 1] }}
        transition={{ delay: 0.9, duration: 0.4 }}
        className="text-3xl sm:text-5xl font-black bg-gradient-to-br from-amber-300 to-rose-400 bg-clip-text text-transparent"
      >
        {t("lanes.shoot")}
      </motion.div>
    </motion.div>
  );
}
