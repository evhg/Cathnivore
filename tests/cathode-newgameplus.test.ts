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
