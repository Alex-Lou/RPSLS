/** XP required to go from level N → N+1.
 *  Softened from the old `100 + level*150` (which made L5 ~2,250 cumulative
 *  XP ≈ 75 ranked wins — a grind wall). `80 + level*90` keeps early levels
 *  quick and dopamine-rich while still ramping: L0→1:80, L1→2:170, L2→3:260…
 *  L0→5 cumulative ≈ 1,150 XP (~halved), so progression feels rewarding
 *  without trivialising higher levels. */
export function xpForNextLevel(level: number): number {
  return 80 + level * 90;
}

export interface LevelInfo {
  level: number;
  xpInLevel: number;
  xpForNext: number;
  progress: number; // 0..1
}

export function levelFromXp(xp: number): LevelInfo {
  let level = 0;
  let remaining = xp;
  while (remaining >= xpForNextLevel(level)) {
    remaining -= xpForNextLevel(level);
    level++;
  }
  const xpForNext = xpForNextLevel(level);
  return {
    level,
    xpInLevel: remaining,
    xpForNext,
    progress: xpForNext === 0 ? 0 : remaining / xpForNext,
  };
}
