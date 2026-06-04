/**
 * Local Constellation Lanes match — vs CPU, no server, no network.
 *
 * Drives the same passive LanesMatchView used by the online mode, but feeds
 * it state from a client-side engine + AI.
 */

import { useEffect, useRef, useState } from "react";
import {
  LanesMatchView,
  type LanesMatchInfo,
  type LanesRoundData,
  type LanesRoundResultData,
  type LanesEndData,
} from "./LanesMatchView";
import { type AiMood, type Move } from "./game";
import { useStore } from "./store";
import {
  battleStatus,
  cpuLanesPicks,
  makeLocalBattle,
  resolveLanesRound,
  type LocalBattleState,
} from "./lanesEngine";
import type { LanePlay, PlayerSlot } from "./online";
import {
  hapticLock,
  hapticMatchStart,
  hapticMatchWin,
  hapticMatchLoss,
  hapticTap,
  hapticWin,
  hapticLoss,
} from "./haptic";

const LANE_COUNT = 3;
const PICK_DEADLINE_MS = 13_500;          // matches server PICK_DEADLINE
const ROUND_PAUSE_MS = 7_500;              // matches server inter-round sleep
const REVEAL_SUSPENSE_MS = 1_400;
const MATCH_FOUND_SPLASH_MS = 2_500;

