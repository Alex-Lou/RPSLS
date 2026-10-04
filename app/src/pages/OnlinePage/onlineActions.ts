/**
 * Actions utilisateur de la page En ligne (salon, file, annuler, coup, quitter,
 * retour menu / hub Classé).
 *
 * Extrait verbatim d'OnlinePage : `createOnlineActions(ctx)` est appelé à CHAQUE
 * rendu avec les valeurs de ce rendu — mêmes closures qu'avant.
 */
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { Move } from "../../engine/game";
import type { OnlineClient } from "../../online/online";
import { hapticLock } from "../../haptic";
import { emptyMatch } from "./types";
import type { Phase, MatchState, ConnStatus } from "./types";
import type { OnlineIntent } from "../../online/onlineIntent";
import { setPlayReturnView } from "../../online/playReturnView";
import type { createBotFallback } from "./botFallback";

type SetState<T> = Dispatch<SetStateAction<T>>;

export interface OnlineActionsCtx {
  t: (key: string, params?: Record<string, string | number>) => string;
  ensureClient: () => Promise<OnlineClient>;
  bot: ReturnType<typeof createBotFallback>;
  clearRematch: () => void;
  clientRef: MutableRefObject<OnlineClient | null>;
  phaseRef: MutableRefObject<Phase>;
  ladderRef: MutableRefObject<"classe" | null>;
  classeReturnRef: MutableRefObject<boolean>;
  playerRecentRef: MutableRefObject<Move[]>;
  connStatus: ConnStatus;
  mode: "classic" | "lanes";
  bestOf: number;
  lanesWinTo: number;
  joinCode: string;
  vsBot: boolean;
  m: MatchState;
  setErrMsg: SetState<string | null>;
  setPhase: SetState<Phase>;
  setLobbyCode: SetState<string>;
  setJoinCode: SetState<string>;
  setQueuePosition: SetState<number>;
  setM: SetState<MatchState>;
  setVsBot: SetState<boolean>;
}

