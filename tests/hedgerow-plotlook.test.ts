// Plan item 52: plots by what lies under them, deterministic per level; item 345: fields along the rows.
import { describe, expect, it } from "vitest";
import { LEVELS } from "../games/hedgerow/src/levels";
import { PLOT_STITCH, PLOT_STITCH_UNDER, fieldAt, plotLooks, sameField } from "../games/hedgerow/src/plotlook";

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
  it("run as one field along a row, and differ from the next field above on 60%+ of shared edges", () => {
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
        if (below && !sameField(level, c, r, c, r + 1)) { edges++; if (flat(below) !== flat(look)) differ++; }
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

  // Plan item 345's measure: every plot used to paint its own rimmed bed; a field (a block up to three rows deep,
  // counted at its top-left plot) is one bed now, so the edges drawn
  // outside build mode (one rim per field) drop by 60%+ on the critique's levels, and on the farm as a whole.
  it("draw 60%+ fewer bed rims than plots (one per field)", () => {
    let plotsAll = 0;
    let rimsAll = 0;
    for (const level of LEVELS) {
      const looks = plotLooks(level);
      let rims = 0;
      for (const k of looks.keys()) {
        const [c, r] = k.split(",").map(Number) as [number, number];
        if (!sameField(level, c - 1, r, c, r) && !sameField(level, c, r - 1, c, r)) rims++;
      }
      plotsAll += looks.size;
      rimsAll += rims;
      if (level.id === 21 || level.id === 34) expect(rims / looks.size, `level ${level.id}`).toBeLessThanOrEqual(0.4);
    }
    expect(rimsAll / plotsAll).toBeLessThanOrEqual(0.4);
  });
});

describe("fields", () => {
  it("are blocks: every plot of a field lies in its box, a field is at most 3 rows deep, and all its plots share a look", () => {
    const flat = (l: string | undefined) => (l === "puddle" ? "earth" : l);
    for (const level of LEVELS) {
      const looks = plotLooks(level);
      for (const [k, look] of looks) {
        const [c, r] = k.split(",").map(Number) as [number, number];
        const f = fieldAt(level, c, r)!;
        expect(c >= f.c0 && c <= f.c1 && r >= f.r0 && r <= f.r1, `level ${level.id} ${k}`).toBe(true);
        expect(f.r1 - f.r0).toBeLessThan(3);
        expect(flat(looks.get(`${f.c0},${f.r0}`))).toBe(flat(look));
        for (let fr = f.r0; fr <= f.r1; fr++) for (let fc = f.c0; fc <= f.c1; fc++) expect(looks.has(`${fc},${fr}`)).toBe(true);
      }
    }
  });
});

// Plan item 345: in build mode every free plot shows a stitched outline at 3:1+ against what's under it: the cream
// stitch against its own dark under-stroke laid over the palest bed (stubble's straw, taken as opaque: the worst case).
describe("build-mode outline", () => {
  const rgba = (c: string) => c.match(/[\d.]+/g)!.map(Number) as [number, number, number, number];
  const over = (top: [number, number, number, number], bed: number[]) => bed.map((v, i) => top[i]! * top[3] + v * (1 - top[3]));
  const lum = (c: number[]) => {
    const [r, g, b] = c.map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number]; return (x + 0.05) / (y + 0.05); };
  it("stands 3:1+ against its under-stroke on the palest and the darkest beds", () => {
    for (const bed of [[232, 204, 130], [70, 120, 50], [96, 66, 36]]) {
      const under = over(rgba(PLOT_STITCH_UNDER), bed);
      const stitch = over(rgba(PLOT_STITCH), under);
      expect(ratio(stitch, under), bed.join(",")).toBeGreaterThanOrEqual(3);
    }
  });
});
