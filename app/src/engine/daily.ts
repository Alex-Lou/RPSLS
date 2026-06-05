import type { AiMood } from "./game";
import type { GameMode, MatchRecord, Player } from "../types";

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

/* ───────────────────────── Daily challenges (TODO #17) ─────────────────────────
   A pool of objectives — some doable offline (vs CPU), some that require a live
   online opponent. Three are drawn deterministically per day; progress is read
   from the matches recorded *today* (local midnight → now), so a challenge ticks
   up just by playing normally, then the reward is claimed manually.
   ──────────────────────────────────────────────────────────────────────────── */

export type DailyScope = "offline" | "online";

/** Where the "Play" button on a challenge sends the player. */
export type DailyRoute =
  | { kind: "mode"; mode: GameMode; bestOf: number }
  | { kind: "constellation" }
  | { kind: "online" };

export interface DailyQuestDef {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  target: number;
  xpReward: number;
  scope: DailyScope;
  route: DailyRoute;
  /** Progress today (uncapped), from today's matches + the player. */
  progress: (today: MatchRecord[], p: Player) => number;
}

function startOfDayMs(now: Date = new Date()): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/** Matches recorded since local midnight — the window every daily challenge reads. */
export function matchesToday(history: MatchRecord[], now: Date = new Date()): MatchRecord[] {
  const since = startOfDayMs(now);
  return history.filter((m) => m.timestamp >= since);
}

// A real online match always has a human opponent — that distinguishes online
// Constellation from the local vs-CPU one (both recorded as mode "constellation").
const isOnlineMatch = (m: MatchRecord) => m.opponent.kind === "human";

const DAILY_POOL: DailyQuestDef[] = [
  // ── Offline — always doable vs CPU ──
  { id: "casual-win-2", emoji: "🎮", title: "Casual streak", desc: "Win 2 Casual matches.",
    target: 2, xpReward: 100, scope: "offline", route: { kind: "mode", mode: "casual", bestOf: 3 },
    progress: (t) => t.filter((m) => m.mode === "casual" && m.outcome === "win").length },
  { id: "ranked-win-1", emoji: "🏆", title: "Climber", desc: "Win a Ranked match.",
    target: 1, xpReward: 90, scope: "offline", route: { kind: "mode", mode: "ranked", bestOf: 3 },
    progress: (t) => t.filter((m) => m.mode === "ranked" && m.outcome === "win").length },
  { id: "play-3", emoji: "🔥", title: "Warming up", desc: "Play 3 matches today.",
    target: 3, xpReward: 80, scope: "offline", route: { kind: "mode", mode: "casual", bestOf: 3 },
    progress: (t) => t.length },
  { id: "win-3", emoji: "⚔️", title: "On a roll", desc: "Win 3 matches today.",
    target: 3, xpReward: 130, scope: "offline", route: { kind: "mode", mode: "casual", bestOf: 3 },
    progress: (t) => t.filter((m) => m.outcome === "win").length },
  { id: "hotseat-1", emoji: "👥", title: "Pass the phone", desc: "Play a Hot-seat match.",
    target: 1, xpReward: 70, scope: "offline", route: { kind: "mode", mode: "hotseat", bestOf: 3 },
    progress: (t) => t.filter((m) => m.mode === "hotseat").length },
  { id: "training-2", emoji: "🤖", title: "Drills", desc: "Play 2 Training matches.",
    target: 2, xpReward: 60, scope: "offline", route: { kind: "mode", mode: "training", bestOf: 3 },
    progress: (t) => t.filter((m) => m.mode === "training").length },
  { id: "constellation-2", emoji: "🌌", title: "Stargazer", desc: "Play 2 Constellation matches vs CPU.",
    target: 2, xpReward: 90, scope: "offline", route: { kind: "constellation" },
    progress: (t) => t.filter((m) => m.mode === "constellation" && m.opponent.kind === "cpu").length },
  // ── Online — need a live opponent (recorded into history at match end) ──
  { id: "online-play-1", emoji: "🌐", title: "Go live", desc: "Play an online match.",
    target: 1, xpReward: 120, scope: "online", route: { kind: "online" },
    progress: (t) => t.filter(isOnlineMatch).length },
  { id: "online-win-1", emoji: "🥊", title: "Real fight", desc: "Beat a real player online.",
    target: 1, xpReward: 170, scope: "online", route: { kind: "online" },
    progress: (t) => t.filter((m) => isOnlineMatch(m) && m.outcome === "win").length },
  { id: "online-constellation-1", emoji: "🌌", title: "Star duel", desc: "Play an online Constellation match.",
    target: 1, xpReward: 150, scope: "online", route: { kind: "online" },
    progress: (t) => t.filter((m) => m.mode === "constellation" && m.opponent.kind === "human").length },
];

/** Deterministic 3-challenge pick for the day: 2 offline + 1 online, seeded by
 *  date so it's stable all day and rotates at midnight. */
export function todayDailyQuests(date: string = todayDateKey()): DailyQuestDef[] {
  const seed = dateSeed(date);
  const offline = DAILY_POOL.filter((q) => q.scope === "offline");
  const online = DAILY_POOL.filter((q) => q.scope === "online");
  const pick = <T>(arr: T[], n: number, salt: number): T[] => {
    const start = arr.length ? (seed + salt) % arr.length : 0;
    const out: T[] = [];
    for (let i = 0; i < n && i < arr.length; i++) out.push(arr[(start + i) % arr.length]);
    return out;
  };
  return [...pick(offline, 2, 0), ...pick(online, 1, 5)];
}
