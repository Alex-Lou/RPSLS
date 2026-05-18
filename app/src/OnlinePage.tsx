import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useStore } from "./store";
import { useT } from "./i18n";
import { Hand, MOVE_ICON, MOVE_PALETTE } from "./icons";
import { MOVES, type Move } from "./game";
import {
  OnlineClient,
  normalizeServerUrl,
  type ServerMessage,
  type PlayerSlot,
} from "./online";
import {
  LanesMatchView,
  type LanesMatchInfo,
  type LanesRoundData,
  type LanesRoundResultData,
  type LanesEndData,
} from "./LanesMatchView";
import {
  hapticTap,
  hapticLock,
  hapticMatchStart,
  hapticWin,
  hapticLoss,
  hapticMatchWin,
  hapticMatchLoss,
  hapticAlert,
} from "./haptic";

type Phase =
  | "menu"
  | "connecting"
  | "creating"
  | "lobby_open"   // we created a lobby, waiting for joiner
  | "joining"
  | "queued"
  | "matched"
  | "round"
  | "reveal"
  | "match_end"
  | "lanes_match"  // Constellation Lanes match in progress (LanesMatchView)
  | "error";

interface MatchState {
  matchId: string;
  opponent: string;
  bestOf: number;
  youAre: PlayerSlot;
  scoreA: number;
  scoreB: number;
  roundNo: number;
  deadlineMs: number;
  myMove: Move | null;
  lastResult: null | {
    aMove: Move;
    bMove: Move;
    outcome: { kind: "draw" } | { kind: "a_wins"; verb: string } | { kind: "b_wins"; verb: string };
  };
  ended: null | { winner: PlayerSlot | null; forfeit: boolean };
}

/* ──────────── useServerStatus hook ──────────── */

type ConnStatus = "idle" | "checking" | "waking" | "online" | "offline";

function useServerStatus(url: string): {
  status: ConnStatus;
  latencyMs: number | null;
  refresh: () => void;
} {
  const [status, setStatus] = useState<ConnStatus>("idle");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const probeRef = useRef<WebSocket | null>(null);

  const refresh = useCallback(() => {
    // Tear down any running probe.
    try { probeRef.current?.close(); } catch { /* ignore */ }
    probeRef.current = null;

    if (!url.trim()) {
      setStatus("offline");
      setLatencyMs(null);
      return;
    }
    const wsUrl = normalizeServerUrl(url).replace(/\/+$/, "") + "/ws";
    setStatus("checking");

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      setStatus("offline");
      return;
    }
    probeRef.current = ws;

    // Cold-start budget for Render free tier: up to ~90s. Flip to "waking"
    // after 2.5s so the user sees we know it's slow.
    const t0 = performance.now();
    const wakingT = setTimeout(() => {
      if (probeRef.current === ws) setStatus("waking");
    }, 2_500);
    const hardT = setTimeout(() => {
      try { ws.close(); } catch { /* ignore */ }
      if (probeRef.current === ws) setStatus("offline");
    }, 90_000);

    ws.onopen = () => {
      clearTimeout(wakingT);
      clearTimeout(hardT);
      const dt = Math.round(performance.now() - t0);
      try { ws.close(); } catch { /* ignore */ }
      if (probeRef.current === ws) {
        setLatencyMs(dt);
        setStatus("online");
      }
    };
    ws.onerror = () => {
      clearTimeout(wakingT);
      clearTimeout(hardT);
      if (probeRef.current === ws) setStatus("offline");
    };
  }, [url]);

  useEffect(() => {
    refresh();
    return () => {
      try { probeRef.current?.close(); } catch { /* ignore */ }
    };
  }, [refresh]);

  // Auto-retry every 15s while we're stuck offline so a slow first
  // wake-up eventually self-recovers without the user touching ↻.
  useEffect(() => {
    if (status !== "offline") return;
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [status, refresh]);

  return { status, latencyMs, refresh };
}

function emptyMatch(): MatchState {
  return {
    matchId: "",
    opponent: "",
    bestOf: 3,
    youAre: "a",
    scoreA: 0,
    scoreB: 0,
    roundNo: 0,
    deadlineMs: 10_000,
    myMove: null,
    lastResult: null,
    ended: null,
  };
}

