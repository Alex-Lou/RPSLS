import type { Move } from "./engine/game";
import type { AiMood } from "./engine/game";

export type ThemeId =
  | "violet" | "neon" | "pastel" | "sunset" | "forest"
  | "ocean" | "ember" | "aurora" | "gold" | "cyber" | "rose" | "mono"
  // ── Premium palettes ──
  | "quartz"
  // ── Eclipse set ──
  | "eclipse"
  // ── Phantom + Emberforge + Tempus + Storm ──
  | "phantom" | "emberforge" | "tempus" | "storm"
  // ── 2026-06-07 lineup: warm/industrial/minimal/spectral/artistic/floral ──
  | "coral" | "rust" | "void" | "prism" | "ink" | "bloom";

export type PadId =
  // Fully coded, animated playmats (SVG/SMIL — no PNGs anymore).
  | "chalkboard" | "vintage" | "cosmos" | "galaxy" | "neon" | "comics"
  | "cyberpunk" | "holy" | "quantum" | "casino"
  // Dedicated pads matching coded backgrounds.
  | "nebula" | "aurora_borealis"
  // Second casino variant — black & gold Monte-Carlo midnight.
  | "casino_noir"
  // Theme-reactive pad: colours follow the active theme/background accent.
  | "aura"
  // Elemental pads matching coded backgrounds.
  | "volcanic" | "abyss"
  // ── Eclipse/Phantom/Emberforge/Tempus/Storm sets ──
  | "eclipse" | "phantom" | "emberforge" | "tempus" | "storm"
  // ── Premium pads ──
  | "quartz"
  // ── 2026-06-07 premium lineup ──
  | "coral" | "rust" | "void" | "prism" | "ink" | "bloom"
  // Player's own uploaded mat (data URL on the player).
  | "custom";

export type BackgroundId =
  | "default"
  // Coded / animated WebGL backdrops (no PNG — fully procedural).
  | "nebula" | "galaxy" | "aurora" | "holy" | "quantum" | "grid" | "casino"
  | "volcanic" | "abyss" | "eclipse" | "phantom" | "emberforge" | "tempus" | "storm"
  // ── Premium backgrounds ──
  | "quartz"
  // ── 2026-06-07 premium lineup ──
  | "coral" | "rust" | "void" | "prism" | "ink" | "bloom"
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
  /** Soft currency earned on every finished match. Spent at the boutique
   *  to buy a pack. */
  eclats?: number;
  /** Craft resource. Granted from duplicate pulls in packs (more on rare
   *  cards), spent to forge a specific locked card. */
  dust?: number;
  /** Premium currency — NEVER awarded through gameplay. Used only for the
   *  premium cosmetics shop (animated sets, ranked exclusives). Purchased
   *  via the App/Play Store and granted by the server post-receipt-verify.
   *  Keeping it out of every gameplay loop is what guarantees no in-game
   *  exploit can mint it; the only mint surface is a verified IAP receipt. */
  stars?: number;
  /** Premium cosmetic ids the player owns (e.g. ["quartz"]). Cosmetics are
   *  per-set, not per-piece — owning "quartz" unlocks the background, pad,
   *  and HUD palette together. Server-replicated like the rest of progress. */
  ownedPremiumSets?: string[];
  /** Collection-completion thresholds the player has already claimed
   *  (5 / 10 / 15 cards). Each threshold can be claimed at most once. */
  codexClaimed?: number[];
  /** Mastery XP per card. Grows when the card is in the active deck during
   *  a finished match. Cosmetic levels 1–5 (a gold star at 5). */
  cardMastery?: Record<string, number>;
  /** Current season — bumps every {@link SEASON_DURATION_MS} with a soft
   *  LP reset and a tier-based reward. Stored as a timestamp so rollover
   *  detection stays trivial across timezones. */
  season?: { number: number; startedAt: number };
  /** Classé (classic 1 v 1) ranked ladder — LOCAL and SEPARATE from the
   *  online-authoritative global `rankLp`. Every Classé match (quick match +
   *  tournament) moves this, so the mode has its own "climb the ranks" loop.
   *  Kept local (never pushed to the global leaderboard) so vs-CPU play can't
   *  farm the un-farmable online ladder. Default 1000 = Bronze entry; reuses
   *  the same tier thresholds as engine/rank.ts. */
  classeLp?: number;
  /** Lifetime Classé win/loss/draw record, shown in the Classé lobby. Kept
   *  apart from the global `stats` so the mode reports its OWN results
   *  ("son propre enregistrement"). */
  classeStats?: { wins: number; losses: number; draws: number };
  /** Constellation Pro (mini-CCG arena) own record — separate from
   *  Ranked and Classé. Cloud-synced via playerSync so it survives a
   *  reinstall. Recorded by ArenaGame at phase=match-end. */
  arenaStats?: { wins: number; losses: number; draws: number };
  /** Constellation Pro v2 — the player's chosen "Voie" / affinity. The
   *  symbol invocated of THIS type gets a passive bonus + counts towards
   *  the 3-star Constellation Finisher unlock. Default to "rock" if
   *  unset (CV-saved players from v1). User picks it in the Pro lobby
   *  before each match. See docs/CONSTELLATION_PRO_V2_PLAN.md. */
  arenaAffinity?: import("./engine/game").Move;
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
  /** Epoch millis of the last state we synced with the server (pushed or
   *  adopted). Local-only anchor for last-write-wins on cosmetic prefs: on
   *  load we adopt the server's chosen look only if its `updatedAt` is newer
   *  than this. Not itself synced. */
  syncedAt?: number;
  /** TOFU (Trust On First Use) claim token — issued by the server on first
   *  Hello, required on subsequent connections. Prevents player_id spoofing.
   *  Local-only (not part of PlayerProgress). */
  claimToken?: string;
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
  /** Per-premium-theme FX intensity multiplier. Keyed by `premiumSetId`
   *  (storm / coral / bloom / …). Range 0.4 - 1.6; 1.0 = the shipping look.
   *  Scales the visual density of the theme's defining FX — rain drops for
   *  Storm, falling petals for Bloom, flying sparks for Rust, etc. Lives on
   *  the player so the preference survives reinstall + sync. */
  premiumIntensity?: Record<string, number>;
}

