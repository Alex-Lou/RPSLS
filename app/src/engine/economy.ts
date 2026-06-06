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
