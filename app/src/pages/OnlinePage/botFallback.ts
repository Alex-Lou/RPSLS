/**
 * Moteur du repli CPU (« bot fallback ») de la page En ligne.
 *
 * Extrait verbatim d'OnlinePage : `createBotFallback(ctx)` est appelé à CHAQUE
 * rendu et renvoie les mêmes fonctions qu'avant (mêmes closures par rendu, les
 * minuteurs armés gardent la version du rendu qui les a armés).
 */
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { MOVES, type Move, aiMove, rollAiMood, localResolve, type AiMood } from "../../engine/game";
import type { OnlineClient, PlayerSlot } from "../../online/online";
import { pushPlayerState } from "../../online/playerSync";
import type { AppState } from "../../store/storeTypes";
import {
  hapticTap,
  hapticLock,
  hapticMatchStart,
  hapticWin,
  hapticLoss,
  hapticMatchWin,
  hapticMatchLoss,
} from "../../haptic";
import { QUEUE_BOT_TIMEOUT_MS, BOT_NAMES, emptyMatch } from "./types";
import type { Phase, MatchState } from "./types";

type SetState<T> = Dispatch<SetStateAction<T>>;

/** Refs / setters / actions du store dont dépend le repli CPU. */
export interface BotFallbackCtx {
  phaseRef: MutableRefObject<Phase>;
  mRef: MutableRefObject<MatchState>;
  modeRef: MutableRefObject<"classic" | "lanes">;
  bestOfRef: MutableRefObject<number>;
  clientRef: MutableRefObject<OnlineClient | null>;
  ladderRef: MutableRefObject<"classe" | null>;
  botMoodRef: MutableRefObject<AiMood>;
  playerRecentRef: MutableRefObject<Move[]>;
  botFallbackTimer: MutableRefObject<number | null>;
  botRoundTimer: MutableRefObject<number | null>;
  botDeadlineTimer: MutableRefObject<number | null>;
  splashTimer: MutableRefObject<number | null>;
  recordMatch: AppState["recordMatch"];
  recordClasseOutcome: AppState["recordClasseOutcome"];
  setBotArmedAt: SetState<number | null>;
  setQueueStartAt: SetState<number | null>;
  setVsBot: SetState<boolean>;
  setPhase: SetState<Phase>;
  setM: SetState<MatchState>;
  setShowMatchFoundSplash: SetState<boolean>;
  setPickStartedAt: SetState<number | null>;
  setRevealRevealed: SetState<boolean>;
}

