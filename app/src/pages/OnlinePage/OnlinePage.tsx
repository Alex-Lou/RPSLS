import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useStore } from "../../store/store";
import { useT } from "../../i18n";
import { QuitConfirmModal } from "../../match/QuitConfirmModal";
import { MOVES, type Move, aiMove, rollAiMood, localResolve, type AiMood } from "../../engine/game";
import { LocalLanesGame } from "../../match/LocalLanesGame";
import {
  OnlineClient,
  type ServerMessage,
  type PlayerSlot,
} from "../../online/online";
import { handleStateLoaded, pushPlayerState, setActiveClient } from "../../online/playerSync";
import {
  LanesMatchView,
  type LanesMatchInfo,
  type LanesRoundData,
  type LanesRoundResultData,
  type LanesEndData,
} from "../../match/LanesMatchView";
import { MatchPrepScreen } from "../../ranked/MatchPrepScreen";
import { oppPersona } from "../../ranked/personaSeed";
import { ArenaPadProvider } from "../../ranked/arena";
import { useArenaOverride } from "../../ranked/arenaOverride";
import { applyTheme } from "../../theme/theme";
import {
  hapticTap,
  hapticLock,
  hapticMatchStart,
  hapticWin,
  hapticLoss,
  hapticMatchWin,
  hapticMatchLoss,
  hapticAlert,
} from "../../haptic";
// Sous-modules extraits du dossier OnlinePage/ (verbatim, présentationnel + types + hook santé serveur).
import { QUEUE_BOT_TIMEOUT_MS, BOT_NAMES, emptyMatch } from "./types";
import type { Phase, MatchState } from "./types";
import { useServerStatus } from "./useServerStatus";
import { Card, ModePicker, LanesWinToPicker, BestOfPicker } from "./MenuPickers";
import { ServerStatusBadge, Waiting, DotPulse } from "./StatusAndWaiting";
import { MatchFoundSplash, ScoreHeader } from "./MatchFlowSplash";
import { PickStage, LockedStage, RevealCountdown, RevealStage } from "./MatchFlowRound";
import { MatchEndScene } from "./MatchEndScene";
import { QueueRadar } from "./QueueRadar";
export function OnlinePage() {
  const t = useT();
  const player = useStore((s) => s.player);
  const serverConfig = useStore((s) => s.serverConfig);
  const recordMatch = useStore((s) => s.recordMatch);
  const recordAbandon = useStore((s) => s.recordAbandon);
  /** Open state for the themed forfeit-confirm modal (classic 1v1). */
  const [quitOpen, setQuitOpen] = useState(false);

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

  // Constellation Lanes state — all messages land here so LanesMatchView
  // is a pure view and never races with a late mount.
  const [lanesMatch, setLanesMatch] = useState<LanesMatchInfo | null>(null);
  const [lanesRound, setLanesRound] = useState<LanesRoundData | null>(null);
  const [lanesLastResult, setLanesLastResult] = useState<LanesRoundResultData | null>(null);
  const [lanesEnd, setLanesEnd] = useState<LanesEndData | null>(null);
  const [lanesSubmitted, setLanesSubmitted] = useState(false);

  // Pre-match prep — drives MatchPrepScreen in lanes_prep phase. `coinWinner`
  // is the side (from THIS client's POV) the server flipped to; null until
  // `start_coin_flip` arrives. The arena (theme + pad + backdrop) is derived
  // on render from `coinWinner` + the opponent persona, no extra state needed.
  // Reset every time a fresh `lanes_match_found` lands so a rematch starts
  // clean.
  const [prepReadyState, setPrepReadyState] = useState<{ you: boolean; opp: boolean }>({ you: false, opp: false });
  const [prepCoinWinner, setPrepCoinWinner] = useState<"you" | "opp" | null>(null);

  // Rematch handshake (post-match): we asked / opponent asked / a brief toast.
  const [rematchPending, setRematchPending] = useState(false);
  const [rematchOffered, setRematchOffered] = useState(false);
  const [rematchToast, setRematchToast] = useState<string | null>(null);
  const rematchTimer = useRef<number | null>(null);

  const clientRef = useRef<OnlineClient | null>(null);

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

  // Opponent watchdog — only against a real player. While we're waiting on the
  // opponent (move locked, or just matched waiting for round 1), escalate a
  // hint after 15s, then a "probably disconnected" + clean exit after 35s.
  // Resets the instant the match advances (new round / reveal / move cleared).
  useEffect(() => {
    const waiting = !vsBot && ((phase === "round" && !!m.myMove) || phase === "matched");
    if (!waiting) { setOppWaitLevel(0); return; }
    setOppWaitLevel(0);
    const t1 = window.setTimeout(() => setOppWaitLevel(1), 15_000);
    const t2 = window.setTimeout(() => setOppWaitLevel(2), 35_000);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [phase, m.myMove, m.roundNo, vsBot]);

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

  // Lanes arena override — when the coin gave the duel to the opponent's
  // side, swap the player's WHOLE LOOK (backdrop scene + HUD theme + pad)
  // for the duration of the prep + match. Mirrors PlayPage's local-tournament
  // setup: backdrop via `arenaOverride.bg`, theme via CSS-var mutation +
  // snapshot/restore on cleanup, pad via <ArenaPadProvider> down in the
  // match view. Effect deps stay narrow on purpose: phase changes
  // (lanes_prep → lanes_match) MUST NOT trigger a cleanup/re-apply (would
  // snapshot the opp theme as the "original" and never restore the player's
  // own). Cleanup runs when the override should END — either the coin
  // resolves to "you", the match ends (lanesOppPersona → null), or the user
  // leaves.
  const setArenaBg = useArenaOverride((s) => s.setBg);
  const lanesOppPersona = useMemo(
    () => (lanesMatch ? oppPersona(lanesMatch.opponent || "Anonymous") : null),
    [lanesMatch?.opponent],
  );
  useEffect(() => {
    if (prepCoinWinner !== "opp" || !lanesOppPersona) return;
    const root = document.documentElement;
    const snap = {
      p: root.style.getPropertyValue("--theme-primary"),
      s: root.style.getPropertyValue("--theme-secondary"),
      b: root.style.getPropertyValue("--theme-bg"),
    };
    applyTheme(lanesOppPersona.themeId);
    setArenaBg(lanesOppPersona.backgroundId);
    return () => {
      if (snap.p) root.style.setProperty("--theme-primary", snap.p);
      if (snap.s) root.style.setProperty("--theme-secondary", snap.s);
      if (snap.b) root.style.setProperty("--theme-bg", snap.b);
      setArenaBg(null);
    };
  }, [prepCoinWinner, lanesOppPersona, setArenaBg]);

  /* ── Lazy create client ── */
  function ensureClient(): Promise<OnlineClient> {
    if (clientRef.current && clientRef.current.status === "open") {
      return Promise.resolve(clientRef.current);
    }
    // Disconnect any previous closed client.
    clientRef.current?.disconnect();
    const url = serverConfig.cloudUrl;
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
      c.send({ type: "hello", nickname: player.nickname || "Anonymous", player_id: player.id, claim_token: player.claimToken });
    };
    return c.connect(url).then(() => {
      // Send Hello once on connection.
      c.send({ type: "hello", nickname: player.nickname || "Anonymous", player_id: player.id, claim_token: player.claimToken });
      setActiveClient(c);
      return c;
    });
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

  /* ── Message handler ── */
  function onMessage(msg: ServerMessage) {
    switch (msg.type) {
      case "welcome":
        // session id — we don't display it.
        break;
      case "state_loaded":
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
        setRematchOffered(true);
        break;
      case "rematch_declined":
        clearRematch();
        setRematchToast(t("online.rematch.declined"));
        window.setTimeout(() => {
          setRematchToast(null);
          backToMenu();
        }, 1600);
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
        // Log this online 1v1 to history with the real opponent's nickname.
        const prev = mRef.current;
        const outcome = msg.winner == null ? "draw" : msg.winner === prev.youAre ? "win" : "loss";
        recordMatch({
          id: `${prev.matchId || "online"}-${Date.now()}`,
          mode: "online",
          bestOf: prev.bestOf,
          opponent: { kind: "human", nickname: prev.opponent || "Anonymous" },
          scorePlayer:   prev.youAre === "a" ? msg.score_a : msg.score_b,
          scoreOpponent: prev.youAre === "a" ? msg.score_b : msg.score_a,
          outcome,
          rounds: [],
          xpDelta: outcome === "win" ? 60 : outcome === "draw" ? 25 : 15,
          lpDelta: outcome === "win" ? 20 : outcome === "draw" ? 0 : -15,
          timestamp: Date.now(),
          forfeit: msg.forfeit && outcome === "loss",
        });
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
        setErrMsg(`${msg.code}: ${msg.message}`);
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
            opponent: { kind: "human", nickname: lm.opponent || "Anonymous" },
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

  /* ── Actions ── */
  function handleConnectError(e: unknown) {
    const reason = e instanceof Error ? e.message : String(e);
    setErrMsg(
      `Couldn't reach the server.\n${reason}\n\n` +
        `→ The free cloud instance may be asleep — the first try can take up to ~90s to wake it. Give it a moment and retry.`
    );
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
    if (mode === "lanes") {
      setVsBot(false);
      setPhase("lanes_bot");
      return;
    }

    // Classic: drive the existing online flow locally.
    botMoodRef.current = rollAiMood();
    playerRecentRef.current = [];
    const botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    setVsBot(true);
    setM({ ...emptyMatch(), matchId: `bot-${Date.now()}`, opponent: botName, bestOf, youAre: "a" });
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
    setM((c) => ({ ...c, ended: { winner, forfeit: false } }));
    setPhase("match_end");
    pushPlayerState(clientRef.current);
  }

  function cancel() {
    disarmBotFallback();
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

  function leaveMatch() {
    if (vsBot) { backToMenu(); return; } // local match — nothing to tell the server
    clientRef.current?.send({ type: "leave_match" });
    setPhase("menu");
    setM(emptyMatch());
  }

  function backToMenu() {
    disarmBotFallback();
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

  /* ── Rematch handshake ── */
  function clearRematch() {
    if (rematchTimer.current) {
      window.clearTimeout(rematchTimer.current);
      rematchTimer.current = null;
    }
    setRematchPending(false);
    setRematchOffered(false);
  }
  function requestRematch() {
    clientRef.current?.send({ type: "request_rematch" });
    setRematchOffered(false);
    setRematchPending(true);
    if (rematchTimer.current) window.clearTimeout(rematchTimer.current);
    // The server's rematch window is 30s; give a little slack before giving up.
    rematchTimer.current = window.setTimeout(() => {
      setRematchPending(false);
      setRematchToast(t("online.rematch.noResponse"));
      window.setTimeout(() => {
        setRematchToast(null);
        backToMenu();
      }, 1600);
    }, 32000);
  }
  function acceptRematch() {
    clientRef.current?.send({ type: "respond_rematch", accept: true });
    setRematchOffered(false);
    setRematchPending(true); // now waiting for the fresh match_found
  }
  function declineRematch() {
    clientRef.current?.send({ type: "respond_rematch", accept: false });
    backToMenu();
  }
  function cancelRematchWait() {
    clientRef.current?.send({ type: "leave_match" });
    backToMenu();
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
    <div className="px-4 pt-2 pb-10 max-w-3xl w-full mx-auto flex-1 flex flex-col min-h-0">
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

      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div className="flex items-baseline gap-3">
          <h1 className="font-headline text-3xl font-black tracking-tight">🌐 {t("nav.online")}</h1>
          <span className="text-xs text-zinc-500">Beta · {player.nickname}</span>
        </div>
      </div>

      {/* Live server status badge */}
      <ServerStatusBadge
        mode="cloud"
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
                className="w-full py-3 rounded-xl bg-themed font-semibold text-white shadow-lg shadow-themed active:scale-[0.98] transition"
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
            <div className="text-5xl sm:text-6xl font-black tracking-[0.4em] font-mono text-themed">
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
            startedAt={botArmedAt ?? queueStartAt}
            bestOf={bestOf}
            onCancel={cancel}
            botTimeoutMs={QUEUE_BOT_TIMEOUT_MS}
            onExtend={extendBotFallback}
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

            {/* Opponent watchdog — escalating feedback + a fair, penalty-free
                exit when the opponent is slow or has dropped, so the player is
                never stuck on a frozen match wondering what's happening. */}
            <AnimatePresence>
              {oppWaitLevel >= 1 && (
                <motion.div
                  key="oppwait"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={
                    "self-center flex flex-col items-center gap-2 rounded-2xl px-4 py-3 border text-center " +
                    (oppWaitLevel >= 2
                      ? "bg-rose-500/10 border-rose-400/40"
                      : "bg-white/5 border-white/10")
                  }
                >
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className="inline-block w-3 h-3 rounded-full border-2 border-white/30 border-t-white/80 animate-spin" />
                    <span className={oppWaitLevel >= 2 ? "text-rose-200" : "text-zinc-300"}>
                      {oppWaitLevel >= 2
                        ? "Adversaire probablement déconnecté"
                        : "L'adversaire prend son temps…"}
                    </span>
                  </div>
                  {oppWaitLevel >= 2 && (
                    <button
                      onClick={leaveMatch}
                      className="px-4 py-1.5 rounded-xl bg-rose-500/25 hover:bg-rose-500/40 border border-rose-400/50 text-rose-100 text-[11px] font-bold transition"
                    >
                      Quitter (sans pénalité)
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={() => setQuitOpen(true)}
              className="mt-2 self-center px-4 py-2 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/40 text-zinc-400 hover:text-rose-200 text-xs transition"
            >
              🏳️ Forfeit match
            </button>
            <AnimatePresence>
              {quitOpen && (
                <QuitConfirmModal
                  competitive={!vsBot}
                  onCancel={() => setQuitOpen(false)}
                  onConfirm={() => { setQuitOpen(false); if (!vsBot) recordAbandon(); leaveMatch(); }}
                />
              )}
            </AnimatePresence>
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
            onRematch={vsBot ? startBotFallback : requestRematch}
          />
        )}

        {phase === "lanes_prep" && lanesMatch && lanesOppPersona && (
          <motion.div
            key="lanes-prep"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="flex-1 flex flex-col min-h-0"
          >
            <MatchPrepScreen
              key={`lanes-prep-${lanesMatch.matchId}`}
              youName={player.nickname || "Toi"}
              youAvatar={player.avatar}
              youThemeId={player.themeId}
              youBackgroundId={player.backgroundId ?? "default"}
              oppName={lanesMatch.opponent || "Adversaire"}
              // No avatar exchange in the protocol yet — use a placeholder
              // glyph; the persona theme + bg already gives a distinct look.
              oppAvatar="🛡️"
              oppThemeId={lanesOppPersona.themeId}
              oppPadId={lanesOppPersona.padId}
              oppBackgroundId={lanesOppPersona.backgroundId}
              onBack={() => {
                clientRef.current?.send({ type: "leave_match" });
                setLanesMatch(null);
                setPrepReadyState({ you: false, opp: false });
                setPrepCoinWinner(null);
                backToMenu();
              }}
              // `onReady` is never called in online mode (the transition out
              // of the prep screen is driven by `lanes_round_start`), but
              // the prop is required by the component.
              onReady={() => {}}
              online={{
                youReady: prepReadyState.you,
                oppReady: prepReadyState.opp,
                coinWinner: prepCoinWinner,
                // `connDropped` flips true on "reconnecting" and false on
                // "open" — mirrors the underlying OnlineClient status, so
                // the prep button reflects the actual wire state.
                connectionAlive: !connDropped,
                onReady: () => {
                  if (prepReadyState.you || connDropped) return;
                  // Optimistic local flip — server will echo back the same
                  // `prep_ready_state` shortly, but the button feels
                  // unresponsive otherwise on a 100ms RTT. OnlineClient now
                  // queues the send if the socket happens to be mid-flap,
                  // so the message replays on reconnect (TTL guards against
                  // landing in a dead match).
                  setPrepReadyState((s) => ({ ...s, you: true }));
                  clientRef.current?.send({ type: "prep_ready" });
                },
              }}
            />
          </motion.div>
        )}

        {phase === "lanes_match" && lanesMatch && (
          <motion.div
            key="lanes"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col min-h-0"
          >
            {/* When the coin gave the duel to the opponent's pad, the arena
                override pad replaces the player's own. null = no override. */}
            <ArenaPadProvider value={prepCoinWinner === "opp" ? lanesOppPersona?.padId ?? null : null}>
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
                  setPrepCoinWinner(null);
                  backToMenu();
                }}
                onRematch={requestRematch}
              />
            </ArenaPadProvider>
          </motion.div>
        )}

        {phase === "lanes_bot" && (
          <motion.div
            key="lanes-bot"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col min-h-0"
          >
            <div className="mb-2 self-center px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-200 text-[11px] font-semibold">
              🤖 Aucun joueur trouvé — match d'entraînement
            </div>
            <LocalLanesGame winTo={lanesWinTo} onQuit={backToMenu} />
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

      {/* Rematch handshake overlays — rendered once, cover classic + lanes. */}
      <AnimatePresence>
        {rematchOffered && (
          <motion.div
            key="rematch-offer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-5 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 6 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className="w-full max-w-sm rounded-3xl bg-zinc-950 border border-white/15 p-6 shadow-2xl text-center flex flex-col gap-4"
            >
              <div className="text-4xl">🔁</div>
              <div className="text-lg font-black text-white">{t("online.rematch.offer")}</div>
              <div className="flex gap-2">
                <button
                  onClick={acceptRematch}
                  className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 font-bold text-white shadow-lg shadow-emerald-500/30 active:scale-[0.98] transition"
                >
                  {t("online.rematch.accept")}
                </button>
                <button
                  onClick={declineRematch}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 font-semibold text-zinc-200 active:scale-[0.98] transition"
                >
                  {t("online.rematch.decline")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {rematchPending && !rematchOffered && (
          <motion.div
            key="rematch-wait"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-5 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-sm rounded-3xl bg-zinc-950 border border-white/15 p-6 shadow-2xl text-center flex flex-col gap-4"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                className="text-4xl mx-auto"
              >
                🔁
              </motion.div>
              <div className="text-base font-bold text-white">{t("online.rematch.waiting")}</div>
              <button
                onClick={cancelRematchWait}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 font-semibold text-zinc-300 text-sm transition"
              >
                {t("online.rematch.cancel")}
              </button>
            </motion.div>
          </motion.div>
        )}

        {rematchToast && (
          <motion.div
            key="rematch-toast"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[60] px-4 py-2.5 rounded-xl bg-rose-500/90 text-white text-sm font-semibold shadow-lg"
          >
            {rematchToast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