export function createOnlineActions(ctx: OnlineActionsCtx) {
  const {
    t, ensureClient, clearRematch, clientRef, phaseRef, ladderRef, classeReturnRef,
    playerRecentRef, connStatus, mode, bestOf, lanesWinTo, joinCode, vsBot, m,
    setErrMsg, setPhase, setLobbyCode, setJoinCode, setQueuePosition, setM, setVsBot,
  } = ctx;
  const { startBotFallback, armBotFallback, disarmBotFallback, clearBotTimers, doBotPlay } = ctx.bot;

  /* ── Actions ── */
  function handleConnectError(e: unknown) {
    const reason = e instanceof Error ? e.message : String(e);
    setErrMsg(t("online.err.unreachable", { reason }));
    setPhase("error");
  }

  async function createLobby() {
    setErrMsg(null);
    setPhase("connecting");
    try {
      const c = await ensureClient();
      c.send({ type: "create_lobby", best_of: bestOf });
      setPhase("creating");
    } catch (e) {
      handleConnectError(e);
    }
  }

  async function joinLobby() {
    if (!joinCode.trim()) return;
    setErrMsg(null);
    setPhase("connecting");
    try {
      const c = await ensureClient();
      c.send({ type: "join_lobby", code: joinCode.trim().toUpperCase() });
      setPhase("joining");
    } catch (e) {
      handleConnectError(e);
    }
  }

  async function joinQueue() {
    setErrMsg(null);
    // Offline / unreachable server → no point queueing, play a bot now.
    if (connStatus === "offline") {
      startBotFallback();
      return;
    }
    setPhase("connecting");
    armBotFallback(); // 10s safety net: no opponent → CPU
    try {
      const c = await ensureClient();
      // The 10s timer (or a cancel) may have already moved us on while the
      // socket was still connecting — only queue if we're still waiting.
      if (phaseRef.current !== "connecting") return;
      if (mode === "lanes") {
        c.send({ type: "join_lanes_queue", win_to: lanesWinTo });
      } else {
        c.send({ type: "join_queue", best_of: bestOf });
      }
    } catch {
      // Couldn't reach the server within budget → fall back to a bot instead
      // of dead-ending on an error screen.
      if (phaseRef.current === "connecting") startBotFallback();
    }
  }

  // Variante auto-file (posée par un hub via onlineIntent) : même logique que
  // joinQueue mais avec les valeurs de l'intent EXPLICITES (le setMode/setBestOf
  // du montage n'est pas encore reflété dans le state au moment de l'appel). Vrai
  // joueur d'abord, fallback CPU à 10s (armBotFallback) — inchangé.
  async function autoJoinQueue(intent: OnlineIntent) {
    setErrMsg(null);
    if (connStatus === "offline") {
      startBotFallback();
      return;
    }
    setPhase("connecting");
    armBotFallback();
    try {
      const c = await ensureClient();
      if (phaseRef.current !== "connecting") return;
      if (intent.mode === "lanes") {
        c.send({ type: "join_lanes_queue", win_to: intent.winTo ?? lanesWinTo });
      } else {
        c.send({ type: "join_queue", best_of: intent.bestOf ?? bestOf });
      }
    } catch {
      if (phaseRef.current === "connecting") startBotFallback();
    }
  }

  function cancel() {
    disarmBotFallback();
    // Annuler la file clôt le contexte « vs réel Classé » : un match manuel lancé
    // ensuite (lobby privé…) NE doit PAS créditer classeLp (Alex — zéro inéquité).
    ladderRef.current = null;
    clientRef.current?.send({ type: "cancel" });
    setPhase("menu");
    setLobbyCode("");
    setQueuePosition(0);
  }

  function playMove(mv: Move) {
    if (vsBot) { doBotPlay(mv); return; }
    if (m.myMove) return;
    hapticLock();
    setM((cur) => ({ ...cur, myMove: mv }));
    clientRef.current?.send({ type: "play_move", mv });
  }

  // Retour au HUB D'ORIGINE quand la session vient du Classé (bug Alex 2026-07) :
  // au lieu du menu « En ligne » interne, on pose la vue de retour et on demande
  // à App de rouvrir PlayPage sur le hub Classé. Retourne true si on a navigué
  // (l'appelant doit s'arrêter là — OnlinePage va se démonter). false sinon.
  function goToClasseHub(): boolean {
    if (!classeReturnRef.current) return false;
    classeReturnRef.current = false;
    ladderRef.current = null;
    disarmBotFallback();
    clearBotTimers();
    clearRematch();
    setPlayReturnView("classe_lobby");
    window.dispatchEvent(new CustomEvent("rpsls:navigate", { detail: "play" }));
    return true;
  }

  function leaveMatch() {
    ladderRef.current = null; // quitter un match clôt le contexte « vs réel Classé »
    if (vsBot) { backToMenu(); return; } // local match — nothing to tell the server
    // Synchrone (pas d'attente de l'effet) : le match_end que le serveur renvoie
    // au partant doit trouver la phase déjà hors match (cf. case "match_end").
    phaseRef.current = "menu";
    clientRef.current?.send({ type: "leave_match" });
    if (goToClasseHub()) return; // session Classé → retour au hub Classé, pas au menu En ligne
    setPhase("menu");
    setM(emptyMatch());
  }

  function backToMenu() {
    if (goToClasseHub()) return; // session Classé → retour au hub Classé, pas au menu En ligne
    disarmBotFallback();
    ladderRef.current = null; // retour menu → contexte Classé clos (pas de fuite classeLp)
    clearBotTimers();
    setVsBot(false);
    playerRecentRef.current = [];
    setPhase("menu");
    setM(emptyMatch());
    setLobbyCode("");
    setJoinCode("");
    setQueuePosition(0);
    setErrMsg(null);
    clearRematch();
  }

  return {
    createLobby,
    joinLobby,
    joinQueue,
    autoJoinQueue,
    cancel,
    playMove,
    leaveMatch,
    backToMenu,
  };
}
