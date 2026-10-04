import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { useStore } from "../../store/store";
import { useT } from "../../i18n";
import type { Move, AiMood } from "../../engine/game";
import type { OnlineClient, ServerMessage } from "../../online/online";
import { setActiveClient } from "../../online/playerSync";
// Sous-modules extraits du dossier OnlinePage/ (verbatim, présentationnel + types + hook santé serveur).
import { QUEUE_BOT_TIMEOUT_MS, emptyMatch } from "./types";
import type { Phase, MatchState } from "./types";
import { useServerStatus } from "./useServerStatus";
import { OnlineMenu } from "./OnlineMenu";
import { useImmersive } from "../../nav/topBarStore";
import { ServerStatusBadge, Waiting } from "./StatusAndWaiting";
import { MatchFoundSplash } from "./MatchFlowSplash";
import { MatchEndScene } from "./MatchEndScene";
import { useRematch } from "./useRematch";
import { RematchOverlays } from "./RematchOverlays";
import { QueueRadar } from "./QueueRadar";
import { consumeOnlineIntent } from "../../online/onlineIntent";
// Logique extraite (verbatim) : gestionnaire WS, repli CPU, connexion, actions.
import { handleServerMessage } from "./onlineMessageHandler";
import { createBotFallback } from "./botFallback";
import { ensureOnlineClient, settleHelloAck as settleHelloAckRef } from "./onlineConnection";
import { createOnlineActions } from "./onlineActions";
import { useLanesArenaOverride } from "./useLanesArenaOverride";
import { classicDerived } from "./classicDerived";
import { useLanesOnlineState } from "./useLanesOnlineState";
import { useOpponentWatchdog } from "./useOpponentWatchdog";
import { ClassicMatchPanel } from "./ClassicMatchPanel";
import { LanesPrepPanel, LanesMatchPanel } from "./LanesPanels";
import { ReconnectBanner, LobbyOpenPanel, LanesBotPanel, OnlineErrorPanel } from "./OnlinePhasePanels";
/** Phases de match (plein écran, HUD propre) — sans barre du haut. */
const IMMERSIVE_PHASES = new Set<Phase>(["matched", "round", "reveal", "match_end", "lanes_match", "lanes_bot"]);

