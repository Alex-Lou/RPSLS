import type { Move } from "./game";
import type { AiMood } from "./game";

export type ThemeId = "violet" | "neon" | "pastel" | "sunset" | "forest";

export type PadId =
  // Fully coded, animated playmats (SVG/SMIL — no PNGs anymore).
  | "chalkboard" | "vintage" | "cosmos" | "galaxy" | "neon" | "comics"
  | "cyberpunk" | "holy" | "quantum" | "casino"
  // Player's own uploaded mat (data URL on the player).
  | "custom";

export type BackgroundId =
  | "default"
  // Coded / animated WebGL backdrops (no PNG — fully procedural).
  | "nebula" | "galaxy" | "aurora" | "holy" | "quantum" | "grid" | "casino"
  // Player's own uploaded image.
  | "custom";

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
  /** Opt-in to anonymized Sentry crash reports. Defaults to false to honour
   *  the privacy-first stance laid out in the policy. The toggle lives in
   *  Settings; flipping it at runtime calls initSentry / shutdownSentry. */
  crashReports?: boolean;
  /** Global UI text-size multiplier (accessibility). 1 = default, 1.15 =
   *  large, 1.3 = extra-large. Applied via the --font-scale CSS var. */
  fontScale?: number;
  /** Rolling forfeit tracker for the abandon-penalty system (match/forfeit.ts).
   *  Repeat ranked/online quitters take escalating LP hits. */
  abandons?: { count: number; lastAt: number };
  /** Current consecutive-win streak (match/streak.ts). Grants escalating
   *  bonus XP; a loss resets it. */
  winStreak?: number;
  /** Player's own uploaded background image (data URL), shown when the
   *  "custom" background is selected. Pre-bibliothèque: stores ONLY the
   *  current pick. Post-bibliothèque: mirrors customBgs[0] for back-compat. */
  customBgUrl?: string;
  /** Player's own uploaded battle pad (data URL), shown when the "custom"
   *  pad is selected. Landscape 3:2 (≈1500×1000), cover-fit on the mat. */
  customPadUrl?: string;
  /** Personal library of imported background images (data URLs), newest first.
   *  Capped client-side so the persisted state stays under localStorage limits.
   *  Picking one writes it to customBgUrl. */
  customBgs?: string[];
  /** Personal library of imported battle-pad images (data URLs), newest first.
   *  Same cap as customBgs. Picking one writes it to customPadUrl. */
  customPads?: string[];
  /** True once the player has explicitly picked a battle pad. Until then,
   *  choosing a background applies that background's default pad; afterwards
   *  pad and background are fully independent. */
  padChosen?: boolean;
}

export const PAD_META: Record<PadId, { label: string; emoji: string; tagline: string }> = {
  chalkboard: { label: "Blackboard",     emoji: "🧪", tagline: "Hand-drawn chalk, formulas, lab vibes." },
  vintage:    { label: "Vintage Hall",   emoji: "🎲", tagline: "Felt mat, gold trim, retro lounge." },
  cosmos:     { label: "Cosmos",         emoji: "🌌", tagline: "Dark sky, orbits, particle trails." },
  galaxy:     { label: "Galaxy",         emoji: "🌀", tagline: "Spiral arms turning around a bright core." },
  neon:       { label: "Neon Arcade",    emoji: "🕹️", tagline: "Synthwave grid, neon lines, 80s arcade." },
  comics:     { label: "Comics",         emoji: "💥", tagline: "Halftone dots, BAM-POW, pop-art comic page." },
  cyberpunk:  { label: "Cyberpunk",      emoji: "🌆", tagline: "Neon hex grid, holographic HUD, scanlines." },
  holy:       { label: "Holy Game",      emoji: "✝️", tagline: "Cathedral light, gilded relics, sacred geometry." },
  quantum:    { label: "Quantum Lab",    emoji: "⚛️", tagline: "Particle traces, physics equations." },
  casino:     { label: "Casino Royale",  emoji: "🎰", tagline: "Feutre émeraude, roulette, jetons et or Art Déco." },
  custom:     { label: "Mon image",      emoji: "🖼️", tagline: "Ton propre tapis (paysage 3:2, ex. 1500×1000)." },
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