export function createBotFallback(ctx: BotFallbackCtx) {
  const {
    phaseRef, mRef, modeRef, bestOfRef, clientRef, ladderRef, botMoodRef, playerRecentRef,
    botFallbackTimer, botRoundTimer, botDeadlineTimer, splashTimer,
    recordMatch, recordClasseOutcome,
    setBotArmedAt, setQueueStartAt, setVsBot, setPhase, setM,
    setShowMatchFoundSplash, setPickStartedAt, setRevealRevealed,
  } = ctx;

  /* ── Bot fallback engine ──
     A self-contained local match that reuses the same cinematic phases as a
     real online game, so the opponent simply "is" the next player you face. */

  function armBotFallback() {
    disarmBotFallback();
    setBotArmedAt(Date.now());
    botFallbackTimer.current = window.setTimeout(() => {
      // Only kick in if we're still hunting (not already matched).
      if (phaseRef.current === "connecting" || phaseRef.current === "queued") {
        startBotFallback();
      }
    }, QUEUE_BOT_TIMEOUT_MS);
  }
  function disarmBotFallback() {
    if (botFallbackTimer.current) {
      window.clearTimeout(botFallbackTimer.current);
      botFallbackTimer.current = null;
    }
    setBotArmedAt(null);
  }
  /** Player tapped "Attendre encore un humain" — restart the fallback timer
   *  from zero so they get another full window without re-queueing. */
  function extendBotFallback() {
    if (phaseRef.current !== "connecting" && phaseRef.current !== "queued") return;
    armBotFallback();
  }
  function clearBotTimers() {
    if (botRoundTimer.current) { window.clearTimeout(botRoundTimer.current); botRoundTimer.current = null; }
    if (botDeadlineTimer.current) { window.clearTimeout(botDeadlineTimer.current); botDeadlineTimer.current = null; }
  }

  function startBotFallback() {
    disarmBotFallback();
    // Tell the server we'\''re leaving any pending match BEFORE dropping the
    // socket. Without this, a match task spawned in the last few hundred ms
    // (between our last queue check and now) sits there waiting for a move
    // from a disconnected client, holding the slot until the 12s deadline.
    // The on_end cleanup eventually removes the DashMap entries, but the
    // race window means we burn match-cap quota and CPU for nothing.
    const c = clientRef.current;
    if (c && c.status === "open") {
      try { c.send({ type: "leave_match" }); } catch { /* ignore */ }
    }
    // Brief grace so the leave_match text frame actually flushes to the
    // socket before disconnect cancels its in-flight write.
    window.setTimeout(() => {
      try { c?.disconnect(); } catch { /* ignore */ }
    }, 80);
    clientRef.current = null;
    setQueueStartAt(null);

    // Lanes mode has a full local CPU experience already — use it.
    if (modeRef.current === "lanes") {
      setVsBot(false);
      setPhase("lanes_bot");
      return;
    }

    // Classic: drive the existing online flow locally.
    botMoodRef.current = rollAiMood();
    playerRecentRef.current = [];
    const botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    setVsBot(true);
    setM({ ...emptyMatch(), matchId: `bot-${Date.now()}`, opponent: botName, bestOf: bestOfRef.current, youAre: "a" });
    setPhase("matched");
    hapticMatchStart();
    setShowMatchFoundSplash(true);
    if (splashTimer.current) window.clearTimeout(splashTimer.current);
    splashTimer.current = window.setTimeout(() => {
      setShowMatchFoundSplash(false);
      startBotRound();
    }, 2500);
  }

  function startBotRound() {
    clearBotTimers();
    setM((cur) => ({ ...cur, roundNo: cur.roundNo + 1, deadlineMs: 10_000, myMove: null, lastResult: null }));
    setPhase("round");
    setPickStartedAt(Date.now());
    setRevealRevealed(false);
    // Auto-pick a random move if the player lets the clock run out.
    botDeadlineTimer.current = window.setTimeout(() => {
      if (mRef.current.myMove == null) {
        doBotPlay(MOVES[Math.floor(Math.random() * MOVES.length)]);
      }
    }, 10_300);
  }

  function doBotPlay(mv: Move) {
    if (mRef.current.myMove) return; // already locked this round
    if (botDeadlineTimer.current) { window.clearTimeout(botDeadlineTimer.current); botDeadlineTimer.current = null; }
    hapticLock();
    setM((cur) => ({ ...cur, myMove: mv }));
    resolveBotRound(mv);
  }

  function resolveBotRound(playerMv: Move) {
    playerRecentRef.current = [...playerRecentRef.current, playerMv].slice(-10);
    const botMv = aiMove(botMoodRef.current, "normal", playerRecentRef.current);
    const res = localResolve(playerMv, botMv); // a = you, b = bot
    setM((cur) => {
      const scoreA = cur.scoreA + (res.outcome.kind === "a_wins" ? 1 : 0);
      const scoreB = cur.scoreB + (res.outcome.kind === "b_wins" ? 1 : 0);
      return { ...cur, scoreA, scoreB, lastResult: { aMove: res.move_a, bMove: res.move_b, outcome: res.outcome } };
    });
    setPhase("reveal");
    setRevealRevealed(false);
    clearBotTimers();
    // 1.4s "Rock… Paper… Scissors… SHOOT!" suspense, mirroring the server.
    botRoundTimer.current = window.setTimeout(() => {
      setRevealRevealed(true);
      if (res.outcome.kind === "draw") hapticTap();
      else if (res.outcome.kind === "a_wins") hapticWin();
      else hapticLoss();
      const cur = mRef.current;
      const tgt = Math.floor(cur.bestOf / 2) + 1;
      const over = cur.scoreA >= tgt || cur.scoreB >= tgt;
      botRoundTimer.current = window.setTimeout(
        () => (over ? endBotMatch() : startBotRound()),
        over ? 1400 : 1600,
      );
    }, 1400);
  }

  function endBotMatch() {
    const cur = mRef.current;
    const tgt = Math.floor(cur.bestOf / 2) + 1;
    const winner: PlayerSlot | null = cur.scoreA >= tgt ? "a" : cur.scoreB >= tgt ? "b" : null;
    if (winner === "a") hapticMatchWin();
    else if (winner === "b") hapticMatchLoss();
    else hapticTap();
    // Bot fallback is a real match — register it so XP/éclats/quests credit.
    // lpDelta stays 0: rankLp is server-authoritative (match_engine.rs), so a
    // local bot match must not move the ladder.
    const outcome = winner === "a" ? "win" : winner === "b" ? "loss" : "draw";
    recordMatch({
      id: `online-bot-${Date.now()}`,
      mode: "online",
      bestOf: cur.bestOf,
      opponent: { kind: "cpu", mood: botMoodRef.current },
      scorePlayer: cur.scoreA,
      scoreOpponent: cur.scoreB,
      outcome,
      rounds: [],
      xpDelta: outcome === "win" ? 60 : outcome === "draw" ? 25 : 15,
      lpDelta: 0,
      timestamp: Date.now(),
      forfeit: false,
    });
    // Fallback CPU d'un « vs joueur réel » depuis le hub Classé → crédite le
    // classeLp local aussi (parité avec le vrai match : compter dans les deux).
    if (ladderRef.current === "classe") recordClasseOutcome(outcome, false);
    setM((c) => ({ ...c, ended: { winner, forfeit: false } }));
    setPhase("match_end");
    pushPlayerState(clientRef.current);
  }

  return {
    armBotFallback,
    disarmBotFallback,
    extendBotFallback,
    clearBotTimers,
    startBotFallback,
    doBotPlay,
  };
}
