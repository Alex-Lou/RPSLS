import { describe, expect, it } from "vitest";
import { QUESTS, questsFor } from "./quests";

const ARENA_QUEST_IDS = ["arena-initiate", "arena-champion"];
const ids = (enabled: boolean) => questsFor(enabled).map((q) => q.id);

describe("questsFor", () => {
  it("leaves out the Constellation Pro quests when the mode is off", () => {
    for (const id of ARENA_QUEST_IDS) expect(ids(false)).not.toContain(id);
  });

  it("adds exactly the Constellation Pro quests when the mode is on", () => {
    expect(ids(true)).toEqual([...ids(false), ...ARENA_QUEST_IDS]);
  });

  it("keeps quest ids unique", () => {
    expect(new Set(ids(true)).size).toBe(ids(true).length);
  });
});

describe("QUESTS", () => {
  it("offers no Constellation Pro quest while the mode is on standby", () => {
    expect(QUESTS.map((q) => q.id)).toEqual(ids(false));
  });
});
