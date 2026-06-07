import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ATOUTS, ATOUTS_BY_ID, MAX_ATOUTS, type AtoutId } from "../../ranked/atouts";
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
} from "../../engine/game";
import { Hand, MysteryHand, MoveGlyph, MOVE_PALETTE, moveRim, moveGlow } from "../../icons";
import { BattlePad } from "../../BattlePad";
import { useStore } from "../../store/store";
import {
  GameMode,
  MatchRecord,
  MODE_META,
  Opponent,
  Outcome,
  REWARDS,
  classeLpDelta,
} from "../../types";
import { type DailyChallenge } from "../../engine/daily";
import { eclatsReward } from "../../engine/economy";
import { useT } from "../../i18n";
import {
  CinematicMatchEnd,
  AmbientFlavor,
  MatchScoreBar,
  FloatingMatchBackButton,
  hapticTick,
  PickShock,
  useAndroidBackPrompt,
} from "../../match/sharedMatchUI";
import { QuitConfirmModal } from "../../match/QuitConfirmModal";
import { vibrate, hapticWin, hapticLoss, hapticTap } from "../../haptic";

/* ─────────── Game ─────────── */

type Phase =
  | { kind: "atout-select" }
  | { kind: "p1-pick" }
  | { kind: "pass"; p1Move: Move }
  | { kind: "p2-pick"; p1Move: Move }
  | { kind: "countdown"; aMove: Move; bMove: Move }
  | { kind: "reveal"; round: RoundResult; matchOver: boolean; atoutNote?: string }
  | { kind: "match-end" };

interface Streaks {
  a: number;
  b: number;
  bestA: number;
  bestB: number;
}

const PICK_TIMEOUT_MS = 8000;

