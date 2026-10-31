import { describe, expect, it } from "vitest";
import { ALL_CARD_IDS } from "./cards";
import { PRO_CARDS } from "./cardCatalog/proCards";
import { isRankedDeckable } from "./rankedPool";
import type { CardId } from "./rankedTypes";

const ENGINE_SOURCE = Object.values(
  import.meta.glob<string>(
    ["./rankedRules.ts", "./rankedAI.ts", "./RankedPickPhase.tsx", "./RankedRevealPhase.tsx", "./RankedGame/*.{ts,tsx}"],
    { query: "?raw", import: "default", eager: true },
  ),
).join("\n");

const implementedInRanked = (id: CardId) => ENGINE_SOURCE.includes(`"${id}"`);

describe("isRankedDeckable", () => {
  it("rejects every Constellation Pro card", () => {
    for (const id of Object.keys(PRO_CARDS) as CardId[]) expect(isRankedDeckable(id), id).toBe(false);
  });

  // Les deux sens verrouillent la liste : une carte qui reçoit un effet Classé
  // doit devenir équipable, une carte sans effet Classé doit rester masquée.
  it("offers exactly the cards the Classée engine implements", () => {
    for (const id of ALL_CARD_IDS) expect(isRankedDeckable(id), id).toBe(implementedInRanked(id));
  });

  it("keeps a playable pool", () => {
    expect(ALL_CARD_IDS.filter(isRankedDeckable).length).toBeGreaterThanOrEqual(40);
  });
});
