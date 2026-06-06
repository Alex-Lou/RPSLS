/**
 * 26 cards — 4 rarities (15 base + 11 bonus). Deck of 8, hand of 3.
 * Passive cards (kind: "passive") are equipped but never drawn.
 */

import type { CardId, CardRarity, RankedCard } from "./rankedTypes";

export const CARDS: Record<CardId, RankedCard> = {
  /* ⚪ COMMONS — 1 mana */
  aegis: {
    id: "aegis", cost: 1, rarity: "common",
    target: "lane", palette: "sky", glyph: "🛡️",
    nameKey: "ranked.cards.aegis.name", descKey: "ranked.cards.aegis.desc",
    targetHintKey: "ranked.cards.aegis.targetHint",
    art: "/Cards Bonus/aegis.png",
  },
  precision: {
    id: "precision", cost: 1, rarity: "common",
    target: "lane", palette: "emerald", glyph: "🎯",
    nameKey: "ranked.cards.precision.name", descKey: "ranked.cards.precision.desc",
    targetHintKey: "ranked.cards.precision.targetHint",
    art: "/Cards Bonus/precision.png",
  },
  anchor: {
    id: "anchor", cost: 1, rarity: "common",
    target: "lane", palette: "zinc", glyph: "🪨",
    nameKey: "ranked.cards.anchor.name", descKey: "ranked.cards.anchor.desc",
    targetHintKey: "ranked.cards.anchor.targetHint",
    art: "/Cards Bonus/anchor.png",
  },
  "second-wind": {
    id: "second-wind", cost: 1, rarity: "common",
    target: "self", palette: "teal", glyph: "🩹",
    nameKey: "ranked.cards.second-wind.name", descKey: "ranked.cards.second-wind.desc",
    targetHintKey: "ranked.cards.second-wind.targetHint",
    art: "/Cards Bonus/second-wind.png",
  },
  prescience: {
    id: "prescience", cost: 1, rarity: "common",
    target: "none", palette: "cyan", glyph: "🔮",
    nameKey: "ranked.cards.prescience.name", descKey: "ranked.cards.prescience.desc",
    targetHintKey: "ranked.cards.prescience.targetHint",
    art: "/Cards Bonus/prescience.png",
  },
  cadence: {
    id: "cadence", cost: 1, rarity: "common", kind: "passive",
    target: "none", palette: "teal", glyph: "⏳",
    nameKey: "ranked.cards.cadence.name", descKey: "ranked.cards.cadence.desc",
    targetHintKey: "ranked.cards.cadence.targetHint",
    art: "/Cards Bonus/cadence.png",
  },
  mascarade: {
    id: "mascarade", cost: 1, rarity: "common",
    target: "none", palette: "indigo", glyph: "🎭",
    nameKey: "ranked.cards.mascarade.name", descKey: "ranked.cards.mascarade.desc",
    targetHintKey: "ranked.cards.mascarade.targetHint",
    art: "/Cards Bonus/mascarade.png",
  },
  boussole: {
    id: "boussole", cost: 1, rarity: "common",
    target: "none", palette: "sky", glyph: "🧭",
    nameKey: "ranked.cards.boussole.name", descKey: "ranked.cards.boussole.desc",
    targetHintKey: "ranked.cards.boussole.targetHint",
    art: "/Cards Bonus/boussole.png",
  },

  /* 🔵 RARES — 2 mana */
  surge: {
    id: "surge", cost: 2, rarity: "rare",
    target: "lane", palette: "amber", glyph: "⚡",
    nameKey: "ranked.cards.surge.name", descKey: "ranked.cards.surge.desc",
    targetHintKey: "ranked.cards.surge.targetHint",
    art: "/Cards Bonus/surge.png",
  },
  augur: {
    id: "augur", cost: 2, rarity: "rare",
    target: "lane-reveal", palette: "violet", glyph: "👁️",
    nameKey: "ranked.cards.augur.name", descKey: "ranked.cards.augur.desc",
    targetHintKey: "ranked.cards.augur.targetHint",
    art: "/Cards Bonus/augur.png",
  },
  riposte: {
    id: "riposte", cost: 2, rarity: "rare",
    target: "lane", palette: "pink", glyph: "⚔️",
    nameKey: "ranked.cards.riposte.name", descKey: "ranked.cards.riposte.desc",
    targetHintKey: "ranked.cards.riposte.targetHint",
    art: "/Cards Bonus/riposte.png",
  },
  curse: {
    id: "curse", cost: 2, rarity: "rare",
    target: "lane", palette: "rose", glyph: "💀",
    nameKey: "ranked.cards.curse.name", descKey: "ranked.cards.curse.desc",
    targetHintKey: "ranked.cards.curse.targetHint",
    art: "/Cards Bonus/curse.png",
  },
  mirror: {
    id: "mirror", cost: 2, rarity: "rare",
    target: "lane", palette: "cyan", glyph: "🪞",
    nameKey: "ranked.cards.mirror.name", descKey: "ranked.cards.mirror.desc",
    targetHintKey: "ranked.cards.mirror.targetHint",
    art: "/Cards Bonus/mirror.png",
  },
  sangsue: {
    id: "sangsue", cost: 2, rarity: "rare",
    target: "lane", palette: "rose", glyph: "🩸",
    nameKey: "ranked.cards.sangsue.name", descKey: "ranked.cards.sangsue.desc",
    targetHintKey: "ranked.cards.sangsue.targetHint",
    art: "/Cards Bonus/sangsue.png",
  },
  rempart: {
    id: "rempart", cost: 2, rarity: "rare",
    target: "none", palette: "zinc", glyph: "🏰",
    nameKey: "ranked.cards.rempart.name", descKey: "ranked.cards.rempart.desc",
    targetHintKey: "ranked.cards.rempart.targetHint",
    art: "/Cards Bonus/rempart.png",
  },
  pillage: {
    id: "pillage", cost: 2, rarity: "rare", kind: "passive",
    target: "none", palette: "orange", glyph: "🧤",
    nameKey: "ranked.cards.pillage.name", descKey: "ranked.cards.pillage.desc",
    targetHintKey: "ranked.cards.pillage.targetHint",
    art: "/Cards Bonus/pillage.png",
  },

  /* 🟣 EPICS — 3 mana */
  heist: {
    id: "heist", cost: 3, rarity: "epic",
    target: "lane", palette: "orange", glyph: "🏴‍☠️",
    nameKey: "ranked.cards.heist.name", descKey: "ranked.cards.heist.desc",
    targetHintKey: "ranked.cards.heist.targetHint",
    art: "/Cards Bonus/heist.png",
  },
  tide: {
    id: "tide", cost: 3, rarity: "epic",
    target: "self", palette: "cyan", glyph: "🌊",
    nameKey: "ranked.cards.tide.name", descKey: "ranked.cards.tide.desc",
    targetHintKey: "ranked.cards.tide.targetHint",
    art: "/Cards Bonus/tide.png",
  },
  oracle: {
    id: "oracle", cost: 3, rarity: "epic",
    target: "lane-reveal-all", palette: "fuchsia", glyph: "👁️‍🗨️",
    nameKey: "ranked.cards.oracle.name", descKey: "ranked.cards.oracle.desc",
    targetHintKey: "ranked.cards.oracle.targetHint",
    art: "/Cards Bonus/oracle.png",
  },
  vortex: {
    id: "vortex", cost: 3, rarity: "epic",
    target: "lane-rotate", palette: "indigo", glyph: "🌀",
    nameKey: "ranked.cards.vortex.name", descKey: "ranked.cards.vortex.desc",
    targetHintKey: "ranked.cards.vortex.targetHint",
    art: "/Cards Bonus/vortex.png",
  },
  gambit: {
    id: "gambit", cost: 2, rarity: "epic",
    target: "gamble", palette: "rose", glyph: "🎲",
    nameKey: "ranked.cards.gambit.name", descKey: "ranked.cards.gambit.desc",
    targetHintKey: "ranked.cards.gambit.targetHint",
    art: "/Cards Bonus/gambit.png",
  },
  "trou-noir": {
    id: "trou-noir", cost: 3, rarity: "epic",
    target: "none", palette: "violet", glyph: "🕳️",
    nameKey: "ranked.cards.trou-noir.name", descKey: "ranked.cards.trou-noir.desc",
    targetHintKey: "ranked.cards.trou-noir.targetHint",
    art: "/Cards Bonus/trou-noir.png",
  },
  prophetie: {
    id: "prophetie", cost: 3, rarity: "epic", kind: "passive",
    target: "none", palette: "fuchsia", glyph: "📜",
    nameKey: "ranked.cards.prophetie.name", descKey: "ranked.cards.prophetie.desc",
    targetHintKey: "ranked.cards.prophetie.targetHint",
    art: "/Cards Bonus/prophetie.png",
  },
  conduit: {
    id: "conduit", cost: 3, rarity: "epic", kind: "passive",
    target: "none", palette: "cyan", glyph: "🔗",
    nameKey: "ranked.cards.conduit.name", descKey: "ranked.cards.conduit.desc",
    targetHintKey: "ranked.cards.conduit.targetHint",
    art: "/Cards Bonus/conduit.png",
  },

  /* 🟡 LEGENDARY — 4 mana */
  supernova: {
    id: "supernova", cost: 4, rarity: "legendary",
    target: "gamble", palette: "yellow", glyph: "💫",
    nameKey: "ranked.cards.supernova.name", descKey: "ranked.cards.supernova.desc",
    targetHintKey: "ranked.cards.supernova.targetHint",
    art: "/Cards Bonus/supernova.png",
  },
  trinite: {
    id: "trinite", cost: 4, rarity: "legendary",
    target: "none", palette: "amber", glyph: "🔱",
    nameKey: "ranked.cards.trinite.name", descKey: "ranked.cards.trinite.desc",
    targetHintKey: "ranked.cards.trinite.targetHint",
    art: "/Cards Bonus/trinite.png",
  },
};

export const ALL_CARD_IDS: CardId[] = Object.keys(CARDS) as CardId[];

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

export function shuffle<T>(input: readonly T[]): T[] {
  const out = input.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function drawN(
  deck: CardId[], hand: CardId[], discard: CardId[],
  n: number, capHand: number = HAND_CAP,
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
      workingDeck = shuffle(workingDiscard);
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
  hand: CardId[], discard: CardId[], usedOneShotCards: CardId[],
): { hand: CardId[]; discard: CardId[]; usedOneShotCards: CardId[] } {
  if (hand.length === 0) return { hand, discard, usedOneShotCards };
  const idx = Math.floor(Math.random() * hand.length);
  const card = hand[idx];
  const rarity = CARDS[card].rarity;
  const isOneShot = rarity === "epic" || rarity === "legendary";
  return {
    hand: [...hand.slice(0, idx), ...hand.slice(idx + 1)],
    discard: isOneShot ? discard : [...discard, card],
    usedOneShotCards: isOneShot ? [...usedOneShotCards, card] : usedOneShotCards,
  };
}
