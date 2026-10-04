import type { Move } from "../../engine/game";
import { rpslsBeats } from "../../engine/lanesEngine";
import { eclatsReward } from "../../engine/economy";
import { hapticLock, hapticMatchWin, hapticMatchLoss, hapticTap, hapticWin, hapticLoss } from "../../haptic";
import { cpuRankedDecision } from "../rankedAI";
import type { CardId } from "../rankedTypes";
import {
  REVEAL_SUSPENSE_MS, SUDDEN_DEATH_POST_MS, SUDDEN_DEATH_DUEL_TIE_MS,
} from "./rankedGameConstants";
import type { RankedGameCtx } from "./rankedGameContext";

/**
 * createSubPhases — fabrique (appelée À CHAQUE rendu) des sous-phases Riposte
 * et Mort subite + finalizeMatch (fin de match après sous-phase). Extrait
 * VERBATIM de RankedGame.
 */
export function createSubPhases(ctx: RankedGameCtx, startNextRound: () => void) {
  const {
    riposteData, suddenDeathData, lastResult, difficulty, winTo, roundPauseMs, savedDeck,
    recordMatch, awardCardMasteryXp,
    moodRef, playerHistoryRef, roundNoRef, wonLastRoundRef, recordedOutcomeRef,
    youCardsPlayedRef, oppCardsPlayedRef,
    setRiposteData, setSuddenDeathData, setBattle, setLastResult, setEnd,
  } = ctx;

  /* ──────────── Riposte sub-phase ──────────── */

  /** Player picks the rematch move. We then roll the CPU's counter and run
   *  the suspense reveal, then apply the flip and either start the next
   *  round or end the match (depending on the recalculated score). */
  function handleRipostePick(move: Move) {
    if (!riposteData || riposteData.phase !== "pick") return;
    hapticLock();
    const cpuPlay = cpuRankedDecision(
      {
        mood: moodRef.current,
        difficulty,
        playerHistory: playerHistoryRef.current,
        mana: 1,
        hand: [],
      },
      1,
    );
    const cpuMove = cpuPlay.plays[0].mv;
    // Determine outcome of the rematch.
    const aBeatsB = rpslsBeats(move, cpuMove);
    const bBeatsA = rpslsBeats(cpuMove, move);
    const playerWonRematch = !!aBeatsB && !bBeatsA;
    setRiposteData({
      lane: riposteData.lane,
      phase: "reveal",
      playerMove: move,
      cpuMove,
      flipped: playerWonRematch,
    });
    window.setTimeout(() => {
      if (playerWonRematch) hapticWin(); else if (bBeatsA) hapticLoss(); else hapticTap();
    }, REVEAL_SUSPENSE_MS);
    // After a short pause, apply the flip and proceed.
    window.setTimeout(() => applyRiposteOutcome(playerWonRematch), roundPauseMs);
  }

  /** Apply the lane flip (if the rematch was won), recompute the round
   *  winner, then either start the next round or end the match. */
  function applyRiposteOutcome(playerWonRematch: boolean) {
    if (!riposteData || !lastResult) {
      setRiposteData(null);
      window.setTimeout(() => startNextRound(), 200);
      return;
    }
    if (!playerWonRematch) {
      // Lane stays as a loss — just continue.
      setRiposteData(null);
      const nextWinsA = lastResult.roundWinsYou;
      const nextWinsB = lastResult.roundWinsOpp;
      if (nextWinsA >= winTo || nextWinsB >= winTo) {
        finalizeMatch(nextWinsA, nextWinsB);
      } else {
        startNextRound();
      }
      return;
    }
    // Flip the targeted lane from "b" to "a", recount the round winner,
    // and patch lastResult + battle scores so the UI reflects the change.
    const flippedLanes = lastResult.laneResults.map((lr, i) =>
      i === riposteData.lane
        ? { ...lr, winner: "a" as const, points: 1 }
        : lr,
    );
    const aWins = flippedLanes.filter((l) => l.winner === "a").length;
    const bWins = flippedLanes.filter((l) => l.winner === "b").length;
    const newRoundWinner: "a" | "b" | "draw" =
      aWins > bWins ? "a" : bWins > aWins ? "b" : "draw";
    // Score delta from the original round outcome → the new one.
    const origRoundWinner = lastResult.roundWinner;
    let deltaA = 0, deltaB = 0;
    if (newRoundWinner === "a" && origRoundWinner !== "a") {
      deltaA = 1;
      if (origRoundWinner === "b") deltaB = -1;
    } else if (newRoundWinner === "b" && origRoundWinner !== "b") {
      deltaB = 1;
      if (origRoundWinner === "a") deltaA = -1;
    } else if (newRoundWinner === "draw") {
      if (origRoundWinner === "a") deltaA = -1;
      if (origRoundWinner === "b") deltaB = -1;
    }
    const nextWinsA = Math.max(0, lastResult.roundWinsYou + deltaA);
    const nextWinsB = Math.max(0, lastResult.roundWinsOpp + deltaB);
    setBattle((b) => ({
      ...b,
      roundWinsA: Math.max(0, b.roundWinsA + deltaA),
      roundWinsB: Math.max(0, b.roundWinsB + deltaB),
    }));
    setLastResult((prev) => prev ? {
      ...prev,
      laneResults: flippedLanes,
      roundWinner: newRoundWinner,
      roundWinsYou: nextWinsA,
      roundWinsOpp: nextWinsB,
    } : prev);
    wonLastRoundRef.current = newRoundWinner === "a";
    setRiposteData(null);
    if (nextWinsA >= winTo || nextWinsB >= winTo) {
      finalizeMatch(nextWinsA, nextWinsB);
    } else {
      window.setTimeout(() => startNextRound(), roundPauseMs / 2);
    }
  }

  /* ──────────── Sudden-death sub-phase ──────────── */

  /** Player picks one move; CPU answers. A clean win takes the round point; a
   *  duel-tie re-picks until decided. */
  function handleSuddenDeathPick(move: Move) {
    if (!suddenDeathData || suddenDeathData.phase !== "pick") return;
    hapticLock();
    const cpuPlay = cpuRankedDecision(
      { mood: moodRef.current, difficulty, playerHistory: playerHistoryRef.current, mana: 1, hand: [] },
      1,
    );
    const cpuMove = cpuPlay.plays[0].mv;
    const playerWins = rpslsBeats(move, cpuMove);
    const cpuWins = rpslsBeats(cpuMove, move);
    if (!playerWins && !cpuWins) {
      // Duel tied → flash it, then re-pick — short delay, the player is
      // already locked in.
      setSuddenDeathData({ phase: "reveal", round: suddenDeathData.round, playerMove: move, cpuMove, winner: null });
      window.setTimeout(() => hapticTap(), 350);
      window.setTimeout(() => setSuddenDeathData({ phase: "pick", round: roundNoRef.current }), SUDDEN_DEATH_DUEL_TIE_MS);
      return;
    }
    const winner: "a" | "b" = playerWins ? "a" : "b";
    setSuddenDeathData({ phase: "reveal", round: suddenDeathData.round, playerMove: move, cpuMove, winner });
    window.setTimeout(() => { if (winner === "a") hapticWin(); else hapticLoss(); }, 300);
    window.setTimeout(() => applySuddenDeath(winner), SUDDEN_DEATH_POST_MS);
  }

  /** Award the broken-tie round point to the duel winner, then continue/finish. */
  function applySuddenDeath(winner: "a" | "b") {
    if (!lastResult) {
      setSuddenDeathData(null);
      window.setTimeout(() => startNextRound(), 200);
      return;
    }
    const deltaA = winner === "a" ? 1 : 0;
    const deltaB = winner === "b" ? 1 : 0;
    const nextWinsA = lastResult.roundWinsYou + deltaA;
    const nextWinsB = lastResult.roundWinsOpp + deltaB;
    setBattle((b) => ({ ...b, roundWinsA: b.roundWinsA + deltaA, roundWinsB: b.roundWinsB + deltaB }));
    setLastResult((prev) => prev ? { ...prev, roundWinner: winner, roundWinsYou: nextWinsA, roundWinsOpp: nextWinsB } : prev);
    wonLastRoundRef.current = winner === "a";
    setSuddenDeathData(null);
    if (nextWinsA >= winTo || nextWinsB >= winTo) {
      finalizeMatch(nextWinsA, nextWinsB);
    } else {
      window.setTimeout(() => startNextRound(), roundPauseMs / 2);
    }
  }

  /** Helper shared by the normal end-of-match path and the post-Riposte
   *  path: record the result + show the cinematic end screen. */
  function finalizeMatch(winsA: number, winsB: number) {
    const youWon = winsA > winsB;
    if (recordedOutcomeRef.current) return; // déjà enregistré pour ce match
    recordedOutcomeRef.current = youWon ? "win" : "loss";
    recordMatch({
      id: `ranked-cpu-${Date.now()}`,
      mode: "constellation",
      bestOf: winTo,
      opponent: { kind: "cpu", mood: moodRef.current },
      scorePlayer: winsA,
      scoreOpponent: winsB,
      outcome: youWon ? "win" : "loss",
      rounds: [],
      xpDelta: youWon ? 60 : 15,
      lpDelta: 0,
      timestamp: Date.now(),
      forfeit: false,
    });
    window.setTimeout(() => {
      if (youWon) hapticMatchWin(); else hapticMatchLoss();
      awardCardMasteryXp((savedDeck ?? []) as CardId[], youWon ? "win" : "loss");
      setEnd({
        winner: youWon ? "a" : "b",
        roundWinsYou: winsA,
        roundWinsOpp: winsB,
        forfeit: false,
        xpGained: youWon ? 60 : 15,
        eclatsGained: eclatsReward("constellation", youWon ? "win" : "loss", winTo),
        youCardsPlayed: youCardsPlayedRef.current.slice(),
        oppCardsPlayed: oppCardsPlayedRef.current.slice(),
      });
    }, roundPauseMs);
  }

  return { handleRipostePick, handleSuddenDeathPick };
}
