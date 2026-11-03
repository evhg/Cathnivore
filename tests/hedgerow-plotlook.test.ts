// Plan item 52: plots by what lies under them, deterministic per level, neighbours differ.
import { describe, expect, it } from "vitest";
import { LEVELS } from "../games/hedgerow/src/levels";
import { plotLooks } from "../games/hedgerow/src/plotlook";

describe("plot looks", () => {
  it("are the same every time for a level", () => {
    for (const level of LEVELS.slice(0, 20)) {
      const a = [...plotLooks(level)];
      const b = [...plotLooks({ ...level })];
      expect(b).toEqual(a);
    }
  });

  it("differ from an orthogonal neighbour on at least 60% of every level's plots", () => {
    for (const level of LEVELS) {
      const looks = plotLooks(level);
      let shared = 0;
      for (const [k, look] of looks) {
        const [c, r] = k.split(",").map(Number) as [number, number];
        const ns = [`${c + 1},${r}`, `${c - 1},${r}`, `${c},${r + 1}`, `${c},${r - 1}`];
        if (ns.some((n) => looks.get(n) === look)) shared++;
      }
      expect(shared / Math.max(1, looks.size), `level ${level.id}`).toBeLessThanOrEqual(0.4);
    }
  });

  it("use every look somewhere, and each base look on a big field", () => {
    const all = new Set<string>();
    for (const level of LEVELS) {
      const looks = plotLooks(level);
      for (const l of looks.values()) all.add(l);
      if (looks.size >= 20) {
        const kinds = new Set(looks.values());
        for (const l of ["earth", "stubble", "clover"]) expect(kinds.has(l as never), `level ${level.id}`).toBe(true);
      }
    }
    expect([...all].sort()).toEqual(["clover", "earth", "puddle", "stubble"]);
  });
});
