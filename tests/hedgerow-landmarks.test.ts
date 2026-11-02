// Plan item 43: every Hedgerow level is a place. Each field has a landmark from its act's library on cells of its
// own, and no two fields of one act share more than 70% of their plots.
import { describe, expect, it } from "vitest";
import { LEVELS } from "../games/hedgerow/src/levels";
import { isPlot, landmarkAt, landmarks, laneCellsOf, newGame, place, plotKind } from "../games/hedgerow/src/engine";
import { LANDMARKS, landmarkKinds } from "../games/hedgerow/src/landmarks";

const plots = (lv: (typeof LEVELS)[number]) => {
  const s = new Set<string>();
  for (let c = 0; c < lv.cols; c++) for (let r = 0; r < lv.rows; r++) if (isPlot(lv, c, r)) s.add(`${c},${r}`);
  return s;
};
const jaccard = (a: Set<string>, b: Set<string>) => {
  let i = 0;
  for (const x of a) if (b.has(x)) i++;
  return i / (a.size + b.size - i);
};

describe("hedgerow landmarks", () => {
  it("every level has a landmark, and boss fields two", () => {
    for (const lv of LEVELS) {
      const ms = landmarks(lv);
      expect(ms.length, `level ${lv.id}`).toBeGreaterThanOrEqual(1);
      if (lv.id % 10 === 0) expect(ms.length, `level ${lv.id}`).toBe(2);
      expect(ms.map((m) => m.type)).toEqual(landmarkKinds(lv));
    }
  });

  it("uses most of the library, and neighbouring levels differ", () => {
    const kinds = new Set(LEVELS.flatMap((l) => landmarks(l).map((m) => m.type)));
    expect(kinds.size).toBe(Object.keys(LANDMARKS).length);
    for (let i = 1; i < LEVELS.length; i++) expect(landmarks(LEVELS[i]!)[0]!.type).not.toBe(landmarks(LEVELS[i - 1]!)[0]!.type);
  });

  it("within an act, no two levels share more than 70% of their plots", () => {
    for (let act = 1; act <= 10; act++) {
      const ls = LEVELS.filter((l) => Math.ceil(l.id / 10) === act);
      const sets = ls.map(plots);
      for (let i = 0; i < ls.length; i++)
        for (let j = i + 1; j < ls.length; j++) expect(jaccard(sets[i]!, sets[j]!), `${ls[i]!.id}~${ls[j]!.id}`).toBeLessThanOrEqual(0.7);
    }
  });

  it("stand off the lane, clear of each other, and leave three quarters of the field to build on", () => {
    for (const lv of LEVELS) {
      const lane = laneCellsOf(lv);
      const seen = new Set<string>();
      let scenery = 0;
      for (const m of landmarks(lv))
        for (const [c, r] of m.cells) {
          expect(lane.has(`${c},${r}`), `level ${lv.id}`).toBe(false);
          expect(seen.has(`${c},${r}`)).toBe(false);
          seen.add(`${c},${r}`);
          if (m.type !== "bank") scenery++;
        }
      const open = lv.cols * lv.rows - lane.size;
      expect(scenery + (lv.barns?.length ?? 0)).toBeLessThanOrEqual(open * 0.25);
    }
  });

  it("scenery can't be built on; a raised bank is high ground", () => {
    const lv = LEVELS.find((l) => landmarks(l).some((m) => m.type === "churchyard"))!;
    const [c, r] = landmarks(lv).find((m) => m.type === "churchyard")!.cells[0]!;
    expect(isPlot(lv, c, r)).toBe(false);
    expect(landmarkAt(lv, c, r)?.type).toBe("churchyard");
    const g = newGame(lv);
    g.marks = 100000;
    expect(place(g, "scarecrow", c, r).ok).toBe(false);
    const bank = LEVELS.find((l) => landmarks(l).some((m) => m.type === "bank"))!;
    for (const [bc, br] of landmarks(bank).find((m) => m.type === "bank")!.cells) {
      expect(isPlot(bank, bc, br)).toBe(true);
      expect(plotKind(bank, bc, br)).toBe("high");
    }
  });
});