export function LocalLanesGame({
  winTo,
  onQuit,
}: {
  /** Number of round-wins needed (e.g. 2 = best of 3 in round-wins). */
  winTo: number;
  onQuit: () => void;
}) {
  const profileNickname = useStore((s) => s.player.nickname);
  const difficulty = useStore((s) => s.player.difficulty);
  const recordMatch = useStore((s) => s.recordMatch);

  // Match info — set once at start, persists through the run.
  const matchInfo: LanesMatchInfo = {
    matchId: "local",
    opponent: "CPU",
    youAre: "a" as PlayerSlot, // human is always slot A locally
    lanes: LANE_COUNT,
    winTo,
  };

  // Lifted lanes state — same shape as in OnlinePage, fed by our local loop.
  const [round, setRound] = useState<LanesRoundData | null>(null);
  const [lastResult, setLastResult] = useState<LanesRoundResultData | null>(null);
  const [end, setEnd] = useState<LanesEndData | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Constellation CPU is fair by default: a pure-uniform "random" mood (no
  // aggressive/logical bias, true 1/5 per move). The challenge is dialed up
  // only via the explicit difficulty setting (Profil), never by a hidden bias.
  const moodRef = useRef<AiMood>("random");
  // Player move history fed to the hard AI.
  const playerHistoryRef = useRef<Move[]>([]);
  // Local battle state machine.
  const battleRef = useRef<LocalBattleState>(makeLocalBattle());
  const roundNoRef = useRef(0);
  // Timer ID for the "auto-loss on timeout" deadline.
  const deadlineTimerRef = useRef<number | null>(null);

  // Kick off: splash → first round.
  useEffect(() => {
    hapticMatchStart();
    const t = window.setTimeout(() => startNextRound(), MATCH_FOUND_SPLASH_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startNextRound() {
    roundNoRef.current += 1;
    setSubmitted(false);
    setLastResult(null);
    setRound({
      no: roundNoRef.current,
      deadlineMs: PICK_DEADLINE_MS,
      startedAt: Date.now(),
    });
    // Solo vs CPU: NO countdown / auto-loss. The player picks at their own
    // pace — the game never plays a move (e.g. Rock×3) for them.
  }

  function handleSubmit(picks: [Move, Move, Move]) {
    if (submitted) return;
    hapticLock();
    if (deadlineTimerRef.current) {
      window.clearTimeout(deadlineTimerRef.current);
      deadlineTimerRef.current = null;
    }
    const plays: LanePlay[] = picks.map((mv) => ({ mv, mana: 0 }));
    setSubmitted(true);
    resolveAndAdvance(plays, /*timedOut=*/ false);
  }

  function resolveAndAdvance(playerPlays: LanePlay[], timedOut: boolean) {
    // Pretend the CPU sends its picks at the same time as the player.
    const cpuPlays = cpuLanesPicks(
      {
        mood: moodRef.current,
        difficulty,
        playerHistory: playerHistoryRef.current,
      },
      LANE_COUNT,
    );

    // Record the player's real picks for the AI's PAST-rounds pattern model —
    // but only AFTER the CPU has committed this round, so it can never peek at
    // the picks the player just made (that would be cheating). Timeout fillers
    // (Rock×3) aren't real choices, so they don't pollute the model.
    if (!timedOut) {
      playerHistoryRef.current.push(...playerPlays.map((p) => p.mv));
    }

    let outcome;
    if (timedOut) {
      // Mirror the server: silent side loses all lanes regardless of plays.
      outcome = {
        lanes: playerPlays.map((p, i) => ({
          a_play: p,
          b_play: cpuPlays[i],
          outcome: { kind: "b_wins" as const, verb: "wins by timeout" },
          winner: "b" as const,
          points: 1,
        })),
        aPoints: 0,
        bPoints: LANE_COUNT,
        roundWinner: "b" as const,
      };
    } else {
      outcome = resolveLanesRound(playerPlays, cpuPlays);
    }

    // Update battle state.
    const battle = battleRef.current;
    if (outcome.roundWinner === "a") battle.roundWinsA += 1;
    else if (outcome.roundWinner === "b") battle.roundWinsB += 1;
    battle.roundsPlayed += 1;
    battle.history.push(outcome);

    // Clear the round (the view will switch to reveal because lastResult set,
    // round null).
    setRound(null);
    setLastResult({
      yourPlays:    playerPlays,
      oppPlays:     cpuPlays,
      laneResults:  outcome.lanes,
      yourPoints:   outcome.aPoints,
      oppPoints:    outcome.bPoints,
      roundWinsYou: battle.roundWinsA,
      roundWinsOpp: battle.roundWinsB,
    });

    // Reveal-time haptic, delayed to land with the visual reveal.
    window.setTimeout(() => {
      if (outcome.aPoints > outcome.bPoints) hapticWin();
      else if (outcome.aPoints < outcome.bPoints) hapticLoss();
      else hapticTap();
    }, REVEAL_SUSPENSE_MS);

    // Check match end, otherwise schedule next round.
    const status = battleStatus(battle, {
      lanes: LANE_COUNT, winTo, pickDeadlineMs: PICK_DEADLINE_MS,
    });
    if (status.kind === "won") {
      const youWon = status.winner === "a";
      // Log this vs-CPU Constellation match to history (simplified entry — the
      // 3-lane rounds don't map to the per-move round log). Earns casual-like XP.
      recordMatch({
        id: `lanes-cpu-${Date.now()}`,
        mode: "constellation",
        bestOf: winTo,
        opponent: { kind: "cpu", mood: moodRef.current },
        scorePlayer: battle.roundWinsA,
        scoreOpponent: battle.roundWinsB,
        outcome: youWon ? "win" : "loss",
        rounds: [],
        xpDelta: youWon ? 40 : 10,
        lpDelta: 0,
        timestamp: Date.now(),
        forfeit: false,
      });
      window.setTimeout(() => {
        if (youWon) hapticMatchWin(); else hapticMatchLoss();
        setEnd({
          winner: status.winner,
          roundWinsYou: battle.roundWinsA,
          roundWinsOpp: battle.roundWinsB,
          forfeit: false,
        });
      }, ROUND_PAUSE_MS);
    } else {
      window.setTimeout(() => startNextRound(), ROUND_PAUSE_MS);
    }
  }

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (deadlineTimerRef.current) window.clearTimeout(deadlineTimerRef.current);
    };
  }, []);

  function rematch() {
    // Reset everything for a fresh local match.
    setRound(null);
    setLastResult(null);
    setEnd(null);
    setSubmitted(false);
    moodRef.current = "random";
    playerHistoryRef.current = [];
    battleRef.current = makeLocalBattle();
    roundNoRef.current = 0;
    if (deadlineTimerRef.current) {
      window.clearTimeout(deadlineTimerRef.current);
      deadlineTimerRef.current = null;
    }
    hapticMatchStart();
    // Give the match-found splash a beat before round 1 like at fresh start.
    window.setTimeout(() => startNextRound(), MATCH_FOUND_SPLASH_MS);
  }

  return (
    <LanesMatchView
      nickname={profileNickname}
      match={matchInfo}
      round={round}
      lastResult={lastResult}
      end={end}
      submitted={submitted}
      onSubmitPicks={handleSubmit}
      onLeave={onQuit}
      onRematch={rematch}
      showTimer={false}
    />
  );
}
