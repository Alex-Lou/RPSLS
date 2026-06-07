/**
 * economy.ts — soft currency + crafting economy for the ranked card mode.
 *
 * Players earn ÉCLATS on every finished match (more on a ranked win, a small
 * consolation on a loss). They spend éclats at the boutique to open a pack
 * of {@link PACK_SIZE} cards. Duplicates inside a pack are auto-converted to
 * POUSSIÈRE — a craft resource the player can then spend to forge a specific
 * locked card. The whole loop stays local (no server, no auth).
 */

import type { CardId, CardRarity } from "../ranked/rankedTypes";
import { CARDS, ALL_CARD_IDS, RARITY_ORDER } from "../ranked/cards";
import type { Outcome, RecordMode } from "../types";

/** Éclats awarded for a win, by recorded match mode. Casual gives less to
 *  keep ranked feel rewarding; constellation sits in between; ranked + online
 *  pay the most because they're the highest-effort competitive modes. */
export const ECLATS_PER_WIN: Record<RecordMode, number> = {
  casual: 5,
  ranked: 15,
  hotseat: 5,
  training: 5,
  online: 15,
  constellation: 12,
};

/** Consolation for any finished loss, so a bad run still nudges progress. */
export const ECLATS_PER_LOSS = 2;

/** Cost of one pack. Tuned so a ~3-match win streak in ranked earns it. */
export const PACK_COST = 50;

/** Cards delivered per pack. */
export const PACK_SIZE = 3;

/** Drop weights inside a single card roll (sum doesn't have to be 100). */
export const PACK_WEIGHTS: Record<CardRarity, number> = {
  common: 60,
  rare: 30,
  epic: 9,
  legendary: 1,
};

/** Poussière granted when a pulled card duplicates one already owned. */
export const DUST_PER_DUPLICATE: Record<CardRarity, number> = {
  common: 5,
  rare: 15,
  epic: 40,
  legendary: 100,
};

/** Poussière needed to craft a specific locked card. Roughly 5× a duplicate
 *  so the meta-progression feels earned without being grindy. */
export const CRAFT_COST: Record<CardRarity, number> = {
  common: 25,
  rare: 75,
  epic: 200,
  legendary: 500,
};

/** Compute the éclats earned from a finished match. */
export function eclatsReward(mode: RecordMode, outcome: Outcome): number {
  if (outcome === "win") return ECLATS_PER_WIN[mode] ?? 0;
  if (outcome === "loss") return ECLATS_PER_LOSS;
  return 0;
}

function rollOneCard(): CardId {
  const total = (Object.values(PACK_WEIGHTS) as number[]).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let pickedRarity: CardRarity = "common";
  for (const rarity of RARITY_ORDER) {
    r -= PACK_WEIGHTS[rarity];
    if (r <= 0) { pickedRarity = rarity; break; }
  }
  const pool = ALL_CARD_IDS.filter((id) => CARDS[id].rarity === pickedRarity);
  if (pool.length === 0) {
    const commons = ALL_CARD_IDS.filter((id) => CARDS[id].rarity === "common");
    return commons[Math.floor(Math.random() * commons.length)];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Roll one full pack — PACK_SIZE independent card draws. */
export function rollPack(): CardId[] {
  return Array.from({ length: PACK_SIZE }, () => rollOneCard());
}

export function dustForDuplicate(id: CardId): number {
  return DUST_PER_DUPLICATE[CARDS[id].rarity] ?? 0;
}

export function craftCost(id: CardId): number {
  return CRAFT_COST[CARDS[id].rarity] ?? 0;
}

export interface PackResult {
  /** Cards pulled, in display order. */
  cards: CardId[];
  /** Per-card flag: true if it was new to the collection. */
  isNew: boolean[];
  /** Poussière gained from duplicates in this pack. */
  dustGained: number;
}

/** Codex (B3) completion tiers. Once the player's collection reaches the
 *  threshold, the tier becomes claimable for a one-shot éclats+poussière
 *  reward, giving long-term collectors a reason to chase every card. */
export interface CodexTier {
  threshold: number;
  eclats: number;
  dust: number;
}

export const CODEX_TIERS: CodexTier[] = [
  { threshold: 5,  eclats: 50,  dust: 0 },
  { threshold: 10, eclats: 120, dust: 30 },
  { threshold: 15, eclats: 300, dust: 80 },
  { threshold: 20, eclats: 450, dust: 120 },
  { threshold: 26, eclats: 700, dust: 200 },
  // V3 expansion — collection grows from 26 to 46 cards. Tiers continue at
  // roughly the same density (every 5–10 new cards) so the chase still has
  // milestones, with the final all-46 reward being the biggest of the game.
  { threshold: 32, eclats: 850, dust: 250 },
  { threshold: 40, eclats: 1100, dust: 350 },
  { threshold: 46, eclats: 1500, dust: 500 },
];

/** Find the tier definition for a given threshold, or undefined if unknown. */
export function codexTier(threshold: number): CodexTier | undefined {
  return CODEX_TIERS.find((t) => t.threshold === threshold);
}

/** Per-card mastery (B4). XP grows when the card is in the deck during a
 *  finished match — pure cosmetic (a gold star at level 5) so the system
 *  never reads as pay-to-win.
 *  Index in the array = level - 1, value = XP required to reach the level. */
export const MASTERY_THRESHOLDS = [0, 25, 75, 150, 300] as const;
export const MASTERY_MAX_LEVEL = MASTERY_THRESHOLDS.length;

export function masteryLevel(xp: number): number {
  for (let i = MASTERY_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= MASTERY_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

/** Mastery XP granted per card in the deck when a match ends. Tuned so a
 *  motivated player gradually masters their favourite cards (~60 wins to
 *  cap a card) without it feeling slow. */
export function masteryXpForMatch(outcome: Outcome): number {
  if (outcome === "win") return 5;
  if (outcome === "loss") return 1;
  return 0;
}

/** Season (B5) — 30-day cadence. At rollover the player's LP is softly
 *  reset (so the ladder churns instead of fossilising) and they receive a
 *  one-shot reward based on the tier they ended the season in. */
export const SEASON_DURATION_MS = 30 * 24 * 3600 * 1000;

export interface SeasonReward {
  /** Inclusive LP floor used to pick this reward (matches the tier order
   *  in engine/rank.ts: Bronze 0, Silver 1100, Gold 1300, Platinum 1500,
   *  Diamond 1750). */
  minLp: number;
  /** Display label — the human-readable tier name baked in. */
  tier: string;
  eclats: number;
  dust: number;
}

export const SEASON_REWARDS: SeasonReward[] = [
  { minLp: 0,    tier: "Bronze",   eclats: 50,  dust: 0   },
  { minLp: 1100, tier: "Silver",   eclats: 150, dust: 20  },
  { minLp: 1300, tier: "Gold",     eclats: 300, dust: 50  },
  { minLp: 1500, tier: "Platinum", eclats: 500, dust: 100 },
  { minLp: 1750, tier: "Diamond",  eclats: 700, dust: 200 },
];

/** Pick the reward bucket the LP value falls into — highest-tier wins. */
export function seasonRewardForLp(lp: number): SeasonReward {
  let pick = SEASON_REWARDS[0];
  for (const r of SEASON_REWARDS) {
    if (lp >= r.minLp) pick = r;
  }
  return pick;
}

/** Soft-reset the player's LP so the next season starts in the lower half
 *  of their previous tier. Floor of 1000 keeps the bronze entry meaningful. */
export function softResetLp(lp: number): number {
  return Math.max(1000, Math.floor(lp * 0.8));
}
