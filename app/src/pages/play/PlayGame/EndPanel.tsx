import { MatchState, status, AiMood, AI_MOOD_META } from "../../../engine/game";
import { GameMode, REWARDS, classeLpDelta } from "../../../types";
import { eclatsReward, scaleByLength } from "../../../engine/economy";
import { streakBonusXp, streakXpMultiplier } from "../../../match/streak";
import { useT } from "../../../i18n";
import { useStore } from "../../../store/store";
import { MatchEndScreen, useEndPhrase } from "../../../match/matchEnd";
import { Streaks } from "./types";

/**
 * Fin de match des modes classiques (Entraînement / Normal / Classé / hotseat)
 * — adaptateur vers l'écran de fin COMMUN (MatchEndScreen). Les gains sont
 * calculés exactement comme avant (miroir de recordMatch) ; seule la mise en
 * scène est partagée.
 */
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
  // Même multiplicateur de longueur que recordMatch (Bo1 ×0,4 … Bo7 ×1,8).
  const baseXp = scaleByLength(playerWon ? r.xpWin : r.xpLoss, mode, match.bestOf);
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
  const phrase = useEndPhrase({ youScore: match.scoreA, oppScore: match.scoreB, bestOf: match.bestOf });

  // Détail des multiplicateurs (défi du jour, série) sous les compteurs.
  const xpNote = xpBonus > 0
    ? [
        isDaily && playerWon ? t("match.bonus.daily", { p: Math.round(dailyBonus * 100) }) : null,
        streakMult > 1 ? t("match.bonus.streak", { x: streakMult.toFixed(1) }) : null,
        t("match.bonus.breakdown", { a: baseXp, b: xpBonus }),
      ].filter(Boolean).join(" · ")
    : undefined;

  // Classé shows its OWN ladder swing (classeLp) as the "LP" line so the player
  // sees their rank move; other modes keep their REWARDS lp (0 vs CPU).
  const lp = mode === "ranked" ? classeLpDelta(outcome) : (lpDelta !== 0 ? lpDelta : undefined);

  return (
    <MatchEndScreen
      outcome={outcome}
      subtitle={phrase}
      score={{
        you: match.scoreA, opp: match.scoreB,
        youName: labelA,
        oppName: labelB,
        caption: t("end.bestOf", { bo: match.bestOf }),
      }}
      rewards={{
        xp: xpDelta > 0 ? xpDelta : undefined,
        xpNote,
        lp,
        eclats: eclatsReward(mode, outcome, match.bestOf),
      }}
      lpLadder={mode === "ranked" ? "classeLp" : undefined}
      extra={
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[11px] text-ink-faint">
          {/* Hotseat : le titre est vu du joueur 1 → on nomme le vainqueur. */}
          {mode === "hotseat" && (
            <span className="text-ink-muted font-semibold">{t("match.win.title", { name: winnerLabel })}</span>
          )}
          {bestStreak >= 2 && <span>{t("match.win.streak", { n: bestStreak, name: bestStreakHolder })}</span>}
          {mood && <span>{AI_MOOD_META[mood].emoji} {t("mood." + mood)}</span>}
        </div>
      }
      // Tournoi : un seul bouton « Suivant » qui remonte le résultat au bracket.
      primary={onMatchResult
        ? { label: t("end.next"), onClick: () => onMatchResult(outcome === "win") }
        : { label: t("end.playAgain"), onClick: onAgain }}
      secondary={onMatchResult ? undefined : { label: t("end.back"), onClick: onQuit }}
    />
  );
}
