// Plan item 66: the 3D field's verge scatter (sheep, pines, flower clumps, a scarecrow) is the same every time a
// level loads, and never lands on a plot, the lane or the sea.
import { describe, expect, it } from "vitest";
import { LEVELS } from "../games/hedgerow/src/levels";
import { inSea, laneDistance, vergeScatter } from "../games/hedgerow/src/render3d/verge";

describe("verge scatter", () => {
  it("is deterministic per level", () => {
    for (const level of LEVELS) expect(vergeScatter({ ...level })).toEqual(vergeScatter(level));
  });

  it("never lands on a plot, the lane or the sea", () => {
    for (const level of LEVELS) {
      for (const it of vergeScatter(level)) {
        const inGrid = it.x > -0.5 && it.x < level.cols + 0.5 && it.y > -0.5 && it.y < level.rows + 0.5;
        expect(inGrid, `level ${level.id} ${it.kind} at ${it.x.toFixed(2)},${it.y.toFixed(2)}`).toBe(false);
        expect(laneDistance(level, it.x, it.y)).toBeGreaterThanOrEqual(0.8);
        expect(inSea(level, it.x, it.y)).toBe(false);
        // Nothing tall stands between the camera and the field.
        if (it.kind === "pine" || it.kind === "scarecrow") expect(it.y).toBeLessThan(level.rows);
      }
    }
  });

  it("dresses the farmland acts with a flock, pines and flowers", () => {
    for (const id of [1, 12, 30]) {
      const kinds = vergeScatter(LEVELS.find((l) => l.id === id)!).map((i) => i.kind);
      expect(kinds.filter((k) => k === "flowers").length).toBeGreaterThanOrEqual(10);
      expect(kinds).toContain("sheep");
    }
  });
});
