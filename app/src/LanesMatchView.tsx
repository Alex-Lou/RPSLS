/**
 * Constellation Lanes match view — Phase 1.
 *
 * Drives the 3-lane match flow once the server has accepted us into a
 * lanes match. Reads server messages from a callback, sends client
 * messages via a sender prop, and renders the full pick → reveal →
 * verdict → match-end cycle.
 *
 * Designed to slot into OnlinePage when the user picks the "Lanes" mode,
 * leaving the classic 1v1 flow completely untouched.
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Hand, MOVE_ICON, MOVE_PALETTE } from "./icons";
import { MOVES, type Move } from "./game";
import { hapticAlert, hapticTap } from "./haptic";
import type { LanePlay, LaneResult, PlayerSlot } from "./online";
import {
  detectOutcomeCombo,
  detectPlayerCombo,
  LANE_IDENTITIES,
  laneFavoursMove,
  type ComboTheme,
} from "./lanesCombos";

/* ──────────── Types (re-exported for the parent) ──────────── */

export interface LanesMatchInfo {
  matchId: string;
  opponent: string;
  youAre: PlayerSlot;
  lanes: number;
  winTo: number;
}

export interface LanesRoundData {
  no: number;
  deadlineMs: number;
  startedAt: number;
}

export interface LanesRoundResultData {
  yourPlays: LanePlay[];
  oppPlays: LanePlay[];
  laneResults: LaneResult[];
  yourPoints: number;
  oppPoints: number;
  roundWinsYou: number;
  roundWinsOpp: number;
}

export interface LanesEndData {
  winner: PlayerSlot | null;
  roundWinsYou: number;
  roundWinsOpp: number;
  forfeit: boolean;
}

/**
 * Internal UI phase derived from the props the parent provides. Kept here so
 * the parent doesn't have to know about reveal countdowns and submit states.
 */
type Phase =
  | "matched"        // splash visible, waiting for first round_start
  | "picking"        // round_start → user can choose lanes
  | "submitted"      // user picks locked, waiting for opponent
  | "reveal_intro"   // 1.4s suspense "Rock-Paper-Scissors-SHOOT"
  | "reveal"         // showing the verdict
  | "match_end";

export interface LanesMatchViewProps {
  /** Player's own nickname for the score header. */
  nickname: string;
  /** Match metadata (provided as soon as lanes_match_found arrives). */
  match: LanesMatchInfo;
  /** Current round details (null between rounds / before the first one). */
  round: LanesRoundData | null;
  /** Most recent resolved round (null until at least one round has finished). */
  lastResult: LanesRoundResultData | null;
  /** Match-end payload (null until the server says it's over). */
  end: LanesEndData | null;
  /** Locked-in marker — the parent stores whether *we* have already submitted
   *  picks for the current round. */
  submitted: boolean;
  /** Called when the user locks their 3 picks. */
  onSubmitPicks: (picks: [Move, Move, Move]) => void;
  /** Forfeit / back to menu. */
  onLeave: () => void;
}

/* ──────────── Main view ──────────── */

