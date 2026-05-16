/** XP required to go from level N → N+1. */
export function xpForNextLevel(level: number): number {
  return 100 + level * 150; // L0→1: 100, L1→2: 250, L2→3: 400…
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
