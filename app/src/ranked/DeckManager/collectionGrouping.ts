import type { Move } from "../../engine/game";
import { isDeckable } from "../../arena/arenaDecks";
import { ALL_CARD_IDS, CARDS, isPassiveCard, RARITY_ORDER } from "../cards";
import { isRankedDeckable } from "../rankedPool";
import type { CardId, CardRarity } from "../rankedTypes";
import type { VoieFilter } from "./deckManagerConstants";

/** Fonctions PURES de la collection du DeckManager (mêmes dépendances côté appelant). */

export type DeckMode = "ranked" | "arena";

/** Cartes que le deck builder propose : seulement celles qui ont un effet dans
 *  le mode. Arène : isDeckable (source unique, cf. arenaDecks) écarte aussi les
 *  Finishers, injectés à jauge pleine. Classé : isRankedDeckable. */
export function deckPool(mode: DeckMode): CardId[] {
  return ALL_CARD_IDS.filter((id) => (mode === "arena" ? isDeckable(id) : isRankedDeckable(id)));
}

/** Count owned cards per rarity — shown in the rarity tab pills so the
 *  player knows at a glance "how much of each tier I've collected". */
export function countOwnedByRarity(collection: readonly string[], pool: readonly CardId[]) {
  const counts: Record<CardRarity, { owned: number; total: number }> = {
    common: { owned: 0, total: 0 },
    rare: { owned: 0, total: 0 },
    epic: { owned: 0, total: 0 },
    legendary: { owned: 0, total: 0 },
  };
  for (const id of pool) {
    const r = CARDS[id].rarity;
    counts[r].total += 1;
    if (collection.includes(id)) counts[r].owned += 1;
  }
  return counts;
}

export interface CollectionFilterArgs {
  searchQuery: string;
  mode: DeckMode;
  rarityFilter: CardRarity | "all";
  ownedOnly: boolean;
  inDeckOnly: boolean;
  passiveOnly: boolean;
  voieFilter: VoieFilter;
  arenaAffinity: Move | null | undefined;
  collection: readonly string[];
  usedInDeck: ReadonlySet<CardId | null>;
  t: (key: string) => string;
}

/** Filtered + grouped collection. Grouping is by mana cost within the
 *  active rarity filter — gives the player a natural curve view inside
 *  each tab without forcing them to scan a flat 46-card grid. */
export function groupCollectionByMana({
  searchQuery, mode, rarityFilter, ownedOnly, inDeckOnly, passiveOnly,
  voieFilter, arenaAffinity, collection, usedInDeck, t,
}: CollectionFilterArgs): { cost: number; ids: CardId[] }[] {
  const q = searchQuery.trim().toLowerCase();
  const filtered = deckPool(mode).filter((id) => {
    const card = CARDS[id];
    if (rarityFilter !== "all" && card.rarity !== rarityFilter) return false;
    if (ownedOnly && !collection.includes(id)) return false;
    if (inDeckOnly && !usedInDeck.has(id)) return false;
    if (passiveOnly && !isPassiveCard(id)) return false;
    // VOIE (arène) : masque les cartes d'une AUTRE Voie ; garde tes signatures
    // (voie===affinity) + les neutres (voie absente).
    if (mode === "arena") {
      const cv = card.voie;
      if (voieFilter === "myvoie") {
        if (arenaAffinity && cv !== undefined && cv !== arenaAffinity) return false;
      } else if (voieFilter === "neutral") {
        if (cv !== undefined) return false;
      } else if (voieFilter !== "all") {
        if (cv !== voieFilter) return false;
      }
    }
    if (q) {
      const name = t(card.nameKey).toLowerCase();
      if (!name.includes(q) && !id.toLowerCase().includes(q)) return false;
    }
    return true;
  });
  // Group by mana cost (1/2/3/4) so the player sees their curve.
  const groups: Record<number, CardId[]> = {};
  for (const id of filtered) {
    const cost = CARDS[id].cost;
    (groups[cost] ??= []).push(id);
  }
  // Within each cost bucket: rarity asc, then alphabetical name — the
  // resulting order matches how a deck-builder mentally scans cards.
  for (const cost of Object.keys(groups)) {
    groups[+cost].sort((a, b) => {
      const ra = RARITY_ORDER.indexOf(CARDS[a].rarity);
      const rb = RARITY_ORDER.indexOf(CARDS[b].rarity);
      if (ra !== rb) return ra - rb;
      return t(CARDS[a].nameKey).localeCompare(t(CARDS[b].nameKey));
    });
  }
  return [1, 2, 3, 4]
    .filter((c) => groups[c]?.length)
    .map((c) => ({ cost: c, ids: groups[c] }));
}