/** Where a pad shows up in the Profile pad picker's 3-way sub-filter.
 *  - "styled" = animated, themed (matches a coded background)
 *  - "svg"    = plain illustrated, no theme tie
 *  - "img"    = the player's uploaded image */
export type PadCategory = "styled" | "svg" | "img";

export const PAD_META: Record<PadId, { label: string; emoji: string; tagline: string; category: PadCategory; premiumSetId?: string }> = {
  chalkboard: { label: "Blackboard",     emoji: "🧪", tagline: "Hand-drawn chalk, formulas, lab vibes.",            category: "svg" },
  vintage:    { label: "Vintage Hall",   emoji: "🎲", tagline: "Felt mat, gold trim, retro lounge.",                 category: "svg" },
  cosmos:     { label: "Cosmos",         emoji: "🌌", tagline: "Dark sky, orbits, particle trails.",                 category: "styled" },
  galaxy:     { label: "Galaxy",         emoji: "🌀", tagline: "Spiral arms turning around a bright core.",          category: "styled" },
  neon:       { label: "Neon Arcade",    emoji: "🕹️", tagline: "Synthwave grid, neon lines, 80s arcade.",            category: "styled" },
  comics:     { label: "Comics",         emoji: "💥", tagline: "Halftone dots, BAM-POW, pop-art comic page.",        category: "svg" },
  cyberpunk:  { label: "Cyberpunk",      emoji: "🌆", tagline: "Neon hex grid, holographic HUD, scanlines.",          category: "styled" },
  holy:       { label: "Holy Game",      emoji: "✝️", tagline: "Cathedral light, gilded relics, sacred geometry.",   category: "styled" },
  quantum:    { label: "Quantum Lab",    emoji: "⚛️", tagline: "Particle traces, physics equations.",                category: "styled" },
  nebula:     { label: "Nebula",         emoji: "🌌", tagline: "Nuages de gaz violet et cyan, étoiles, pulsations.", category: "styled" },
  aurora_borealis: { label: "Aurore Boréale", emoji: "🌌", tagline: "Ciel polaire, rideaux de lumière verte et violette.", category: "styled" },
  casino:     { label: "Casino Royale",  emoji: "🎰", tagline: "Feutre émeraude, roulette, jetons et or Art Déco.",  category: "styled" },
  casino_noir:{ label: "Casino Noir",   emoji: "🃏", tagline: "Monte-Carlo minuit : noir, or, médaillon Art Déco.",  category: "styled" },
  aura:       { label: "Aura",           emoji: "🎨", tagline: "S'accorde à ton thème : couleurs et lueurs vivantes.", category: "styled" },
  volcanic:   { label: "Volcanic",      emoji: "🌋", tagline: "Obsidienne craquelée, veines de lave, braises montantes.", category: "styled" },
  abyss:      { label: "Abyss",         emoji: "🐙", tagline: "Abysses océaniques, méduses bioluminescentes, profondeurs.", category: "styled" },
  eclipse:    { label: "Eclipse",       emoji: "🌑", tagline: "Couronne solaire, anneau de diamant, vide onyx percé d'or.",     category: "styled", premiumSetId: "eclipse" },
  phantom:    { label: "Phantom Realm", emoji: "👻", tagline: "Brume spectrale, larmes fantômes, volutes argentées flottantes.", category: "styled", premiumSetId: "phantom" },
  emberforge: { label: "Ember Forge",   emoji: "🔥", tagline: "Forge naine, rivières de braise, cuivre martelé incandescent.",  category: "styled", premiumSetId: "emberforge" },
  tempus:     { label: "Tempus Aeternum", emoji: "⏳", tagline: "Sables du temps, engrenages antiques, sablier sépia éternel.", category: "styled", premiumSetId: "tempus" },
  storm:      { label: "Tempest Fury",  emoji: "⚡", tagline: "Foudre déchirante, rideaux de pluie, nuages d'orage grondants.",  category: "styled", premiumSetId: "storm" },
  quartz:     { label: "Quartz",        emoji: "💠", tagline: "Cristaux prismatiques, refractions glaciales, lumière douce.",     category: "styled", premiumSetId: "quartz" },
  coral:      { label: "Coral",         emoji: "🪸", tagline: "Récif bioluminescent, anémones pulsantes, bancs de poissons.",     category: "styled", premiumSetId: "coral" },
  rust:       { label: "Rust",          emoji: "🏭", tagline: "Déclin industriel, poutres rouillées, étincelles de soudure.",      category: "styled", premiumSetId: "rust" },
  void:       { label: "Void",          emoji: "◼️", tagline: "Vide géométrique, lignes blanches fines, minimalisme absolu.",      category: "styled", premiumSetId: "void" },
  prism:      { label: "Prism",         emoji: "💎", tagline: "Laboratoire de lumière, faisceaux spectraux décomposés.",          category: "styled", premiumSetId: "prism" },
  ink:        { label: "Ink",           emoji: "🖋️", tagline: "Sumi-e vivant, encre de Chine sur papier de riz texturé.",         category: "styled", premiumSetId: "ink" },
  bloom:      { label: "Bloom",         emoji: "🌸", tagline: "Jardin infini, pétales en spirale, lucioles, fleurs qui s'ouvrent.", category: "styled", premiumSetId: "bloom" },
  custom:     { label: "Mon image",      emoji: "🖼️", tagline: "Ton propre tapis (paysage 3:2, ex. 1500×1000).",     category: "img" },
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
  // vs-CPU "ranked" gives XP only — competitive LP / rank comes ONLY from
  // real online matches (server-authoritative ladder). Keeps the global
  // ranking un-farmable.
  ranked:   { xpWin: 30, xpLoss: 5,  xpDraw: 10, lpWin: 0,  lpLoss: 0,   lpDraw: 0 },
  hotseat:  { xpWin: 0,  xpLoss: 0,  xpDraw: 0,  lpWin: 0,  lpLoss: 0,   lpDraw: 0 },
};

