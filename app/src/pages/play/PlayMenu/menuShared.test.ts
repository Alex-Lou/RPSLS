import { describe, expect, it } from "vitest";
import { ALL_CARDS, isWideTile, menuCards } from "./menuShared";

describe("menuCards", () => {
  it("lists the five accessible modes in menu order when Constellation Pro is off", () => {
    expect(menuCards(false)).toEqual(["training", "online", "ranked", "constellation", "ranked_constellation"]);
  });

  it("appends Constellation Pro last when it is on", () => {
    const cards = menuCards(true);
    expect(cards).toHaveLength(6);
    expect(cards[cards.length - 1]).toBe("arena_pro");
  });

  it("hides Constellation Pro from the live menu while it is on standby", () => {
    expect(ALL_CARDS).not.toContain("arena_pro");
  });
});

describe("isWideTile", () => {
  it("widens only the last tile of an odd count", () => {
    expect(isWideTile(4, 5)).toBe(true);
    expect(isWideTile(3, 5)).toBe(false);
  });

  it("never widens a tile of an even count", () => {
    expect(isWideTile(5, 6)).toBe(false);
  });
});