export function LanesMatchView({
  nickname,
  match,
  round,
  lastResult,
  end,
  submitted,
  onSubmitPicks,
  onLeave,
}: LanesMatchViewProps) {
  /* The phase is derived from the props — no listener, no race. */
  const phase: Phase = (() => {
    if (end) return "match_end";
    if (lastResult && !round) return "reveal";       // reveal until next round_start
    if (round && submitted) return "submitted";
    if (round) return "picking";
    return "matched";
  })();

  /* Local UI state for the picks the user is currently building. */
  const [picks, setPicks] = useState<(Move | null)[]>([null, null, null]);
  /* Reset picks whenever a new round starts. */
  useEffect(() => {
    if (round) setPicks([null, null, null]);
  }, [round?.no]);

  /* Splash visible for the first 2.5 seconds after mount (we boot in matched). */
  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setShowSplash(false), 2500);
    return () => window.clearTimeout(t);
  }, [match.matchId]);

  /* Render-side reveal countdown — a quick 1.4s suspense when a new
     lastResult lands. Parent re-feeds lastResult fresh; we just gate
     the "reveal" content behind a short timer. */
  const [revealReady, setRevealReady] = useState(false);
  useEffect(() => {
    if (!lastResult) {
      setRevealReady(false);
      return;
    }
    setRevealReady(false);
    const t = window.setTimeout(() => setRevealReady(true), 1400);
    return () => window.clearTimeout(t);
  }, [lastResult]);

  function submitNow() {
    if (picks.some((p) => p === null)) return;
    onSubmitPicks(picks as [Move, Move, Move]);
  }
  function pickInNextEmpty(mv: Move) {
    if (phase !== "picking") return;
    setPicks((cur) => {
      const i = cur.findIndex((p) => p === null);
      if (i === -1) return cur;
      const next = [...cur];
      next[i] = mv;
      return next;
    });
  }
  function clearLane(i: number) {
    if (phase !== "picking") return;
    setPicks((cur) => {
      const next = [...cur];
      next[i] = null;
      return next;
    });
  }

  const target = match.winTo;
  const youWins = lastResult?.roundWinsYou ?? end?.roundWinsYou ?? 0;
  const oppWins = lastResult?.roundWinsOpp ?? end?.roundWinsOpp ?? 0;

  /* ──────────── Render ──────────── */
  return (
    <div className="relative flex flex-col gap-4">
      {/* Splash overlay */}
      <AnimatePresence>
        {showSplash && (
          <MatchFoundSplash
            you={nickname}
            opp={match.opponent}
            lanes={match.lanes}
            winTo={match.winTo}
          />
        )}
      </AnimatePresence>

      {/* Score header */}
      <ScoreHeader
        you={nickname}
        opp={match.opponent}
        youWins={youWins}
        oppWins={oppWins}
        target={target}
        round={round?.no ?? 1}
      />

      {/* Stage */}
      <div className="relative min-h-[300px] sm:min-h-[360px] flex items-center justify-center">
        {phase === "matched" && !showSplash && (
          <div className="text-sm text-zinc-400">Preparing round 1…</div>
        )}
        {phase === "picking" && round && (
          <PickStage
            picks={picks}
            onPick={pickInNextEmpty}
            onClearLane={clearLane}
            startedAt={round.startedAt}
            deadlineMs={round.deadlineMs}
            onSubmit={submitNow}
          />
        )}
        {phase === "submitted" && (
          <LockedStage picks={picks as Move[]} />
        )}
        {phase === "reveal" && lastResult && !revealReady && <RevealCountdown />}
        {phase === "reveal" && lastResult && revealReady && (
          <RevealStage result={lastResult} />
        )}
        {phase === "match_end" && end && (
          <MatchEndScene end={end} onBack={onLeave} />
        )}
      </div>

      {/* Forfeit button — shown anytime but match-end. */}
      {phase !== "match_end" && (
        <button
          onClick={onLeave}
          className="self-center px-4 py-2 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/40 text-zinc-400 hover:text-rose-200 text-xs transition"
        >
          🏳️ Forfeit match
        </button>
      )}
    </div>
  );
}

/* ──────────── Subcomponents ──────────── */

function ScoreHeader({
  you, opp, youWins, oppWins, target, round,
}: {
  you: string; opp: string;
  youWins: number; oppWins: number; target: number; round: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between rounded-2xl bg-black/30 border border-white/10 px-4 py-3">
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">You</span>
          <span className="font-semibold truncate text-emerald-200">{you}</span>
        </div>
        {/* Score: each side rendered through a "rolling number" so the value
            slides in/out instead of stacking. Fixed width prevents the
            colon/border from shifting when digits change. */}
        <div className="text-3xl sm:text-4xl font-black tabular-nums px-3 flex items-center gap-1">
          <RollingNumber value={youWins} color="emerald" />
          <span className="text-zinc-600 px-1">:</span>
          <RollingNumber value={oppWins} color="rose" />
        </div>
        <div className="flex flex-col text-right min-w-0 flex-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Opponent</span>
          <span className="font-semibold truncate text-rose-200">{opp || "—"}</span>
        </div>
      </div>
      <div className="text-center text-[11px] uppercase tracking-[0.25em] text-zinc-500">
        Round {round} · 3 lanes · First to {target} round-wins
      </div>
    </div>
  );
}

