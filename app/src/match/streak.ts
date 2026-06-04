/**
 * streak.ts — win-streak momentum (pure logic).
 *
 * Consecutive wins build a streak that grants escalating bonus XP, giving
 * a "don't stop now" hook. A loss resets it. Pure + side-effect-free so the
 * store can call it deterministically and it stays trivially testable.
 *
 * Thresholds (kept gentle so it rewards without trivialising progression):
 *   < 3  wins → ×1.0 (no bonus yet)
 *   3-4  wins → ×1.5
 *   5+   wins → ×2.0
 */

/** Roll the streak forward given the latest match outcome. */
export function nextStreak(prev: number, outcome: "win" | "loss" | "draw"): number {
  if (outcome === "win") return prev + 1;
  if (outcome === "loss") return 0;
  return prev; // a draw neither extends nor breaks the streak
}

/** XP multiplier earned at a given streak length. */
export function streakXpMultiplier(streak: number): number {
  if (streak >= 5) return 2.0;
  if (streak >= 3) return 1.5;
  return 1.0;
}

/** Bonus XP to ADD on top of a base win reward at this streak (0 when the
 *  multiplier is 1). Rounded to a whole number. */
export function streakBonusXp(baseXp: number, streak: number): number {
  if (baseXp <= 0) return 0;
  return Math.round(baseXp * (streakXpMultiplier(streak) - 1));
}

/** The streak length at which the next tier kicks in — used by the UI to
 *  tease "1 more win → ×2". Returns null at the top tier. */
export function nextStreakTier(streak: number): number | null {
  if (streak < 3) return 3;
  if (streak < 5) return 5;
  return null;
}
