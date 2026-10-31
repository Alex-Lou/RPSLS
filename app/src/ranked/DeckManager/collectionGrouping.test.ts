import { describe, expect, it } from "vitest";
import { isDeckable } from "../../arena/arenaDecks";
import { ALL_CARD_IDS } from "../cards";
import { isRankedDeckable } from "../rankedPool";
import { countOwnedByRarity, deckPool, groupCollectionByMana, type DeckMode } from "./collectionGrouping";

function shownIds(mode: DeckMode) {
  return groupCollectionByMana({
    searchQuery: "",
    mode,
    rarityFilter: "all",
    ownedOnly: false,
    inDeckOnly: false,
    passiveOnly: false,
    voieFilter: "all",
    arenaAffinity: null,
    collection: ALL_CARD_IDS,
    usedInDeck: new Set(),
    t: (key) => key,
  }).flatMap((g) => g.ids);
}

describe("deckPool", () => {
  it("offers the Classée deck only the cards its engine implements", () => {
    expect(deckPool("ranked")).toEqual(ALL_CARD_IDS.filter(isRankedDeckable));
  });

  it("offers the Arena deck its own deckable pool", () => {
    expect(deckPool("arena")).toEqual(ALL_CARD_IDS.filter((id) => isDeckable(id)));
  });
});

describe("groupCollectionByMana", () => {
  it.each<DeckMode>(["ranked", "arena"])("shows exactly the %s pool when no filter is set", (mode) => {
    expect([...shownIds(mode)].sort()).toEqual([...deckPool(mode)].sort());
  });

  it("groups by ascending mana cost", () => {
    const costs = groupCollectionByMana({
      searchQuery: "", mode: "ranked", rarityFilter: "all", ownedOnly: false, inDeckOnly: false,
      passiveOnly: false, voieFilter: "all", arenaAffinity: null, collection: [], usedInDeck: new Set(),
      t: (key) => key,
    }).map((g) => g.cost);
    expect(costs).toEqual([...costs].sort((a, b) => a - b));
  });
});

describe("countOwnedByRarity", () => {
  it("counts only the cards of the given pool", () => {
    const pool = deckPool("ranked");
    const counts = countOwnedByRarity(ALL_CARD_IDS, pool);
    const total = Object.values(counts).reduce((sum, c) => sum + c.total, 0);
    const owned = Object.values(counts).reduce((sum, c) => sum + c.owned, 0);
    expect(total).toBe(pool.length);
    expect(owned).toBe(pool.length);
  });

  it("reports nothing owned for an empty collection", () => {
    const counts = countOwnedByRarity([], deckPool("ranked"));
    for (const c of Object.values(counts)) expect(c.owned).toBe(0);
  });
});
