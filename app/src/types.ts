import type { Move } from "./game";
import type { AiMood } from "./game";

export type ThemeId = "violet" | "neon" | "pastel" | "sunset" | "forest";

export type PadId =
  | "chalkboard" | "vintage" | "cosmos" | "neon" | "comics"      // original SVG playmats
  | "ancient" | "astrolab" | "casino" | "cyberpunk" | "quantum" | "steampunk";  // image playmats

export type BackgroundId =
  | "default"
  | "ancient" | "astrolab" | "casino" | "cyberpunk"
  | "galaxy" | "quantum" | "steampunk";

export type GameMode = "training" | "casual" | "ranked" | "hotseat";

/** Modes that can appear in match HISTORY — the local GameMode set plus the two
 *  online surfaces (recorded from OnlinePage). Kept separate from GameMode so the
 *  local Game / ModeSelect flow stays a clean 4-mode union. */
export type RecordMode = GameMode | "online" | "constellation";

export type Difficulty = "easy" | "normal" | "hard";

export const DIFFICULTY_META: Record<Difficulty, { label: string; emoji: string; desc: string }> = {
  easy:   { label: "Easy",   emoji: "🟢", desc: "The CPU often plays into your hand. Practice mode." },
  normal: { label: "Normal", emoji: "🟡", desc: "Mood-based weighted random. Fair fight." },
  hard:   { label: "Hard",   emoji: "🔴", desc: "The CPU reads your last moves and counters your habits." },
};

export type Outcome = "win" | "loss" | "draw";

export interface ByMoveStat {
  picked: number;
  won: number;
}

export interface PlayerStats {
  wins: number;
  losses: number;
  draws: number;
  byMove: Record<Move, ByMoveStat>;
}

export interface Player {
  id: string;
  nickname: string;
  avatar: string; // emoji or data URL
  themeId: ThemeId;
  padId: PadId;
  difficulty: Difficulty;
  xp: number;
  rankLp: number;
  stats: PlayerStats;
  claimedQuests: string[];
  completedDailies: string[]; // 'YYYY-MM-DD' date keys
  /** Daily-challenge (#17) rewards claimed today; resets when the date rolls over. */
  dailyClaims?: { date: string; ids: string[] };
  createdAt: number;
  /** Vibration on/off — default true. Read via store.migration on legacy save. */
  hapticEnabled?: boolean;
  /** Vibration intensity multiplier — default "med". */
  hapticIntensity?: "low" | "med" | "high";
  /** Ranked card collection — IDs of cards the player has unlocked. */
  cardCollection?: string[];
  /** Ranked deck — ordered list of 6 card IDs (3 main + 3 reserve). */
  rankedDeck?: string[];
  /** Cosmetic background image painted behind every page. Defaults to the
   *  original radial-gradient. */
  backgroundId?: BackgroundId;
}

export const PAD_META: Record<PadId, { label: string; emoji: string; tagline: string }> = {
  chalkboard: { label: "Blackboard",     emoji: "🧪", tagline: "Hand-drawn chalk, formulas, lab vibes." },
  vintage:    { label: "Vintage Hall",   emoji: "🎲", tagline: "Felt mat, gold trim, retro lounge." },
  cosmos:     { label: "Cosmos",         emoji: "🌌", tagline: "Dark sky, orbits, particle trails." },
  neon:       { label: "Neon Arcade",    emoji: "🕹️", tagline: "Synthwave grid, neon lines, 80s arcade." },
  comics:     { label: "Comics",         emoji: "💥", tagline: "Halftone dots, BAM-POW, pop-art comic page." },
  ancient:    { label: "Ancient Codex",  emoji: "📜", tagline: "Worn parchment, gold leaf, arcane runes." },
  astrolab:   { label: "Astrolab",       emoji: "🔭", tagline: "Brass instruments, parchment, star charts." },
  casino:     { label: "Casino Royale",  emoji: "🎰", tagline: "Emerald felt + Art Deco gold trim." },
  cyberpunk:  { label: "Cyberpunk",      emoji: "🌆", tagline: "Neon hex grid, holographic HUD." },
  quantum:    { label: "Quantum Lab",    emoji: "⚛️", tagline: "Particle traces, physics equations." },
  steampunk:  { label: "Steampunk",      emoji: "⚙️", tagline: "Brass gears, leather, amber filaments." },
};

export type Opponent =
  | { kind: "cpu"; mood: AiMood }
  | { kind: "human"; nickname: string };

export interface MatchRoundLog {
  playerMove: Move;
  opponentMove: Move;
  result: Outcome;
}

export interface MatchRecord {
  id: string;
  mode: RecordMode;
  bestOf: number;
  opponent: Opponent;
  scorePlayer: number;
  scoreOpponent: number;
  outcome: Outcome;
  rounds: MatchRoundLog[];
  xpDelta: number;
  lpDelta: number;
  timestamp: number;
  /** True when the player abandoned the match mid-way (counted as a loss). */
  forfeit?: boolean;
}

/** XP/LP rewards table per mode. */
export const REWARDS: Record<
  GameMode,
  { xpWin: number; xpLoss: number; xpDraw: number; lpWin: number; lpLoss: number; lpDraw: number }
> = {
  training: { xpWin: 0,  xpLoss: 0,  xpDraw: 0,  lpWin: 0,  lpLoss: 0,   lpDraw: 0 },
  casual:   { xpWin: 50, xpLoss: 10, xpDraw: 20, lpWin: 0,  lpLoss: 0,   lpDraw: 0 },
  ranked:   { xpWin: 30, xpLoss: 5,  xpDraw: 10, lpWin: 25, lpLoss: -20, lpDraw: 0 },
  hotseat:  { xpWin: 0,  xpLoss: 0,  xpDraw: 0,  lpWin: 0,  lpLoss: 0,   lpDraw: 0 },
};

export const MODE_META: Record<RecordMode, { label: string; emoji: string; tagline: string }> = {
  training:      { label: "Training",      emoji: "🤖", tagline: "Vs CPU · no XP, no risk" },
  casual:        { label: "Casual",        emoji: "🎮", tagline: "Vs CPU · earn XP" },
  ranked:        { label: "Ranked",        emoji: "🏆", tagline: "Vs CPU · LP at stake" },
  hotseat:       { label: "Hot-seat",      emoji: "👥", tagline: "2 players, 1 device" },
  online:        { label: "Online",        emoji: "🌐", tagline: "Live 1v1 vs a real player" },
  constellation: { label: "Constellation", emoji: "🌌", tagline: "3-lane online duel" },
};
