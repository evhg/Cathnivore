import { describe, expect, it } from "vitest";
import { ROSETTES, newRosettes, type LevelSummary } from "../games/hedgerow/src/rosettes";
import { emptySave, parseSave } from "../games/hedgerow/src/store";

const win: LevelSummary = { levelId: 1, won: true, stars: 3, kept: 1, heroKills: 0, earlyCalls: 0, towerKinds: 1, towers: 3, perkRanks: 0 };

describe("rosettes", () => {
  it("has unique ids", () => {
    expect(new Set(ROSETTES.map((r) => r.id)).size).toBe(ROSETTES.length);
  });
  it("awards first and flawless on a clean first win, and nothing on a loss", () => {
    const d = emptySave();
    d.stars["1"] = 3;
    expect(newRosettes(win, d).sort()).toEqual(["first", "flawless"]);
    expect(newRosettes({ ...win, won: false }, d)).toEqual([]);
  });
  it("never re-awards", () => {
    const d = emptySave();
    d.stars["1"] = 3;
    d.rosettes = { first: true, flawless: true };
    expect(newRosettes(win, d)).toEqual([]);
  });
  it("counts clears", () => {
    const d = emptySave();
    for (let i = 1; i <= 10; i++) d.stars[String(i)] = 1;
    expect(newRosettes({ ...win, stars: 1, kept: 0.6 }, d)).toContain("ten");
  });
  it("round-trips through the save and drops junk", () => {
    const d = parseSave(JSON.stringify({ version: 2, rosettes: { first: true, bad: "x" } }));
    expect(d.rosettes).toEqual({ first: true });
  });
});
