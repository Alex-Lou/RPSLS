/**
 * Gestionnaire des messages serveur (WebSocket) de la page En ligne.
 *
 * Extrait verbatim d'OnlinePage : le composant construit, à CHAQUE rendu, une
 * fonction `onMessage` qui appelle `handleServerMessage(msg, ctx)` avec les
 * valeurs de ce rendu — mêmes closures (et même « fraîcheur ») qu'avant.
 */
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { OnlineClient, ServerMessage } from "../../online/online";
import { handleStateLoaded, pushPlayerState } from "../../online/playerSync";
import type {
  LanesMatchInfo,
  LanesRoundData,
  LanesRoundResultData,
  LanesEndData,
} from "../../match/LanesMatchView";
import type { AppState } from "../../store/storeTypes";
import {
  hapticTap,
  hapticMatchStart,
  hapticWin,
  hapticLoss,
  hapticMatchWin,
  hapticMatchLoss,
} from "../../haptic";
import { emptyMatch } from "./types";
import type { Phase, MatchState } from "./types";
import type { RematchHandshake } from "./useRematch";
import { serverErrorText } from "../../online/serverErrors";

type SetState<T> = Dispatch<SetStateAction<T>>;

/** Tout ce que lit / écrit le gestionnaire (valeurs du rendu courant). */
export interface OnlineMessageCtx {
  t: (key: string, params?: Record<string, string | number>) => string;
  clientRef: MutableRefObject<OnlineClient | null>;
  phaseRef: MutableRefObject<Phase>;
  mRef: MutableRefObject<MatchState>;
  lanesMatchRef: MutableRefObject<LanesMatchInfo | null>;
  ladderRef: MutableRefObject<"classe" | null>;
  splashTimer: MutableRefObject<number | null>;
  revealTimer: MutableRefObject<number | null>;
  queueStartAt: number | null;
  rematch: RematchHandshake;
  clearRematch: () => void;
  disarmBotFallback: () => void;
  settleHelloAck: () => void;
  recordMatch: AppState["recordMatch"];
  recordClasseOutcome: AppState["recordClasseOutcome"];
  setLobbyCode: SetState<string>;
  setPhase: SetState<Phase>;
  setQueuePosition: SetState<number>;
  setQueueStartAt: SetState<number | null>;
  setM: SetState<MatchState>;
  setShowMatchFoundSplash: SetState<boolean>;
  setPickStartedAt: SetState<number | null>;
  setRevealRevealed: SetState<boolean>;
  setErrMsg: SetState<string | null>;
  setLanesMatch: SetState<LanesMatchInfo | null>;
  setLanesRound: SetState<LanesRoundData | null>;
  setLanesLastResult: SetState<LanesRoundResultData | null>;
  setLanesEnd: SetState<LanesEndData | null>;
  setLanesSubmitted: SetState<boolean>;
  setPrepReadyState: SetState<{ you: boolean; opp: boolean }>;
  setPrepCoinWinner: SetState<"you" | "opp" | null>;
}

