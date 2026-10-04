/**
 * 46 cards — 4 rarities (15 base + 11 bonus Lot 1 + 20 bonus V3).
 * Deck of 8, hand of 3. Passive cards (kind: "passive") are equipped but never drawn.
 */

import type { CardId, CardRarity, RankedCard } from "./rankedTypes";
import type { Rng } from "../engine/rng";

import { BASE_CARDS } from "./cardCatalog/baseCards";
import { V3_CARDS } from "./cardCatalog/v3Cards";
import { PRO_CARDS } from "./cardCatalog/proCards";
import { FUSION_CARDS } from "./cardCatalog/fusionCards";

// Catalogue découpé en tranches (cardCatalog/*) — ordre des clés CONSERVÉ :
// tranches concaténées dans l'ordre d'origine (base → V3 → Pro/Voies → fusions).
export const CARDS: Record<CardId, RankedCard> = {
  ...BASE_CARDS,
  ...V3_CARDS,
  ...PRO_CARDS,
  ...FUSION_CARDS,
};

/** Toutes les cartes COLLECTIONNABLES. kind:"fusion" exclu À LA SOURCE
 *  (Forge 2026-06-13) : un seul filtre couvre packs (economy), boutique,
 *  collection, DeckManager, Codex — les cartes fusionnées n'existent
 *  qu'EN PARTIE, via la Forge. */
export const ALL_CARD_IDS: CardId[] = (Object.keys(CARDS) as CardId[]).filter(
  (id) => CARDS[id].kind !== "fusion",
);

/** True for cards whose effect is permanently active while equipped — they are
 *  never drawn into the hand (see makeBattle / RankedBattleState.passives). */
export function isPassiveCard(id: CardId): boolean {
  return CARDS[id].kind === "passive";
}

export const RARITY_ORDER: CardRarity[] = ["common", "rare", "epic", "legendary"];

export const RARITY_COLOR: Record<CardRarity, string> = {
  common: "text-zinc-400",
  rare: "text-blue-400",
  epic: "text-violet-400",
  legendary: "text-amber-400",
};

export const RARITY_BG: Record<CardRarity, string> = {
  common: "from-zinc-600 to-zinc-800",
  rare: "from-blue-500 to-cyan-600",
  epic: "from-violet-500 to-fuchsia-600",
  legendary: "from-amber-400 to-orange-500",
};

/* ──────────── Deck helpers ──────────── */

export const DECK_SIZE = 8;
export const HAND_CAP = 3;
export const STARTING_HAND = 3;

/** Default starter deck (all commons + the 3 original rares). */
/** Default starter deck — 8 cards. Only 1 Augur (intel is rare). */
export function starterDeck(): CardId[] {
  return ["aegis", "precision", "anchor", "second-wind", "surge", "augur", "surge", "curse"];
}

/** Cards every new player owns at first launch (6 commons + first rares). SINGLE
 *  SOURCE — was duplicated in store.defaultPlayer (cardCollection) and DeckManager
 *  (STARTER_CARDS); overlaps the server's WELCOME_CARDS starter subset. */
export const STARTER_COLLECTION: CardId[] = ["aegis", "precision", "anchor", "second-wind", "surge", "augur"];

/** Default 6-card Classé deck for a fresh / wiped profile. */
export const DEFAULT_RANKED_DECK: CardId[] = ["aegis", "precision", "surge", "augur", "anchor", "second-wind"];

/** Default 10-card Arena (Constellation Pro) deck for a fresh / wiped profile. */
export const DEFAULT_ARENA_DECK: CardId[] = [
  "aegis", "precision", "surge", "augur", "anchor", "second-wind", "heist", "supernova", "seve", "jet-caillou",
];

// `rng` (défaut Math.random) : passe un PRNG seedé pour une résolution
// DÉTERMINISTE (lockstep CCG online). Tous les appelants existants (non-CCG)
// gardent Math.random via le défaut → zéro changement de comportement.
export function shuffle<T>(input: readonly T[], rng: Rng = Math.random): T[] {
  const out = input.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function drawN(
  deck: CardId[], hand: CardId[], discard: CardId[],
  n: number, capHand: number = HAND_CAP, rng: Rng = Math.random,
): { deck: CardId[]; hand: CardId[]; discard: CardId[]; drawn: CardId[] } {
  let workingDeck = deck.slice();
  let workingDiscard = discard.slice();
  const newHand = hand.slice();
  const drawn: CardId[] = [];
  const room = Math.max(0, capHand - newHand.length);
  const toDraw = Math.min(n, room);
  for (let i = 0; i < toDraw; i++) {
    if (workingDeck.length === 0) {
      if (workingDiscard.length === 0) break;
      workingDeck = shuffle(workingDiscard, rng);
      workingDiscard = [];
    }
    const card = workingDeck.shift()!;
    drawn.push(card);
    newHand.push(card);
  }
  return { deck: workingDeck, hand: newHand, discard: workingDiscard, drawn };
}

/** Discard a random card from hand. Epics/legendaries go to usedOneShotCards instead. */
export function discardRandom(
  hand: CardId[], discard: CardId[], usedOneShotCards: CardId[], rng: Rng = Math.random,
): { hand: CardId[]; discard: CardId[]; usedOneShotCards: CardId[] } {
  if (hand.length === 0) return { hand, discard, usedOneShotCards };
  const idx = Math.floor(rng() * hand.length);
  const card = hand[idx];
  const rarity = CARDS[card].rarity;
  const isOneShot = rarity === "epic" || rarity === "legendary";
  return {
    hand: [...hand.slice(0, idx), ...hand.slice(idx + 1)],
    discard: isOneShot ? discard : [...discard, card],
    usedOneShotCards: isOneShot ? [...usedOneShotCards, card] : usedOneShotCards,
  };
}