export function Game({
  mode,
  bestOf,
  daily,
  questCtx,
  onQuit,
  onMatchResult,
  withAtouts,
}: {
  mode: GameMode;
  bestOf: number;
  daily?: DailyChallenge;
  questCtx?: { title: string; reward: number };
  onQuit: () => void;
  /** When set (tournament context), the end screen shows a "Suivant →" button
   *  that reports win/loss to the bracket instead of rematch/back. */
  onMatchResult?: (won: boolean) => void;
  /** Classé 1v1 — enable the pre-match Atout picker + in-match perks. */
  withAtouts?: boolean;
}) {
  const recordMatch = useStore((s) => s.recordMatch);
  const recordDailyComplete = useStore((s) => s.recordDailyComplete);
  const profileNickname = useStore((s) => s.player.nickname);
  const padId = useStore((s) => s.player.padId);
  const difficulty = useStore((s) => s.player.difficulty);
  const t = useT();

  const [match, setMatch] = useState<MatchState>(() => newMatch(bestOf));
  const [phase, setPhase] = useState<Phase>(() => withAtouts ? { kind: "atout-select" } : { kind: "p1-pick" });
  const [streaks, setStreaks] = useState<Streaks>({ a: 0, b: 0, bestA: 0, bestB: 0 });
  // Atouts (Classé 1v1): the 2 chosen perks, which are spent, and per-round state.
  const [chosenAtouts, setChosenAtouts] = useState<AtoutId[]>([]);
  const [usedAtouts, setUsedAtouts] = useState<AtoutId[]>([]);
  const [vabanqueArmed, setVabanqueArmed] = useState(false);
  const [lectureMove, setLectureMove] = useState<Move | null>(null);
  // Upcoming CPU move, decided at round start so Lecture reveals the REAL move.
  const cpuNextRef = useRef<Move | null>(null);
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

  // Freeze the CPU's upcoming move at the start of each pick so Lecture reveals
  // the move that will actually be played, and reset the per-round Atout state.
  useEffect(() => {
    if (phase.kind !== "p1-pick" || isHotseat) return;
    cpuNextRef.current = aiMove(mood, difficulty, match.history.map((r) => r.move_a));
    setLectureMove(null);
    setVabanqueArmed(false);
  }, [phase.kind, isHotseat, mood, difficulty, match.history]);

  const useLecture = () => {
    if (usedAtouts.includes("lecture") || isHotseat) return;
    if (!cpuNextRef.current) cpuNextRef.current = aiMove(mood, difficulty, match.history.map((r) => r.move_a));
    hapticTick();
    setLectureMove(cpuNextRef.current);
    setUsedAtouts((u) => [...u, "lecture"]);
  };
  const useVabanque = () => {
    if (usedAtouts.includes("vabanque")) return;
    hapticTick();
    setVabanqueArmed(true);
    setUsedAtouts((u) => [...u, "vabanque"]);
  };

  const onP1Pick = (m: Move) => {
    if (!isHotseat) {
      const bMove = cpuNextRef.current ?? aiMove(mood, difficulty, match.history.map((r) => r.move_a));
      setPhase({ kind: "countdown", aMove: m, bMove });
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
    let round = await resolveRound(phase.aMove, phase.bMove);
    let atoutNote: string | undefined;

    // 🔁 Contre — re-roll the opponent once on a lost round (keep your move).
    if (round.outcome.kind === "b_wins" && chosenAtouts.includes("contre") && !usedAtouts.includes("contre")) {
      const reroll = aiMove(mood, difficulty, match.history.map((r) => r.move_a));
      round = await resolveRound(phase.aMove, reroll);
      setUsedAtouts((u) => [...u, "contre"]);
      atoutNote = "🔁 Contre — nouveau tirage adverse";
    }
    // 🛡️ Garde — turn a still-lost round into a draw.
    if (round.outcome.kind === "b_wins" && chosenAtouts.includes("garde") && !usedAtouts.includes("garde")) {
      round = { ...round, outcome: { kind: "draw" } };
      setUsedAtouts((u) => [...u, "garde"]);
      atoutNote = "🛡️ Garde — défaite annulée";
    }

    let next = applyRound(match, round);
    // ⚡ Va-banque — the winner of this round scores an extra point.
    if (vabanqueArmed) {
      if (round.outcome.kind === "a_wins") next = { ...next, scoreA: next.scoreA + 1 };
      else if (round.outcome.kind === "b_wins") next = { ...next, scoreB: next.scoreB + 1 };
      if (round.outcome.kind !== "draw") atoutNote = "⚡ Va-banque — manche à 2 points";
      setVabanqueArmed(false);
    }
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
      atoutNote,
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

  // Pre-match Atout picker (Classé 1v1) — choose 2 perks before the first round.
  if (phase.kind === "atout-select") {
    return (
      <AtoutPicker
        chosen={chosenAtouts}
        onToggle={(id) =>
          setChosenAtouts((c) =>
            c.includes(id) ? c.filter((x) => x !== id) : c.length < MAX_ATOUTS ? [...c, id] : c,
          )
        }
        onConfirm={() => setPhase({ kind: "p1-pick" })}
        onBack={onQuit}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-3 sm:gap-4 flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
    >
      {/* Daily-challenge context — shows *why* this match was started (from a
          challenge) and the reward at stake, so the point is visible in-game. */}
      {questCtx && (
        <div className="shrink-0 flex items-center gap-2 rounded-xl px-3 py-1.5 bg-amber-500/15 border border-amber-400/40 text-amber-200 text-xs font-bold">
          <span>🎯</span>
          <span className="flex-1 min-w-0 truncate">{questCtx.title}</span>
          <span className="shrink-0 text-emerald-300">+{questCtx.reward} XP</span>
        </div>
      )}

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

      {/* Atout bar (Classé 1v1) — manual perks usable during your pick. */}
      {chosenAtouts.length > 0 && (
        <AtoutBar
          chosen={chosenAtouts}
          used={usedAtouts}
          canUse={phase.kind === "p1-pick"}
          vabanqueArmed={vabanqueArmed}
          lectureMove={lectureMove}
          onUseLecture={useLecture}
          onUseVabanque={useVabanque}
        />
      )}

      {/* Board: pad as canvas, takes ALL remaining vertical space */}
      <div className="relative flex-1 min-h-0 rounded-2xl sm:rounded-3xl overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          {/* compact = suppress the big animated centrepiece (orbiting
              electrons, etc.) so the pad reads as a CALM, stable backdrop
              behind the cards instead of churning during the match. */}
          <BattlePad padId={padId} className="w-full h-full opacity-90" compact />
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
            // Solo vs CPU = no countdown (no move played for you). Hotseat keeps
            // the pass-and-play timer.
            withTimer={isHotseat}
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
            atoutNote={phase.atoutNote}
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
            onMatchResult={onMatchResult}
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
    <div className="bg-surface border border-hairline rounded-xl sm:rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3 py-2 flex items-center justify-between gap-3 text-left hover:bg-hairline transition"
      >
        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-base">{MODE_META[mode].emoji}</span>
          <span className="font-semibold truncate">{t("mode." + mode)}</span>
          {mood && (
            <>
              <span className="text-zinc-600">·</span>
              <span className="text-xs text-ink-muted truncate">
                {AI_MOOD_META[mood].emoji} {t("mood." + mood)}
              </span>
            </>
          )}
        </div>
        <span className={"text-ink-faint text-xs transition " + (open ? "rotate-180" : "")}>▾</span>
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
              <div className="border-t border-hairline pt-3">
                <div className="text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1">
                  {t("mode." + mode)}
                </div>
                <p className="text-ink-muted leading-relaxed">{t("mode." + mode + ".tag")}</p>
                {r.xpWin > 0 && (
                  <p className="text-[11px] text-ink-muted mt-1.5">
                    {t("play.win.xp", { n: r.xpWin })}
                    {r.lpWin > 0 && ` · ${t("play.win.lp", { n: r.lpWin })}`}
                    {r.lpLoss < 0 && ` · ${t("play.loss.lp", { n: r.lpLoss })}`}
                  </p>
                )}
              </div>
              {/* Mood info */}
              {mood && (
                <div className="border-t border-hairline pt-3">
                  <div className="text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1">
                    {AI_MOOD_META[mood].emoji} {t("mood." + mood)}
                  </div>
                  <p className="text-ink-muted leading-relaxed">{t("mood." + mood + ".desc")}</p>
                </div>
              )}
              {/* Difficulty info */}
              <div className="border-t border-hairline pt-3">
                <div className="text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1">
                  {t("profile.diff.title")} · {t("diff." + difficulty)}
                </div>
                <p className="text-ink-muted leading-relaxed">{t("diff." + difficulty + ".desc")}</p>
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
  mode, labelA, labelB, scoreA, scoreB, target,
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
  // Classé is competitive — always confirm a quit (even at 0-0) so a stray tap
  // can't silently forfeit. Casual/training only confirm once a match is live.
  const ranked = mode === "ranked";

  const handleQuitClick = () => {
    if (isMidMatch || ranked) setConfirmQuit(true);
    else onQuit();
  };

  // Android system back routes to the same confirm flow so a stray
  // back-press mid-match can't silently abandon the game.
  useAndroidBackPrompt(handleQuitClick);

  // Same caption shape as the Constellation ScoreHeader, classic wording.
  const round = scoreA + scoreB + 1;
  const caption = t("match.scoreCaption", { round, target });

  return (
    <>
      {/* Quit button docks next to the burger so the score bar can take the
          full row width on its own line. */}
      <FloatingMatchBackButton onClick={handleQuitClick} label={t("match.quit")} />

      {/* Unified score bar — identical component used by Constellation. */}
      <MatchScoreBar
        youName={labelA}
        oppName={labelB}
        youScore={scoreA}
        oppScore={scoreB}
        youTag={t("lanes.you")}
        oppTag={t("lanes.opponent")}
        youStreak={streakA}
        oppStreak={streakB}
        caption={caption}
      />

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
        "relative bg-surface backdrop-blur-sm rounded-2xl sm:rounded-3xl shadow-xl ring-1 px-3 py-3 sm:p-12 border flex flex-col items-center gap-2 sm:gap-6 w-full transition-colors " +
        (urgent
          ? "ring-rose-500/50 border-rose-500/40"
          : "ring-white/10 border-hairline")
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
        <p className="text-ink-muted text-xs sm:text-base mt-1">{subtitle}</p>
      </div>

      {recentOppMoves && recentOppMoves.length > 0 && (
        <div className="flex items-center gap-2 bg-surface border border-hairline rounded-xl px-3 py-1.5">
          <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-ink-muted font-medium">
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
          <div className="flex items-center justify-between text-[10px] sm:text-xs text-ink-muted mb-1">
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
          <div className="h-1.5 sm:h-2 rounded-full bg-hairline overflow-hidden">
            <motion.div
              className={
                "h-full rounded-full " +
                (urgent ? "bg-rose-400" : "bg-themed")
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

      {/* 5 hands in one clean, proportional row — same compact picker model
          as the Lanes / Ranked modes (was big 'lg' cards in a 3+2 grid, which
          felt oversized and crowded on phones). */}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-3 w-full max-w-md">
        {MOVES.map((m, i) => (
          <PickHandButton
            key={m}
            move={m}
            label={t("element." + m)}
            index={i}
            disabled={locked}
            onPick={handlePick}
          />
        ))}
      </div>

      {/* Atmosphere — same rotating geek one-liners as in Constellation,
          so every mode breathes with the same vibe. Hidden on mobile so the
          panel stays short enough to fit the board without clipping the title. */}
      <div className="mt-1 hidden sm:block">
        <AmbientFlavor />
      </div>
    </motion.div>
  );
}

/* ─────────── PickHandButton — one of the 5 RPSLS hand buttons with VFX ─────────── */

function PickHandButton({
  move, label, index, disabled, onPick,
}: {
  move: Move;
  label: string;
  index: number;
  disabled: boolean;
  onPick: (m: Move) => void;
}) {
  const [shock, setShock] = useState(false);
  const pal = MOVE_PALETTE[move];

  function handleClick() {
    if (disabled) return;
    hapticTick();
    setShock(true);
    // Auto-clear so the same button can be re-armed if the parent doesn't
    // unmount (rare here, but keeps the component resilient).
    setTimeout(() => setShock(false), 500);
    onPick(move);
  }

  return (
    <motion.button
      onClick={handleClick}
      disabled={disabled}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 * index, duration: 0.25 }}
      whileHover={{ y: -4, scale: 1.04 }}
      whileTap={{ scale: 0.86 }}
      aria-label={label}
      className="relative aspect-[4/5] rounded-xl flex flex-col items-center justify-center gap-0.5 py-1 text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
      // Dark glass + theme-blended rim — identical treatment to the Lanes /
      // Ranked pickers so every mode's move buttons look consistent and adapt
      // to the active background accent.
      style={{
        background: "linear-gradient(160deg, rgba(20,22,32,0.92) 0%, rgba(10,12,20,0.92) 100%)",
        border: `2px solid ${moveRim(pal.hex)}`,
        boxShadow: `0 0 12px -2px ${moveGlow(pal.hex)}, inset 0 1px 0 rgba(255,255,255,0.08)`,
      }}
    >
      <PickShock show={shock} />
      <MoveGlyph move={move} className="w-9 h-9 sm:w-11 sm:h-11" />
      <span
        className="text-[10px] sm:text-[11px] uppercase tracking-wider font-bold leading-none"
        style={{ color: moveRim(pal.hex) }}
      >
        {label}
      </span>
    </motion.button>
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
      className="bg-surface backdrop-blur-sm rounded-2xl sm:rounded-3xl shadow-xl ring-1 ring-white/10 p-5 sm:p-10 border border-hairline flex flex-col items-center gap-6 text-center"
    >
      <motion.span
        animate={{ rotate: [0, -10, 10, -10, 0] }}
        transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1 }}
        className="text-5xl"
      >
        📱
      </motion.span>
      <h2 className="text-xl font-semibold">{t("match.pass.title", { name: labelB })}</h2>
      <p className="text-ink-muted text-sm max-w-sm">{t("match.pass.subtitle")}</p>
      <motion.button
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.97 }}
        onClick={onContinue}
        className="px-6 py-3 rounded-2xl font-semibold bg-themed shadow-lg shadow-black/30"
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
    // Tiny buzz on every beat (Rock, Paper, Scissors, Lizard, Spock…) so
    // the player physically feels the rhythm. The final beat is the
    // SHOOT moment — give it a slightly stronger pulse.
    if (beat < COUNTDOWN_IDS.length) {
      vibrate(beat === COUNTDOWN_IDS.length - 1 ? 28 : 12);
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
      className="bg-surface-raised rounded-2xl sm:rounded-3xl shadow-xl ring-1 ring-white/10 p-4 sm:p-6 border border-hairline flex flex-col items-center gap-6"
    >
      <div className="grid grid-cols-3 items-center w-full">
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-ink-muted">{labelA}</span>
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
          <span className="text-xs uppercase tracking-wider text-ink-muted">{labelB}</span>
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
  round, labelA, labelB, streakA, streakB, matchOver, atoutNote, onNext,
}: {
  round: RoundResult;
  labelA: string; labelB: string;
  streakA: number; streakB: number;
  matchOver: boolean; atoutNote?: string; onNext: () => void;
}) {
  const t = useT();
  const { move_a, move_b, outcome } = round;
  const aWon = outcome.kind === "a_wins";
  const bWon = outcome.kind === "b_wins";
  const draw = outcome.kind === "draw";

  // Buzz once when the result lands. The reveal animation timing is ~0.6 s
  // after mount so we delay the haptic to land with the verb appearing.
  useEffect(() => {
    const id = setTimeout(() => {
      if (aWon) hapticWin();
      else if (bWon) hapticLoss();
      else hapticTap();
    }, 280);
    return () => clearTimeout(id);
    // Effect must re-run if a different round is shown — keyed on outcome.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

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
      className="relative bg-surface-raised rounded-2xl sm:rounded-3xl shadow-xl ring-1 ring-white/10 px-3 py-5 sm:p-12 border border-hairline flex flex-col items-center gap-6 sm:gap-8 max-w-full"
    >
      {/* Winner flash — a radial-gradient glow (NO blur filter). The old
          w-96 h-96 blur-3xl recomposited a huge blurred area every frame over
          the live WebGL backdrop → the reveal stutter/lag. A soft-edged radial
          gradient reads the same but is nearly free. */}
      {!draw && (
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: [0, 0.55, 0], scale: [0.7, 1.5, 2] }}
          transition={{ duration: 0.55, delay: 0.06, ease: "easeOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${flashColor} 0%, transparent 66%)`, willChange: "transform, opacity" }}
        />
      )}

      <div className="relative grid grid-cols-[1fr_auto_1fr] items-center w-full gap-4 sm:gap-8">
        <RevealHand label={labelA} move={move_a} winner={aWon} loser={bWon} side="left" streak={streakA} />

        <div className="relative h-32 sm:h-40 flex items-center justify-center px-2 sm:px-4">
          <motion.div
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.08, type: "spring", stiffness: 380, damping: 16 }}
            className="flex flex-col items-center"
          >
            <span className="text-ink-muted uppercase tracking-[0.4em] text-sm sm:text-base font-bold">
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
        transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 18 }}
        className="text-center min-h-[3rem] relative"
      >
        {draw && <p className="text-3xl font-bold text-ink-muted">{t("match.draw")}</p>}
        {!draw && verb && (
          <p className="text-xl sm:text-3xl font-bold">
            <span className={aWon ? "text-violet-300" : "text-teal-300"}>
              {t("element." + (aWon ? move_a : move_b))}
            </span>{" "}
            <span className="text-ink-muted font-normal italic">{verb}</span>{" "}
            <span className="text-ink">
              {t("element." + (aWon ? move_b : move_a))}
            </span>
          </p>
        )}
      </motion.div>

      {atoutNote && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.42 }}
          className="-mt-3 text-sm font-bold text-amber-300 text-center"
        >
          {atoutNote}
        </motion.div>
      )}

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.97 }}
        onClick={onNext}
        className="mt-2 px-7 py-3.5 rounded-2xl font-semibold text-base bg-hairline hover:bg-white/20 border border-hairline hover:border-white/30 transition relative z-10"
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
  // Winner: subtle nod toward the middle (never outward). Loser: stays put.
  const swing = winner ? (side === "left" ? 4 : -4) : 0;
  const rotateKick = winner ? (side === "left" ? 3 : -3) : 0;

  return (
    <div className="flex flex-col items-center gap-2 sm:gap-3 min-w-0">
      <span className="text-xs sm:text-sm uppercase tracking-wider text-ink-muted font-semibold truncate max-w-full">{label}</span>
      <motion.div
        initial={{ scale: 0.4, rotate: -15, opacity: 0, x: 0 }}
        animate={{
          // Capped peak so the winning card never bleeds past the frame.
          scale: winner ? [0.4, 1.06, 1.02] : loser ? [0.4, 1, 0.97] : 1,
          rotate: [(side === "left" ? -15 : 15), 0, rotateKick, 0],
          x: [0, 0, swing, swing * 0.4],
          opacity: 1,
        }}
        transition={{ duration: 0.5, times: [0, 0.45, 0.62, 1], ease: "easeOut" }}
        className={
          "relative " +
          (winner && streak >= 3
            ? "after:absolute after:inset-0 after:rounded-3xl after:ring-4 after:ring-orange-400/50 after:animate-pulse"
            : "")
        }
      >
        {/* Down-sized from "xl" → "lg": two xl cards + VS overflowed the
            viewport on phones (the winner card bled off-screen). "lg"
            matches the contained feel of the Constellation reveal. */}
        <Hand move={move} size="lg" emphasis={winner ? "winner" : loser ? "loser" : "default"} />
      </motion.div>
      <span className="text-sm sm:text-lg text-ink font-medium truncate max-w-full">{t("element." + move)}</span>
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
          delay: 0.1 + Math.random() * 0.08,
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

/* ─────────── Atouts (Classé 1v1) ─────────── */

function AtoutPicker({
  chosen, onToggle, onConfirm, onBack,
}: {
  chosen: AtoutId[];
  onToggle: (id: AtoutId) => void;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const ready = chosen.length === MAX_ATOUTS;
  const remaining = MAX_ATOUTS - chosen.length;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-4 flex-1 py-2 px-1 max-w-lg mx-auto w-full overflow-y-auto"
    >
      <FloatingMatchBackButton onClick={onBack} label="Retour" />
      <div className="text-center mt-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-themed leading-tight" style={{ fontFamily: "var(--font-headline)" }}>
          Choisis tes Atouts
        </h1>
        <p className="text-[11px] text-ink-muted mt-1">2 atouts · chacun utilisable une fois dans le match</p>
      </div>
      <div className="flex flex-col gap-2">
        {ATOUTS.map((a) => {
          const on = chosen.includes(a.id);
          const full = chosen.length >= MAX_ATOUTS && !on;
          return (
            <motion.button
              key={a.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => { hapticTick(); onToggle(a.id); }}
              disabled={full}
              className={"text-left rounded-2xl p-3 flex items-center gap-3 transition " + (full ? "opacity-40 pointer-events-none" : "")}
              style={{
                background: on
                  ? "linear-gradient(150deg, color-mix(in oklab, var(--theme-primary) 30%, transparent), color-mix(in oklab, var(--theme-secondary) 22%, transparent))"
                  : "rgba(255,255,255,0.04)",
                border: on
                  ? "1px solid color-mix(in oklab, var(--theme-primary) 65%, transparent)"
                  : "1px solid rgba(255,255,255,0.10)",
              }}
            >
              <span className="text-2xl shrink-0">{a.glyph}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm">{a.label}</span>
                  <span className="text-[9px] uppercase tracking-wider px-1 rounded-full bg-hairline text-ink-muted">
                    {a.kind === "manual" ? "manuel" : "auto"}
                  </span>
                </div>
                <div className="text-[11px] text-ink-muted leading-snug">{a.desc}</div>
              </div>
              <span className={"shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-xs " +
                (on ? "bg-emerald-400 border-emerald-400 text-zinc-900" : "border-white/30 text-transparent")}>✓</span>
            </motion.button>
          );
        })}
      </div>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => { hapticTick(); onConfirm(); }}
        disabled={!ready}
        className="mt-1 w-full px-7 py-3.5 rounded-2xl font-bold text-white bg-themed shadow-lg shadow-themed transition hover:scale-[1.01] disabled:opacity-40 disabled:pointer-events-none"
        style={{ fontFamily: "var(--font-headline)", letterSpacing: "0.04em" }}
      >
        {ready ? "Commencer →" : `Choisis encore ${remaining} atout${remaining > 1 ? "s" : ""}`}
      </motion.button>
    </motion.div>
  );
}

