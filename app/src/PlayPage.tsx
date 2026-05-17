import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Move,
  MOVES,
  RoundResult,
  MatchState,
  applyRound,
  newMatch,
  resolveRound,
  status,
  target,
  AiMood,
  AI_MOOD_META,
  aiMove,
  rollAiMood,
} from "./game";
import { Hand, MysteryHand, MOVE_PALETTE } from "./icons";
import { BattlePad } from "./BattlePad";
import { useStore } from "./store";
import {
  GameMode,
  MatchRecord,
  MODE_META,
  Opponent,
  Outcome,
  REWARDS,
} from "./types";
import { THEMES } from "./theme";
import { todayChallenge, type DailyChallenge } from "./daily";
import { useT } from "./i18n";
import type { Page } from "./Sidebar";

type View =
  | { kind: "select" }
  | { kind: "game"; mode: GameMode; bestOf: number; daily?: DailyChallenge };

export function PlayPage({ onNavigate }: { onNavigate?: (p: Page) => void }) {
  const [view, setView] = useState<View>({ kind: "select" });

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-8 py-2 sm:py-4 flex-1 flex flex-col">
      <AnimatePresence mode="wait">
        {view.kind === "select" && (
          <ModeSelect
            key="select"
            onStart={(mode, bestOf) => setView({ kind: "game", mode, bestOf })}
            onStartDaily={(daily) =>
              setView({ kind: "game", mode: daily.mode, bestOf: daily.bestOf, daily })
            }
            onGoOnline={onNavigate ? () => onNavigate("online") : undefined}
          />
        )}
        {view.kind === "game" && (
          <Game
            key={`${view.mode}-${view.bestOf}-${view.daily?.date ?? ""}-${Date.now()}`}
            mode={view.mode}
            bestOf={view.bestOf}
            daily={view.daily}
            onQuit={() => setView({ kind: "select" })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────── Mode Select ─────────── */

// "online" is a UI-only card on the home grid that navigates to OnlinePage
// — it's not a GameMode (which represents local CPU/hotseat match records).
type ModeCardId = GameMode | "online";

// Order matches user preference: Online slotted right after Casual so it's
// visible without scrolling.
const ALL_CARDS: ModeCardId[] = ["training", "casual", "online", "ranked", "hotseat"];

function ModeSelect({
  onStart,
  onStartDaily,
  onGoOnline,
}: {
  onStart: (mode: GameMode, bestOf: number) => void;
  onStartDaily: (daily: DailyChallenge) => void;
  onGoOnline?: () => void;
}) {
  const [mode, setMode] = useState<GameMode>("casual");
  const [bestOf, setBestOf] = useState(3);
  const [pendingMode, setPendingMode] = useState<GameMode | null>(null);
  const completedDailies = useStore((s) => s.player.completedDailies);
  const t = useT();

  const daily = todayChallenge();
  const dailyDone = completedDailies.includes(daily.date);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-6"
    >
      <div className="text-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-violet-400 via-fuchsia-400 to-teal-300 bg-clip-text text-transparent">
          {t("play.title")}
        </h1>
        <p className="mt-2 text-zinc-400 text-sm">
          {t("splash.tagline")}
        </p>
      </div>

      <DailyBanner daily={daily} done={dailyDone} onStart={() => onStartDaily(daily)} />

      {/* Mode tiles — tap to open confirmation modal (Online navigates instead) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ALL_CARDS.map((m, i) => {
          if (m === "online") {
            return (
              <motion.button
                key="online"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i, duration: 0.25 }}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onGoOnline?.()}
                disabled={!onGoOnline}
                className={
                  "text-left p-4 rounded-2xl border transition flex items-start gap-3 relative overflow-hidden " +
                  "border-violet-400/30 bg-gradient-to-br from-violet-500/15 via-fuchsia-500/10 to-cyan-500/15 " +
                  "hover:from-violet-500/25 hover:via-fuchsia-500/20 hover:to-cyan-500/25 hover:border-violet-400/60 " +
                  "shadow-lg shadow-violet-500/10"
                }
              >
                <span className="text-3xl">🌐</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{t("mode.online")}</span>
                    <span className="text-[10px] uppercase tracking-wider text-violet-200 bg-violet-500/25 px-1.5 rounded-full">
                      LIVE
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 mt-0.5">{t("mode.online.tag")}</p>
                  <p className="text-[10px] text-violet-300/80 mt-1.5">
                    {t("mode.online.cta")} →
                  </p>
                </div>
              </motion.button>
            );
          }
          const rewards = REWARDS[m];
          return (
            <motion.button
              key={m}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.25 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setMode(m); setPendingMode(m); }}
              className="text-left p-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition flex items-start gap-3"
            >
              <span className="text-3xl">{MODE_META[m].emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{t("mode." + m)}</span>
                  {rewards.lpWin > 0 && (
                    <span className="text-[10px] uppercase tracking-wider text-rose-300 bg-rose-500/15 px-1.5 rounded-full">
                      LP
                    </span>
                  )}
                  {rewards.xpWin > 0 && (
                    <span className="text-[10px] uppercase tracking-wider text-emerald-300 bg-emerald-500/15 px-1.5 rounded-full">
                      XP
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">{t("mode." + m + ".tag")}</p>
                {rewards.xpWin > 0 && (
                  <p className="text-[10px] text-zinc-500 mt-1.5">
                    {t("play.win.xp", { n: rewards.xpWin })}
                    {rewards.lpWin > 0 && ` · ${t("play.win.lp", { n: rewards.lpWin })}`}
                    {rewards.lpLoss < 0 && ` · ${t("play.loss.lp", { n: rewards.lpLoss })}`}
                  </p>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Mode confirmation modal */}
      <AnimatePresence>
        {pendingMode && (
          <ModeConfirmModal
            mode={pendingMode}
            bestOf={bestOf}
            onBestOfChange={setBestOf}
            onCancel={() => setPendingMode(null)}
            onConfirm={() => { setPendingMode(null); onStart(mode, bestOf); }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─────────── Mode confirmation modal ─────────── */

function ModeConfirmModal({
  mode, bestOf, onBestOfChange, onCancel, onConfirm,
}: {
  mode: GameMode;
  bestOf: number;
  onBestOfChange: (n: number) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useT();
  const themeId = useStore((s) => s.player.themeId);
  const theme = THEMES[themeId];
  const r = REWARDS[mode];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 5 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-zinc-950 border border-white/15 rounded-3xl p-6 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-3">
          <span className="text-4xl">{MODE_META[mode].emoji}</span>
          <div>
            <h2 className="text-xl font-bold">{t("mode." + mode)}</h2>
            <p className="text-xs text-zinc-400">{t("mode." + mode + ".tag")}</p>
          </div>
        </div>

        <div className="my-5">
          <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-2">
            {t("play.bestOf")}
          </div>
          <div className="flex gap-2">
            {[1, 3, 5, 7].map((n) => (
              <button
                key={n}
                onClick={() => onBestOfChange(n)}
                className={
                  "flex-1 px-3 py-2 rounded-xl border text-sm font-semibold transition " +
                  (bestOf === n
                    ? "bg-white/15 border-white/40 text-white"
                    : "bg-white/5 border-white/10 hover:border-white/30")
                }
                style={
                  bestOf === n
                    ? { borderColor: theme.primary, color: theme.primary, background: `${theme.primary}20` }
                    : undefined
                }
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {(r.xpWin > 0 || r.lpWin !== 0) && (
          <p className="text-xs text-zinc-500 mb-5">
            {r.xpWin > 0 && t("play.win.xp", { n: r.xpWin })}
            {r.lpWin > 0 && ` · ${t("play.win.lp", { n: r.lpWin })}`}
            {r.lpLoss < 0 && ` · ${t("play.loss.lp", { n: r.lpLoss })}`}
          </p>
        )}

        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onCancel}
            className="flex-1 px-4 py-3 rounded-2xl font-semibold bg-white/5 hover:bg-white/10 border border-white/10"
          >
            {t("lab.btn.cancel")}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onConfirm}
            className="flex-1 px-4 py-3 rounded-2xl font-semibold text-white shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
            }}
          >
            {t("play.start")}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─────────── Daily Banner ─────────── */

function DailyBanner({
  daily, done, onStart,
}: { daily: DailyChallenge; done: boolean; onStart: () => void }) {
  const t = useT();
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={
        "rounded-2xl p-4 sm:p-5 border-2 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-5 " +
        (done
          ? "bg-emerald-950/30 border-emerald-700/40"
          : "bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-transparent border-amber-400/50 shadow-lg shadow-amber-900/20")
      }
    >
      <div className="text-3xl shrink-0">{done ? "✅" : "🎯"}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-widest font-bold text-amber-300">
          {t("play.daily.title")}
        </div>
        <div className="text-base sm:text-lg font-bold mt-0.5">
          {MODE_META[daily.mode].emoji} {t("mode." + daily.mode)}
          {" · "}
          {AI_MOOD_META[daily.mood].emoji} {t("mood." + daily.mood)}
          {" · "}
          {t("history.bo", { n: daily.bestOf })}
        </div>
        <div className="text-xs text-amber-200/80 mt-0.5">
          {done ? t("play.daily.done") : t("play.daily.bonus", { p: Math.round(daily.xpBonus * 100) })}
        </div>
      </div>
      {!done && (
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          onClick={onStart}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-zinc-900 font-bold text-sm shadow-lg shadow-amber-900/40 shrink-0"
        >
          {t("play.daily.start")}
        </motion.button>
      )}
    </motion.div>
  );
}

/* ─────────── Game ─────────── */

type Phase =
  | { kind: "p1-pick" }
  | { kind: "pass"; p1Move: Move }
  | { kind: "p2-pick"; p1Move: Move }
  | { kind: "countdown"; aMove: Move; bMove: Move }
  | { kind: "reveal"; round: RoundResult; matchOver: boolean }
  | { kind: "match-end" };

interface Streaks {
  a: number;
  b: number;
  bestA: number;
  bestB: number;
}

const PICK_TIMEOUT_MS = 8000;

function Game({
  mode,
  bestOf,
  daily,
  onQuit,
}: {
  mode: GameMode;
  bestOf: number;
  daily?: DailyChallenge;
  onQuit: () => void;
}) {
  const recordMatch = useStore((s) => s.recordMatch);
  const recordDailyComplete = useStore((s) => s.recordDailyComplete);
  const profileNickname = useStore((s) => s.player.nickname);
  const padId = useStore((s) => s.player.padId);
  const difficulty = useStore((s) => s.player.difficulty);
  const t = useT();

  const [match, setMatch] = useState<MatchState>(() => newMatch(bestOf));
  const [phase, setPhase] = useState<Phase>({ kind: "p1-pick" });
  const [streaks, setStreaks] = useState<Streaks>({ a: 0, b: 0, bestA: 0, bestB: 0 });
  // For daily, the mood is forced. For free play, rolled per match.
  const [mood, setMood] = useState<AiMood>(() => daily?.mood ?? rollAiMood());
  // The daily bonus only applies to the FIRST match of this Game instance.
  // After "Play again", isDailyActive becomes false so we don't farm the bonus.
  const [isDailyActive, setIsDailyActive] = useState<boolean>(!!daily);
  const [recorded, setRecorded] = useState(false);
  // Player times out → counts as a lost round. 3 timeouts = forfeit.
  const MAX_TIMEOUTS = 3;
  const [timeouts, setTimeouts] = useState(0);

  const isHotseat = mode === "hotseat";
  const labelA = isHotseat ? t("match.player1") : profileNickname || t("match.you");
  const labelB = isHotseat ? t("match.player2") : t("match.cpu");

  const onP1Pick = (m: Move) => {
    if (!isHotseat) {
      const playerRecent = match.history.map((r) => r.move_a);
      setPhase({ kind: "countdown", aMove: m, bMove: aiMove(mood, difficulty, playerRecent) });
    } else {
      setPhase({ kind: "pass", p1Move: m });
    }
  };

  /** Player ran out of time on their pick — counts as a lost round. */
  const onP1Timeout = () => {
    const newCount = timeouts + 1;
    setTimeouts(newCount);
    if (newCount >= MAX_TIMEOUTS) {
      // Forfeit: the opponent immediately wins the match.
      const tgt = target(match);
      setMatch({ ...match, scoreB: tgt });
      setPhase({ kind: "match-end" });
      return;
    }
    // Force a loss for this round: Player picks Rock, opponent picks Paper.
    // Paper covers Rock → AI wins this round.
    setPhase({ kind: "countdown", aMove: "rock", bMove: "paper" });
  };

  const continueToP2 = () => {
    if (phase.kind === "pass") setPhase({ kind: "p2-pick", p1Move: phase.p1Move });
  };

  const onP2Pick = (m: Move) => {
    if (phase.kind !== "p2-pick") return;
    setPhase({ kind: "countdown", aMove: phase.p1Move, bMove: m });
  };

  /** Hot-seat: P2 timed out → P1 wins this round (Rock vs Scissors). */
  const onP2Timeout = () => {
    if (phase.kind !== "p2-pick") return;
    setPhase({ kind: "countdown", aMove: "rock", bMove: "scissors" });
  };

  const finishCountdown = async () => {
    if (phase.kind !== "countdown") return;
    const round = await resolveRound(phase.aMove, phase.bMove);
    const next = applyRound(match, round);
    setMatch(next);
    setStreaks((s) => {
      let { a, b, bestA, bestB } = s;
      if (round.outcome.kind === "a_wins") {
        a += 1; b = 0;
        bestA = Math.max(bestA, a);
      } else if (round.outcome.kind === "b_wins") {
        b += 1; a = 0;
        bestB = Math.max(bestB, b);
      }
      return { a, b, bestA, bestB };
    });
    setPhase({
      kind: "reveal",
      round,
      matchOver: status(next) !== "in_progress",
    });
  };

  const advance = () => {
    if (phase.kind !== "reveal") return;
    if (phase.matchOver) setPhase({ kind: "match-end" });
    else setPhase({ kind: "p1-pick" });
  };

  /** User confirmed Quit mid-match → record as a forfeit loss, then unmount. */
  const handleQuit = () => {
    // If the match already ended naturally, the recordMatch effect handled it.
    if (recorded || phase.kind === "match-end") {
      onQuit();
      return;
    }
    const tgt = target(match);
    const opponent: Opponent = isHotseat
      ? { kind: "human", nickname: "Guest" }
      : { kind: "cpu", mood };
    const r = REWARDS[mode];
    const rec: MatchRecord = {
      id:
        globalThis.crypto && "randomUUID" in globalThis.crypto
          ? (globalThis.crypto as Crypto).randomUUID()
          : `${Date.now()}-${Math.random()}`,
      mode,
      bestOf,
      opponent,
      scorePlayer: match.scoreA,
      // Treat the opponent as crossing the finish line — that's what a
      // forfeit means in the match history.
      scoreOpponent: tgt,
      outcome: "loss",
      rounds: match.history.map((rd) => ({
        playerMove: rd.move_a,
        opponentMove: rd.move_b,
        result:
          rd.outcome.kind === "a_wins"
            ? "win"
            : rd.outcome.kind === "b_wins"
            ? "loss"
            : "draw",
      })),
      // No XP from forfeits (you don't get rewarded for bailing).
      xpDelta: 0,
      // Ranked still pays the loss penalty so players can't ditch to dodge LP.
      lpDelta: r.lpLoss,
      timestamp: Date.now(),
      forfeit: true,
    };
    recordMatch(rec);
    setRecorded(true);
    onQuit();
  };

  // Record match on end (once)
  useEffect(() => {
    if (phase.kind !== "match-end" || recorded) return;
    const s = status(match);
    if (s === "in_progress") return;

    const outcome: Outcome = s === "a_won" ? "win" : "loss";
    const r = REWARDS[mode];
    const baseXp =
      outcome === "win" ? r.xpWin : outcome === "loss" ? r.xpLoss : r.xpDraw;
    const lpDelta =
      outcome === "win" ? r.lpWin : outcome === "loss" ? r.lpLoss : r.lpDraw;

    // Streak multiplier — applied only on wins (don't reward losing streaks)
    const peakStreak = streaks.bestA;
    const streakMult =
      outcome === "win" && peakStreak >= 5 ? 2.0 :
      outcome === "win" && peakStreak >= 3 ? 1.5 :
      outcome === "win" && peakStreak >= 2 ? 1.2 : 1.0;
    // Daily challenge bonus on win
    const dailyMult = outcome === "win" && isDailyActive && daily ? (1 + daily.xpBonus) : 1.0;
    const xpDelta = Math.round(baseXp * streakMult * dailyMult);

    // Mark daily as completed only on win
    if (outcome === "win" && isDailyActive && daily) {
      recordDailyComplete(daily.date);
    }

    const opponent: Opponent = isHotseat
      ? { kind: "human", nickname: "Guest" }
      : { kind: "cpu", mood };

    const rec: MatchRecord = {
      id:
        (globalThis.crypto && "randomUUID" in globalThis.crypto
          ? (globalThis.crypto as Crypto).randomUUID()
          : `${Date.now()}-${Math.random()}`),
      mode,
      bestOf,
      opponent,
      scorePlayer: match.scoreA,
      scoreOpponent: match.scoreB,
      outcome,
      rounds: match.history.map((r) => ({
        playerMove: r.move_a,
        opponentMove: r.move_b,
        result:
          r.outcome.kind === "a_wins"
            ? "win"
            : r.outcome.kind === "b_wins"
            ? "loss"
            : "draw",
      })),
      xpDelta,
      lpDelta,
      timestamp: Date.now(),
    };
    recordMatch(rec);
    setRecorded(true);
  }, [phase, match, mode, bestOf, isHotseat, mood, streaks.bestA, isDailyActive, daily, recordMatch, recordDailyComplete, recorded]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-2 sm:gap-4 flex-1"
    >
      {/* Header OUTSIDE the board — never overlaps */}
      <Header
        mode={mode}
        labelA={labelA}
        labelB={labelB}
        scoreA={match.scoreA}
        scoreB={match.scoreB}
        target={target(match)}
        streakA={streaks.a}
        streakB={streaks.b}
        mood={!isHotseat ? mood : null}
        onQuit={handleQuit}
      />

      {/* Board: pad as canvas, takes ALL remaining vertical space */}
      <div className="relative flex-1 min-h-[400px] rounded-2xl sm:rounded-3xl overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <BattlePad padId={padId} className="w-full h-full opacity-90" />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.28) 55%, rgba(0,0,0,0) 100%)",
            }}
          />
        </div>

        <div className="relative w-full h-full flex items-center justify-center p-3 sm:p-8">
          <AnimatePresence mode="wait">
        {phase.kind === "p1-pick" && (
          <PickPanel
            key="p1"
            title={t("match.pickTitle", { name: labelA })}
            subtitle={isHotseat ? t("match.pickHotseat") : t("match.pickSubtitle")}
            onPick={onP1Pick}
            onTimeout={isHotseat ? undefined : onP1Timeout}
            withTimer
            recentOppMoves={
              !isHotseat
                ? match.history.slice(-3).map((r) => r.move_b)
                : undefined
            }
          />
        )}

        {phase.kind === "pass" && (
          <PassPanel key="pass" labelB={labelB} onContinue={continueToP2} />
        )}

        {phase.kind === "p2-pick" && (
          <PickPanel
            key="p2"
            title={t("match.pickTitle", { name: labelB })}
            subtitle={t("match.pickP2Sub")}
            onPick={onP2Pick}
            onTimeout={onP2Timeout}
            withTimer
          />
        )}

        {phase.kind === "countdown" && (
          <Countdown
            key="countdown"
            labelA={labelA}
            labelB={labelB}
            onDone={finishCountdown}
          />
        )}

        {phase.kind === "reveal" && (
          <RevealPanel
            key="reveal"
            round={phase.round}
            labelA={labelA}
            labelB={labelB}
            streakA={streaks.a}
            streakB={streaks.b}
            matchOver={phase.matchOver}
            onNext={advance}
          />
        )}

        {phase.kind === "match-end" && (
          <EndPanel
            key="end"
            labelA={labelA}
            labelB={labelB}
            match={match}
            streaks={streaks}
            mood={!isHotseat ? mood : null}
            mode={mode}
            isDaily={isDailyActive}
            dailyBonus={daily?.xpBonus ?? 0}
            onAgain={() => {
              setMatch(newMatch(bestOf));
              setStreaks({ a: 0, b: 0, bestA: 0, bestB: 0 });
              // After the daily match, rematches are normal play (no bonus, mood re-rolled).
              setIsDailyActive(false);
              setMood(rollAiMood());
              setRecorded(false);
              setPhase({ kind: "p1-pick" });
            }}
            onQuit={onQuit}
          />
        )}
          </AnimatePresence>
        </div>
      </div>

      {/* Useful facts panel — collapsible, fills the space below the board */}
      <MatchFacts mode={mode} mood={!isHotseat ? mood : null} difficulty={difficulty} />
    </motion.div>
  );
}

/* ─────────── Useful facts panel below the board ─────────── */

function MatchFacts({
  mode, mood, difficulty,
}: {
  mode: GameMode;
  mood: AiMood | null;
  difficulty: "easy" | "normal" | "hard";
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const r = REWARDS[mode];
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3 py-2 flex items-center justify-between gap-3 text-left hover:bg-white/5 transition"
      >
        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-base">{MODE_META[mode].emoji}</span>
          <span className="font-semibold truncate">{t("mode." + mode)}</span>
          {mood && (
            <>
              <span className="text-zinc-600">·</span>
              <span className="text-xs text-zinc-300 truncate">
                {AI_MOOD_META[mood].emoji} {t("mood." + mood)}
              </span>
            </>
          )}
        </div>
        <span className={"text-zinc-500 text-xs transition " + (open ? "rotate-180" : "")}>▾</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 grid gap-3 text-xs">
              {/* Mode info */}
              <div className="border-t border-white/5 pt-3">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1">
                  {t("mode." + mode)}
                </div>
                <p className="text-zinc-300 leading-relaxed">{t("mode." + mode + ".tag")}</p>
                {r.xpWin > 0 && (
                  <p className="text-[11px] text-zinc-400 mt-1.5">
                    {t("play.win.xp", { n: r.xpWin })}
                    {r.lpWin > 0 && ` · ${t("play.win.lp", { n: r.lpWin })}`}
                    {r.lpLoss < 0 && ` · ${t("play.loss.lp", { n: r.lpLoss })}`}
                  </p>
                )}
              </div>
              {/* Mood info */}
              {mood && (
                <div className="border-t border-white/5 pt-3">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1">
                    {AI_MOOD_META[mood].emoji} {t("mood." + mood)}
                  </div>
                  <p className="text-zinc-300 leading-relaxed">{t("mood." + mood + ".desc")}</p>
                </div>
              )}
              {/* Difficulty info */}
              <div className="border-t border-white/5 pt-3">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1">
                  {t("profile.diff.title")} · {t("diff." + difficulty)}
                </div>
                <p className="text-zinc-300 leading-relaxed">{t("diff." + difficulty + ".desc")}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────── Header ─────────── */

function Header({
  labelA, labelB, scoreA, scoreB, target,
  streakA, streakB, onQuit,
}: {
  mode: GameMode;
  labelA: string; labelB: string; scoreA: number; scoreB: number;
  target: number; streakA: number; streakB: number;
  mood: AiMood | null; onQuit: () => void;
}) {
  const t = useT();
  const [confirmQuit, setConfirmQuit] = useState(false);
  const isMidMatch = scoreA > 0 || scoreB > 0;

  const handleQuitClick = () => {
    if (isMidMatch) setConfirmQuit(true);
    else onQuit();
  };

  return (
    <>
      <div className="flex items-center justify-center gap-3 relative">
        {/* Compact back-arrow button — absolute positioned so the score stays centered */}
        <button
          onClick={handleQuitClick}
          aria-label={t("match.quit")}
          className="absolute left-0 w-10 h-10 rounded-xl border border-white/10 hover:border-white/30 bg-zinc-950/40 backdrop-blur-sm transition flex items-center justify-center text-zinc-300 hover:text-white"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* Centered score badge */}
        <div className="flex items-center gap-4 sm:gap-7 bg-zinc-950/55 backdrop-blur-md border border-white/15 rounded-xl sm:rounded-2xl px-4 sm:px-7 py-1.5 sm:py-2 shadow-xl">
          <ScoreSide name={labelA} score={scoreA} target={target} streak={streakA} />
          <span className="text-zinc-500 text-xs font-bold tracking-[0.3em]">{t("match.vs")}</span>
          <ScoreSide name={labelB} score={scoreB} target={target} streak={streakB} align="right" />
        </div>
      </div>

      {/* Quit confirmation modal */}
      <AnimatePresence>
        {confirmQuit && (
          <QuitConfirmModal
            onCancel={() => setConfirmQuit(false)}
            onConfirm={() => { setConfirmQuit(false); onQuit(); }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function QuitConfirmModal({
  onCancel, onConfirm,
}: { onCancel: () => void; onConfirm: () => void }) {
  const t = useT();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-zinc-950 border border-white/15 rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-5 max-w-xs"
      >
        <span className="text-4xl">⚠️</span>
        <p className="text-base font-semibold text-center">
          {t("match.quitConfirm")}
        </p>
        <div className="flex items-center gap-3 w-full">
          {/* ✓ green: YES, quit (recorded as forfeit loss). */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onConfirm}
            aria-label="Yes, quit (forfeit)"
            className="flex-1 h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold flex items-center justify-center shadow-lg"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </motion.button>
          {/* ✗ rose: NO, stay in the match. */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onCancel}
            aria-label="No, stay in the match"
            className="flex-1 h-12 rounded-2xl bg-rose-500 hover:bg-rose-400 text-white font-bold flex items-center justify-center shadow-lg"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </svg>
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ScoreSide({
  name, score, target, streak, align = "left",
}: {
  name: string; score: number; target: number; streak: number;
  align?: "left" | "right";
}) {
  return (
    <div className={"flex flex-col " + (align === "right" ? "items-end" : "items-start")}>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-semibold uppercase tracking-wider text-zinc-200">{name}</span>
        <AnimatePresence>
          {streak >= 2 && (
            <motion.span
              key={streak}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 18 }}
              className={
                "text-[10px] font-bold px-1.5 py-0.5 rounded-full " +
                (streak >= 3
                  ? "bg-orange-500/30 text-orange-300 ring-1 ring-orange-400/50"
                  : "bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/40")
              }
            >
              🔥 {streak}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <div className="flex gap-1.5 mt-1.5">
        {Array.from({ length: target }).map((_, i) => (
          <motion.span
            key={i}
            initial={false}
            animate={{
              scale: i < score ? [1, 1.5, 1] : 1,
              backgroundColor: i < score ? "#a78bfa" : "rgba(255,255,255,0.12)",
            }}
            transition={{ duration: 0.4 }}
            className="w-3 h-3 rounded-full"
            style={i < score ? { boxShadow: "0 0 8px #a78bfa80" } : undefined}
          />
        ))}
      </div>
    </div>
  );
}

/* ─────────── PickPanel with 3s timer ─────────── */

function PickPanel({
  title, subtitle, onPick, onTimeout, withTimer = false, recentOppMoves,
}: {
  title: string; subtitle: string; onPick: (m: Move) => void;
  onTimeout?: () => void;
  withTimer?: boolean; recentOppMoves?: Move[];
}) {
  const t = useT();
  const [remaining, setRemaining] = useState(PICK_TIMEOUT_MS);
  const [locked, setLocked] = useState(false);

  // Tick timer
  useEffect(() => {
    if (!withTimer || locked) return;
    if (remaining <= 0) {
      setLocked(true);
      // Prefer explicit timeout handler (Game uses it to score against the player);
      // otherwise fall back to random auto-pick.
      if (onTimeout) {
        onTimeout();
      } else {
        const r = MOVES[Math.floor(Math.random() * MOVES.length)];
        onPick(r);
      }
      return;
    }
    const id = setTimeout(() => setRemaining((r) => r - 100), 100);
    return () => clearTimeout(id);
  }, [remaining, withTimer, locked, onPick, onTimeout]);

  const pct = withTimer ? Math.max(0, remaining / PICK_TIMEOUT_MS) : 1;
  const seconds = Math.ceil(remaining / 1000);
  const urgent = remaining < 1500 && remaining > 0;
  const critical = remaining < 500 && remaining > 0;

  const handlePick = (m: Move) => {
    if (locked) return;
    setLocked(true);
    onPick(m);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={critical
        ? { opacity: 1, y: 0, x: [0, -3, 3, -3, 3, 0] }
        : { opacity: 1, y: 0, x: 0 }
      }
      exit={{ opacity: 0, y: -16 }}
      transition={critical
        ? { x: { duration: 0.4, repeat: Infinity }, default: { duration: 0.25 } }
        : { duration: 0.25 }
      }
      className={
        "relative bg-zinc-950/30 backdrop-blur-sm rounded-2xl sm:rounded-3xl shadow-xl ring-1 px-3 py-4 sm:p-12 border flex flex-col items-center gap-3 sm:gap-6 w-full transition-colors " +
        (urgent
          ? "ring-rose-500/50 border-rose-500/40"
          : "ring-white/10 border-white/10")
      }
    >
      {/* Critical red flash overlay covering the whole panel */}
      <AnimatePresence>
        {critical && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.4, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="absolute inset-0 rounded-2xl sm:rounded-3xl bg-rose-500/40 pointer-events-none"
          />
        )}
      </AnimatePresence>
      <div className="text-center">
        <h2 className="text-lg sm:text-3xl font-bold leading-tight">{title}</h2>
        <p className="text-zinc-400 text-xs sm:text-base mt-1">{subtitle}</p>
      </div>

      {recentOppMoves && recentOppMoves.length > 0 && (
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5">
          <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-zinc-400 font-medium">
            {t("match.cpu.last")}
          </span>
          <div className="flex gap-1">
            {recentOppMoves.map((m, i) => (
              <motion.div
                key={`${i}-${m}`}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 0.6 + i * 0.15, scale: 1 }}
                transition={{ delay: i * 0.05 }}
              >
                <Hand move={m} size="sm" />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {withTimer && (
        <div className="w-full max-w-md relative">
          <div className="flex items-center justify-between text-[10px] sm:text-xs text-zinc-400 mb-1">
            <span className={"uppercase tracking-wider " + (urgent ? "text-rose-300 font-bold" : "")}>
              {t("match.timeleft")}
            </span>
            <motion.span
              animate={{
                scale: critical ? [1, 1.5, 1] : urgent ? [1, 1.2, 1] : 1,
                color: urgent ? "#f87171" : "#e4e4e7",
              }}
              transition={{ duration: 0.35, repeat: urgent ? Infinity : 0 }}
              className={"font-bold " + (urgent ? "text-lg sm:text-2xl" : "text-sm sm:text-base")}
            >
              {seconds}s
            </motion.span>
          </div>
          <div className="h-1.5 sm:h-2 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className={
                "h-full rounded-full " +
                (urgent ? "bg-rose-400" : "bg-gradient-to-r from-violet-400 to-fuchsia-400")
              }
              animate={{
                width: `${pct * 100}%`,
                boxShadow: urgent
                  ? ["0 0 0px #f87171", "0 0 14px #f87171", "0 0 0px #f87171"]
                  : "0 0 0px transparent",
              }}
              transition={{
                width: { duration: 0.1, ease: "linear" },
                boxShadow: { duration: 0.5, repeat: urgent ? Infinity : 0 },
              }}
            />
          </div>
        </div>
      )}

      {/* 5 hands: on mobile, 3 cols → centered row of 3 + centered row of 2 via 6-col trick.
          On desktop, single row of 5. */}
      <div className="grid grid-cols-6 sm:grid-cols-5 gap-2 sm:gap-4 w-full max-w-3xl">
        {MOVES.map((m, i) => (
          <motion.button
            key={m}
            onClick={() => handlePick(m)}
            disabled={locked}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 * i, duration: 0.25 }}
            whileHover={{ y: -6, scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={
              "col-span-2 sm:col-span-1 " +
              (i === 3 ? "col-start-2 sm:col-start-auto " : "") +
              "group rounded-2xl p-2 sm:p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 disabled:opacity-50 disabled:cursor-not-allowed transition flex flex-col items-center gap-1.5 sm:gap-2.5"
            }
          >
            <Hand move={m} size="lg" />
            <span className="text-xs sm:text-sm font-medium text-zinc-300 group-hover:text-white">
              {t("element." + m)}
            </span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

/* ─────────── PassPanel ─────────── */

function PassPanel({
  labelB, onContinue,
}: { labelB: string; onContinue: () => void }) {
  const t = useT();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25 }}
      className="bg-zinc-950/30 backdrop-blur-sm rounded-2xl sm:rounded-3xl shadow-xl ring-1 ring-white/10 p-5 sm:p-10 border border-white/10 flex flex-col items-center gap-6 text-center"
    >
      <motion.span
        animate={{ rotate: [0, -10, 10, -10, 0] }}
        transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1 }}
        className="text-5xl"
      >
        📱
      </motion.span>
      <h2 className="text-xl font-semibold">{t("match.pass.title", { name: labelB })}</h2>
      <p className="text-zinc-400 text-sm max-w-sm">{t("match.pass.subtitle")}</p>
      <motion.button
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.97 }}
        onClick={onContinue}
        className="px-6 py-3 rounded-2xl font-semibold bg-gradient-to-br from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 shadow-lg shadow-violet-900/30"
      >
        {t("match.pass.continue", { name: labelB })}
      </motion.button>
    </motion.div>
  );
}

/* ─────────── Countdown (5 beats) ─────────── */

const COUNTDOWN_IDS = ["rock", "paper", "scissors", "lizard", "spock"] as const;
const BEAT_MS = 360;

function Countdown({
  labelA, labelB, onDone,
}: { labelA: string; labelB: string; onDone: () => void }) {
  const tr = useT();
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    if (beat < COUNTDOWN_IDS.length) {
      const t = setTimeout(() => setBeat(beat + 1), BEAT_MS);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(onDone, 220);
      return () => clearTimeout(t);
    }
  }, [beat, onDone]);

  const id = COUNTDOWN_IDS[Math.min(beat, COUNTDOWN_IDS.length - 1)];
  const label = tr("element." + id) + "!";

  const shakeVariant = {
    animate: {
      y: [0, -22, 0],
      rotate: [0, -8, 0],
      transition: { duration: BEAT_MS / 1000, ease: "easeInOut" as const },
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="bg-zinc-950/30 backdrop-blur-sm rounded-2xl sm:rounded-3xl shadow-xl ring-1 ring-white/10 p-4 sm:p-6 border border-white/10 flex flex-col items-center gap-6"
    >
      <div className="grid grid-cols-3 items-center w-full">
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-zinc-400">{labelA}</span>
          <motion.div key={`a-${Math.min(beat, COUNTDOWN_IDS.length - 1)}`} variants={shakeVariant} animate="animate">
            <MysteryHand size="lg" />
          </motion.div>
        </div>

        <motion.div
          key={`label-${Math.min(beat, COUNTDOWN_IDS.length - 1)}`}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.4, opacity: 0 }}
          transition={{ type: "spring", stiffness: 350, damping: 18 }}
          className="text-center"
        >
          <span className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-br from-fuchsia-300 to-violet-400 bg-clip-text text-transparent">
            {label}
          </span>
        </motion.div>

        <div className="flex flex-col items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-zinc-400">{labelB}</span>
          <motion.div key={`b-${Math.min(beat, COUNTDOWN_IDS.length - 1)}`} variants={shakeVariant} animate="animate">
            <MysteryHand size="lg" />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─────────── Reveal ─────────── */

function RevealPanel({
  round, labelA, labelB, streakA, streakB, matchOver, onNext,
}: {
  round: RoundResult;
  labelA: string; labelB: string;
  streakA: number; streakB: number;
  matchOver: boolean; onNext: () => void;
}) {
  const t = useT();
  const { move_a, move_b, outcome } = round;
  const aWon = outcome.kind === "a_wins";
  const bWon = outcome.kind === "b_wins";
  const draw = outcome.kind === "draw";

  // Translate the canonical RPSLS verb returned by the core engine
  const verb =
    outcome.kind === "a_wins" || outcome.kind === "b_wins"
      ? t("verb." + outcome.verb.toLowerCase())
      : null;

  const winnerMove = aWon ? move_a : bWon ? move_b : null;
  const flashColor = winnerMove ? MOVE_PALETTE[winnerMove].hex : "#ffffff";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className="relative bg-zinc-950/30 backdrop-blur-sm rounded-2xl sm:rounded-3xl shadow-xl ring-1 ring-white/10 px-3 py-5 sm:p-12 border border-white/10 flex flex-col items-center gap-6 sm:gap-8 max-w-full"
    >
      {!draw && (
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: [0, 0.45, 0], scale: [0.6, 1.6, 2.2] }}
          transition={{ duration: 0.8, delay: 0.35, ease: "easeOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl pointer-events-none"
          style={{ background: flashColor }}
        />
      )}

      <div className="relative grid grid-cols-[1fr_auto_1fr] items-center w-full gap-4 sm:gap-8">
        <RevealHand label={labelA} move={move_a} winner={aWon} loser={bWon} side="left" streak={streakA} />

        <div className="relative h-32 sm:h-40 flex items-center justify-center px-2 sm:px-4">
          <motion.div
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 350, damping: 16 }}
            className="flex flex-col items-center"
          >
            <span className="text-zinc-300 uppercase tracking-[0.4em] text-sm sm:text-base font-bold">
              vs
            </span>
            <span className="block w-8 h-px bg-zinc-500 mt-1.5" />
          </motion.div>
          {!draw && <ParticleBurst color={flashColor} />}
        </div>

        <RevealHand label={labelB} move={move_b} winner={bWon} loser={aWon} side="right" streak={streakB} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.6, type: "spring", stiffness: 260, damping: 18 }}
        className="text-center min-h-[3rem] relative"
      >
        {draw && <p className="text-3xl font-bold text-zinc-300">{t("match.draw")}</p>}
        {!draw && verb && (
          <p className="text-xl sm:text-3xl font-bold">
            <span className={aWon ? "text-violet-300" : "text-teal-300"}>
              {t("element." + (aWon ? move_a : move_b))}
            </span>{" "}
            <span className="text-zinc-400 font-normal italic">{verb}</span>{" "}
            <span className="text-zinc-200">
              {t("element." + (aWon ? move_b : move_a))}
            </span>
          </p>
        )}
      </motion.div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.85 }}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.97 }}
        onClick={onNext}
        className="mt-2 px-7 py-3.5 rounded-2xl font-semibold text-base bg-white/10 hover:bg-white/20 border border-white/15 hover:border-white/30 transition relative z-10"
      >
        {matchOver ? t("match.seeResults") : t("match.next")}
      </motion.button>
    </motion.div>
  );
}

function RevealHand({
  label, move, winner, loser, side, streak,
}: {
  label: string; move: Move;
  winner: boolean; loser: boolean;
  side: "left" | "right"; streak: number;
}) {
  const t = useT();
  // Winner: small nod toward the middle. Loser: stays put (no outward push).
  const swing = winner ? (side === "left" ? 6 : -6) : 0;
  const rotateKick = winner ? (side === "left" ? 4 : -4) : 0;

  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-xs sm:text-sm uppercase tracking-wider text-zinc-400 font-semibold">{label}</span>
      <motion.div
        initial={{ scale: 0.4, rotate: -15, opacity: 0, x: 0 }}
        animate={{
          scale: winner ? [0.4, 1.08, 1.04] : loser ? [0.4, 1, 0.96] : 1,
          rotate: [(side === "left" ? -15 : 15), 0, rotateKick, 0],
          x: [0, 0, swing, swing * 0.4],
          opacity: 1,
        }}
        transition={{ duration: 0.7, times: [0, 0.4, 0.55, 1], ease: "easeOut" }}
        className={
          "relative " +
          (winner && streak >= 3
            ? "after:absolute after:inset-0 after:rounded-3xl after:ring-4 after:ring-orange-400/50 after:animate-pulse"
            : "")
        }
      >
        <Hand move={move} size="xl" emphasis={winner ? "winner" : loser ? "loser" : "default"} />
      </motion.div>
      <span className="text-base sm:text-lg text-zinc-200 font-medium">{t("element." + move)}</span>
    </div>
  );
}

function ParticleBurst({ color }: { color: string }) {
  const N = 10;
  const particles = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => {
        const angle = (i / N) * Math.PI * 2 + Math.random() * 0.3;
        const dist = 70 + Math.random() * 40;
        return {
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist,
          delay: 0.35 + Math.random() * 0.1,
          size: 6 + Math.random() * 4,
        };
      }),
    []
  );
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {particles.map((p, i) => (
        <motion.span
          key={i}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.dx, y: p.dy, opacity: 0, scale: 0.3 }}
          transition={{ duration: 0.75, delay: p.delay, ease: "easeOut" }}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            background: color,
            boxShadow: `0 0 12px ${color}`,
          }}
        />
      ))}
    </div>
  );
}

