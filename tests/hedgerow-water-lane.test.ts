import { describe, expect, it } from "vitest";
import { LEVELS } from "../games/hedgerow/src/levels";
import { laneCellsOf, setPiece } from "../games/hedgerow/src/engine";

// Plan item 94: no water is drawn over the lane. Ponds and the flood lie on plots only; where the lane itself
// crosses water it is a ford (drawn as water with stepping stones) or the swing bridge.
describe("Hedgerow water and the lane", () => {
  it("no pond or flood cell is a lane tile, over all 100 levels", () => {
    const bad: string[] = [];
    for (const lv of LEVELS) {
      const lane = laneCellsOf(lv);
      for (const [c, r] of lv.terrain?.water ?? []) if (lane.has(`${c},${r}`)) bad.push(`${lv.id} pond ${c},${r}`);
      for (const [c, r] of setPiece(lv, "flood")?.cells ?? []) if (lane.has(`${c},${r}`)) bad.push(`${lv.id} flood ${c},${r}`);
    }
    expect(bad).toEqual([]);
  });
  it("every ford is a forward stretch of the lane", () => {
    for (const lv of LEVELS)
      for (const f of lv.fords ?? []) {
        expect(f.from).toBeGreaterThanOrEqual(0);
        expect(f.to).toBeGreaterThan(f.from);
      }
  });
});
