import { motion } from "motion/react";
import { MatchState, status, AiMood, AI_MOOD_META } from "../../../engine/game";
import { GameMode, REWARDS, classeLpDelta } from "../../../types";
import { eclatsReward } from "../../../engine/economy";
import { streakBonusXp, streakXpMultiplier } from "../../../match/streak";
import { useT } from "../../../i18n";
import { useStore } from "../../../store/store";
import { CinematicMatchEnd } from "../../../match/sharedMatchUI";
import { Streaks } from "./types";

export function EndPanel({
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
  // Streak bonus is owned by the store (recordMatch → streakBonusXp). Mirror
  // the same math here so the displayed total matches what was credited.
  // The store rolls the streak via nextStreak() then feeds it to
  // streakBonusXp(); after recordMatch winStreak holds the post-roll value.
  const currentStreak = useStore((s2) => s2.player.winStreak ?? 0);
  const streakMult = playerWon ? streakXpMultiplier(currentStreak) : 1.0;
  const dailyMult = playerWon && isDaily ? 1 + dailyBonus : 1.0;
  const xpAfterDaily = Math.round(baseXp * dailyMult);
  const streakBonus = playerWon ? streakBonusXp(xpAfterDaily, currentStreak) : 0;
  const xpDelta = xpAfterDaily + streakBonus;
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
