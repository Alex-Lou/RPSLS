/**
 * Combo detection for Constellation Lanes — Phase 1+.
 *
 * Given the 3 picks of one player in a round, returns a named combo with a
 * visual theme. Used purely for UI flair in the reveal stage — does not
 * affect server scoring (Phase 1).
 *
 * Adding a new combo = adding one entry to COMBOS + a detection rule.
 * The tier sort means rarer combos override more common ones.
 */

import type { Move } from "./game";

export type ComboTier = "epic" | "rare" | "common" | "neutral";

export interface ComboTheme {
  /** Internal id used by the UI to switch the animation. */
  id: string;
  /** Short display name, e.g. "ROCKSLIDE". */
  name: string;
  /** A one-liner sub-title shown under the name. */
  tagline: string;
  /** Tier — drives rarity colour / size of the visual treatment. */
  tier: ComboTier;
  /** Single emoji that becomes the burst icon. */
  glyph: string;
  /** Tailwind gradient classes for the headline (use grad-clip-text). */
  gradient: string;
  /** Optional bonus points to flash next to the score (cosmetic). */
  bonus?: number;
}

const TRIPLE_THEMES: Record<Move, ComboTheme> = {
  rock: {
    id: "rockslide",
    name: "ROCKSLIDE",
    tagline: "Three boulders, no mercy.",
    tier: "rare",
    glyph: "🪨",
    gradient: "from-stone-300 via-amber-400 to-orange-600",
    bonus: 1,
  },
  paper: {
    id: "origami",
    name: "ORIGAMI WAVE",
    tagline: "A flock of folded fate.",
    tier: "rare",
    glyph: "📄",
    gradient: "from-zinc-100 via-sky-200 to-blue-400",
    bonus: 1,
  },
  scissors: {
    id: "shear",
    name: "SHEAR FRENZY",
    tagline: "Snip · snip · snip.",
    tier: "rare",
    glyph: "✂️",
    gradient: "from-rose-300 via-orange-400 to-amber-500",
    bonus: 1,
  },
  lizard: {
    id: "reptile",
    name: "REPTILE OVERLOAD",
    tagline: "Cold blood, venom thrice.",
    tier: "rare",
    glyph: "🦎",
    gradient: "from-lime-300 via-emerald-400 to-teal-600",
    bonus: 1,
  },
  spock: {
    id: "vulcan",
    name: "VULCAN BURST",
    tagline: "Live long and dominate.",
    tier: "rare",
    glyph: "🖖",
    gradient: "from-cyan-300 via-violet-400 to-fuchsia-600",
    bonus: 1,
  },
};

const TRINITY_CLASSIC: ComboTheme = {
  id: "trinityClassic",
  name: "CLASSIC TRINITY",
  tagline: "Rock · Paper · Scissors — the originals.",
  tier: "common",
  glyph: "🌀",
  gradient: "from-zinc-100 via-amber-200 to-rose-300",
};

const TRINITY_QUANTUM: ComboTheme = {
  id: "trinityQuantum",
  name: "QUANTUM PARADOX",
  tagline: "Probability collapses across three lanes.",
  tier: "rare",
  glyph: "🧠",
  gradient: "from-emerald-300 via-violet-400 to-cyan-300",
};

const MIRROR: ComboTheme = {
  id: "mirror",
  name: "MIRROR",
  tagline: "Same picks, both sides. The cosmos blinks.",
  tier: "common",
  glyph: "🪞",
  gradient: "from-zinc-100 via-zinc-300 to-zinc-500",
};

const SWEEP: ComboTheme = {
  id: "sweep",
  name: "FLAWLESS SWEEP",
  tagline: "All three lanes — total domination.",
  tier: "epic",
  glyph: "👑",
  gradient: "from-amber-200 via-fuchsia-400 to-violet-500",
  bonus: 2,
};

const SWEPT: ComboTheme = {
  id: "wipeout",
  name: "WIPEOUT",
  tagline: "All three lanes lost. Reset your nerves.",
  tier: "epic",
  glyph: "💀",
  gradient: "from-rose-300 via-rose-500 to-red-700",
};