function RollingNumber({
  value, color,
}: { value: number; color: "emerald" | "rose" }) {
  const colorCls = color === "emerald" ? "text-emerald-300" : "text-rose-300";
  return (
    <span
      className={
        "relative inline-block min-w-[1.2em] text-center overflow-hidden " + colorCls
      }
      style={{ height: "1.1em", lineHeight: "1.1em" }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: "-100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function MatchFoundSplash({
  you, opp, lanes, winTo,
}: { you: string; opp: string; lanes: number; winTo: number }) {
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
        className="text-xs tracking-[0.5em] text-violet-300/80 uppercase mb-3"
      >
        Constellation · Lanes Match Found
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
          className="text-5xl sm:text-7xl font-black bg-gradient-to-br from-amber-300 to-rose-400 bg-clip-text text-transparent"
        >
          VS
        </motion.div>
        <NameTag name={opp} accent="rose" align="left" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="mt-8 text-sm uppercase tracking-[0.3em] text-zinc-400"
      >
        {lanes} lanes · First to {winTo} rounds
      </motion.div>
    </motion.div>
  );
}

function NameTag({
  name, accent, align,
}: { name: string; accent: "emerald" | "rose"; align: "left" | "right" }) {
  const grad = accent === "emerald" ? "from-emerald-300 to-teal-400" : "from-rose-300 to-fuchsia-400";
  return (
    <div className={"flex flex-col " + (align === "right" ? "items-end" : "items-start")}>
      <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
        {accent === "emerald" ? "You" : "Opponent"}
      </div>
      <div
        className={
          "mt-1 text-xl sm:text-3xl font-black truncate max-w-[32vw] sm:max-w-[28vw] bg-gradient-to-r " +
          grad +
          " bg-clip-text text-transparent"
        }
      >
        {name || "Anonymous"}
      </div>
    </div>
  );
}

function PickStage({
  picks, onPick, onClearLane, startedAt, deadlineMs, onSubmit,
}: {
  picks: (Move | null)[];
  /** Pick `mv` — drops it into the next empty lane. */
  onPick: (mv: Move) => void;
  onClearLane: (lane: number) => void;
  startedAt: number;
  deadlineMs: number;
  onSubmit: () => void;
}) {
  const allFilled = picks.every((p) => p !== null);
  return (
    <div className="w-full flex flex-col items-center gap-5">
      {/* Timer */}
      <TimerBar startedAt={startedAt} durationMs={deadlineMs} />

      {/* 3 lane slots */}
      <div className="grid grid-cols-3 gap-3 sm:gap-5 w-full max-w-2xl">
        {picks.map((mv, i) => (
          <LaneSlot key={i} index={i} pick={mv} onClear={() => onClearLane(i)} />
        ))}
      </div>

      <div className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">
        Tap a move below, then tap a lane to place
      </div>

      {/* Picker — tap a move, then tap a lane. For MVP simplicity we use
          a lane-by-lane focus: clicking a move places it in the next empty lane. */}
      <PickerBar onPickInNextEmpty={onPick} />

      <button
        onClick={onSubmit}
        disabled={!allFilled}
        className={
          "mt-2 px-7 py-3 rounded-2xl font-bold text-white transition " +
          (allFilled
            ? "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-teal-400 shadow-lg shadow-violet-500/30 hover:scale-[1.02]"
            : "bg-white/5 text-zinc-500 cursor-not-allowed")
        }
      >
        {allFilled ? "✓ Lock all 3 picks" : `Pick ${3 - picks.filter(Boolean).length} more`}
      </button>
    </div>
  );
}

