import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useStore } from "./store";
import { useT } from "./i18n";
import { Hand, MysteryHand, MOVE_ICON } from "./icons";
import { MOVES, type Move } from "./game";
import {
  OnlineClient,
  type ServerMessage,
  type PlayerSlot,
} from "./online";

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

  const [phase, setPhase] = useState<Phase>("menu");
  const [bestOf, setBestOf] = useState(3);
  const [lobbyCode, setLobbyCode] = useState("");        // we created it
  const [joinCode, setJoinCode] = useState("");          // input
  const [queuePosition, setQueuePosition] = useState(0);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [m, setM] = useState<MatchState>(emptyMatch());

  const clientRef = useRef<OnlineClient | null>(null);

  /* ── Lazy create client ── */
  function ensureClient(): Promise<OnlineClient> {
    if (clientRef.current && clientRef.current.status === "open") {
      return Promise.resolve(clientRef.current);
    }
    const c = new OnlineClient();
    clientRef.current = c;
    c.on(onMessage);
    return c.connect().then(() => {
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
        break;
      case "round_result":
        setM((cur) => ({
          ...cur,
          scoreA: msg.score_a,
          scoreB: msg.score_b,
          lastResult: { aMove: msg.a_move, bMove: msg.b_move, outcome: msg.outcome },
        }));
        setPhase("reveal");
        break;
      case "match_end":
        setM((cur) => ({
          ...cur,
          scoreA: msg.score_a,
          scoreB: msg.score_b,
          ended: { winner: msg.winner, forfeit: msg.forfeit },
        }));
        setPhase("match_end");
        break;
      case "opponent_left":
        // Wait for match_end which arrives right after.
        break;
      case "error":
        setErrMsg(`${msg.code}: ${msg.message}`);
        setPhase("error");
        break;
      case "chat":
      case "pong":
      default:
        break;
    }
  }

  /* ── Actions ── */
  async function createLobby() {
    setErrMsg(null);
    setPhase("connecting");
    try {
      const c = await ensureClient();
      c.send({ type: "create_lobby", best_of: bestOf });
      setPhase("creating");
    } catch (e) {
      setErrMsg(String(e));
      setPhase("error");
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
      setErrMsg(String(e));
      setPhase("error");
    }
  }

  async function joinQueue() {
    setErrMsg(null);
    setPhase("connecting");
    try {
      const c = await ensureClient();
      c.send({ type: "join_queue", best_of: bestOf });
    } catch (e) {
      setErrMsg(String(e));
      setPhase("error");
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
      <div className="flex items-baseline gap-3 mb-6">
        <h1 className="text-3xl font-black tracking-tight">🌐 {t("nav.online")}</h1>
        <span className="text-xs text-zinc-500">Beta · {player.nickname}</span>
      </div>

      <AnimatePresence mode="wait">
        {phase === "menu" && (
          <motion.div
            key="menu"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col gap-4"
          >
            <BestOfPicker value={bestOf} onChange={setBestOf} />

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
          <Waiting key="wait" label="Connecting…" onCancel={cancel} />
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
          <motion.div
            key="queued"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4 py-10"
          >
            <div className="text-2xl font-bold">In queue</div>
            <div className="text-sm text-zinc-400">
              {queuePosition > 0
                ? `Position #${queuePosition}`
                : "Searching for opponents…"}
            </div>
            <DotPulse />
            <button
              onClick={cancel}
              className="mt-4 px-5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-sm transition"
            >
              Cancel
            </button>
          </motion.div>
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
            <div className="flex items-center justify-between rounded-2xl bg-black/30 border border-white/10 px-4 py-3">
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-wider text-zinc-500">You</span>
                <span className="font-semibold truncate">{player.nickname}</span>
              </div>
              <div className="text-3xl font-black tabular-nums">
                <span className="text-emerald-300">{youScore}</span>
                <span className="text-zinc-600 mx-2">:</span>
                <span className="text-rose-300">{oppScore}</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-xs uppercase tracking-wider text-zinc-500">Opponent</span>
                <span className="font-semibold truncate">{m.opponent}</span>
              </div>
            </div>

            <div className="text-center text-xs text-zinc-500">
              Round {m.roundNo || 1} · first to {target}
            </div>

            {/* Reveal area */}
            <div className="flex items-center justify-around py-4 sm:py-8">
              <PlayerCard
                side="left"
                move={youMove}
                pendingMove={m.myMove}
                emphasis={
                  outcomeForYou === "win" ? "winner" :
                  outcomeForYou === "loss" ? "loser" :
                  "default"
                }
              />
              <div className="text-3xl font-black text-zinc-500">VS</div>
              <PlayerCard
                side="right"
                move={oppMove}
                pendingMove={null /* hidden until reveal */}
                emphasis={
                  outcomeForYou === "loss" ? "winner" :
                  outcomeForYou === "win" ? "loser" :
                  "default"
                }
              />
            </div>

            {/* Outcome line */}
            <div className="text-center min-h-[2em]">
              {phase === "reveal" && outcomeForYou === "draw" && (
                <div className="text-zinc-400 font-medium">Draw — same move</div>
              )}
              {phase === "reveal" && outcomeForYou === "win" && verb && (
                <div className="text-emerald-300 font-semibold">
                  You win — your {youMove} {verb} {oppMove}
                </div>
              )}
              {phase === "reveal" && outcomeForYou === "loss" && verb && (
                <div className="text-rose-300 font-semibold">
                  You lose — {m.opponent}'s {oppMove} {verb} {youMove}
                </div>
              )}
              {phase === "round" && !m.myMove && (
                <div className="text-zinc-400">Pick a move…</div>
              )}
              {phase === "round" && m.myMove && (
                <div className="text-zinc-400">Waiting for opponent…</div>
              )}
            </div>

            {/* Move picker (only during round, only if not yet played) */}
            {phase === "round" && !m.myMove && (
              <div className="grid grid-cols-5 gap-2 sm:gap-3 mt-2">
                {MOVES.map((mv) => {
                  const Icon = MOVE_ICON[mv];
                  return (
                    <button
                      key={mv}
                      onClick={() => playMove(mv)}
                      className="aspect-square rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-zinc-200 active:scale-95 transition"
                      title={mv}
                    >
                      <Icon className="w-7 h-7 sm:w-9 sm:h-9" />
                    </button>
                  );
                })}
              </div>
            )}

            <button
              onClick={leaveMatch}
              className="mt-4 self-center px-4 py-2 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/40 text-zinc-400 hover:text-rose-200 text-sm transition"
            >
              Forfeit
            </button>
          </motion.div>
        )}

        {phase === "match_end" && m.ended && (
          <motion.div
            key="end"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4 py-10"
          >
            <div className="text-5xl">
              {m.ended.winner === m.youAre ? "🏆" : m.ended.winner === null ? "🤝" : "💀"}
            </div>
            <div className="text-3xl font-black">
              {m.ended.winner === m.youAre
                ? "Victory"
                : m.ended.winner === null
                ? "Draw"
                : "Defeat"}
              {m.ended.forfeit && <span className="text-sm text-zinc-500 ml-2">(forfeit)</span>}
            </div>
            <div className="text-2xl font-mono">
              {youScore} — {oppScore}
            </div>
            <button
              onClick={backToMenu}
              className="mt-4 px-6 py-3 rounded-xl bg-violet-500/90 hover:bg-violet-500 font-semibold text-white shadow-lg shadow-violet-500/30 active:scale-[0.98] transition"
            >
              Back to menu
            </button>
          </motion.div>
        )}

        {phase === "error" && (
          <motion.div
            key="err"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4 py-10"
          >
            <div className="text-4xl">⚠️</div>
            <div className="text-rose-300 font-semibold text-center">
              {errMsg || "Something went wrong."}
            </div>
            <button
              onClick={backToMenu}
              className="mt-2 px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm transition"
            >
              Back
            </button>
          </motion.div>
        )}
      </AnimatePresence>
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

function PlayerCard({
  side,
  move,
  pendingMove,
  emphasis,
}: {
  side: "left" | "right";
  move: Move | null;
  pendingMove: Move | null;
  emphasis: "default" | "winner" | "loser";
}) {
  const shown = move ?? pendingMove;
  return (
    <div className={"flex flex-col items-center gap-2 " + (side === "right" ? "scale-x-[-1]" : "")}>
      {shown ? (
        <div className={side === "right" ? "scale-x-[-1]" : ""}>
          <Hand move={shown} size="lg" emphasis={move ? emphasis : "default"} />
        </div>
      ) : (
        <MysteryHand size="lg" />
      )}
    </div>
  );
}