function AtoutBar({
  chosen, used, canUse, vabanqueArmed, lectureMove,
  onUseLecture, onUseVabanque,
}: {
  chosen: AtoutId[];
  used: AtoutId[];
  canUse: boolean;
  vabanqueArmed: boolean;
  lectureMove: Move | null;
  onUseLecture: () => void;
  onUseVabanque: () => void;
}) {
  const t = useT();
  return (
    <div className="shrink-0 flex flex-col gap-1">
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {chosen.map((id) => {
          const a = ATOUTS_BY_ID[id];
          const isUsed = used.includes(id);
          const manual = a.kind === "manual";
          const active = manual && !isUsed && canUse;
          const onClick = id === "lecture" ? onUseLecture : id === "vabanque" ? onUseVabanque : undefined;
          return (
            <button
              key={id}
              onClick={active ? onClick : undefined}
              disabled={!active}
              className={"flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition " +
                (isUsed ? "opacity-35 line-through border-hairline bg-hairline text-ink-muted"
                 : active ? "border-amber-400/60 bg-amber-400/15 text-amber-200 hover:bg-amber-400/25"
                 : "border-hairline bg-hairline text-ink-muted")}
            >
              <span>{a.glyph}</span>
              <span>{a.label}</span>
              {!manual && !isUsed && <span className="text-[8px] uppercase tracking-wider opacity-60">auto</span>}
            </button>
          );
        })}
      </div>
      {lectureMove && (
        <div className="text-center text-[11px] text-amber-300 font-bold">
          🔮 L'adversaire va jouer : {t("element." + lectureMove)}
        </div>
      )}
      {vabanqueArmed && (
        <div className="text-center text-[11px] text-amber-300 font-bold">⚡ Va-banque armé — manche à 2 points</div>
      )}
    </div>
  );
}