function LaneSlot({
  index, pick, onClear,
}: { index: number; pick: Move | null; onClear: () => void }) {
  const identity = LANE_IDENTITIES[index];
  const favoured = pick ? laneFavoursMove(index, pick) : false;
  const accentRing =
    identity.accent === "amber"  ? "ring-amber-400/30"  :
    identity.accent === "sky"    ? "ring-sky-400/30"    :
                                    "ring-emerald-400/30";
  const accentText =
    identity.accent === "amber"  ? "text-amber-300"  :
    identity.accent === "sky"    ? "text-sky-300"    :
                                    "text-emerald-300";
  return (
    <div className="flex flex-col items-center gap-1">
      {/* Lane identity badge — taught to the player by visibility. */}
      <div className={"flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold " + accentText}>
        <span>{identity.glyph}</span>
        <span>{identity.title}</span>
      </div>
      <button
        onClick={onClear}
        disabled={!pick}
        className={
          "aspect-square w-full rounded-2xl border-2 transition flex items-center justify-center relative ring-1 " +
          accentRing + " " +
          (pick
            ? "border-emerald-400/40 bg-emerald-500/10 hover:bg-rose-500/10 hover:border-rose-400/50"
            : "border-dashed border-white/15 bg-black/20")
        }
        title={
          pick
            ? `Clear ${pick}${favoured ? " · favoured here ✨" : ""}`
            : identity.hint
        }
      >
        {pick ? (
          <>
            <Hand move={pick} size="md" />
            {favoured && (
              <span className="absolute -top-1 -right-1 text-xs px-1.5 rounded-full bg-amber-400/90 text-zinc-900 font-bold shadow">
                ✨
              </span>
            )}
          </>
        ) : (
          <span className="text-3xl text-zinc-700 font-black">?</span>
        )}
      </button>
      <span className="text-[9px] text-zinc-500 text-center leading-tight hidden sm:block">
        {identity.hint}
      </span>
    </div>
  );
}

