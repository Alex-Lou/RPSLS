import type { Move, AiMood } from "./game";
import type { GameMode, MatchRecord, Player } from "./types";
import { levelFromXp } from "./leveling";

export interface QuestDef {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  target: number;
  xpReward: number;
  lpReward?: number;
  /** Returns current progress (capped at target by the consumer). */
  progress: (p: Player, h: MatchRecord[]) => number;
}

const ALL_MOVES: Move[] = ["rock", "paper", "scissors", "lizard", "spock"];

function maxConsecWinsInOneMatch(h: MatchRecord[]): number {
  let best = 0;
  for (const m of h) {
    let cur = 0;
    for (const r of m.rounds) {
      if (r.result === "win") {
        cur++;
        if (cur > best) best = cur;
      } else {
        cur = 0;
      }
    }
  }
  return best;
}

function maxSameMoveInOneMatch(h: MatchRecord[]): number {
  let best = 0;
  for (const m of h) {
    let cur = 0;
    let last: Move | null = null;
    for (const r of m.rounds) {
      if (r.playerMove === last) {
        cur++;
      } else {
        cur = 1;
        last = r.playerMove;
      }
      if (cur > best) best = cur;
    }
  }
  return best;
}

function hasUsedAll5InAnyMatch(h: MatchRecord[]): boolean {
  for (const m of h) {
    if (m.bestOf >= 5) {
      const set = new Set<Move>(m.rounds.map((r) => r.playerMove));
      if (set.size === 5) return true;
    }
  }
  return false;
}

function winsAgainstMood(h: MatchRecord[], mood: AiMood): number {
  return h.filter(
    (m) =>
      m.opponent.kind === "cpu" &&
      m.opponent.mood === mood &&
      m.outcome === "win"
  ).length;
}

function matchesInMode(h: MatchRecord[], mode: GameMode): number {
  return h.filter((m) => m.mode === mode).length;
}

export const QUESTS: QuestDef[] = [
  {
    id: "first-win",
    emoji: "🎯",
    title: "First blood",
    desc: "Win your first match.",
    target: 1,
    xpReward: 50,
    progress: (p) => Math.min(p.stats.wins, 1),
  },
  {
    id: "hat-trick",
    emoji: "🔥",
    title: "Hat trick",
    desc: "Get a streak of 3 wins in a single match.",
    target: 1,
    xpReward: 75,
    progress: (_p, h) => (maxConsecWinsInOneMatch(h) >= 3 ? 1 : 0),
  },
  {
    id: "pentagram",
    emoji: "⭐",
    title: "Pentagram master",
    desc: "Win at least once with each of the 5 moves.",
    target: 5,
    xpReward: 100,
    progress: (p) => ALL_MOVES.filter((m) => p.stats.byMove[m].won > 0).length,
  },
  {
    id: "mood-reader",
    emoji: "🧠",
    title: "Mood reader",
    desc: "Defeat the Logical CPU 3 times.",
    target: 3,
    xpReward: 100,
    lpReward: 15,
    progress: (_p, h) => Math.min(winsAgainstMood(h, "logical"), 3),
  },
  {
    id: "boulder-smasher",
    emoji: "💪",
    title: "Boulder smasher",
    desc: "Defeat the Aggressive CPU 3 times.",
    target: 3,
    xpReward: 100,
    lpReward: 15,
    progress: (_p, h) => Math.min(winsAgainstMood(h, "aggressive"), 3),
  },
  {
    id: "chaos-rider",
    emoji: "🎲",
    title: "Chaos rider",
    desc: "Defeat the Random CPU 5 times.",
    target: 5,
    xpReward: 75,
    progress: (_p, h) => Math.min(winsAgainstMood(h, "random"), 5),
  },
  {
    id: "veteran-5",
    emoji: "🎖️",
    title: "Veteran",
    desc: "Reach level 5.",
    target: 5,
    xpReward: 150,
    progress: (p) => Math.min(levelFromXp(p.xp).level, 5),
  },
  {
    id: "lp-climber",
    emoji: "🏔️",
    title: "Rank climber",
    desc: "Reach 1100 LP.",
    target: 1100,
    xpReward: 200,
    progress: (p) => Math.min(p.rankLp, 1100),
  },
  {
    id: "historian-25",
    emoji: "📚",
    title: "Historian",
    desc: "Play 25 matches total.",
    target: 25,
    xpReward: 150,
    progress: (_p, h) => Math.min(h.length, 25),
  },
  {
    id: "casual-fan",
    emoji: "🎮",
    title: "Casual fan",
    desc: "Play 10 Casual matches.",
    target: 10,
    xpReward: 100,
    progress: (_p, h) => Math.min(matchesInMode(h, "casual"), 10),
  },
  {
    id: "loyalist",
    emoji: "🪨",
    title: "Loyalist",
    desc: "Pick the same move 5 times in a row in one match.",
    target: 1,
    xpReward: 75,
    progress: (_p, h) => (maxSameMoveInOneMatch(h) >= 5 ? 1 : 0),
  },
  {
    id: "variety-pack",
    emoji: "🌈",
    title: "Variety pack",
    desc: "Use all 5 different moves in a single BO5+ match.",
    target: 1,
    xpReward: 100,
    progress: (_p, h) => (hasUsedAll5InAnyMatch(h) ? 1 : 0),
  },
];

export interface QuestState {
  value: number;
  target: number;
  complete: boolean;
  claimed: boolean;
}

export function questState(q: QuestDef, p: Player, h: MatchRecord[]): QuestState {
  const raw = q.progress(p, h);
  return {
    value: Math.min(raw, q.target),
    target: q.target,
    complete: raw >= q.target,
    claimed: p.claimedQuests.includes(q.id),
  };
}
