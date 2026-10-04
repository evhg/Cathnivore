import { describe, expect, it } from "vitest";
import { Progress } from "../games/cathode/src/game/progress";
import { ENFORCER } from "../games/cathode/src/game/enemy";

describe("elites in play", () => {
  it("an ordinary kit is not an elite", () => {
    const k = Progress.kit(ENFORCER, "enforcer", 5, 1);
    expect(k.elite).toBe(false);
    expect(k.mods).toEqual([]);
  });
  it("an elite has more health, a longer name and its modifiers", () => {
    const plain = Progress.kit(ENFORCER, "enforcer", 5, 1);
    const k = Progress.kit(ENFORCER, "enforcer", 5, 1, true);
    expect(k.elite).toBe(true);
    expect(k.mods!.length).toBeGreaterThan(0);
    expect(k.maxHp).toBeGreaterThan(plain.maxHp * 2);
    expect(k.name).not.toBe(plain.name);
  });
});
