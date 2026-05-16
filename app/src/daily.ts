import type { AiMood } from "./game";

export interface DailyChallenge {
  date: string; // 'YYYY-MM-DD'
  mode: "casual" | "ranked";
  mood: AiMood;
  bestOf: number;
  xpBonus: number; // multiplicative bonus on win, e.g. 0.5 = +50%
}

export function todayDateKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateSeed(date: string): number {
  let h = 0;
  for (let i = 0; i < date.length; i++) {
    h = ((h << 5) - h + date.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function todayChallenge(date: string = todayDateKey()): DailyChallenge {
  const h = dateSeed(date);
  const modes: Array<"casual" | "ranked"> = ["casual", "ranked"];
  const moods: AiMood[] = ["random", "aggressive", "logical"];
  const bestOfs = [3, 5];
  return {
    date,
    mode: modes[h % modes.length],
    mood: moods[Math.floor(h / 7) % moods.length],
    bestOf: bestOfs[Math.floor(h / 31) % bestOfs.length],
    xpBonus: 0.5,
  };
}