export function OnlinePage() {
  const t = useT();
  const player = useStore((s) => s.player);
  const serverConfig = useStore((s) => s.serverConfig);
  const setServerConfig = useStore((s) => s.setServerConfig);

  // Mode toggle: classic 1v1 (current) vs Constellation Lanes (Phase 1).
  // Once a user picks a mode in the menu, the rest of the flow follows.
  const [mode, setMode] = useState<"classic" | "lanes">("classic");

  const [phase, setPhase] = useState<Phase>("menu");
  const [bestOf, setBestOf] = useState(3);
  // For Lanes mode: win_to (3 → bo5 in round-wins).
  const [lanesWinTo, setLanesWinTo] = useState(2);
  const [lobbyCode, setLobbyCode] = useState("");        // we created it
  const [joinCode, setJoinCode] = useState("");          // input
  const [queuePosition, setQueuePosition] = useState(0);
  const [queueStartAt, setQueueStartAt] = useState<number | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [m, setM] = useState<MatchState>(emptyMatch());
  const [serverPickerOpen, setServerPickerOpen] = useState(false);

  // Cinematic state — keeps the experience from feeling rushed.
  const [showMatchFoundSplash, setShowMatchFoundSplash] = useState(false);
  const [pickStartedAt, setPickStartedAt] = useState<number | null>(null);
  const [revealRevealed, setRevealRevealed] = useState(false);
  const splashTimer = useRef<number | null>(null);
  const revealTimer = useRef<number | null>(null);

  // Connection drop tracking — keeps the UI sane during wifi hiccups.
  const [connDropped, setConnDropped] = useState(false);

  // Constellation Lanes state — all messages land here so LanesMatchView
  // is a pure view and never races with a late mount.
  const [lanesMatch, setLanesMatch] = useState<LanesMatchInfo | null>(null);
  const [lanesRound, setLanesRound] = useState<LanesRoundData | null>(null);
  const [lanesLastResult, setLanesLastResult] = useState<LanesRoundResultData | null>(null);
  const [lanesEnd, setLanesEnd] = useState<LanesEndData | null>(null);
  const [lanesSubmitted, setLanesSubmitted] = useState(false);

  const clientRef = useRef<OnlineClient | null>(null);

  const activeServerUrl =
    serverConfig.mode === "cloud" ? serverConfig.cloudUrl : serverConfig.lanUrl;
  const { status: connStatus, latencyMs, refresh: refreshStatus } =
    useServerStatus(activeServerUrl);

  /* ── Lazy create client ── */
  function ensureClient(): Promise<OnlineClient> {
    if (clientRef.current && clientRef.current.status === "open") {
      return Promise.resolve(clientRef.current);
    }
    // Disconnect any previous closed client.
    clientRef.current?.disconnect();
    const url = serverConfig.mode === "cloud" ? serverConfig.cloudUrl : serverConfig.lanUrl;
    if (!url.trim()) {
      return Promise.reject(
        new Error(
          serverConfig.mode === "cloud"
            ? "No cloud server URL set. Open Server settings."
            : "No LAN server URL set. Open Server settings."
        )
      );
    }
    const c = new OnlineClient();
    clientRef.current = c;
    c.on(onMessage);
    c.onStatus = (s) => {
      // Surface only the "reconnecting" → "open" cycle in the UI banner.
      if (s === "reconnecting") {
        setConnDropped(true);
        hapticAlert();
      } else if (s === "open") {
        setConnDropped(false);
      } else if (s === "error" || s === "closed") {
        // After all retries exhausted, OnlineClient flips to "error".
        // Leave the banner up — the user can cancel/retry manually.
      }
    };
    c.onReconnect = () => {
      // Server session reset on reconnect — re-introduce ourselves so the
      // server has our nickname for the next match.
      c.send({ type: "hello", nickname: player.nickname || "Anonymous" });
    };
    return c.connect(url).then(() => {
      // Send Hello once on connection.
      c.send({ type: "hello", nickname: player.nickname || "Anonymous" });
      return c;
    });
  }

  /* ── Cleanup on unmount ── */
  useEffect(() => {
    return () => {
      clientRef.current?.disconnect();
      clientRef.current = null;
      if (splashTimer.current) window.clearTimeout(splashTimer.current);
      if (revealTimer.current) window.clearTimeout(revealTimer.current);
    };
  }, []);

  /* ── Message handler ── */
  function onMessage(msg: ServerMessage) {
    switch (msg.type) {
      case "welcome":
        // session id — we don't display it.
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
      case "match_end":
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
        break;
      case "opponent_left":
        // Wait for match_end which arrives right after.
        break;
      case "error":
        setErrMsg(`${msg.code}: ${msg.message}`);
        setPhase("error");
        break;
      case "lanes_match_found":
        // Fresh match — wipe any stale state from a previous one.
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
        setPhase("lanes_match");
        hapticMatchStart();
        break;

      case "lanes_round_start":
        setLanesRound({
          no: msg.round_no,
          deadlineMs: msg.deadline_ms,
          startedAt: Date.now(),
        });
        // A new round wipes the just-seen reveal and the locked picks.
        setLanesLastResult(null);
        setLanesSubmitted(false);
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
        break;
      }

      case "chat":
      case "pong":
      default:
        break;
    }
  }

  /* ── Actions ── */
  function activeUrl(): string {
    return serverConfig.mode === "cloud" ? serverConfig.cloudUrl : serverConfig.lanUrl;
  }

  function handleConnectError(e: unknown) {
    const url = activeUrl();
    const reason = e instanceof Error ? e.message : String(e);
    setErrMsg(
      `Couldn't reach ${normalizeServerUrl(url) || "(no URL set)"}.\n${reason}\n\n` +
        `→ Check that the server is running and the address is correct.\n` +
        `→ On the host PC: \`pnpm server\` (from app/) or run the rpsls-server binary.\n` +
        `→ From another device on the same Wi-Fi: use the host's local IP, not localhost.`
    );
    setServerPickerOpen(true);
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
    setPhase("connecting");
    try {
      const c = await ensureClient();
      if (mode === "lanes") {
        c.send({ type: "join_lanes_queue", win_to: lanesWinTo });
      } else {
        c.send({ type: "join_queue", best_of: bestOf });
      }
    } catch (e) {
      handleConnectError(e);
    }
  }

  function cancel() {
    clientRef.current?.send({ type: "cancel" });
    setPhase("menu");
    setLobbyCode("");
    setQueuePosition(0);
  }

  function playMove(mv: Move) {
    if (m.myMove) return;
    hapticLock();
    setM((cur) => ({ ...cur, myMove: mv }));
    clientRef.current?.send({ type: "play_move", mv });
  }

  function leaveMatch() {
    clientRef.current?.send({ type: "leave_match" });
    setPhase("menu");
    setM(emptyMatch());
  }

  function backToMenu() {
    setPhase("menu");
    setM(emptyMatch());
    setLobbyCode("");
    setJoinCode("");
    setQueuePosition(0);
    setErrMsg(null);
  }

  /* ── Derived ── */
  const target = useMemo(() => Math.floor(m.bestOf / 2) + 1, [m.bestOf]);
  const youScore = m.youAre === "a" ? m.scoreA : m.scoreB;
  const oppScore = m.youAre === "a" ? m.scoreB : m.scoreA;
  const youMove =
    m.lastResult ? (m.youAre === "a" ? m.lastResult.aMove : m.lastResult.bMove) : null;
  const oppMove =
    m.lastResult ? (m.youAre === "a" ? m.lastResult.bMove : m.lastResult.aMove) : null;

  const outcomeForYou: "win" | "loss" | "draw" | null = m.lastResult
    ? m.lastResult.outcome.kind === "draw"
      ? "draw"
      : (m.lastResult.outcome.kind === "a_wins") === (m.youAre === "a")
      ? "win"
      : "loss"
    : null;
  const verb =
    m.lastResult && m.lastResult.outcome.kind !== "draw"
      ? m.lastResult.outcome.verb
      : null;

  /* ── Render ── */
  return (
    <div className="px-4 py-6 max-w-3xl w-full mx-auto flex-1 flex flex-col">
      {/* Cinematic match-found splash overlay */}
      <AnimatePresence>
        {showMatchFoundSplash && phase !== "menu" && (
          <MatchFoundSplash
            key="splash"
            youName={player.nickname}
            opponentName={m.opponent}
            bestOf={m.bestOf}
          />
        )}
      </AnimatePresence>

      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-3xl font-black tracking-tight">🌐 {t("nav.online")}</h1>
          <span className="text-xs text-zinc-500">Beta · {player.nickname}</span>
        </div>
        {phase === "menu" && (
          <button
            onClick={() => setServerPickerOpen((v) => !v)}
            className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 transition"
            title="Server settings"
          >
            ⚙️ {serverConfig.mode === "cloud" ? "Cloud" : "LAN"}
          </button>
        )}
      </div>

      {/* Live server status badge */}
      <ServerStatusBadge
        mode={serverConfig.mode}
        url={activeServerUrl}
        status={connStatus}
        latencyMs={latencyMs}
        onRefresh={refreshStatus}
      />

      {/* Transient reconnect banner — only shown while the WS is mid-retry. */}
      <AnimatePresence>
        {connDropped && (
          <motion.div
            key="reconn"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-3 px-3 py-2 rounded-xl border bg-amber-500/10 border-amber-500/30 text-amber-200 text-xs flex items-center gap-2"
          >
            <motion.span
              className="w-2 h-2 rounded-full bg-amber-400"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <span className="font-semibold">Reconnecting…</span>
            <span className="text-amber-300/70">
              your connection blinked — we're getting back online
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Server picker — collapsible */}
      <AnimatePresence>
        {serverPickerOpen && phase === "menu" && (
          <motion.div
            key="srv"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <ServerPicker
              cfg={serverConfig}
              onChange={setServerConfig}
              onClose={() => setServerPickerOpen(false)}
              onRefreshStatus={refreshStatus}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {phase === "menu" && (
          <motion.div
            key="menu"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col gap-4"
          >
            {/* Mode picker — Classic vs Constellation Lanes */}
            <ModePicker mode={mode} onChange={setMode} />

            {mode === "classic" ? (
              <BestOfPicker value={bestOf} onChange={setBestOf} />
            ) : (
              <LanesWinToPicker value={lanesWinTo} onChange={setLanesWinTo} />
            )}

            <Card title="🎲 Random match">
              <p className="text-sm text-zinc-400 mb-3">
                Join the queue. We'll pair you with the next available player.
              </p>
              <button
                onClick={joinQueue}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 font-semibold text-white shadow-lg shadow-violet-500/30 active:scale-[0.98] transition"
              >
                Find an opponent
              </button>
            </Card>

            <Card title="🔒 Private lobby">
              <p className="text-sm text-zinc-400 mb-3">
                Create a 6-letter code and share it with a friend.
              </p>
              <button
                onClick={createLobby}
                className="w-full py-3 rounded-xl bg-emerald-500/90 hover:bg-emerald-500 font-semibold text-white shadow-lg shadow-emerald-500/30 active:scale-[0.98] transition"
              >
                Create lobby
              </button>
            </Card>

            <Card title="🔑 Join with code">
              <div className="flex gap-2">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  maxLength={6}
                  className="flex-1 px-3 py-3 rounded-xl bg-black/40 border border-white/10 font-mono uppercase tracking-widest text-center text-lg"
                />
                <button
                  onClick={joinLobby}
                  disabled={joinCode.trim().length !== 6}
                  className="px-5 py-3 rounded-xl bg-sky-500/90 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-white active:scale-[0.98] transition"
                >
                  Join
                </button>
              </div>
            </Card>
          </motion.div>
        )}

        {(phase === "connecting" || phase === "creating" || phase === "joining") && (
          <Waiting
            key="wait"
            label={
              connStatus === "waking" && serverConfig.mode === "cloud"
                ? "Waking up free server (up to ~90s, only on first connect)…"
                : "Connecting…"
            }
            onCancel={cancel}
          />
        )}

        {phase === "lobby_open" && (
          <motion.div
            key="lobby"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4 py-10"
          >
            <div className="text-sm text-zinc-400">Share this code with a friend</div>
            <div className="text-5xl sm:text-6xl font-black tracking-[0.4em] font-mono bg-gradient-to-br from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
              {lobbyCode}
            </div>
            <div className="text-xs text-zinc-500">Best of {bestOf} · waiting…</div>
            <DotPulse />
            <button
              onClick={cancel}
              className="mt-4 px-5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-sm transition"
            >
              Cancel
            </button>
          </motion.div>
        )}

        {phase === "queued" && (
          <QueueRadar
            key="queued"
            position={queuePosition}
            startedAt={queueStartAt}
            bestOf={bestOf}
            onCancel={cancel}
          />
        )}

        {(phase === "matched" || phase === "round" || phase === "reveal") && (
          <motion.div
            key="play"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-4"
          >
            {/* Score header */}
            <ScoreHeader
              youName={player.nickname}
              opponentName={m.opponent}
              youScore={youScore}
              oppScore={oppScore}
              round={m.roundNo || 1}
              target={target}
              bestOf={m.bestOf}
            />

            {/* Stage — what happens here depends on phase */}
            <div className="relative min-h-[260px] sm:min-h-[320px] flex items-center justify-center">
              {phase === "round" && !m.myMove && (
                <PickStage
                  startedAt={pickStartedAt}
                  deadlineMs={m.deadlineMs}
                  onPick={playMove}
                />
              )}
              {phase === "round" && m.myMove && (
                <LockedStage move={m.myMove} />
              )}
              {phase === "reveal" && !revealRevealed && (
                <RevealCountdown />
              )}
              {phase === "reveal" && revealRevealed && (
                <RevealStage
                  youMove={youMove}
                  oppMove={oppMove}
                  outcomeForYou={outcomeForYou}
                  verb={verb}
                  opponentName={m.opponent}
                />
              )}
              {phase === "matched" && !showMatchFoundSplash && (
                <div className="text-zinc-400 text-sm">Preparing round 1…</div>
              )}
            </div>

            <button
              onClick={leaveMatch}
              className="mt-2 self-center px-4 py-2 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/40 text-zinc-400 hover:text-rose-200 text-xs transition"
            >
              🏳️ Forfeit match
            </button>
          </motion.div>
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
          />
        )}

        {phase === "lanes_match" && lanesMatch && (
          <motion.div
            key="lanes"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <LanesMatchView
              nickname={player.nickname}
              match={lanesMatch}
              round={lanesRound}
              lastResult={lanesLastResult}
              end={lanesEnd}
              submitted={lanesSubmitted}
              onSubmitPicks={(picks) => {
                hapticLock();
                clientRef.current?.send({
                  type: "play_lanes",
                  plays: picks.map((mv) => ({ mv, mana: 0 })),
                });
                setLanesSubmitted(true);
              }}
              onLeave={() => {
                clientRef.current?.send({ type: "leave_match" });
                setLanesMatch(null);
                setLanesRound(null);
                setLanesLastResult(null);
                setLanesEnd(null);
                setLanesSubmitted(false);
                backToMenu();
              }}
            />
          </motion.div>
        )}

        {phase === "error" && (
          <motion.div
            key="err"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4 py-6"
          >
            <div className="text-4xl">⚠️</div>
            <pre className="text-rose-200/90 text-xs sm:text-sm whitespace-pre-wrap text-center max-w-prose font-sans leading-relaxed">
              {errMsg || "Something went wrong."}
            </pre>
            <button
              onClick={backToMenu}
              className="mt-2 px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm transition"
            >
              Back to menu
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ──────────── Server status badge ──────────── */

function ServerStatusBadge({
  mode,
  url,
  status,
  latencyMs,
  onRefresh,
}: {
  mode: "cloud" | "lan";
  url: string;
  status: ConnStatus;
  latencyMs: number | null;
  onRefresh: () => void;
}) {
  const palette: Record<ConnStatus, { dot: string; text: string; bg: string }> = {
    idle:     { dot: "bg-zinc-500",   text: "text-zinc-400",   bg: "bg-white/5 border-white/10" },
    checking: { dot: "bg-sky-400",    text: "text-sky-200",    bg: "bg-sky-500/10 border-sky-500/30" },
    waking:   { dot: "bg-amber-400",  text: "text-amber-200",  bg: "bg-amber-500/10 border-amber-500/30" },
    online:   { dot: "bg-emerald-400",text: "text-emerald-200",bg: "bg-emerald-500/10 border-emerald-500/30" },
    offline:  { dot: "bg-rose-500",   text: "text-rose-200",   bg: "bg-rose-500/10 border-rose-500/30" },
  };
  const p = palette[status];

  const label = (() => {
    switch (status) {
      case "idle":     return "Idle";
      case "checking": return "Pinging…";
      case "waking":   return mode === "cloud"
        ? "Waking up free instance (up to ~90s on first ping)…"
        : "Connecting…";
      case "online":   return latencyMs != null ? `Online · ${latencyMs} ms` : "Online";
      case "offline":  return "Unreachable";
    }
  })();

  const prettyUrl = url.replace(/^wss?:\/\//, "");

  return (
    <div
      className={
        "mb-4 px-3 py-2 rounded-xl border flex items-center gap-2 text-xs " + p.bg
      }
    >
      <motion.span
        className={"w-2 h-2 rounded-full " + p.dot}
        animate={
          status === "checking" || status === "waking"
            ? { opacity: [0.3, 1, 0.3] }
            : { opacity: 1 }
        }
        transition={{ duration: 1, repeat: Infinity }}
      />
      <span className={"font-semibold " + p.text}>
        {mode === "cloud" ? "☁️ Cloud" : "📶 LAN"}
      </span>
      <span className="text-zinc-500">·</span>
      <span className={"truncate flex-1 min-w-0 " + p.text}>{label}</span>
      <span className="hidden sm:inline text-zinc-500 truncate max-w-[40%] font-mono text-[10px]">
        {prettyUrl}
      </span>
      <button
        onClick={onRefresh}
        title="Ping again"
        className="ml-1 px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-300 text-[10px] transition"
      >
        ↻
      </button>
    </div>
  );
}

/* ──────────── Server picker ──────────── */

function ServerPicker({
  cfg,
  onChange,
  onClose,
  onRefreshStatus,
}: {
  cfg: { mode: "cloud" | "lan"; cloudUrl: string; lanUrl: string };
  onChange: (p: Partial<{ mode: "cloud" | "lan"; cloudUrl: string; lanUrl: string }>) => void;
  onClose: () => void;
  onRefreshStatus?: () => void;
}) {
  const [lan, setLan] = useState(cfg.lanUrl);
  const [cloud, setCloud] = useState(cfg.cloudUrl);
  const [testStatus, setTestStatus] = useState<"" | "testing" | "ok" | "fail">("");
  const [testMsg, setTestMsg] = useState<string>("");
  const previewLan = normalizeServerUrl(lan);
  const previewCloud = normalizeServerUrl(cloud);

  function testConnection() {
    setTestStatus("testing");
    setTestMsg("");
    const wsUrlRaw = cfg.mode === "lan" ? previewLan : previewCloud;
    const wsUrl = wsUrlRaw.replace(/\/+$/, "") + "/ws";
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      setTestStatus("fail");
      setTestMsg(`Invalid URL: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    const t0 = performance.now();
    const t = setTimeout(() => {
      try { ws.close(); } catch { /* ignore */ }
      setTestStatus("fail");
      setTestMsg(
        cfg.mode === "cloud"
          ? "No response in 90s. The free instance may be down."
          : "No response in 90s. Is the server running? Same Wi-Fi? Firewall?"
      );
    }, 90_000);
    ws.onopen = () => {
      clearTimeout(t);
      const dt = Math.round(performance.now() - t0);
      try { ws.close(); } catch { /* ignore */ }
      setTestStatus("ok");
      setTestMsg(`Server reachable (WebSocket opened in ${dt} ms).`);
      onRefreshStatus?.();
    };
    ws.onerror = () => {
      clearTimeout(t);
      setTestStatus("fail");
      setTestMsg(
        "Cannot open WebSocket — server unreachable, wrong URL, or firewall."
      );
    };
  }

  return (
    <div className="rounded-2xl bg-black/40 border border-white/10 p-4 mb-4">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => onChange({ mode: "lan" })}
          className={
            "flex-1 py-2 rounded-xl font-semibold transition " +
            (cfg.mode === "lan"
              ? "bg-emerald-500/90 text-white"
              : "bg-white/5 hover:bg-white/10 text-zinc-300")
          }
        >
          📶 Local network
        </button>
        <button
          onClick={() => onChange({ mode: "cloud" })}
          className={
            "flex-1 py-2 rounded-xl font-semibold transition " +
            (cfg.mode === "cloud"
              ? "bg-violet-500/90 text-white"
              : "bg-white/5 hover:bg-white/10 text-zinc-300")
          }
        >
          ☁️ Cloud
        </button>
      </div>

      {cfg.mode === "lan" ? (
        <div className="flex flex-col gap-2">
          <label className="text-xs uppercase tracking-wider text-zinc-500">
            Host's address (LAN)
          </label>
          <input
            value={lan}
            onChange={(e) => setLan(e.target.value)}
            placeholder="192.168.1.42"
            className="px-3 py-2 rounded-lg bg-black/40 border border-white/10 font-mono text-sm"
          />
          <div className="text-[11px] text-zinc-500 break-all">
            → {previewLan || "—"}
          </div>
          <div className="text-xs text-zinc-400 mt-2 leading-relaxed">
            <b>Host setup:</b> on the host PC, open a terminal in the project and run:
            <pre className="mt-1 px-2 py-1 rounded bg-black/50 text-zinc-200 font-mono text-[11px] overflow-x-auto">
cargo run -p rpsls-server --release
            </pre>
            Then find your local IP with <code className="bg-black/40 px-1 rounded">ipconfig</code>{" "}
            (Windows) or <code className="bg-black/40 px-1 rounded">ip a</code> (Linux/Mac) and
            share it with the joiner.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="text-xs uppercase tracking-wider text-zinc-500">
            Cloud server URL
          </label>
          <input
            value={cloud}
            onChange={(e) => setCloud(e.target.value)}
            placeholder="wss://your-server.example.com"
            className="px-3 py-2 rounded-lg bg-black/40 border border-white/10 font-mono text-sm"
          />
          <div className="text-[11px] text-zinc-500 break-all">
            → {previewCloud || "—"}
          </div>
          <div className="text-xs text-zinc-400 mt-2">
            Use any public host (Cloudflare Tunnel, Render, your VPS…).
          </div>
        </div>
      )}

      {testStatus !== "" && (
        <div
          className={
            "mt-3 px-3 py-2 rounded-lg text-xs " +
            (testStatus === "ok"
              ? "bg-emerald-500/15 text-emerald-200 border border-emerald-500/30"
              : testStatus === "fail"
              ? "bg-rose-500/15 text-rose-200 border border-rose-500/30"
              : "bg-white/5 text-zinc-300 border border-white/10")
          }
        >
          {testStatus === "testing" ? "Testing…" : testMsg}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2 mt-4">
        <button
          onClick={testConnection}
          disabled={testStatus === "testing"}
          className="px-4 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-100 text-sm transition disabled:opacity-50"
        >
          Test connection
        </button>
        <button
          onClick={onClose}
          className="px-4 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-zinc-300 transition"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            onChange({ lanUrl: lan, cloudUrl: cloud });
            // Defer to next tick so the store update lands before refresh.
            setTimeout(() => onRefreshStatus?.(), 0);
            onClose();
          }}
          className="px-4 py-1.5 rounded-lg bg-emerald-500/90 hover:bg-emerald-500 text-sm text-white font-semibold transition"
        >
          Save
        </button>
      </div>
    </div>
  );
}

/* ──────────── Subcomponents ──────────── */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-black/30 border border-white/10 p-4">
      <h3 className="font-bold mb-2">{title}</h3>
      {children}
    </div>
  );
}

function ModePicker({
  mode,
  onChange,
}: {
  mode: "classic" | "lanes";
  onChange: (m: "classic" | "lanes") => void;
}) {
  return (
    <div className="rounded-2xl bg-black/30 border border-white/10 p-3 flex gap-2">
      <button
        onClick={() => onChange("classic")}
        className={
          "flex-1 py-3 rounded-xl font-semibold transition flex flex-col items-center gap-0.5 " +
          (mode === "classic"
            ? "bg-emerald-500/90 text-white shadow-lg shadow-emerald-500/30"
            : "bg-white/5 hover:bg-white/10 text-zinc-300")
        }
      >
        <span>⚔️ Classic 1v1</span>
        <span className={"text-[10px] font-normal " + (mode === "classic" ? "text-emerald-100/80" : "text-zinc-500")}>
          One move per round
        </span>
      </button>
      <button
        onClick={() => onChange("lanes")}
        className={
          "flex-1 py-3 rounded-xl font-semibold transition flex flex-col items-center gap-0.5 " +
          (mode === "lanes"
            ? "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 text-white shadow-lg shadow-violet-500/30"
            : "bg-white/5 hover:bg-white/10 text-zinc-300")
        }
      >
        <span>🌌 Constellation Lanes</span>
        <span className={"text-[10px] font-normal " + (mode === "lanes" ? "text-violet-100/90" : "text-zinc-500")}>
          3 picks per round · NEW
        </span>
      </button>
    </div>
  );
}

function LanesWinToPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="rounded-2xl bg-black/30 border border-white/10 p-4">
      <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">First to … round-wins</div>
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((n) => {
          const active = n === value;
          return (
            <button
              key={n}
              onClick={() => onChange(n)}
              className={
                "flex-1 py-2 rounded-xl font-semibold transition " +
                (active
                  ? "bg-violet-500/90 text-white shadow-lg shadow-violet-500/30"
                  : "bg-white/5 hover:bg-white/10 text-zinc-300")
              }
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="text-[10px] text-zinc-500 mt-2 text-center">
        Each round = 3 lanes resolved simultaneously
      </div>
    </div>
  );
}

function BestOfPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="rounded-2xl bg-black/30 border border-white/10 p-4">
      <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Best of</div>
      <div className="flex gap-2">
        {[1, 3, 5, 7].map((n) => {
          const active = n === value;
          return (
            <button
              key={n}
              onClick={() => onChange(n)}
              className={
                "flex-1 py-2 rounded-xl font-semibold transition " +
                (active
                  ? "bg-violet-500/90 text-white shadow-lg shadow-violet-500/30"
                  : "bg-white/5 hover:bg-white/10 text-zinc-300")
              }
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Waiting({ label, onCancel }: { label: string; onCancel: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-4 py-10"
    >
      <div className="text-sm text-zinc-400">{label}</div>
      <DotPulse />
      <button
        onClick={onCancel}
        className="mt-4 px-5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-sm transition"
      >
        Cancel
      </button>
    </motion.div>
  );
}

function DotPulse() {
  return (
    <div className="flex gap-1.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-2 h-2 rounded-full bg-violet-400"
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  );
}

/* ──────────── Cinematic match flow components ──────────── */

function MatchFoundSplash({
  youName,
  opponentName,
  bestOf,
}: {
  youName: string;
  opponentName: string;
  bestOf: number;
}) {
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
        transition={{ delay: 0.1, type: "spring", stiffness: 240, damping: 16 }}
        className="text-xs tracking-[0.5em] text-violet-300/80 uppercase mb-3"
      >
        Match found
      </motion.div>
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.15, type: "spring", stiffness: 220, damping: 12 }}
        className="flex items-center gap-6 sm:gap-10"
      >
        <NameTag name={youName} accent="emerald" align="right" />
        <motion.div
          animate={{ rotate: [0, -8, 8, -4, 4, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 0.9, delay: 0.4 }}
          className="text-5xl sm:text-7xl font-black bg-gradient-to-br from-amber-300 to-rose-400 bg-clip-text text-transparent drop-shadow-[0_4px_24px_rgba(251,191,36,0.4)]"
        >
          VS
        </motion.div>
        <NameTag name={opponentName} accent="rose" align="left" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.4 }}
        className="mt-8 text-sm uppercase tracking-[0.3em] text-zinc-400"
      >
        Best of {bestOf}
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ delay: 1.6, duration: 0.4 }}
        className="mt-12 text-xs text-zinc-500"
      >
        Get ready…
      </motion.div>
    </motion.div>
  );
}

function NameTag({
  name,
  accent,
  align,
}: {
  name: string;
  accent: "emerald" | "rose";
  align: "left" | "right";
}) {
  const grad =
    accent === "emerald"
      ? "from-emerald-300 to-teal-400"
      : "from-rose-300 to-fuchsia-400";
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

function ScoreHeader({
  youName,
  opponentName,
  youScore,
  oppScore,
  round,
  target,
  bestOf,
}: {
  youName: string;
  opponentName: string;
  youScore: number;
  oppScore: number;
  round: number;
  target: number;
  bestOf: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between rounded-2xl bg-black/30 border border-white/10 px-4 py-3">
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">You</span>
          <span className="font-semibold truncate text-emerald-200">{youName}</span>
        </div>
        <div className="text-3xl sm:text-4xl font-black tabular-nums px-4">
          <motion.span
            key={youScore}
            initial={{ scale: 1.6, color: "#10b981" }}
            animate={{ scale: 1, color: "#6ee7b7" }}
            transition={{ duration: 0.4 }}
            className="text-emerald-300 inline-block"
          >
            {youScore}
          </motion.span>
          <span className="text-zinc-600 mx-2">:</span>
          <motion.span
            key={oppScore}
            initial={{ scale: 1.6, color: "#f43f5e" }}
            animate={{ scale: 1, color: "#fda4af" }}
            transition={{ duration: 0.4 }}
            className="text-rose-300 inline-block"
          >
            {oppScore}
          </motion.span>
        </div>
        <div className="flex flex-col text-right min-w-0 flex-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Opponent</span>
          <span className="font-semibold truncate text-rose-200">{opponentName || "—"}</span>
        </div>
      </div>
      <div className="text-center text-[11px] uppercase tracking-[0.25em] text-zinc-500">
        Round {round} · Best of {bestOf} · First to {target}
      </div>
    </div>
  );
}

function TimerRing({
  startedAt,
  durationMs,
  size = 220,
}: {
  startedAt: number | null;
  durationMs: number;
  size?: number;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 80);
    return () => clearInterval(id);
  }, []);
  const elapsed = startedAt ? Math.max(0, now - startedAt) : 0;
  const remaining = Math.max(0, durationMs - elapsed);
  const progress = Math.max(0, Math.min(1, remaining / durationMs));
  const seconds = Math.ceil(remaining / 1000);
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - progress);

  const urgent = remaining < 3000;
  const critical = remaining < 1000;
  const stroke = critical ? "#f43f5e" : urgent ? "#f59e0b" : "#a78bfa";

  return (
    <svg width={size} height={size} className="absolute inset-0 m-auto pointer-events-none">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={6}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        animate={critical ? { opacity: [0.4, 1, 0.4] } : { opacity: 1 }}
        transition={critical ? { duration: 0.4, repeat: Infinity } : { duration: 0.2 }}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        className="font-mono font-black"
        style={{ fontSize: size * 0.28, fill: stroke }}
      >
        {seconds}
      </text>
    </svg>
  );
}

function PickStage({
  startedAt,
  deadlineMs,
  onPick,
}: {
  startedAt: number | null;
  deadlineMs: number;
  onPick: (mv: Move) => void;
}) {
  return (
    <div className="w-full flex flex-col items-center gap-5">
      <div className="relative w-[220px] h-[220px] flex items-center justify-center">
        <TimerRing startedAt={startedAt} durationMs={deadlineMs} size={220} />
      </div>
      <div className="text-center">
        <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Pick your move</div>
      </div>
      <div className="grid grid-cols-5 gap-2 sm:gap-3 w-full">
        {MOVES.map((mv, i) => {
          const Icon = MOVE_ICON[mv];
          const pal = MOVE_PALETTE[mv];
          return (
            <motion.button
              key={mv}
              onClick={() => onPick(mv)}
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
              title={mv}
            >
              <Icon className="w-7 h-7 sm:w-9 sm:h-9" />
              <span className="text-[10px] uppercase tracking-wider font-bold">{mv}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function LockedStage({ move }: { move: Move }) {
  return (
    <motion.div
      key="locked"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-4"
    >
      <div className="text-[10px] uppercase tracking-[0.3em] text-emerald-300">
        Locked in
      </div>
      <motion.div
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <Hand move={move} size="xl" />
      </motion.div>
      <div className="text-sm text-zinc-300 font-medium">
        Waiting for opponent…
      </div>
      <DotPulse />
    </motion.div>
  );
}

function RevealCountdown() {
  const t = useT();
  return (
    <motion.div
      key="revealcd"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center gap-3 w-full px-4 text-center"
    >
      <div className="text-[10px] uppercase tracking-[0.4em] text-zinc-500">
        {t("online.reveal.label")}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xl sm:text-3xl font-black max-w-full leading-tight">
        {[t("online.reveal.rock"), t("online.reveal.paper"), t("online.reveal.scissors")].map((w, i) => (
          <motion.span
            key={w}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.18, duration: 0.25 }}
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
        {t("online.reveal.shoot")}
      </motion.div>
    </motion.div>
  );
}

function RevealStage({
  youMove,
  oppMove,
  outcomeForYou,
  verb,
  opponentName,
}: {
  youMove: Move | null;
  oppMove: Move | null;
  outcomeForYou: "win" | "loss" | "draw" | null;
  verb: string | null;
  opponentName: string;
}) {
  const t = useT();
  // Hit-shake when the verdict lands — only on win/loss, not draw.
  const shake =
    outcomeForYou === "win" || outcomeForYou === "loss"
      ? { x: [0, -6, 6, -4, 4, 0], y: [0, 2, -2, 1, -1, 0] }
      : {};
  return (
    <motion.div
      key="reveal"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1, ...shake }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center gap-3 w-full px-2"
    >
      <div className="flex items-center justify-around w-full max-w-md mx-auto">
        {/* Your hand */}
        <motion.div
          initial={{ x: -40, opacity: 0, rotate: -12 }}
          animate={{
            x: 0,
            opacity: 1,
            rotate: 0,
            scale: outcomeForYou === "win" ? [1, 1.15, 1.05] : outcomeForYou === "loss" ? 0.92 : 1,
          }}
          transition={{ type: "spring", stiffness: 220, damping: 14 }}
          className="relative"
        >
          {/* Winner glow halo */}
          {outcomeForYou === "win" && youMove && (
            <motion.div
              aria-hidden
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: [0, 0.6, 0.25], scale: [0.5, 1.4, 1.2] }}
              transition={{ duration: 0.9 }}
              className="absolute inset-0 -z-10 rounded-3xl blur-2xl"
              style={{
                background: `radial-gradient(circle, ${MOVE_PALETTE[youMove].hex}90, transparent 70%)`,
              }}
            />
          )}
          {youMove && (
            <Hand
              move={youMove}
              size="md"
              emphasis={
                outcomeForYou === "win" ? "winner" :
                outcomeForYou === "loss" ? "loser" : "default"
              }
            />
          )}
        </motion.div>

        {/* Center VS — pulses on impact */}
        <motion.div
          initial={{ scale: 0, rotate: -90 }}
          animate={{
            scale: outcomeForYou === "draw" ? 1 : [0, 1.4, 1],
            rotate: 0,
          }}
          transition={{ delay: 0.05, type: "spring", stiffness: 280, damping: 12 }}
          className="text-2xl sm:text-3xl font-black text-zinc-600 shrink-0 px-1"
        >
          VS
        </motion.div>

        {/* Opponent hand — mirrored */}
        <motion.div
          initial={{ x: 40, opacity: 0, rotate: 12 }}
          animate={{
            x: 0,
            opacity: 1,
            rotate: 0,
            scale: outcomeForYou === "loss" ? [1, 1.15, 1.05] : outcomeForYou === "win" ? 0.92 : 1,
          }}
          transition={{ type: "spring", stiffness: 220, damping: 14 }}
          className="relative scale-x-[-1]"
        >
          {outcomeForYou === "loss" && oppMove && (
            <motion.div
              aria-hidden
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: [0, 0.6, 0.25], scale: [0.5, 1.4, 1.2] }}
              transition={{ duration: 0.9 }}
              className="absolute inset-0 -z-10 rounded-3xl blur-2xl scale-x-[-1]"
              style={{
                background: `radial-gradient(circle, ${MOVE_PALETTE[oppMove].hex}90, transparent 70%)`,
              }}
            />
          )}
          {oppMove && (
            <div className="scale-x-[-1]">
              <Hand
                move={oppMove}
                size="md"
                emphasis={
                  outcomeForYou === "loss" ? "winner" :
                  outcomeForYou === "win" ? "loser" : "default"
                }
              />
            </div>
          )}
        </motion.div>
      </div>

      {/* Sparkle/burst particles on win — pure emoji, no extra deps. */}
      {outcomeForYou === "win" && <SparkBurst color="emerald" />}
      {outcomeForYou === "loss" && <SparkBurst color="rose" />}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.3 }}
        className="text-center mt-1 px-2 max-w-md"
      >
        {outcomeForYou === "draw" && (
          <div className="text-zinc-300 text-base sm:text-lg font-bold">
            🤝 {t("online.verdict.draw")}
          </div>
        )}
        {outcomeForYou === "win" && verb && (
          <div className="text-emerald-300 text-base sm:text-lg font-bold leading-snug">
            ✨ {t("online.verdict.youWin")}{" "}
            <span className="text-emerald-100">{youMove}</span> {verb}{" "}
            <span className="text-emerald-100">{oppMove}</span>
          </div>
        )}
        {outcomeForYou === "loss" && verb && (
          <div className="text-rose-300 text-base sm:text-lg font-bold leading-snug">
            💥 {t("online.verdict.youLose", { opp: opponentName })}{" "}
            <span className="text-rose-100">{oppMove}</span> {verb}{" "}
            <span className="text-rose-100">{youMove}</span>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

/** Tiny celebratory/sad burst — 8 emojis flying outward in a star pattern. */
function SparkBurst({ color }: { color: "emerald" | "rose" }) {
  const emoji = color === "emerald" ? "✨" : "💥";
  return (
    <div className="relative h-0 w-full pointer-events-none">
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const dx = Math.cos(angle) * 90;
        const dy = Math.sin(angle) * 60;
        return (
          <motion.span
            key={i}
            initial={{ opacity: 0, x: 0, y: 0, scale: 0.3 }}
            animate={{ opacity: [0, 1, 0], x: dx, y: dy, scale: [0.3, 1.2, 0.6] }}
            transition={{ duration: 0.9, delay: 0.05 * i, ease: "easeOut" }}
            className="absolute left-1/2 top-0 text-lg"
            style={{ translate: "-50% 0" }}
          >
            {emoji}
          </motion.span>
        );
      })}
    </div>
  );
}

function MatchEndScene({
  winner,
  youAre,
  forfeit,
  youScore,
  oppScore,
  opponentName,
  onBack,
}: {
  winner: "a" | "b" | null;
  youAre: "a" | "b";
  forfeit: boolean;
  youScore: number;
  oppScore: number;
  opponentName: string;
  onBack: () => void;
}) {
  const youWon = winner === youAre;
  const draw = winner === null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-5 py-8"
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
      {forfeit && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-xs uppercase tracking-[0.3em] text-amber-300"
        >
          (by forfeit)
        </motion.div>
      )}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="rounded-2xl bg-black/40 border border-white/10 px-6 py-3 flex items-center gap-4"
      >
        <div className="text-right">
          <div className="text-[10px] uppercase text-zinc-500">You</div>
          <div className="text-3xl font-black text-emerald-300 tabular-nums">{youScore}</div>
        </div>
        <div className="text-zinc-700 text-2xl">—</div>
        <div className="text-left">
          <div className="text-[10px] uppercase text-zinc-500 truncate max-w-[20ch]">
            {opponentName || "Opponent"}
          </div>
          <div className="text-3xl font-black text-rose-300 tabular-nums">{oppScore}</div>
        </div>
      </motion.div>
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
        onClick={onBack}
        className="mt-4 px-7 py-3 rounded-xl bg-violet-500/90 hover:bg-violet-500 font-semibold text-white shadow-lg shadow-violet-500/30 active:scale-[0.98] transition"
      >
        Back to menu
      </motion.button>
    </motion.div>
  );
}

function QueueRadar({
  position,
  startedAt,
  bestOf,
  onCancel,
}: {
  position: number;
  startedAt: number | null;
  bestOf: number;
  onCancel: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const elapsedSec = startedAt ? Math.floor((now - startedAt) / 1000) : 0;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-5 py-6"
    >
      <div className="relative w-48 h-48 sm:w-56 sm:h-56">
        {/* Static rings */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute inset-0 rounded-full border-2 border-violet-400/30"
            initial={{ opacity: 0.6, scale: 0.4 }}
            animate={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 2.2, delay: i * 0.7, repeat: Infinity, ease: "easeOut" }}
          />
        ))}
        {/* Sweeping radar arm */}
        <motion.div
          className="absolute inset-0"
          animate={{ rotate: 360 }}
          transition={{ duration: 2.5, ease: "linear", repeat: Infinity }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 origin-bottom h-1/2 w-1"
            style={{
              background: "linear-gradient(to bottom, transparent, rgba(167,139,250,0.7))",
            }}
          />
        </motion.div>
        {/* Center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-4 h-4 rounded-full bg-violet-400 shadow-[0_0_20px_rgba(167,139,250,0.8)]" />
        </div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-black bg-gradient-to-r from-violet-200 to-fuchsia-300 bg-clip-text text-transparent">
          Looking for an opponent…
        </div>
        <div className="text-xs text-zinc-400 mt-1">
          {position > 0 ? `Position #${position}` : "Scanning the network…"} ·{" "}
          Best of {bestOf} · {elapsedSec}s
        </div>
      </div>
      <button
        onClick={onCancel}
        className="mt-2 px-5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-sm transition"
      >
        Cancel
      </button>
    </motion.div>
  );
}
