import { describe, expect, it } from "vitest";
import { actFiveUnlock, unlockedDifficulties } from "../games/cathode/src/sim/difficulty";

describe("difficulty unlocks", () => {
  it("starts on Noir and opens the next tier after act 5", () => {
    expect(unlockedDifficulties([])).toEqual(["noir"]);
    expect(unlockedDifficulties(["hardboiledOpen"])).toEqual(["noir", "hardboiled"]);
    expect(unlockedDifficulties(["hardboiledOpen", "hellWeekOpen"])).toEqual(["noir", "hardboiled", "hellWeek"]);
  });
  it("act 5 on each tier earns the next flag", () => {
    expect(actFiveUnlock("noir")).toBe("hardboiledOpen");
    expect(actFiveUnlock("hardboiled")).toBe("hellWeekOpen");
    expect(actFiveUnlock("hellWeek")).toBeNull();
  });
});
