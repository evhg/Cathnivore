// Plan item 193: the week's big valley. Every week's board for a year is solvable (its solution waters every cell
// with no leak), 2-3 times the daily's size, and its par within a set range; the week's board is the same all week.
import { describe, expect, it } from "vitest";
import { computeFlow, dailyPuzzle, sundayOf, sundayPuzzle, tapsToSolve } from "../games/runnel/src/engine";

describe("Runnel's Sunday big valley", () => {
  it("is solvable every week for a year, 2-3x the daily, par in range", () => {
    const start = new Date("2026-11-08T00:00:00Z");
    const daily = dailyPuzzle("2026-11-08").cells.length;
    for (let w = 0; w < 52; w++) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + w * 7);
      const day = d.toISOString().slice(0, 10);
      const p = sundayPuzzle(day);
      expect(p.cells.length / daily).toBeGreaterThanOrEqual(2);
      expect(p.cells.length / daily).toBeLessThanOrEqual(3);
      // About three times a daily's par (68 on a Sunday daily), never a slog past 260 taps.
      expect(p.par).toBeGreaterThanOrEqual(150);
      expect(p.par).toBeLessThanOrEqual(260);
      for (const c of p.cells) c.rot = (c.rot + tapsToSolve(c)) % 6;
      expect(computeFlow(p.cells).solved, day).toBe(true);
    }
  });
  it("is the same board all week", () => {
    expect(sundayOf("2026-11-06")).toBe("2026-11-01");
    expect(sundayOf("2026-11-08")).toBe("2026-11-08");
    expect(sundayPuzzle("2026-11-02").cells.map((c) => c.rot)).toEqual(sundayPuzzle("2026-11-07").cells.map((c) => c.rot));
  });
});