/* ── Message handler ── */
export function handleServerMessage(msg: ServerMessage, ctx: OnlineMessageCtx) {
  const {
    t, clientRef, phaseRef, mRef, lanesMatchRef, ladderRef, splashTimer, revealTimer,
    queueStartAt, rematch, clearRematch, disarmBotFallback, settleHelloAck,
    recordMatch, recordClasseOutcome,
    setLobbyCode, setPhase, setQueuePosition, setQueueStartAt, setM,
    setShowMatchFoundSplash, setPickStartedAt, setRevealRevealed, setErrMsg,
    setLanesMatch, setLanesRound, setLanesLastResult, setLanesEnd, setLanesSubmitted,
    setPrepReadyState, setPrepCoinWinner,
  } = ctx;
  switch (msg.type) {
    case "welcome":
      // session id — we don't display it.
      break;
    case "state_loaded":
      settleHelloAck(); // hello traité côté serveur (pseudo posé) → libère les join*
      if (clientRef.current) handleStateLoaded(msg.state, clientRef.current, msg.claim_token);
      break;
    case "lobby_created":
      setLobbyCode(msg.code);
      setPhase("lobby_open");
      break;
    case "queued":
      setQueuePosition(msg.position);
      setPhase("queued");
      if (queueStartAt === null) setQueueStartAt(Date.now());
      break;
    case "match_found":
      clearRematch();
      disarmBotFallback();
      setM({
        ...emptyMatch(),
        matchId: msg.match_id,
        opponent: msg.opponent.nickname,
        bestOf: msg.best_of,
        youAre: msg.you_are,
      });
      setPhase("matched");
      setQueueStartAt(null);
      hapticMatchStart();
      // Show fullscreen "MATCH FOUND" splash for 2.5s.
      setShowMatchFoundSplash(true);
      if (splashTimer.current) window.clearTimeout(splashTimer.current);
      splashTimer.current = window.setTimeout(() => {
        setShowMatchFoundSplash(false);
      }, 2500);
      break;
    case "rematch_offered":
      rematch.onOffered();
      break;
    case "rematch_declined":
      rematch.onDeclined();
      break;
    case "round_start":
      setM((cur) => ({
        ...cur,
        roundNo: msg.round_no,
        deadlineMs: msg.deadline_ms,
        myMove: null,
        lastResult: null,
      }));
      setPhase("round");
      setPickStartedAt(Date.now());
      setRevealRevealed(false);
      break;
    case "round_result":
      setM((cur) => ({
        ...cur,
        scoreA: msg.score_a,
        scoreB: msg.score_b,
        lastResult: { aMove: msg.a_move, bMove: msg.b_move, outcome: msg.outcome },
      }));
      setPhase("reveal");
      setRevealRevealed(false);
      // 1.4s of "Rock... Paper... Scissors... SHOOT!" suspense before
      // the verdict actually shows. Haptic fires *after* the suspense so
      // the buzz lands with the reveal animation, not before it.
      if (revealTimer.current) window.clearTimeout(revealTimer.current);
      revealTimer.current = window.setTimeout(() => {
        setRevealRevealed(true);
        // Latest message captured in closure to derive win/loss/draw.
        const youAreA = msg.outcome.kind === "a_wins";
        const youAreB = msg.outcome.kind === "b_wins";
        // We need our own slot — read from current state ref-ish via setter.
        setM((cur) => {
          const win =
            (cur.youAre === "a" && youAreA) || (cur.youAre === "b" && youAreB);
          const draw = msg.outcome.kind === "draw";
          if (draw) hapticTap();
          else if (win) hapticWin();
          else hapticLoss();
          return cur;
        });
      }, 1400);
      break;
    case "match_end": {
      // Match déjà quitté (forfait / « Quitter ») : le serveur envoie AUSSI
      // match_end au partant. L'ignorer — sinon mRef (déjà remis à zéro,
      // youAre="a") enregistrait une VICTOIRE au slot B et ramenait l'écran
      // de fin par-dessus le menu.
      if (phaseRef.current !== "matched" && phaseRef.current !== "round" && phaseRef.current !== "reveal") break;
      // Log this online 1v1 to history with the real opponent's nickname.
      const prev = mRef.current;
      const outcome = msg.winner == null ? "draw" : msg.winner === prev.youAre ? "win" : "loss";
      recordMatch({
        id: `${prev.matchId || "online"}-${Date.now()}`,
        mode: "online",
        bestOf: prev.bestOf,
        opponent: { kind: "human", nickname: prev.opponent || t("online.anonymous") },
        scorePlayer:   prev.youAre === "a" ? msg.score_a : msg.score_b,
        scoreOpponent: prev.youAre === "a" ? msg.score_b : msg.score_a,
        outcome,
        rounds: [],
        xpDelta: outcome === "win" ? 60 : outcome === "draw" ? 25 : 15,
        lpDelta: outcome === "win" ? 20 : outcome === "draw" ? 0 : -15,
        timestamp: Date.now(),
        forfeit: msg.forfeit && outcome === "loss",
      });
      // « vs joueur réel » lancé depuis le hub Classé → crédite AUSSI le
      // classeLp local (le rankLp serveur est déjà géré) : compter dans les deux.
      if (ladderRef.current === "classe") {
        recordClasseOutcome(outcome, msg.forfeit && outcome === "loss");
      }
      setM((cur) => {
        const won = msg.winner === cur.youAre;
        if (won) hapticMatchWin();
        else if (msg.winner !== null) hapticMatchLoss();
        else hapticTap();
        return {
          ...cur,
          scoreA: msg.score_a,
          scoreB: msg.score_b,
          ended: { winner: msg.winner, forfeit: msg.forfeit },
        };
      });
      setPhase("match_end");
      pushPlayerState(clientRef.current);
      break;
    }
    case "opponent_left":
      // Wait for match_end which arrives right after.
      break;
    case "error":
      settleHelloAck(); // hello rejeté (auth_*) → ne pas bloquer l'attente d'ack
      setErrMsg(serverErrorText(msg.code));
      setPhase("error");
      break;
    case "lanes_match_found":
      // Fresh match — wipe any stale state from a previous one, including
      // prep readiness + coin winner so a rematch starts clean.
      clearRematch();
      disarmBotFallback();
      setLanesMatch({
        matchId: msg.match_id,
        opponent: msg.opponent.nickname,
        youAre: msg.you_are,
        lanes: msg.lanes,
        winTo: msg.win_to,
      });
      setLanesRound(null);
      setLanesLastResult(null);
      setLanesEnd(null);
      setLanesSubmitted(false);
      setPrepReadyState({ you: false, opp: false });
      setPrepCoinWinner(null);
      setPhase("lanes_prep");
      hapticMatchStart();
      break;

    case "prep_ready_state":
      // Server sent per-perspective tally — no slot math needed.
      setPrepReadyState({ you: msg.you_ready, opp: msg.opp_ready });
      break;

    case "start_coin_flip": {
      // Translate server slot to this client's POV. The actual coin
      // animation runs inside MatchPrepScreen, driven by `prepCoinWinner`.
      const lm = lanesMatchRef.current;
      const side: "you" | "opp" =
        lm && msg.winner === lm.youAre ? "you" : "opp";
      setPrepCoinWinner(side);
      break;
    }

    case "lanes_round_start":
      setLanesRound({
        no: msg.round_no,
        deadlineMs: msg.deadline_ms,
        startedAt: Date.now(),
      });
      // A new round wipes the just-seen reveal and the locked picks.
      setLanesLastResult(null);
      setLanesSubmitted(false);
      // First round arriving from the server is the signal that prep is
      // done — leave the prep screen for the real match view. Subsequent
      // rounds (already in lanes_match) are no-ops on this branch.
      if (phaseRef.current === "lanes_prep") {
        setPhase("lanes_match");
      }
      break;

    case "lanes_round_result": {
      // Translate server (a/b) → local (you/opp) coordinates.
      setLanesMatch((cur) => {
        if (!cur) return cur;
        const youA = cur.youAre === "a";
        const r: LanesRoundResultData = {
          yourPlays:    youA ? msg.a_plays : msg.b_plays,
          oppPlays:     youA ? msg.b_plays : msg.a_plays,
          laneResults:  msg.lane_results,
          yourPoints:   youA ? msg.a_points : msg.b_points,
          oppPoints:    youA ? msg.b_points : msg.a_points,
          roundWinsYou: youA ? msg.round_wins_a : msg.round_wins_b,
          roundWinsOpp: youA ? msg.round_wins_b : msg.round_wins_a,
        };
        setLanesLastResult(r);
        // The round is over — clear it so the view shows the reveal.
        // A new round_start will reset everything cleanly.
        setLanesRound(null);
        // Haptic timed to land with the reveal (1.4s into the suspense).
        window.setTimeout(() => {
          if (r.yourPoints > r.oppPoints) hapticWin();
          else if (r.yourPoints < r.oppPoints) hapticLoss();
          else hapticTap();
        }, 1400);
        return cur;
      });
      break;
    }

    case "lanes_match_end": {
      // Log this online Constellation duel to history (simplified entry — the
      // 3-lane rounds don't map to the single-move round log).
      const lm = lanesMatchRef.current;
      if (lm) {
        const youA = lm.youAre === "a";
        const winsYou = youA ? msg.round_wins_a : msg.round_wins_b;
        const winsOpp = youA ? msg.round_wins_b : msg.round_wins_a;
        const outcome = msg.winner == null ? "draw" : msg.winner === lm.youAre ? "win" : "loss";
        recordMatch({
          id: `${lm.matchId || "lanes"}-${Date.now()}`,
          mode: "constellation",
          bestOf: lm.winTo,
          opponent: { kind: "human", nickname: lm.opponent || t("online.anonymous") },
          scorePlayer: winsYou,
          scoreOpponent: winsOpp,
          outcome,
          rounds: [],
          xpDelta: outcome === "win" ? 60 : outcome === "draw" ? 25 : 15,
          lpDelta: outcome === "win" ? 20 : outcome === "draw" ? 0 : -15,
          timestamp: Date.now(),
          forfeit: msg.forfeit && outcome === "loss",
        });
      }
      setLanesMatch((cur) => {
        if (!cur) return cur;
        const youA = cur.youAre === "a";
        const youWon = msg.winner === cur.youAre;
        const draw = msg.winner === null;
        if (youWon) hapticMatchWin();
        else if (!draw) hapticMatchLoss();
        else hapticTap();
        setLanesEnd({
          winner: msg.winner,
          roundWinsYou: youA ? msg.round_wins_a : msg.round_wins_b,
          roundWinsOpp: youA ? msg.round_wins_b : msg.round_wins_a,
          forfeit: msg.forfeit,
        });
        return cur;
      });
      // If the match died DURING prep (both prep timeouts + the mid-prep
      // Leave path on the server send LanesMatchEnd straight from
      // prep_phase), we're still in lanes_prep — slide into lanes_match
      // so LanesMatchView can render the end screen instead of the
      // player getting frozen on the "Confirmez tous les deux…" hint.
      if (phaseRef.current === "lanes_prep") {
        setPhase("lanes_match");
      }
      pushPlayerState(clientRef.current);
      break;
    }

    case "chat":
    case "pong":
    default:
      break;
  }
}