/* ─────────── End ─────────── */

function EndPanel({
  labelA, labelB, match, streaks, mood, mode, isDaily, dailyBonus, onAgain, onQuit, onMatchResult,
}: {
  labelA: string; labelB: string; match: MatchState;
  streaks: Streaks; mood: AiMood | null; mode: GameMode;
  isDaily: boolean; dailyBonus: number;
  onAgain: () => void; onQuit: () => void;
  onMatchResult?: (won: boolean) => void;
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

  // Map status to outcome from the player's perspective (player is always A).
  const outcome: "win" | "loss" | "draw" =
    s === "a_won" ? "win" : s === "b_won" ? "loss" : "draw";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 220, damping: 18 }}
      className="bg-surface-raised rounded-2xl sm:rounded-3xl shadow-xl ring-1 ring-white/10 p-3 sm:p-8 border border-hairline flex flex-col items-center text-center"
    >
      {/* Cinematic match-end shared with Constellation Lanes — same trophy
          breath / wordmark pulse / quote / rematch buttons feel everywhere. */}
      <CinematicMatchEnd
        outcome={outcome}
        scoreLine={`${match.scoreA} — ${match.scoreB}`}
        youScore={match.scoreA}
        oppScore={match.scoreB}
        bestOf={match.bestOf}
        onRematch={onMatchResult ? undefined : onAgain}
        onBack={onMatchResult ? () => onMatchResult(outcome === "win") : onQuit}
        rematchLabel={t("match.playAgain")}
        backLabel={onMatchResult ? "Suivant →" : t("match.back")}
        reward={{
          xp: xpDelta > 0 ? xpDelta : undefined,
          // Classé shows its OWN ladder swing (classeLp) as the "LP" line so
          // the player sees their rank move; other modes keep their REWARDS lp
          // (online-only, so 0 for vs-CPU casual/hotseat).
          lp: mode === "ranked" ? classeLpDelta(outcome) : (lpDelta !== 0 ? lpDelta : undefined),
          eclats: eclatsReward(mode, outcome),
        }}
      />

      {/* Local single-player extras — compacted to one wrap line so the
          card stays in one viewport without scroll on typical phones. */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[11px] text-ink-faint">
        <span className="text-ink-muted font-semibold">
          {t("match.win.title", { name: winnerLabel })}
        </span>
        <span className="opacity-50">·</span>
        <span>{t("match.win.final", { a: match.scoreA, b: match.scoreB, bo: match.bestOf })}</span>
        {bestStreak >= 2 && (
          <>
            <span className="opacity-50">·</span>
            <span>🔥 {bestStreak} ({bestStreakHolder})</span>
          </>
        )}
        {mood && (
          <>
            <span className="opacity-50">·</span>
            <span>{AI_MOOD_META[mood].emoji} {t("mood." + mood)}</span>
          </>
        )}
      </div>

      {(xpDelta !== 0 || lpDelta !== 0) && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.7 }}
          className="flex flex-col items-center gap-1 mt-2"
        >
          <div className="flex gap-2 text-xs">
            {xpDelta !== 0 && (
              <span className={
                "px-2.5 py-0.5 rounded-full font-semibold " +
                (xpDelta > 0 ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-500/20 text-ink-muted")
              }>
                {xpDelta > 0 ? "+" : ""}{xpDelta} XP
              </span>
            )}
            {lpDelta !== 0 && (
              <span className={
                "px-2.5 py-0.5 rounded-full font-semibold " +
                (lpDelta > 0 ? "bg-rose-500/20 text-rose-300" : "bg-rose-500/30 text-rose-200")
              }>
                {lpDelta > 0 ? "+" : ""}{lpDelta} LP
              </span>
            )}
          </div>
          {xpBonus > 0 && (
            <p className="text-[10px] text-amber-300 font-medium px-2 leading-tight">
              {isDaily && playerWon && t("match.bonus.daily", { p: Math.round(dailyBonus * 100) }) + " "}
              {streakMult > 1 && (isDaily ? "· " : "") + t("match.bonus.streak", { x: streakMult.toFixed(1) }) + " "}
              · {t("match.bonus.breakdown", { a: baseXp, b: xpBonus })}
            </p>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
