import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MAX_ATOUTS, type AtoutId } from "../../../ranked/atouts";
import {
  Move,
  RoundResult,
  MatchState,
  applyRound,
  newMatch,
  resolveRound,
  status,
  target,
  AiMood,
  aiMove,
  rollAiMood,
} from "../../../engine/game";
import { BattlePad } from "../../../BattlePad";
import { useStore } from "../../../store/store";
import {
  GameMode,
  MatchRecord,
  Opponent,
  Outcome,
  REWARDS,
} from "../../../types";
import { type DailyChallenge } from "../../../engine/daily";
import { useT } from "../../../i18n";
import { hapticTick } from "../../../match/sharedMatchUI";
import { Streaks } from "./types";
import { Header } from "./Header";
import { MatchFacts } from "./MatchFacts";
import { PickPanel } from "./PickPanel";
import { PassPanel } from "./PassPanel";
import { Countdown } from "./Countdown";
import { RevealPanel } from "./RevealPanel";
import { AtoutPicker } from "./AtoutPicker";
import { AtoutBar } from "./AtoutBar";
import { EndPanel } from "./EndPanel";

type Phase =
  | { kind: "atout-select" }
  | { kind: "p1-pick" }
  | { kind: "pass"; p1Move: Move }
  | { kind: "p2-pick"; p1Move: Move }
  | { kind: "countdown"; aMove: Move; bMove: Move }
  | { kind: "reveal"; round: RoundResult; matchOver: boolean; atoutNote?: string }
  | { kind: "match-end" };

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

    // Daily challenge bonus on win. The win-streak multiplier is NOT applied
    // here: the store rolls the streak in nextStreak() and adds streakBonusXp
    // on top of the xpDelta we send. Re-applying it here would double-count.
    const dailyMult = outcome === "win" && isDailyActive && daily ? (1 + daily.xpBonus) : 1.0;
    const xpDelta = Math.round(baseXp * dailyMult);

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
