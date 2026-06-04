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
import { Hand, MoveGlyph, MOVE_PALETTE, moveRim, moveGlow } from "./icons";
import { MOVES, type Move } from "./game";
import { hapticAlert, hapticTap } from "./haptic";
import { useT } from "./i18n";
import { MatchScoreBar, hapticTick, PickShock, CinematicMatchEnd, useAndroidBackPrompt } from "./sharedMatchUI";
import type { LanePlay, LaneResult, PlayerSlot } from "./online";
import {
  detectOutcomeCombo,
  detectPlayerCombo,
  LANE_IDENTITIES,
  laneFavoursMove,
  type ComboTheme,
} from "./lanesCombos";

/** Map of lane index → i18n key prefix for the identity. */
const IDENTITY_KEYS = ["lanes.identity.force", "lanes.identity.wisdom", "lanes.identity.cunning"];

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
  onRematch,
}: LanesMatchViewProps & { onRematch?: () => void }) {
  const t = useT();
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

  /* Help modal state — a "?" button in the score row toggles it. */
  const [helpOpen, setHelpOpen] = useState(false);
  /* Forfeit confirmation modal — shown both by the in-flow "Forfait" button
   *  and by Android system back so a stray back-press can't silently lose
   *  the match. */
  const [quitConfirmOpen, setQuitConfirmOpen] = useState(false);
  useAndroidBackPrompt(() => setQuitConfirmOpen(true));

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
    <div className="relative flex flex-col gap-2 sm:gap-3 flex-1 min-h-0 overflow-hidden">
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

      {/* Help "?" — floated into the top-right clearance band instead of taking
          a flow row, so the score bar sits higher and the board gets the height
          back (fixes the opponent cards clipping under the timer). */}
      <button
        onClick={() => setHelpOpen(true)}
        title={t("lanes.help.button")}
        className="absolute -top-9 right-0 z-20 w-9 h-9 rounded-full bg-black/50 backdrop-blur hover:bg-white/10 border border-white/15 text-zinc-200 hover:text-white text-sm font-bold transition flex items-center justify-center"
      >
        ?
      </button>

      <ScoreHeader
        you={nickname}
        opp={match.opponent}
        youWins={youWins}
        oppWins={oppWins}
        target={target}
        round={round?.no ?? 1}
      />

      <AnimatePresence>
        {helpOpen && (
          <HelpModal target={target} onClose={() => setHelpOpen(false)} />
        )}
      </AnimatePresence>

      {/* Stage — claims all remaining vertical space inside the locked
          overflow-hidden container. No min-height so it shrinks to fit. */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden">
        {phase === "matched" && !showSplash && (
          <div className="text-sm text-zinc-400">{t("lanes.preparingFirstRound")}</div>
        )}
        {phase === "picking" && round && (
          <PickStage
            picks={picks}
            onPick={pickInNextEmpty}
            onClearLane={clearLane}
            startedAt={round.startedAt}
            deadlineMs={round.deadlineMs}
            onSubmit={submitNow}
            opponentName={match.opponent}
            youName={nickname}
          />
        )}
        {phase === "submitted" && (
          <LockedStage
            picks={picks as Move[]}
            opponentName={match.opponent}
            youName={nickname}
          />
        )}
        {phase === "reveal" && lastResult && !revealReady && <RevealCountdown />}
        {phase === "reveal" && lastResult && revealReady && (
          <RevealStage
            result={lastResult}
            opponentName={match.opponent}
            youName={nickname}
          />
        )}
        {phase === "match_end" && end && (
          <MatchEndScene end={end} onBack={onLeave} onRematch={onRematch} />
        )}
      </div>

      {/* Forfeit button — shown anytime but match-end. */}
      {phase !== "match_end" && (
        <button
          onClick={() => setQuitConfirmOpen(true)}
          className="self-center px-4 py-2 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/40 text-zinc-400 hover:text-rose-200 text-xs transition"
        >
          {t("lanes.forfeitMatch")}
        </button>
      )}

      <AnimatePresence>
        {quitConfirmOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setQuitConfirmOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 22 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-zinc-950/95 border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl"
            >
              <h3 className="text-base sm:text-lg font-bold text-white mb-1.5">Quitter le match ?</h3>
              <p className="text-sm text-zinc-400 leading-relaxed mb-5">
                Tu vas perdre la manche en cours. Ce sera compté comme défaite.
              </p>
              <div className="flex gap-2.5">
                <button
                  onClick={() => setQuitConfirmOpen(false)}
                  className="flex-1 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 font-semibold text-sm text-zinc-200 transition active:scale-[0.97]"
                >
                  Continuer
                </button>
                <button
                  onClick={() => { setQuitConfirmOpen(false); onLeave(); }}
                  className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-red-600 font-bold text-sm text-white shadow-lg shadow-rose-500/30 transition active:scale-[0.97]"
                >
                  Forfait
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
  const t = useT();
  // Same shared component the classic modes use — guaranteed uniformity.
  return (
    <MatchScoreBar
      youName={you}
      oppName={opp || "—"}
      youScore={youWins}
      oppScore={oppWins}
      youTag={t("lanes.you")}
      oppTag={t("lanes.opponent")}
      caption={t("lanes.scoreCaption", { round, target })}
    />
  );
}

function MatchFoundSplash({
  you, opp, lanes, winTo,
}: { you: string; opp: string; lanes: number; winTo: number }) {
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
        className="text-xs tracking-[0.5em] text-violet-300/80 uppercase mb-3 text-center px-4"
      >
        {t("lanes.matchFoundKicker")}
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
        className="mt-8 text-sm uppercase tracking-[0.3em] text-zinc-400 text-center px-4"
      >
        {t("lanes.matchFoundSub", { lanes, winTo })}
      </motion.div>
    </motion.div>
  );
}

function NameTag({
  name, accent, align,
}: { name: string; accent: "emerald" | "rose"; align: "left" | "right" }) {
  const t = useT();
  const grad = accent === "emerald" ? "from-emerald-300 to-teal-400" : "from-rose-300 to-fuchsia-400";
  return (
    <div className={"flex flex-col " + (align === "right" ? "items-end" : "items-start")}>
      <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
        {accent === "emerald" ? t("lanes.you") : t("lanes.opponent")}
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

/**
 * GameTable — felt-mat container that frames the two rows of lanes
 * (Opponent on top, You on bottom) so the player can never confuse which
 * side belongs to whom. Used by PickStage, LockedStage and RevealStage.
 */
function GameTable({
  opponentName, youName,
  oppRow, youRow,
  oppStatus, youStatus,
}: {
  opponentName: string;
  youName: string;
  oppRow: React.ReactNode;
  youRow: React.ReactNode;
  oppStatus?: React.ReactNode;
  youStatus?: React.ReactNode;
}) {
  return (
    <div
      className="w-full max-w-2xl rounded-2xl p-2 sm:p-4 flex flex-col gap-2 sm:gap-3
                 border border-emerald-900/40
                 bg-gradient-to-b from-emerald-950/40 via-zinc-950/60 to-emerald-950/40
                 shadow-[inset_0_0_36px_rgba(0,0,0,0.55)]"
    >
      {/* Opponent header */}
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-rose-300/90 truncate">
          ✦ {opponentName}
        </span>
        {oppStatus && (
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 shrink-0 ml-2">{oppStatus}</span>
        )}
      </div>

      {/* Opponent row */}
      {oppRow}

      {/* Felt divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />

      {/* You row */}
      {youRow}

      {/* You footer */}
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-emerald-300/90 truncate">
          ✦ {youName}
        </span>
        {youStatus && (
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 shrink-0 ml-2">{youStatus}</span>
        )}
      </div>
    </div>
  );
}

/** Tiny "?" face-down card for an opponent lane we can't see yet.
 *  Rectangular (3/2) instead of square so the row stays short on mobile. */
function FaceDownLaneCard({ index, pulsing = false }: { index: number; pulsing?: boolean }) {
  return (
    <motion.div
      animate={pulsing ? { opacity: [0.55, 1, 0.55] } : { opacity: 1 }}
      transition={pulsing ? { duration: 1.4, repeat: Infinity, delay: index * 0.18 } : undefined}
      className="aspect-square w-full rounded-xl border-2 border-dashed border-white/10 bg-black/30
                 flex items-center justify-center"
    >
      <span className="text-xl sm:text-2xl text-zinc-700 font-black">?</span>
    </motion.div>
  );
}

function PickStage({
  picks, onPick, onClearLane, startedAt, deadlineMs, onSubmit, opponentName, youName,
}: {
  picks: (Move | null)[];
  /** Pick `mv` — drops it into the next empty lane. */
  onPick: (mv: Move) => void;
  onClearLane: (lane: number) => void;
  startedAt: number;
  deadlineMs: number;
  onSubmit: () => void;
  opponentName: string;
  youName: string;
}) {
  const t = useT();
  const allFilled = picks.every((p) => p !== null);
  const remaining = 3 - picks.filter(Boolean).length;
  // Combo preview — only triggers once all 3 picks are placed, before lock.
  const preview = allFilled ? detectPlayerCombo(picks as Move[]) : null;
  return (
    <div className="w-full h-full flex flex-col items-center gap-2 sm:gap-3">
      {/* Timer — pinned top */}
      <TimerBar startedAt={startedAt} durationMs={deadlineMs} />

      {/* Table is the ONLY part allowed to compress, so the picker + LOCK
          button below it stay reachable on every phone height. */}
      <div className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden">
      <GameTable
        opponentName={opponentName}
        youName={youName}
        oppStatus={t("lanes.tableOppThinking")}
        youStatus={
          allFilled ? t("lanes.tableYouReady") : t("lanes.pickRemaining", { n: remaining })
        }
        oppRow={
          <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
            {[0, 1, 2].map((i) => (
              <FaceDownLaneCard key={i} index={i} pulsing />
            ))}
          </div>
        }
        youRow={
          <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
            {picks.map((mv, i) => (
              <LaneSlot key={i} index={i} pick={mv} onClear={() => onClearLane(i)} />
            ))}
          </div>
        }
      />
      </div>

      <div className="shrink-0 text-[10px] uppercase tracking-[0.25em] text-zinc-500 text-center px-4">
        {t("lanes.pickInstruction")}
      </div>

      <PickerBar onPickInNextEmpty={onPick} />

      {/* Combo preview: shown as soon as the 3 picks form a known combo. */}
      <AnimatePresence>
        {preview && (
          <motion.div
            key={preview.id}
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 280, damping: 20 }}
            className="flex flex-col items-center gap-0.5"
          >
            <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
              {t("lanes.potentialCombo")}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">{preview.glyph}</span>
              <span
                className={
                  "text-base sm:text-lg font-black tracking-wider bg-gradient-to-br " +
                  preview.gradient +
                  " bg-clip-text text-transparent"
                }
              >
                {t(`combo.${preview.id}.name`)}
              </span>
              <span className="text-xl">{preview.glyph}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={onSubmit}
        disabled={!allFilled}
        className={
          "shrink-0 mt-1 px-7 py-3 rounded-2xl font-bold text-white transition " +
          (allFilled
            ? "bg-themed shadow-lg shadow-violet-500/30 hover:scale-[1.02]"
            : "bg-white/5 text-zinc-500 cursor-not-allowed")
        }
      >
        {allFilled ? t("lanes.lockButton") : t("lanes.pickRemaining", { n: remaining })}
      </button>
    </div>
  );
}

function LaneSlot({
  index, pick, onClear,
}: { index: number; pick: Move | null; onClear: () => void }) {
  const t = useT();
  const identity = LANE_IDENTITIES[index];
  const favoured = pick ? laneFavoursMove(index, pick) : false;
  const idKey = IDENTITY_KEYS[index];
  const title = t(`${idKey}.title`);
  const hint = t(`${idKey}.hint`);

  // Per-identity accent palette — used on the ring, badge and the
  // "favoured" halo so the player learns to associate colour ↔ lane.
  const accent = identity.accent;
  const ringIdle =
    accent === "amber"  ? "ring-amber-400/30"  :
    accent === "sky"    ? "ring-sky-400/30"    :
                          "ring-emerald-400/30";
  const ringFav =
    accent === "amber"  ? "ring-amber-400/80 shadow-[0_0_24px_rgba(251,191,36,0.55)]"  :
    accent === "sky"    ? "ring-sky-400/80 shadow-[0_0_24px_rgba(56,189,248,0.55)]"    :
                          "ring-emerald-400/80 shadow-[0_0_24px_rgba(52,211,153,0.55)]";
  const accentText =
    accent === "amber"  ? "text-amber-300"  :
    accent === "sky"    ? "text-sky-300"    :
                          "text-emerald-300";
  const haloColor =
    accent === "amber"  ? "rgba(251,191,36,0.5)"  :
    accent === "sky"    ? "rgba(56,189,248,0.5)"  :
                          "rgba(52,211,153,0.5)";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={"flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold " + accentText}>
        <span>{identity.glyph}</span>
        <span>{title}</span>
      </div>
      <button
        onClick={onClear}
        disabled={!pick}
        className={
          "aspect-square w-full rounded-xl border-2 transition flex items-center justify-center relative ring-2 " +
          (favoured ? ringFav : ringIdle) + " " +
          (pick
            ? "border-emerald-400/40 bg-emerald-500/10 hover:bg-rose-500/10 hover:border-rose-400/50"
            : "border-dashed border-white/15 bg-black/20")
        }
        title={pick ? t("lanes.clearLane", { move: pick }) : hint}
      >
        {/* Soft halo glow when the placed move is on its favoured lane */}
        {favoured && (
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.45, 0.8, 0.45] }}
            transition={{ duration: 2.2, repeat: Infinity }}
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${haloColor}, transparent 70%)`,
              filter: "blur(8px)",
            }}
          />
        )}
        {pick ? (
          <>
            <Hand move={pick} size="sm" />
            {favoured && (
              <motion.span
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 280, damping: 12 }}
                className={
                  "absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider text-zinc-900 shadow-lg flex items-center gap-1 " +
                  (accent === "amber"  ? "bg-amber-300" :
                   accent === "sky"    ? "bg-sky-300"   :
                                          "bg-emerald-300")
                }
              >
                ✨ +1
              </motion.span>
            )}
          </>
        ) : (
          <span className="text-2xl text-zinc-700 font-black">?</span>
        )}
      </button>
      <span className="text-[9px] text-zinc-500 text-center leading-tight hidden sm:block">
        {hint}
      </span>
    </div>
  );
}

function PickerBar({ onPickInNextEmpty }: { onPickInNextEmpty: (m: Move) => void }) {
  const [shockMove, setShockMove] = useState<Move | null>(null);
  return (
    <div className="grid grid-cols-5 gap-1.5 sm:gap-3 w-full max-w-md">
      {MOVES.map((mv, i) => {
        const pal = MOVE_PALETTE[mv];
        function handleClick() {
          hapticTick();
          setShockMove(mv);
          setTimeout(() => setShockMove((cur) => (cur === mv ? null : cur)), 450);
          onPickInNextEmpty(mv);
        }
        return (
          <motion.button
            key={mv}
            onClick={handleClick}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            whileHover={{ y: -4, scale: 1.04 }}
            whileTap={{ scale: 0.86 }}
            aria-label={`Pick ${mv}`}
            className="relative aspect-[4/5] rounded-xl flex flex-col items-center justify-center gap-0.5 py-1 text-white transition"
            // Dark glass + theme-blended rim — same treatment as the ranked
            // picker so every mode's move buttons look consistent and adapt
            // to the active background accent.
            style={{
              background: "linear-gradient(160deg, rgba(20,22,32,0.92) 0%, rgba(10,12,20,0.92) 100%)",
              border: `2px solid ${moveRim(pal.hex)}`,
              boxShadow: `0 0 12px -2px ${moveGlow(pal.hex)}, inset 0 1px 0 rgba(255,255,255,0.08)`,
            }}
          >
            <PickShock show={shockMove === mv} />
            <MoveGlyph move={mv} className="w-9 h-9 sm:w-11 sm:h-11" />
            <span className="text-[10px] sm:text-[11px] uppercase tracking-wider font-bold leading-none" style={{ color: moveRim(pal.hex) }}>{mv}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

function TimerBar({ startedAt, durationMs }: { startedAt: number; durationMs: number }) {
  const tr = useT();
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
          {tr("lanes.hurry")}
        </div>
      )}
      {critical && (
        <motion.div
          animate={{ x: [0, -3, 3, -2, 2, 0] }}
          transition={{ duration: 0.3, repeat: Infinity }}
          className="text-[10px] uppercase tracking-[0.3em] text-rose-300 font-bold text-center px-4"
        >
          {tr("lanes.pickFastOrLose")}
        </motion.div>
      )}
    </div>
  );
}

function LockedStage({
  picks, opponentName, youName,
}: { picks: Move[]; opponentName: string; youName: string }) {
  const t = useT();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full h-full flex flex-col items-center gap-2 sm:gap-4"
    >
      <div className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden">
      <GameTable
        opponentName={opponentName}
        youName={youName}
        oppStatus={t("lanes.tableOppThinking")}
        youStatus={t("lanes.lockedIn")}
        oppRow={
          <div className="grid grid-cols-3 gap-3 sm:gap-5">
            {[0, 1, 2].map((i) => (
              <FaceDownLaneCard key={i} index={i} pulsing />
            ))}
          </div>
        }
        youRow={
          <div className="grid grid-cols-3 gap-3 sm:gap-5">
            {picks.map((mv, i) => (
              <motion.div
                key={i}
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 1.4, delay: i * 0.18, repeat: Infinity }}
                className="aspect-square w-full rounded-2xl border-2 border-emerald-400/40 bg-emerald-500/10
                           flex flex-col items-center justify-center gap-1 ring-2 ring-emerald-400/30"
              >
                <Hand move={mv} size="md" />
                <span className="text-[9px] uppercase tracking-wider text-emerald-300/80">L{i + 1}</span>
              </motion.div>
            ))}
          </div>
        }
      />
      </div>
      <div className="shrink-0 text-sm text-zinc-300 font-medium">{t("lanes.waitingOpponent")}</div>
    </motion.div>
  );
}

function RevealCountdown() {
  const tCount = useT();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center gap-3 px-4 text-center"
    >
      <div className="text-[10px] uppercase tracking-[0.4em] text-zinc-500">{tCount("lanes.reveal")}</div>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xl sm:text-3xl font-black leading-tight">
        {[tCount("online.reveal.rock"), tCount("online.reveal.paper"), tCount("online.reveal.scissors")].map((w, i) => (
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
        {tCount("lanes.shoot")}
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
function RevealStage({
  result, opponentName, youName,
}: {
  result: LanesRoundResultData;
  opponentName: string;
  youName: string;
}) {
  const t = useT();
  const yourPicks = result.yourPlays.map((p) => p.mv);
  const oppPicks  = result.oppPlays.map((p)  => p.mv);

  const yourCombo = detectPlayerCombo(yourPicks);
  const oppCombo  = detectPlayerCombo(oppPicks);
  const outcomeCombo = detectOutcomeCombo(
    result.yourPoints, result.oppPoints, yourPicks, oppPicks,
  );

  // Pick the most visually-impactful combo to show as the headline banner.
  // Priority: outcome combo (sweep / wipeout / mirror) → winning side's
  // combo → whichever side has any combo. Critically, the *winning* side
  // gets the spotlight when both sides have one — even when they're the
  // opponent — so a defeat doesn't drown out their highlight.
  const youWonRound = result.yourPoints >  result.oppPoints;
  const oppWonRound = result.oppPoints >  result.yourPoints;
  const headlineCombo =
    outcomeCombo ??
    (oppWonRound ? oppCombo : null) ??
    (youWonRound ? yourCombo : null) ??
    // Draw: just pick whichever side actually has a combo.
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

  // Per-lane verdicts from the player's perspective.
  const laneVerdicts: ("win" | "loss" | "draw")[] = result.laneResults.map((lr, i) => {
    const you = result.yourPlays[i].mv;
    if (lr.winner === "draw") return "draw";
    const youWon = (lr.winner === "a" && lr.a_play.mv === you)
                || (lr.winner === "b" && lr.b_play.mv === you);
    return youWon ? "win" : "loss";
  });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full h-full flex flex-col items-center gap-2 sm:gap-3"
    >
      <div className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden">
      <GameTable
        opponentName={opponentName}
        youName={youName}
        oppRow={
          <div className="grid grid-cols-3 gap-3 sm:gap-5">
            {result.laneResults.map((_, i) => (
              <SideLaneCard
                key={i}
                lane={i}
                move={result.oppPlays[i].mv}
                verdictForSide={
                  laneVerdicts[i] === "draw" ? "draw"
                  : laneVerdicts[i] === "win" ? "loss" /* opp lost = lost from opp side */
                  : "win"
                }
                revealed={i < revealedLanes}
                side="opp"
              />
            ))}
          </div>
        }
        youRow={
          <div className="grid grid-cols-3 gap-3 sm:gap-5">
            {result.laneResults.map((_, i) => (
              <SideLaneCard
                key={i}
                lane={i}
                move={result.yourPlays[i].mv}
                verdictForSide={laneVerdicts[i]}
                revealed={i < revealedLanes}
                side="you"
              />
            ))}
          </div>
        }
      />
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
                {t("lanes.roundWon", { a: result.yourPoints, b: result.oppPoints })}
              </div>
            )}
            {result.yourPoints < result.oppPoints && (
              <div className="text-rose-300 text-lg font-bold">
                {t("lanes.roundLost", { a: result.yourPoints, b: result.oppPoints })}
              </div>
            )}
            {result.yourPoints === result.oppPoints && (
              <div className="text-zinc-300 text-lg font-bold">
                {t("lanes.roundDraw", { a: result.yourPoints, b: result.oppPoints })}
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

      {/* Opponent-combo reveal line — pedagogic. Only shows when they had
          a named combo AND it's different from the headline (otherwise
          the banner already covered it). */}
      <AnimatePresence>
        {revealedLanes >= 3 && oppCombo && oppCombo.id !== headlineCombo?.id && (
          <motion.div
            key="opp-combo"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ delay: 0.4, duration: 0.3 }}
            className="text-[11px] text-zinc-400 mt-1 text-center px-3"
          >
            {t("lanes.opponentCombo", {
              combo: `${oppCombo.glyph} ${t(`combo.${oppCombo.id}.name`)}`,
            })}
          </motion.div>
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
  const t = useT();
  const epic = combo.tier === "epic";
  const rare = combo.tier === "rare";
  // i18n keys follow the convention combo.<id>.{name,tag} — falls back to
  // the in-code defaults if a locale doesn't translate them yet.
  const name = t(`combo.${combo.id}.name`);
  const tag  = t(`combo.${combo.id}.tag`);
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
            " bg-clip-text text-transparent drop-shadow-[0_4px_16px_rgba(0,0,0,0.4)] text-center"
          }
        >
          {name}
        </span>
        <motion.span
          animate={{ rotate: [0, 10, -10, 5, -5, 0] }}
          transition={{ duration: 0.8, repeat: epic ? Infinity : 1, repeatType: "loop" }}
          className="text-3xl sm:text-4xl"
        >
          {combo.glyph}
        </motion.span>
      </div>
      <div className={"text-[11px] sm:text-xs uppercase tracking-[0.25em] text-center px-3 " +
        (epic ? "text-amber-300/90" : rare ? "text-fuchsia-300/80" : "text-zinc-400")}>
        {tag}
      </div>
      {combo.bonus != null && combo.bonus > 0 && (
        <div className="text-[10px] uppercase tracking-wider text-amber-300/70 mt-1">
          {t("lanes.styleBonus", { n: combo.bonus })}
        </div>
      )}
    </motion.div>
  );
}

/** Single-side lane card: one Hand + lane identity + per-lane verdict from
 *  the perspective of that side. Used twice per lane (once opp, once you). */
function SideLaneCard({
  lane, move, verdictForSide, revealed, side,
}: {
  lane: number;
  move: Move;
  verdictForSide: "win" | "loss" | "draw";
  revealed: boolean;
  side: "opp" | "you";
}) {
  const t = useT();
  const identity = LANE_IDENTITIES[lane];
  const idKey = IDENTITY_KEYS[lane];
  const favoured = laneFavoursMove(lane, move);
  const isWin  = verdictForSide === "win";
  const isLoss = verdictForSide === "loss";

  const ring =
    isWin  ? "ring-emerald-400/60" :
    isLoss ? "ring-rose-400/50"    :
             "ring-zinc-500/30";
  const border =
    isWin  ? "border-emerald-400/40" :
    isLoss ? "border-rose-400/30"    :
             "border-zinc-500/20";
  const bg =
    isWin  ? "bg-emerald-500/10" :
    isLoss ? "bg-rose-500/10"    :
             "bg-black/30";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7, rotateY: 90 }}
      animate={revealed
        ? { opacity: 1, scale: 1, rotateY: 0 }
        : { opacity: 0.3, scale: 0.85, rotateY: 90 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      className={
        "aspect-square rounded-xl border-2 ring-2 px-1 py-1 flex flex-col items-center justify-center gap-0.5 " +
        ring + " " + border + " " + bg
      }
      style={{ transformPerspective: 800 }}
    >
      <div className={
        "flex items-center gap-0.5 text-[8px] uppercase tracking-wider leading-none " +
        (identity.accent === "amber"  ? "text-amber-300/80"   :
         identity.accent === "sky"    ? "text-sky-300/80"     :
                                        "text-emerald-300/80")
      }>
        <span>{identity.glyph}</span>
        <span className="truncate">{t(`${idKey}.title`)}</span>
      </div>
      <div className="relative">
        <Hand move={move} size="sm" emphasis={isWin ? "winner" : isLoss ? "loser" : "default"} />
        {favoured && revealed && <FavouredBadge winning={isWin} />}
      </div>
      <span className={
        "text-[9px] uppercase tracking-wider font-bold leading-none " +
        (isWin ? "text-emerald-300" : isLoss ? "text-rose-300" : "text-zinc-500")
      }>
        {isWin
          ? (side === "you" ? t("lanes.win") : t("lanes.loss"))
          : isLoss
          ? (side === "you" ? t("lanes.loss") : t("lanes.win"))
          : t("lanes.drawShort")}
      </span>
    </motion.div>
  );
}

function MatchEndScene({
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
    />
  );
}

/**
 * Badge that pops on a lane reveal when the placed move was on its
 * favoured lane. The "+1" floats upward when it actually won the lane,
 * making the identity bonus *visible* in the moment.
 */
function FavouredBadge({ winning }: { winning: boolean }) {
  return (
    <>
      <motion.span
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 12, delay: 0.1 }}
        className="absolute -top-2 -right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-400 text-zinc-900 shadow-lg flex items-center gap-1"
      >
        ✨
      </motion.span>
      {winning && (
        <motion.span
          initial={{ opacity: 0, y: 0, scale: 0.5 }}
          animate={{ opacity: [0, 1, 1, 0], y: -28, scale: [0.5, 1.4, 1.2, 1] }}
          transition={{ duration: 1.2, delay: 0.3 }}
          className="absolute -top-1 left-1/2 -translate-x-1/2 text-amber-300 text-base font-black drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
        >
          +1 ✨
        </motion.span>
      )}
    </>
  );
}

/* AmbientFlavor was used by PickStage to rotate a tiny geek one-liner under
   the picker bar. Removed during the Constellation layout pass to save
   ~28 px of vertical space on small phones; same component lives in
   sharedMatchUI.tsx if a future surface wants to bring it back. */

/* ──────────── Help / Lexicon modal ──────────── */

function HelpModal({ target, onClose }: { target: number; onClose: () => void }) {
  const t = useT();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 6 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[85vh] overflow-y-auto bg-zinc-950 border border-white/15 rounded-3xl p-6 shadow-2xl"
      >
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-xl font-black tracking-tight text-themed">
            🌌 {t("lanes.help.title")}
          </h2>
        </div>

        <div className="space-y-5 text-sm">
          <Section
            title={t("lanes.help.rules.title")}
            body={t("lanes.help.rules.body", { target })}
            accent="violet"
          />

          {/* Per-move grid — much clearer than a paragraph of "X cuts Y, Y…" */}
          <Section
            title={t("lanes.help.rps.title")}
            body={t("lanes.help.rps.body")}
            accent="cyan"
          >
            <div className="mt-3 grid grid-cols-1 gap-2">
              {RPSLS_MOVES_HELP.map(({ id, glyph, color }) => (
                <div
                  key={id}
                  className="rounded-xl bg-white/5 border border-white/10 p-3 flex items-center gap-3"
                >
                  <div
                    className={
                      "shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br " + color +
                      " flex items-center justify-center text-zinc-900 text-2xl shadow-md"
                    }
                  >
                    {glyph}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="text-base font-black uppercase tracking-wider text-zinc-50">
                      {t(`online.reveal.${id}`)}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm leading-tight">
                      <span className="text-emerald-300 font-semibold">
                        ✓ {t("lanes.help.rps.beats")}
                      </span>
                      <span className="text-zinc-200 break-words">
                        {t(`lanes.help.rps.${id}.beats`)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm leading-tight">
                      <span className="text-rose-300 font-semibold">
                        ✗ {t("lanes.help.rps.losesTo")}
                      </span>
                      <span className="text-zinc-400 break-words">
                        {t(`lanes.help.rps.${id}.losesTo`)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section
            title={t("lanes.help.identity.title")}
            body={t("lanes.help.identity.body")}
            accent="amber"
          >
            <div className="mt-2 grid grid-cols-3 gap-2">
              {LANE_IDENTITIES.map((id, i) => (
                <div
                  key={i}
                  className="rounded-xl bg-white/5 border border-white/10 p-2 text-center"
                >
                  <div className="text-lg">{id.glyph}</div>
                  <div className={
                    "text-[10px] uppercase tracking-wider font-bold mt-0.5 " +
                    (id.accent === "amber"  ? "text-amber-300"  :
                     id.accent === "sky"    ? "text-sky-300"    :
                                              "text-emerald-300")
                  }>
                    {t(`${IDENTITY_KEYS[i]}.title`)}
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-1 leading-tight">
                    {t(`${IDENTITY_KEYS[i]}.hint`)}
                  </div>
                </div>
              ))}
            </div>
          </Section>
          <Section
            title={t("lanes.help.combos.title")}
            body={t("lanes.help.combos.body")}
            accent="fuchsia"
          >
            <div className="mt-3 flex flex-col gap-2">
              {COMBO_LEXICON.map(({ id, glyph }) => (
                <div
                  key={id}
                  className="rounded-xl bg-white/5 border border-white/10 p-3 flex items-center gap-3"
                >
                  <span className="text-2xl shrink-0">{glyph}</span>
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="text-sm font-black uppercase tracking-wider text-zinc-50 leading-tight">
                      {t(`combo.${id}.name`)}
                    </span>
                    <span className="text-xs text-zinc-400 leading-snug break-words">
                      {t(`combo.${id}.tag`)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Section>
          <Section
            title={t("lanes.help.timer.title")}
            body={t("lanes.help.timer.body")}
            accent="rose"
          />
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full px-6 py-3 rounded-2xl font-bold text-white bg-themed shadow-lg shadow-violet-500/30 transition hover:scale-[1.02]"
        >
          {t("lanes.help.close")}
        </button>
      </motion.div>
    </motion.div>
  );
}

/** Move list used in the Help modal — gradient colours mirror MOVE_PALETTE. */
const RPSLS_MOVES_HELP: { id: "rock" | "paper" | "scissors" | "lizard" | "spock"; glyph: string; color: string }[] = [
  { id: "rock",     glyph: "🪨", color: "from-stone-300 to-amber-400"   },
  { id: "paper",    glyph: "📄", color: "from-zinc-100 to-sky-200"      },
  { id: "scissors", glyph: "✂️", color: "from-rose-300 to-orange-400"   },
  { id: "lizard",   glyph: "🦎", color: "from-lime-300 to-emerald-500"  },
  { id: "spock",    glyph: "🖖", color: "from-cyan-300 to-violet-500"   },
];

const COMBO_LEXICON: { id: string; glyph: string }[] = [
  { id: "rockslide",      glyph: "🪨" },
  { id: "origami",        glyph: "📄" },
  { id: "shear",          glyph: "✂️" },
  { id: "reptile",        glyph: "🦎" },
  { id: "vulcan",         glyph: "🖖" },
  { id: "trinityClassic", glyph: "🌀" },
  { id: "trinityQuantum", glyph: "🧠" },
  { id: "mirror",         glyph: "🪞" },
  { id: "sweep",          glyph: "👑" },
  { id: "wipeout",        glyph: "💀" },
  { id: "stalemate",      glyph: "🤝" },
];

function Section({
  title, body, accent, children,
}: {
  title: string; body: string;
  accent: "violet" | "cyan" | "amber" | "fuchsia" | "rose";
  children?: React.ReactNode;
}) {
  const colour = {
    violet:  "text-violet-300",
    cyan:    "text-cyan-300",
    amber:   "text-amber-300",
    fuchsia: "text-fuchsia-300",
    rose:    "text-rose-300",
  }[accent];
  return (
    <div>
      <h3 className={"text-xs uppercase tracking-[0.25em] font-bold mb-1.5 " + colour}>
        {title}
      </h3>
      <p className="text-zinc-300 leading-relaxed text-[13px]">{body}</p>
      {children}
    </div>
  );
}

