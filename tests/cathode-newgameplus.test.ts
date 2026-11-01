import { describe, expect, it } from "vitest"
import { canStartNewGamePlus, ngPlusEliteBonus, ngPlusLap, startNewGamePlus } from "../games/cathode/src/sim/newgameplus"

describe("New Game+", () => {
  it("needs the act 5 boss down", () => {
    expect(canStartNewGamePlus(["fishMarket"])).toBe(false)
    expect(canStartNewGamePlus(["fishMarket", "vaultBoss"])).toBe(true)
  })
  it("keeps unlock flags, clears the story and counts laps", () => {
    const one = startNewGamePlus(["fishMarket", "vaultBoss", "hardboiledOpen", "secret:a", "look:b"])
    expect(one).toEqual(["hardboiledOpen", "ngPlus1"])
    expect(ngPlusLap(one)).toBe(1)
    const two = startNewGamePlus([...one, "vaultBoss"])
    expect(two).toEqual(["hardboiledOpen", "ngPlus2"])
    expect(ngPlusLap(two)).toBe(2)
  })
  it("caps the elite bonus", () => {
    expect(ngPlusEliteBonus(0)).toBe(0)
    expect(ngPlusEliteBonus(1)).toBeCloseTo(0.08)
    expect(ngPlusEliteBonus(9)).toBe(0.2)
  })
})

import { activeMods, MOD_EFFECTS, scoreMultiplier, startSecondBroadcast } from "../games/cathode/src/sim/newgameplus"
describe("Second Broadcast deck", () => {
  it("stores up to three mods as flags and ignores unknown ids", () => {
    const j = startSecondBroadcast(["vaultBoss", "hardboiledOpen"], ["glass", "fog", "elites", "noregen", "bogus"])
    expect(activeMods(j)).toEqual(["glass", "noregen", "elites"])
    expect(j).toContain("ngPlus1")
  })
  it("scores more for harder decks and 1 outside New Game+", () => {
    expect(scoreMultiplier(["fishMarket"])).toBe(1)
    expect(scoreMultiplier(startSecondBroadcast(["vaultBoss"], []))).toBe(1)
    expect(scoreMultiplier(startSecondBroadcast(["vaultBoss"], ["glass", "noregen"]))).toBe(1.9)
  })
  it("applies effects", () => {
    expect(MOD_EFFECTS.damageTaken(["glass"])).toBe(1.6)
    expect(MOD_EFFECTS.damageTaken([])).toBe(1)
    expect(MOD_EFFECTS.eliteChance(["elites"])).toBeGreaterThan(0)
  })
})

import { broadcastLadder as _ladder } from "../games/cathode/src/sim/newgameplus";
import { it as _it, expect as _expect } from "vitest";
_it("broadcast ladder has one rung per lap, newest current", () => {
  _expect(_ladder([])).toEqual([]);
  const r = _ladder(["ngPlus2", "mod:glass"]);
  _expect(r.map((x) => x.lap)).toEqual([1, 2]);
  _expect(r[1]?.current).toBe(true);
  _expect(r[1]?.mult).toBeGreaterThan(r[0]?.mult ?? 99);
});