/** Classé ladder (Player.classeLp) point swing per finished match. This is the
 *  LOCAL classic-1v1 ranking — distinct from REWARDS.lp* (which stays 0 for
 *  vs-CPU to keep the ONLINE global ladder un-farmable). A win climbs, a loss
 *  drops, a forfeit drops a little more so bailing isn't a free escape. */
export const CLASSE_LP = { win: 18, loss: -12, draw: 3, forfeit: -18 } as const;

/** Classé LP delta for a finished (non-forfeit) outcome — shared by the store
 *  (applies it) and the end screen (displays it) so they never drift. */
export function classeLpDelta(outcome: Outcome): number {
  return outcome === "win" ? CLASSE_LP.win : outcome === "loss" ? CLASSE_LP.loss : CLASSE_LP.draw;
}

export const MODE_META: Record<RecordMode, { label: string; emoji: string; tagline: string }> = {
  training:      { label: "Training",      emoji: "🤖", tagline: "Vs CPU · no XP, no risk" },
  casual:        { label: "Casual",        emoji: "🎮", tagline: "Vs CPU · earn XP" },
  ranked:        { label: "Ranked",        emoji: "🏆", tagline: "Vs CPU · LP at stake" },
  hotseat:       { label: "Hot-seat",      emoji: "👥", tagline: "2 players, 1 device" },
  online:        { label: "Online",        emoji: "🌐", tagline: "Live 1v1 vs a real player" },
  constellation: { label: "Constellation", emoji: "🌌", tagline: "3-lane online duel" },
};
