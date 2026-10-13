// Hedgerow 2 M9: difficulties, Hollow's rules and medals (docs/design/hedgerow-2.md section 9).
import { describe, expect, it } from "vitest";
import { LEVELS } from "../games/hedgerow/src/levels";
import { isFleet, isPlot, newGame, place, sell, towerCost } from "../games/hedgerow/src/engine";
import { emptySave, medalsOf, recordMedal } from "../games/hedgerow/src/store";

const fleet = LEVELS.find((l) => isFleet(l) && !l.endless)!;
const classic = LEVELS.find((l) => !isFleet(l) && !l.endless)!;

describe("difficulty rules", () => {
  it("Easy, Normal and Hard set Goodwill and tower prices on Fleet levels", () => {
    const e = newGame(fleet, undefined, {}, false, "easy");
    const n = newGame(fleet);
    const h = newGame(fleet, undefined, {}, false, "hard");
    expect([e.goodwill, n.goodwill, h.goodwill]).toEqual([200, 120, 80]);
    expect(towerCost(e, "scarecrow")).toBeLessThan(towerCost(n, "scarecrow"));
    expect(towerCost(h, "scarecrow")).toBeGreaterThan(towerCost(n, "scarecrow"));
  });
  it("classic levels ignore the difficulty", () => {
    const g = newGame(classic, undefined, {}, false, "hard");
    expect(g.difficulty).toBe("normal");
    expect(g.goodwill).toBe(newGame(classic).goodwill);
  });
  it("Hollow has one Goodwill and bars selling", () => {
    const g = newGame(fleet, undefined, {}, true);
    expect(g.goodwill).toBe(1);
    g.marks = 9999;
    let spot: [number, number] | null = null;
    for (let r = 0; r < fleet.rows && !spot; r++) for (let c = 0; c < fleet.cols && !spot; c++) if (isPlot(fleet, c, r)) spot = [c, r];
    expect(place(g, "scarecrow", spot![0], spot![1]).ok).toBe(true);
    expect(sell(g, g.towers[0]!.id).ok).toBe(false);
    expect(g.towers).toHaveLength(1);
  });
});

describe("medals", () => {
  it("record once, and old stars and Heroic migrate", () => {
    const d = emptySave();
    expect(recordMedal(d, 3, "hard")).toBe(true);
    expect(recordMedal(d, 3, "hard")).toBe(false);
    expect(medalsOf(d, 3)).toEqual(["hard"]);
    d.stars["4"] = 3;
    d.heroic = { "4": true };
    expect(medalsOf(d, 4)).toEqual(["easy", "normal", "hollow"]);
    d.stars["5"] = 2;
    expect(medalsOf(d, 5)).toEqual(["easy"]);
  });
});
