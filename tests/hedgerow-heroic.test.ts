import { describe, expect, it } from "vitest";
import { newGame, throwPie, NO_PERKS } from "../games/hedgerow/src/engine";
import { LEVELS } from "../games/hedgerow/src/levels";
import { newRosettes } from "../games/hedgerow/src/rosettes";
import { emptySave, parseSave, recordHeroic } from "../games/hedgerow/src/store";

describe("heroic runs", () => {
  it("start with one Goodwill and no pies, whatever the perks", () => {
    const lv = LEVELS[19]!;
    const g = newGame(lv, { ...NO_PERKS, goodwill: 5 }, { hero: true, abilities: true }, true);
    expect(g.goodwill).toBe(1);
    expect(g.maxGoodwill).toBe(1);
    g.phase = "wave";
    expect(throwPie(g).ok).toBe(false);
    expect(newGame(lv).heroic).toBe(false);
  });
  it("save and rosette", () => {
    const d = emptySave();
    recordHeroic(d, 3);
    expect(parseSave(JSON.stringify(d)).heroic).toEqual({ "3": true });
    expect(parseSave(JSON.stringify({ heroic: { x: 1 } })).heroic).toBeUndefined();
    const s = { levelId: 3, won: true, stars: 3, kept: 1, heroKills: 0, earlyCalls: 0, towerKinds: 1, towers: 3, perkRanks: 0, heroic: true };
    expect(newRosettes(s, d)).toContain("heroic");
  });
});