export function OnlinePage() {
  const t = useT();
  const player = useStore((s) => s.player);
  const serverConfig = useStore((s) => s.serverConfig);
  const recordMatch = useStore((s) => s.recordMatch);
  const recordClasseOutcome = useStore((s) => s.recordClasseOutcome);
  const recordAbandon = useStore((s) => s.recordAbandon);
  // Ladder LOCAL à créditer en fin de match (posé par un hub via onlineIntent) :
  // "classe" → on bump classeLp EN PLUS du rankLp serveur ; null → rien de local.
  const ladderRef = useRef<"classe" | null>(null);
  // Origine « hub Classé » de la session (bug Alex 2026-07) : distinct de ladderRef
  // (qui est remis à null par backToMenu/leaveMatch). Persiste jusqu'à ce qu'on
  // revienne EFFECTIVEMENT au hub Classé → tout retour de match (fin ou quit)
  // renvoie au menu Classé, pas au menu « En ligne ». Survit aux rematchs.
  const classeReturnRef = useRef(false);
  /** Open state for the themed forfeit-confirm modal (classic 1v1). */
  const [quitOpen, setQuitOpen] = useState(false);

  // Mode toggle: classic 1v1 (current) vs Constellation Lanes (Phase 1).
  // Once a user picks a mode in the menu, the rest of the flow follows.
  const [mode, setMode] = useState<"classic" | "lanes">("classic");

  const [phase, setPhase] = useState<Phase>("menu");
  const [bestOf, setBestOf] = useState(3);
  // Lus par le repli CPU (startBotFallback), appelé depuis un minuteur armé au
  // montage : sans refs il voyait le mode/bestOf du 1er rendu (Bo3 « classic »
  // au lieu du Bo5 demandé par le hub Classé).
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const bestOfRef = useRef(bestOf);
  bestOfRef.current = bestOf;
  // For Lanes mode: win_to (3 → bo5 in round-wins).
  const [lanesWinTo, setLanesWinTo] = useState(2);
  const [lobbyCode, setLobbyCode] = useState("");        // we created it
  const [joinCode, setJoinCode] = useState("");          // input
  const [queuePosition, setQueuePosition] = useState(0);
  const [queueStartAt, setQueueStartAt] = useState<number | null>(null);
  /** Timestamp of the most recent bot-fallback arming. The QueueRadar reads
   *  this to fill its "🤖 IA dans Ys" countdown; resets when the player taps
   *  "Attendre encore" so the bar restarts from zero. */
  const [botArmedAt, setBotArmedAt] = useState<number | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [m, setM] = useState<MatchState>(emptyMatch());

  // Cinematic state — keeps the experience from feeling rushed.
  const [showMatchFoundSplash, setShowMatchFoundSplash] = useState(false);
  const [pickStartedAt, setPickStartedAt] = useState<number | null>(null);
  const [revealRevealed, setRevealRevealed] = useState(false);
  const splashTimer = useRef<number | null>(null);
  const revealTimer = useRef<number | null>(null);

  // Connection drop tracking — keeps the UI sane during wifi hiccups.
  const [connDropped, setConnDropped] = useState(false);

  // Constellation Lanes state + pre-match prep (cf. useLanesOnlineState).
  const {
    lanesMatch, setLanesMatch, lanesRound, setLanesRound, lanesLastResult, setLanesLastResult,
    lanesEnd, setLanesEnd, lanesSubmitted, setLanesSubmitted,
    prepReadyState, setPrepReadyState, prepCoinWinner, setPrepCoinWinner,
  } = useLanesOnlineState();

  const clientRef = useRef<OnlineClient | null>(null);

  // Rematch handshake (post-match): we asked / opponent asked / a brief toast.
  // `backToMenu` est hissée (déclaration de fonction) ; useRematch lit toujours
  // la dernière version rendue.
  const rematch = useRematch((msg) => clientRef.current?.send(msg), () => backToMenu());
  const clearRematch = rematch.clear;
  const requestRematch = rematch.request;

  // ── Bot fallback ──
  // When no real opponent shows up within QUEUE_BOT_TIMEOUT_MS (or we're
  // offline), we silently drop into a local CPU match so the player always
  // gets a game. `vsBot` drives the classic flow locally; lanes route to the
  // standalone LocalLanesGame via the "lanes_bot" phase.
  const [vsBot, setVsBot] = useState(false);
  // Opponent watchdog: 0 = fine, 1 = "opponent is slow", 2 = "probably gone".
  // Escalates while we're stuck waiting on the opponent/server so the player
  // never sits on a frozen match without feedback or a clean way out.
  const [oppWaitLevel, setOppWaitLevel] = useState(0);
  const botMoodRef = useRef<AiMood>("random");
  const playerRecentRef = useRef<Move[]>([]);
  const botFallbackTimer = useRef<number | null>(null);
  const botRoundTimer = useRef<number | null>(null);
  const botDeadlineTimer = useRef<number | null>(null);

  // Phase mirror so timers can read the live phase without stale closures.
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Opponent watchdog (15 s / 35 s) — cf. useOpponentWatchdog.
  useOpponentWatchdog(phase, m, vsBot, setOppWaitLevel);

  // Latest match snapshots, so the WS message handler can write a one-shot
  // history entry at match end without trusting its stale closure (and without
  // recording inside a state updater, which StrictMode double-invokes).
  const mRef = useRef(m);
  useEffect(() => { mRef.current = m; }, [m]);
  const lanesMatchRef = useRef(lanesMatch);
  useEffect(() => { lanesMatchRef.current = lanesMatch; }, [lanesMatch]);

  // Online is cloud-only now — the public Render instance. No LAN, no manual
  // URLs: the connection target is always the default cloud server.
  const activeServerUrl = serverConfig.cloudUrl;
  const { status: connStatus, latencyMs, refresh: refreshStatus } =
    useServerStatus(activeServerUrl);

  // Lanes arena override (thème + décor adverses) — cf. useLanesArenaOverride.
  const lanesOppPersona = useLanesArenaOverride(lanesMatch, prepCoinWinner);

  /* ── Lazy create client ── (cf. onlineConnection.ts) */
  const helloAckRef = useRef<(() => void) | null>(null);
  function settleHelloAck() {
    settleHelloAckRef(helloAckRef);
  }
  function ensureClient(): Promise<OnlineClient> {
    return ensureOnlineClient({ clientRef, helloAckRef, serverConfig, t, onMessage, setConnDropped });
  }

  /* ── Cleanup on unmount ── */
  useEffect(() => {
    return () => {
      clientRef.current?.disconnect();
      clientRef.current = null;
      setActiveClient(null);
      if (splashTimer.current) window.clearTimeout(splashTimer.current);
      if (revealTimer.current) window.clearTimeout(revealTimer.current);
      if (botFallbackTimer.current) window.clearTimeout(botFallbackTimer.current);
      if (botRoundTimer.current) window.clearTimeout(botRoundTimer.current);
      if (botDeadlineTimer.current) window.clearTimeout(botDeadlineTimer.current);
    };
  }, []);

  // Intention posée par un hub (Classé…) : applique le mode + lance la file
  // AUTOMATIQUEMENT au montage, et mémorise le ladder à créditer. Consume-once
  // (une nav ultérieure sans intent laisse le comportement normal du menu).
  useEffect(() => {
    const intent = consumeOnlineIntent();
    if (!intent) return;
    setMode(intent.mode);
    if (intent.bestOf) setBestOf(intent.bestOf);
    if (intent.winTo) setLanesWinTo(intent.winTo);
    ladderRef.current = intent.ladder ?? null;
    classeReturnRef.current = intent.ladder === "classe"; // origine hub Classé → retour ciblé
    if (intent.autoQueue) autoJoinQueue(intent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Message handler ── (cf. onlineMessageHandler.ts) */
  function onMessage(msg: ServerMessage) {
    handleServerMessage(msg, {
      t, clientRef, phaseRef, mRef, lanesMatchRef, ladderRef, splashTimer, revealTimer,
      queueStartAt, rematch, clearRematch, disarmBotFallback, settleHelloAck,
      recordMatch, recordClasseOutcome,
      setLobbyCode, setPhase, setQueuePosition, setQueueStartAt, setM,
      setShowMatchFoundSplash, setPickStartedAt, setRevealRevealed, setErrMsg,
      setLanesMatch, setLanesRound, setLanesLastResult, setLanesEnd, setLanesSubmitted,
      setPrepReadyState, setPrepCoinWinner,
    });
  }

  /* ── Bot fallback engine ── (cf. botFallback.ts) */
  const bot = createBotFallback({
    phaseRef, mRef, modeRef, bestOfRef, clientRef, ladderRef, botMoodRef, playerRecentRef,
    botFallbackTimer, botRoundTimer, botDeadlineTimer, splashTimer,
    recordMatch, recordClasseOutcome,
    setBotArmedAt, setQueueStartAt, setVsBot, setPhase, setM,
    setShowMatchFoundSplash, setPickStartedAt, setRevealRevealed,
  });
  const { disarmBotFallback, extendBotFallback, startBotFallback } = bot;

  /* ── Actions ── (cf. onlineActions.ts) */
  const {
    createLobby, joinLobby, joinQueue, autoJoinQueue, cancel, playMove, leaveMatch, backToMenu,
  } = createOnlineActions({
    t, ensureClient, bot, clearRematch, clientRef, phaseRef, ladderRef, classeReturnRef,
    playerRecentRef, connStatus, mode, bestOf, lanesWinTo, joinCode, vsBot, m,
    setErrMsg, setPhase, setLobbyCode, setJoinCode, setQueuePosition, setM, setVsBot,
  });

  /* ── Derived ── */
  const statusBadge = (
    <ServerStatusBadge
      mode="cloud"
      url={activeServerUrl}
      status={connStatus}
      latencyMs={latencyMs}
      onRefresh={refreshStatus}
    />
  );
  const target = useMemo(() => Math.floor(m.bestOf / 2) + 1, [m.bestOf]);
  const { youScore, oppScore, youMove, oppMove, outcomeForYou, verb } = classicDerived(m);

  // Phases de MATCH = surface immersive (pas de barre du haut, HUD du match).
  // Menu / file / salon / préparation gardent la barre (retour à gauche).
  useImmersive(IMMERSIVE_PHASES.has(phase));

  /* ── Render ── */
  return (
    <div className={"max-w-3xl w-full mx-auto flex-1 flex flex-col min-h-0 " + (phase === "menu" ? "px-3 pb-1" : "px-4 pt-2 pb-10")}>
      {/* Burger clearance is handled once by <main> in App.tsx now. */}
      {/* Cinematic match-found splash overlay */}
      <AnimatePresence>
        {showMatchFoundSplash && phase !== "menu" && (
          <MatchFoundSplash
            key="splash"
            youName={player.nickname}
            opponentName={m.opponent}
            bestOf={m.bestOf}
            isBot={vsBot}
          />
        )}
      </AnimatePresence>

      {/* Statut serveur — dans le héros du menu, au-dessus des autres phases.
          (Titre « En ligne » + retour : barre du haut unifiée.) */}
      {phase !== "menu" && statusBadge}

      <ReconnectBanner connDropped={connDropped} />


      <AnimatePresence mode="wait">
        {phase === "menu" && (
          <OnlineMenu
            key="menu"
            status={statusBadge}
            mode={mode}
            onMode={setMode}
            bestOf={bestOf}
            onBestOf={setBestOf}
            lanesWinTo={lanesWinTo}
            onLanesWinTo={setLanesWinTo}
            joinCode={joinCode}
            onJoinCode={setJoinCode}
            onFind={joinQueue}
            onCreate={createLobby}
            onJoin={joinLobby}
          />
        )}

        {(phase === "connecting" || phase === "creating" || phase === "joining") && (
          <Waiting
            key="wait"
            label={
              connStatus === "waking" && serverConfig.mode === "cloud"
                ? t("online.waking")
                : t("online.connecting")
            }
            onCancel={cancel}
          />
        )}

        {phase === "lobby_open" && (
          <LobbyOpenPanel key="lobby" lobbyCode={lobbyCode} bestOf={bestOf} cancel={cancel} />
        )}


        {phase === "queued" && (
          <QueueRadar
            key="queued"
            position={queuePosition}
            startedAt={botArmedAt ?? queueStartAt}
            bestOf={bestOf}
            onCancel={cancel}
            botTimeoutMs={QUEUE_BOT_TIMEOUT_MS}
            onExtend={extendBotFallback}
          />
        )}

        {(phase === "matched" || phase === "round" || phase === "reveal") && (
          <ClassicMatchPanel
            key="play"
            phase={phase} player={player} m={m} youScore={youScore} oppScore={oppScore}
            target={target} pickStartedAt={pickStartedAt} playMove={playMove}
            revealRevealed={revealRevealed} youMove={youMove} oppMove={oppMove}
            outcomeForYou={outcomeForYou} verb={verb} showMatchFoundSplash={showMatchFoundSplash}
            oppWaitLevel={oppWaitLevel} leaveMatch={leaveMatch} quitOpen={quitOpen}
            setQuitOpen={setQuitOpen} vsBot={vsBot} recordAbandon={recordAbandon}
          />
        )}


        {phase === "match_end" && m.ended && (
          <MatchEndScene
            key="end"
            winner={m.ended.winner}
            youAre={m.youAre}
            forfeit={m.ended.forfeit}
            youScore={youScore}
            oppScore={oppScore}
            opponentName={m.opponent}
            onBack={backToMenu}
            onRematch={vsBot ? startBotFallback : requestRematch}
          />
        )}

        {phase === "lanes_prep" && lanesMatch && lanesOppPersona && (
          <LanesPrepPanel
            key="lanes-prep"
            player={player} lanesMatch={lanesMatch} lanesOppPersona={lanesOppPersona}
            clientRef={clientRef} prepReadyState={prepReadyState} prepCoinWinner={prepCoinWinner}
            connDropped={connDropped} setLanesMatch={setLanesMatch}
            setPrepReadyState={setPrepReadyState} setPrepCoinWinner={setPrepCoinWinner}
            backToMenu={backToMenu}
          />
        )}

        {phase === "lanes_match" && lanesMatch && (
          <LanesMatchPanel
            key="lanes"
            player={player} lanesMatch={lanesMatch} lanesOppPersona={lanesOppPersona}
            clientRef={clientRef} prepCoinWinner={prepCoinWinner} lanesRound={lanesRound}
            lanesLastResult={lanesLastResult} lanesEnd={lanesEnd} lanesSubmitted={lanesSubmitted}
            setLanesMatch={setLanesMatch} setLanesRound={setLanesRound}
            setLanesLastResult={setLanesLastResult} setLanesEnd={setLanesEnd}
            setLanesSubmitted={setLanesSubmitted} setPrepCoinWinner={setPrepCoinWinner}
            backToMenu={backToMenu} requestRematch={requestRematch}
          />
        )}

        {phase === "lanes_bot" && (
          <LanesBotPanel key="lanes-bot" lanesWinTo={lanesWinTo} backToMenu={backToMenu} />
        )}

        {phase === "error" && (
          <OnlineErrorPanel key="err" errMsg={errMsg} backToMenu={backToMenu} />
        )}

      </AnimatePresence>

      {/* Rematch handshake overlays — rendered once, cover classic + lanes. */}
      <RematchOverlays rematch={rematch} />
    </div>
  );
}
