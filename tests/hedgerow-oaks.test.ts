// H12: fallen oaks block a plot until cleared for OAK_COST Marks.
import { describe, expect, it } from "vitest";
import { LEVELS } from "../games/hedgerow/src/levels";
import { OAK_COST, clearOak, isPlot, newGame, oakAt, place } from "../games/hedgerow/src/engine";
import { applyAction } from "../games/hedgerow/src/replay";

const lvl = LEVELS.find((l) => l.id === 8)!;

describe("fallen oaks", () => {
  it("sit on real plots of Fleet levels from level 5, never on level 1", () => {
    expect(LEVELS.find((l) => l.id === 1)!.oaks).toBeUndefined();
    expect(lvl.oaks?.length).toBe(1);
    for (const [c, r] of lvl.oaks!) expect(isPlot(lvl, c, r)).toBe(true);
    expect(LEVELS.find((l) => l.id === 25)!.oaks?.length).toBe(2);
  });
  it("block building until cleared, and clearing costs Marks", () => {
    const g = newGame(lvl);
    const [c, r] = lvl.oaks![0]!;
    g.marks = 100000;
    expect(place(g, "scarecrow", c, r).ok).toBe(false);
    const before = g.marks;
    expect(applyAction(g, { t: "clear", col: c, row: r }).ok).toBe(true);
    expect(g.marks).toBe(before - OAK_COST);
    expect(oakAt(g, c, r)).toBe(false);
    expect(place(g, "scarecrow", c, r).ok).toBe(true);
    expect(clearOak(g, c, r).ok).toBe(false);
  });
  it("cannot be cleared without the Marks", () => {
    const g = newGame(lvl);
    g.marks = OAK_COST - 1;
    const [c, r] = lvl.oaks![0]!;
    expect(clearOak(g, c, r).ok).toBe(false);
  });
});