const TIE_3WAY: ComboTheme = {
  id: "stalemate",
  name: "STALEMATE",
  tagline: "Three lanes, three minds, no winner.",
  tier: "neutral",
  glyph: "🤝",
  gradient: "from-zinc-100 via-zinc-300 to-zinc-500",
};

/* ──────────── Public API ──────────── */

export interface RoundComboResult {
  yourCombo: ComboTheme | null;
  oppCombo: ComboTheme | null;
  /** Combo describing the *outcome* of the round (sweep / wipeout / tie). */
  outcomeCombo: ComboTheme | null;
}

/**
 * Pick a combo for one player's lineup of 3 moves.
 * Returns `null` if no themed combo matches (regular mixed picks).
 */
export function detectPlayerCombo(picks: Move[]): ComboTheme | null {
  if (picks.length !== 3) return null;
  const [a, b, c] = picks;
  // Triple — strongest, themed per move.
  if (a === b && b === c) return TRIPLE_THEMES[a];
  // Trinity — 3 distinct moves.
  const set = new Set(picks);
  if (set.size === 3) {
    const hasClassic = ["rock", "paper", "scissors"].every((m) => set.has(m as Move));
    if (hasClassic) return TRINITY_CLASSIC;
    const hasLizard = set.has("lizard");
    const hasSpock = set.has("spock");
    if (hasLizard || hasSpock) return TRINITY_QUANTUM;
  }
  // No themed combo (e.g. mixed pair like Rock-Rock-Paper).
  return null;
}

/** Convenience: same as `detectPlayerCombo` but takes a non-Move sentinel
 *  list of picks (e.g. with nulls) and returns null until all 3 are set. */
export function detectPlayerComboIfFull(picks: (Move | null)[]): ComboTheme | null {
  if (picks.length !== 3 || picks.some((p) => p === null)) return null;
  return detectPlayerCombo(picks as Move[]);
}

/**
 * Describe the round outcome from one player's perspective.
 * `youPoints` / `oppPoints` are lane wins this round.
 * `yourPicks` / `oppPicks` enable the mirror detection.
 */
export function detectOutcomeCombo(
  youPoints: number,
  oppPoints: number,
  yourPicks: Move[],
  oppPicks: Move[],
): ComboTheme | null {
  // Mirror — both sides played identical lineups in the same order.
  if (yourPicks.length === oppPicks.length && yourPicks.every((m, i) => m === oppPicks[i])) {
    return MIRROR;
  }
  if (youPoints === 3 && oppPoints === 0) return SWEEP;
  if (youPoints === 0 && oppPoints === 3) return SWEPT;
  if (youPoints === oppPoints) return TIE_3WAY;
  return null;
}

/* ──────────── Lane Identity ──────────── */

export interface LaneIdentity {
  /** Internal id for the lane index. */
  index: number;
  /** Display title and short hint. */
  title: string;
  glyph: string;
  hint: string;
  /** Move ids this lane "favours" — cosmetic Phase 1, can be wired to a real
   *  score bonus in Phase 2 if we feel the game wants it. */
  favours: Move[];
  /** Tailwind colour token used for ring + badge. */
  accent: "amber" | "sky" | "emerald";
}

/**
 * The three Phase-1 lane identities. Static across all matches so players
 * memorise them and start placing moves intentionally.
 */
export const LANE_IDENTITIES: LaneIdentity[] = [
  {
    index: 0,
    title: "FORCE",
    glyph: "⚔️",
    hint: "Rock & Scissors thrive here.",
    favours: ["rock", "scissors"],
    accent: "amber",
  },
  {
    index: 1,
    title: "WISDOM",
    glyph: "🧠",
    hint: "Paper & Spock thrive here.",
    favours: ["paper", "spock"],
    accent: "sky",
  },
  {
    index: 2,
    title: "CUNNING",
    glyph: "🦎",
    hint: "Lizard thrives here.",
    favours: ["lizard"],
    accent: "emerald",
  },
];

export function laneFavoursMove(laneIdx: number, mv: Move): boolean {
  return LANE_IDENTITIES[laneIdx]?.favours.includes(mv) ?? false;
}