function PickerBar({ onPickInNextEmpty }: { onPickInNextEmpty: (m: Move) => void }) {
  return (
    <div className="grid grid-cols-5 gap-2 sm:gap-3 w-full max-w-md">
      {MOVES.map((mv, i) => {
        const Icon = MOVE_ICON[mv];
        const pal = MOVE_PALETTE[mv];
        return (
          <motion.button
            key={mv}
            onClick={() => onPickInNextEmpty(mv)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            whileHover={{ y: -4, scale: 1.04 }}
            whileTap={{ scale: 0.92 }}
            className={
              "aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 " +
              "bg-gradient-to-br " + pal.from + " " + pal.to + " ring-2 " + pal.ring + " " + pal.glow +
              " text-zinc-900 shadow-lg transition"
            }
          >
            <Icon className="w-6 h-6 sm:w-8 sm:h-8" />
            <span className="text-[9px] uppercase tracking-wider font-bold">{mv}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

function TimerBar({ startedAt, durationMs }: { startedAt: number; durationMs: number }) {
  const [now, setNow] = useState(Date.now());
  // Track previous urgency level so we can fire a haptic on each transition.
  const prevLevel = useRef<"calm" | "urgent" | "critical">("calm");

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 80);
    return () => clearInterval(id);
  }, []);

  const elapsed = Math.max(0, now - startedAt);
  const remaining = Math.max(0, durationMs - elapsed);
  const progress = Math.max(0, Math.min(1, remaining / durationMs));
  const urgent = remaining < 3000 && remaining > 0;
  const critical = remaining < 1000 && remaining > 0;
  const expired = remaining === 0;
  const level: "calm" | "urgent" | "critical" =
    expired ? "critical" : critical ? "critical" : urgent ? "urgent" : "calm";

  useEffect(() => {
    if (level !== prevLevel.current) {
      if (level === "urgent")  hapticTap();
      if (level === "critical") hapticAlert();
      prevLevel.current = level;
    }
  }, [level]);

  const color = critical || expired ? "bg-rose-500" : urgent ? "bg-amber-400" : "bg-violet-400";
  const num = Math.ceil(remaining / 1000);

  return (
    <div className="w-full max-w-md flex flex-col gap-1 items-center">
      <div className="flex items-center gap-3 w-full">
        <motion.span
          key={num}
          initial={{ scale: critical ? 1.4 : 1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.25 }}
          className={
            "text-sm font-mono tabular-nums w-10 text-right font-bold " +
            (critical || expired ? "text-rose-300" : urgent ? "text-amber-300" : "text-zinc-300")
          }
        >
          {num}s
        </motion.span>
        <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            className={"h-full " + color}
            animate={{
              width: `${(progress * 100).toFixed(1)}%`,
              opacity: critical ? [0.5, 1, 0.5] : 1,
            }}
            transition={{
              width:   { duration: 0.1, ease: "linear" },
              opacity: critical ? { duration: 0.4, repeat: Infinity } : { duration: 0.1 },
            }}
          />
        </div>
      </div>
      {/* Pressure overlay: faint red vignette + screen shake when critical. */}
      <AnimatePresence>
        {critical && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 pointer-events-none z-30"
            style={{
              boxShadow: "inset 0 0 120px 30px rgba(244,63,94,0.6)",
            }}
          />
        )}
      </AnimatePresence>
      {urgent && !critical && (
        <div className="text-[10px] uppercase tracking-[0.3em] text-amber-300/80 font-bold">
          Hurry!
        </div>
      )}
      {critical && (
        <motion.div
          animate={{ x: [0, -3, 3, -2, 2, 0] }}
          transition={{ duration: 0.3, repeat: Infinity }}
          className="text-[10px] uppercase tracking-[0.3em] text-rose-300 font-bold"
        >
          ⚠ Pick fast or lose this round!
        </motion.div>
      )}
    </div>
  );
}

function LockedStage({ picks }: { picks: Move[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-4"
    >
      <div className="text-[10px] uppercase tracking-[0.3em] text-emerald-300">
        Picks locked in
      </div>
      <div className="grid grid-cols-3 gap-3">
        {picks.map((mv, i) => (
          <motion.div
            key={i}
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 1.4, delay: i * 0.2, repeat: Infinity }}
            className="flex flex-col items-center gap-1"
          >
            <Hand move={mv} size="md" />
            <span className="text-[9px] uppercase tracking-wider text-zinc-500">L{i + 1}</span>
          </motion.div>
        ))}
      </div>
      <div className="text-sm text-zinc-300 font-medium">Waiting for opponent…</div>
    </motion.div>
  );
}

function RevealCountdown() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center gap-3 px-4 text-center"
    >
      <div className="text-[10px] uppercase tracking-[0.4em] text-zinc-500">Reveal</div>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xl sm:text-3xl font-black leading-tight">
        {["Rock", "Paper", "Scissors"].map((w, i) => (
          <motion.span
            key={w}
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
        SHOOT!
      </motion.div>
    </motion.div>
  );
}

/**
 * Reveal is staged tempo-style: lane 1 → 2 → 3 → verdict. Each lane "drops"
 * with a 0.6s gap so the player gets to feel each one. The outcome combo
 * banner (sweep / wipeout / mirror / classic trinity / triple) animates in
 * last, on top of the lanes.
 */
function RevealStage({ result }: { result: LanesRoundResultData }) {
  const yourPicks = result.yourPlays.map((p) => p.mv);
  const oppPicks  = result.oppPlays.map((p)  => p.mv);

  const yourCombo = detectPlayerCombo(yourPicks);
  const oppCombo  = detectPlayerCombo(oppPicks);
  const outcomeCombo = detectOutcomeCombo(
    result.yourPoints, result.oppPoints, yourPicks, oppPicks,
  );

  // Pick the most visually-impactful combo to show as the headline banner:
  // outcome (sweep/wipeout/mirror) > your combo > opponent combo.
  const headlineCombo =
    outcomeCombo ??
    (result.yourPoints >= result.oppPoints ? yourCombo : oppCombo) ??
    (yourCombo || oppCombo);

  // Sequential lane reveal — flag each lane "ready" on a timer cascade.
  const [revealedLanes, setRevealedLanes] = useState(0);
  useEffect(() => {
    setRevealedLanes(0);
    const timers = [
      window.setTimeout(() => setRevealedLanes(1), 200),
      window.setTimeout(() => setRevealedLanes(2), 800),
      window.setTimeout(() => setRevealedLanes(3), 1400),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [result]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-3 w-full"
    >
      {/* 3-lane reveal — each card flips when its index <= revealedLanes. */}
      <div className="grid grid-cols-3 gap-3 sm:gap-5 w-full max-w-2xl">
        {result.laneResults.map((lr, i) => (
          <LaneRevealCard
            key={i}
            lane={i}
            you={result.yourPlays[i].mv}
            opp={result.oppPlays[i].mv}
            lr={lr}
            revealed={i < revealedLanes}
          />
        ))}
      </div>

      {/* Verdict line — appears once all 3 lanes have dropped. */}
      <AnimatePresence>
        {revealedLanes >= 3 && (
          <motion.div
            key="verdict"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="text-center mt-1 px-2"
          >
            {result.yourPoints > result.oppPoints && (
              <div className="text-emerald-300 text-lg font-bold">
                ✨ Round won {result.yourPoints}-{result.oppPoints}
              </div>
            )}
            {result.yourPoints < result.oppPoints && (
              <div className="text-rose-300 text-lg font-bold">
                💥 Round lost {result.yourPoints}-{result.oppPoints}
              </div>
            )}
            {result.yourPoints === result.oppPoints && (
              <div className="text-zinc-300 text-lg font-bold">
                🤝 Round draw {result.yourPoints}-{result.oppPoints}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Combo banner — drops in after the verdict. */}
      <AnimatePresence>
        {revealedLanes >= 3 && headlineCombo && (
          <ComboBanner combo={headlineCombo} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Big animated banner that names the combo (ROCKSLIDE, FLAWLESS SWEEP…).
 * Tier drives the size + treatment — epics shake the layout, commons fade in.
 */
function ComboBanner({ combo }: { combo: ComboTheme }) {
  const epic = combo.tier === "epic";
  const rare = combo.tier === "rare";
  return (
    <motion.div
      key={combo.id}
      initial={{ opacity: 0, scale: 0.5, y: -10 }}
      animate={{
        opacity: 1,
        scale: epic ? [0.5, 1.25, 1] : 1,
        y: 0,
        x: epic ? [0, -6, 6, -3, 3, 0] : 0,
      }}
      exit={{ opacity: 0, scale: 0.8, y: -8 }}
      transition={{ duration: epic ? 0.7 : 0.4, type: "spring", stiffness: 220, damping: 14 }}
      className="flex flex-col items-center gap-1 mt-2"
    >
      <div className="flex items-center gap-2">
        <motion.span
          animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
          transition={{ duration: 0.8, repeat: epic ? Infinity : 1, repeatType: "loop" }}
          className={"text-3xl sm:text-4xl"}
        >
          {combo.glyph}
        </motion.span>
        <span
          className={
            (epic ? "text-3xl sm:text-5xl" : rare ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl") +
            " font-black tracking-wider bg-gradient-to-br " + combo.gradient +
            " bg-clip-text text-transparent drop-shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
          }
        >
          {combo.name}
        </span>
        <motion.span
          animate={{ rotate: [0, 10, -10, 5, -5, 0] }}
          transition={{ duration: 0.8, repeat: epic ? Infinity : 1, repeatType: "loop" }}
          className="text-3xl sm:text-4xl"
        >
          {combo.glyph}
        </motion.span>
      </div>
      <div className={"text-[11px] sm:text-xs uppercase tracking-[0.25em] " +
        (epic ? "text-amber-300/90" : rare ? "text-fuchsia-300/80" : "text-zinc-400")}>
        {combo.tagline}
      </div>
      {combo.bonus != null && combo.bonus > 0 && (
        <div className="text-[10px] uppercase tracking-wider text-amber-300/70 mt-1">
          ✨ Style bonus · +{combo.bonus}
        </div>
      )}
    </motion.div>
  );
}

function LaneRevealCard({
  lane, you, opp, lr, revealed,
}: { lane: number; you: Move; opp: Move; lr: LaneResult; revealed: boolean }) {
  const identity = LANE_IDENTITIES[lane];
  const ringColor =
    lr.winner === "a" && lr.a_play.mv === you ? "ring-emerald-400/50" :
    lr.winner === "b" && lr.b_play.mv === you ? "ring-emerald-400/50" :
    lr.winner === "draw" ? "ring-zinc-500/30" : "ring-rose-400/40";
  // Simpler: check by comparing your play vs lane winner.
  const youWon = (lr.winner === "a" && lr.a_play.mv === you && lr.b_play.mv === opp)
              || (lr.winner === "b" && lr.b_play.mv === you && lr.a_play.mv === opp);
  const oppWon = (lr.winner !== "draw") && !youWon;
  const youFavoured = laneFavoursMove(lane, you);
  const oppFavoured = laneFavoursMove(lane, opp);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7, rotateY: 90 }}
      animate={revealed
        ? { opacity: 1, scale: 1, rotateY: 0 }
        : { opacity: 0.35, scale: 0.85, rotateY: 90 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      className={
        "rounded-2xl bg-black/30 border-2 p-3 flex flex-col items-center gap-2 ring-2 " + ringColor +
        " " + (youWon ? "border-emerald-400/30" : oppWon ? "border-rose-400/30" : "border-zinc-500/20")
      }
      style={{ transformPerspective: 800 }}
    >
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider">
        <span className="text-zinc-500">Lane {lane + 1}</span>
        <span className="text-zinc-600">·</span>
        <span className={
          identity.accent === "amber"  ? "text-amber-300/80"   :
          identity.accent === "sky"    ? "text-sky-300/80"     :
                                          "text-emerald-300/80"
        }>
          {identity.glyph} {identity.title}
        </span>
      </div>
      <div className="relative">
        <Hand move={you} size="sm" emphasis={youWon ? "winner" : oppWon ? "loser" : "default"} />
        {youFavoured && revealed && (
          <span
            title={identity.hint}
            className="absolute -top-1 -right-1 text-[10px] px-1 rounded-full bg-amber-400/90 text-zinc-900 font-bold"
          >
            ✨
          </span>
        )}
      </div>
      <span className="text-[10px] text-zinc-600 font-black">VS</span>
      <div className="relative">
        <Hand move={opp} size="sm" emphasis={oppWon ? "winner" : youWon ? "loser" : "default"} />
        {oppFavoured && revealed && (
          <span
            title={identity.hint}
            className="absolute -top-1 -right-1 text-[10px] px-1 rounded-full bg-amber-400/90 text-zinc-900 font-bold"
          >
            ✨
          </span>
        )}
      </div>
      <span className={
        "text-[10px] uppercase tracking-wider font-bold mt-0.5 " +
        (youWon ? "text-emerald-300" : oppWon ? "text-rose-300" : "text-zinc-500")
      }>
        {youWon ? "WIN" : oppWon ? "LOSS" : "DRAW"}
      </span>
    </motion.div>
  );
}

function MatchEndScene({
  end, onBack,
}: { end: LanesEndData; onBack: () => void }) {
  // Caller passes "winner=you" via end.winner already in absolute terms — we
  // need to know whether you won. Compute from round wins: if youWins > oppWins
  // your side won. Backwards compat: use end.winner with caller's youAre context
  // not directly available here, so we infer from scores.
  const youWon = end.roundWinsYou > end.roundWinsOpp;
  const draw = end.roundWinsYou === end.roundWinsOpp;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-5 py-6"
    >
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
        className="text-7xl sm:text-8xl"
      >
        {youWon ? "🏆" : draw ? "🤝" : "💀"}
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className={
          "text-4xl sm:text-5xl font-black bg-gradient-to-br bg-clip-text text-transparent " +
          (youWon
            ? "from-emerald-300 to-teal-400"
            : draw
            ? "from-zinc-200 to-zinc-400"
            : "from-rose-300 to-fuchsia-400")
        }
      >
        {youWon ? "VICTORY" : draw ? "DRAW" : "DEFEAT"}
      </motion.div>
      {end.forfeit && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-xs uppercase tracking-[0.3em] text-amber-300"
        >
          (by forfeit)
        </motion.div>
      )}
      <div className="text-2xl font-mono">
        {end.roundWinsYou} — {end.roundWinsOpp}
      </div>
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
        onClick={onBack}
        className="mt-2 px-6 py-3 rounded-xl bg-violet-500/90 hover:bg-violet-500 font-semibold text-white shadow-lg shadow-violet-500/30 transition"
      >
        Back to menu
      </motion.button>
    </motion.div>
  );
}