/* ─────────── End ─────────── */

function EndPanel({
  labelA, labelB, match, streaks, mood, mode, isDaily, dailyBonus, onAgain, onQuit,
}: {
  labelA: string; labelB: string; match: MatchState;
  streaks: Streaks; mood: AiMood | null; mode: GameMode;
  isDaily: boolean; dailyBonus: number;
  onAgain: () => void; onQuit: () => void;
}) {
  const t = useT();
  const s = status(match);
  const winnerLabel = s === "a_won" ? labelA : labelB;
  const bestStreak = Math.max(streaks.bestA, streaks.bestB);
  const bestStreakHolder = streaks.bestA >= streaks.bestB ? labelA : labelB;
  const r = REWARDS[mode];
  const playerWon = s === "a_won";
  const baseXp = playerWon ? r.xpWin : r.xpLoss;
  const lpDelta = playerWon ? r.lpWin : r.lpLoss;
  // Match streak multiplier with the one applied in the store
  const peakStreak = streaks.bestA;
  const streakMult =
    playerWon && peakStreak >= 5 ? 2.0 :
    playerWon && peakStreak >= 3 ? 1.5 :
    playerWon && peakStreak >= 2 ? 1.2 : 1.0;
  const dailyMult = playerWon && isDaily ? 1 + dailyBonus : 1.0;
  const xpMultiplier = streakMult * dailyMult;
  const xpDelta = Math.round(baseXp * xpMultiplier);
  const xpBonus = xpDelta - baseXp;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 220, damping: 18 }}
      className="bg-zinc-950/30 backdrop-blur-sm rounded-2xl sm:rounded-3xl shadow-xl ring-1 ring-white/10 p-5 sm:p-10 border border-white/10 flex flex-col items-center gap-5 text-center"
    >
      <motion.span
        initial={{ scale: 0, rotate: -45 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
        className="text-6xl"
      >
        🏆
      </motion.span>
      <h2 className="text-3xl font-extrabold bg-gradient-to-r from-violet-300 to-teal-300 bg-clip-text text-transparent">
        {t("match.win.title", { name: winnerLabel })}
      </h2>

      <div className="text-zinc-400 text-sm space-y-0.5">
        <p>{t("match.win.final", { a: match.scoreA, b: match.scoreB, bo: match.bestOf })}</p>
        {bestStreak >= 2 && (
          <p>{t("match.win.streak", { n: bestStreak, name: bestStreakHolder })}</p>
        )}
        {mood && (
          <p className="text-zinc-500">
            {t("match.win.moodLabel")}: {AI_MOOD_META[mood].emoji} {t("mood." + mood)}
          </p>
        )}
      </div>

      {(xpDelta !== 0 || lpDelta !== 0) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col items-center gap-2"
        >
          <div className="flex gap-2 text-sm">
            {xpDelta !== 0 && (
              <span className={
                "px-3 py-1 rounded-full font-semibold " +
                (xpDelta > 0 ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-500/20 text-zinc-400")
              }>
                {xpDelta > 0 ? "+" : ""}{xpDelta} XP
              </span>
            )}
            {lpDelta !== 0 && (
              <span className={
                "px-3 py-1 rounded-full font-semibold " +
                (lpDelta > 0 ? "bg-rose-500/20 text-rose-300" : "bg-rose-500/30 text-rose-200")
              }>
                {lpDelta > 0 ? "+" : ""}{lpDelta} LP
              </span>
            )}
          </div>
          {xpBonus > 0 && (
            <p className="text-[11px] text-amber-300 font-medium">
              {isDaily && playerWon && t("match.bonus.daily", { p: Math.round(dailyBonus * 100) }) + " "}
              {streakMult > 1 && (isDaily ? "· " : "") + t("match.bonus.streak", { x: streakMult.toFixed(1) }) + " "}
              · {t("match.bonus.breakdown", { a: baseXp, b: xpBonus })}
            </p>
          )}
        </motion.div>
      )}

      <div className="flex gap-3">
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          onClick={onAgain}
          className="px-5 py-3 rounded-2xl font-semibold bg-gradient-to-br from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400"
        >
          {t("match.playAgain")}
        </motion.button>
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          onClick={onQuit}
          className="px-5 py-3 rounded-2xl font-semibold bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30"
        >
          {t("match.back")}
        </motion.button>
      </div>
    </motion.div>
  );
}
