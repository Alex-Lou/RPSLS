import { describe, expect, it } from "vitest";
import { levelFromXp, xpForNextLevel } from "./leveling";

describe("xpForNextLevel", () => {
  it("grows linearly: 80 + 90 per level", () => {
    expect(xpForNextLevel(0)).toBe(80);
    expect(xpForNextLevel(1)).toBe(170);
    expect(xpForNextLevel(10)).toBe(980);
  });
});

describe("levelFromXp", () => {
  it("starts at level 0 with no progress", () => {
    expect(levelFromXp(0)).toEqual({ level: 0, xpInLevel: 0, xpForNext: 80, progress: 0 });
  });

  it("stays in the level until the threshold is reached", () => {
    const info = levelFromXp(79);
    expect(info.level).toBe(0);
    expect(info.xpInLevel).toBe(79);
    expect(info.progress).toBeCloseTo(79 / 80);
  });

  it("levels up exactly on the threshold", () => {
    expect(levelFromXp(80)).toEqual({ level: 1, xpInLevel: 0, xpForNext: 170, progress: 0 });
  });

  it("chains several levels and keeps the remainder", () => {
    const info = levelFromXp(80 + 170 + 260 + 5);
    expect(info.level).toBe(3);
    expect(info.xpInLevel).toBe(5);
    expect(info.xpForNext).toBe(350);
  });

  it("treats negative xp as level 0", () => {
    expect(levelFromXp(-50).level).toBe(0);
  });
});
