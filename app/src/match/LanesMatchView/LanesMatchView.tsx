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

import { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import { type Move } from "../../engine/game";
import { useT } from "../../i18n";
import { useAndroidBackPrompt, ScaleToFit, FloatingMatchBackButton } from "../sharedMatchUI";
import { QuitConfirmModal } from "../QuitConfirmModal";
import { useStore } from "../../store/store";
import type { LanesMatchViewProps, Phase } from "./types";
import { ScoreHeader } from "./ScoreHeader";
import { MatchFoundSplash } from "./MatchFoundSplash";
import { MatchEndScene } from "./MatchEndScene";
import { PickStage } from "./PickStage";
import { LockedStage, RevealCountdown } from "./LockedStage";
import { RevealStage } from "./RevealStage";
import { HelpModal } from "./HelpModal";

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
  showTimer = true,
  competitive = true,
}: LanesMatchViewProps & { onRematch?: () => void }) {
  const t = useT();
  const recordAbandon = useStore((s) => s.recordAbandon);
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
        className="absolute -top-9 right-0 z-20 w-9 h-9 rounded-full bg-black/50 backdrop-blur hover:bg-hairline border border-hairline text-ink hover:text-white text-sm font-bold transition flex items-center justify-center"
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

      {/* Stage — ScaleToFit guarantees the whole phase (board + picker + LOCK)
          always fits the available height, so the player NEVER scrolls to
          reach the Lock button. Shrinks uniformly on short screens. */}
      <ScaleToFit className="relative">
        <div className="w-full flex flex-col items-center py-1">
        {phase === "matched" && !showSplash && (
          <div className="text-sm text-ink-muted">{t("lanes.preparingFirstRound")}</div>
        )}
        {phase === "picking" && round && (
          <PickStage
            picks={picks}
            onPick={pickInNextEmpty}
            onClearLane={clearLane}
            startedAt={round.startedAt}
            deadlineMs={round.deadlineMs}
            showTimer={showTimer}
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
      </ScaleToFit>

      {/* Back arrow docked next to the burger (like every other match screen) —
          opens the same quit confirmation as the forfeit button below. */}
      {phase !== "match_end" && (
        <FloatingMatchBackButton onClick={() => setQuitConfirmOpen(true)} label={t("lanes.forfeitMatch")} />
      )}

      {/* Forfeit button — shown anytime but match-end. */}
      {phase !== "match_end" && (
        <button
          onClick={() => setQuitConfirmOpen(true)}
          className="self-center px-4 py-2 rounded-xl bg-hairline hover:bg-rose-500/20 border border-hairline hover:border-rose-500/40 text-ink-muted hover:text-rose-200 text-xs transition"
        >
          {t("lanes.forfeitMatch")}
        </button>
      )}

      <AnimatePresence>
        {quitConfirmOpen && (
          <QuitConfirmModal
            competitive={competitive}
            onCancel={() => setQuitConfirmOpen(false)}
            onConfirm={() => {
              setQuitConfirmOpen(false);
              // Competitive (online) → register the abandon so repeat
              // quitters take the escalating LP penalty before we leave.
              // Casual local vs CPU skips it: no ladder to penalise.
              if (competitive) recordAbandon();
              onLeave();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
