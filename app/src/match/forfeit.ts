/**
 * forfeit.ts — abandon tracking + escalating penalty (pure logic).
 *
 * Quitting a match mid-way is always a forfeit (counts as a loss). On
 * competitive surfaces (ranked / online) a REPEAT abandoner inside a rolling
 * window also eats an extra LP penalty, so rage-quitting has a real cost
 * without nuking a one-off disconnect.
 *
 * Pure + side-effect-free: the store passes `now` in so this stays testable
 * and resume-safe. UI reads `abandonPenaltyLp(prevCount)` to warn the player
 * BEFORE they confirm.
 */

export interface AbandonRecord {
  /** Forfeits inside the active window. */
  count: number;
  /** Epoch ms of the most recent forfeit. */
  lastAt: number;
}

/** Rolling window after which the abandon counter resets. */
export const ABANDON_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

/** Extra LP removed (on top of the normal ranked loss) for a forfeit, given
 *  how many forfeits the player ALREADY has in the window.
 *   0 prior → 0 (first abandon is "free" beyond the normal loss)
 *   1 prior → -10
 *   2+ prior → -25 (capped) */
export function abandonPenaltyLp(priorCount: number): number {
  if (priorCount <= 0) return 0;
  if (priorCount === 1) return -10;
  return -25;
}

/** Roll the abandon record forward for a new forfeit at `now`. Resets the
 *  counter when the previous one has aged out of the window. */
export function nextAbandon(prev: AbandonRecord | undefined, now: number): AbandonRecord {
  if (!prev || now - prev.lastAt > ABANDON_WINDOW_MS) {
    return { count: 1, lastAt: now };
  }
  return { count: prev.count + 1, lastAt: now };
}

/** How many forfeits are still "active" in the window as of `now` — used to
 *  preview the next penalty in the confirm modal. */
export function activeAbandonCount(rec: AbandonRecord | undefined, now: number): number {
  if (!rec) return 0;
  return now - rec.lastAt > ABANDON_WINDOW_MS ? 0 : rec.count;
}
