// Plan item 52: plots by what lies under them, deterministic per level; item 345: fields along the rows.
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

  // Plan item 345: a run of plots along a row is one field (one base look); the field above it is another crop
  // where they touch, so the farm reads as strips, not a chequerboard.
  it("run as one field along a row, and differ from the field above on 60%+ of shared edges", () => {
    const flat = (l: string | undefined) => (l === "puddle" ? "earth" : l);
    for (const level of LEVELS) {
      const looks = plotLooks(level);
      let edges = 0;
      let differ = 0;
      for (const [k, look] of looks) {
        const [c, r] = k.split(",").map(Number) as [number, number];
        const right = looks.get(`${c + 1},${r}`);
        if (right) expect(flat(right), `level ${level.id} ${k}`).toBe(flat(look));
        const below = looks.get(`${c},${r + 1}`);
        if (below) { edges++; if (flat(below) !== flat(look)) differ++; }
      }
      if (edges >= 5) expect(differ / edges, `level ${level.id}`).toBeGreaterThanOrEqual(0.6);
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
