// Plan item 202: Hedgerow 2D's margin placer: seeded, inside its rects, clear of keep-outs and of each other, and
// never two identical pieces within 200 px.
import { describe, expect, it } from "vitest";
import { MARGIN_SETS, SAME_GAP, placeMargin } from "../games/hedgerow/src/margins";

const set = MARGIN_SETS[2]!;
const cases = [
  { rects: [{ x: 1060, y: 0, w: 230, h: 900 }], cell: 64 },
  { rects: [{ x: 0, y: 0, w: 260, h: 900 }, { x: 1180, y: 0, w: 260, h: 900 }], cell: 58 },
  { rects: [{ x: 0, y: 0, w: 390, h: 120 }, { x: 0, y: 700, w: 390, h: 144 }], cell: 38 },
];

describe("hedgerow 2D margins", () => {
  it("Saltmarsh has a set with salt pans, huts, gulls and a boardwalk", () => {
    expect(set.name).toBe("saltmarsh");
    expect(set.pieces.map((p) => p.kind)).toEqual(expect.arrayContaining(["saltpan", "hut", "gulls"]));
    expect(set.boardwalk).toBe(true);
  });
  for (const [i, c] of cases.entries())
    for (const seed of [1, 7, 2025, 99991]) {
      it(`case ${i} seed ${seed}: no repeat within ${SAME_GAP} px, inside, no overlaps`, () => {
        const keep = [{ x: c.rects[0]!.x + 40, y: 0, w: 27, h: 900 }];
        const out = placeMargin(set, c.rects, c.cell, seed, keep);
        expect(placeMargin(set, c.rects, c.cell, seed, keep)).toEqual(out);
        for (const p of out) {
          expect(c.rects.some((r) => p.x - p.w / 2 >= r.x - 0.01 && p.x + p.w / 2 <= r.x + r.w + 0.01 && p.y - p.h / 2 >= r.y - 0.01 && p.y + p.h / 2 <= r.y + r.h + 0.01)).toBe(true);
          for (const k of keep) expect(p.x + p.w / 2 <= k.x || p.x - p.w / 2 >= k.x + k.w || p.y + p.h / 2 <= k.y || p.y - p.h / 2 >= k.y + k.h).toBe(true);
        }
        for (let a = 0; a < out.length; a++)
          for (let b = a + 1; b < out.length; b++) {
            const A = out[a]!;
            const B = out[b]!;
            if (A.kind === B.kind) expect(Math.hypot(A.x - B.x, A.y - B.y)).toBeGreaterThanOrEqual(SAME_GAP);
            const apart = Math.abs(A.x - B.x) >= (A.w + B.w) / 2 || Math.abs(A.y - B.y) >= (A.h + B.h) / 2;
            expect(apart).toBe(true);
          }
      });
    }
  it("Highmoor and Rivermead have their own sets (moor and water meadow, punts on the river)", () => {
    expect(MARGIN_SETS[1]!.ground).toBe("moor");
    expect(MARGIN_SETS[1]!.pieces.map((p) => p.kind)).toEqual(expect.arrayContaining(["tor", "flock"]));
    expect(MARGIN_SETS[3]!.ground).toBe("meadow");
    expect(MARGIN_SETS[3]!.pieces.map((p) => p.kind)).toContain("mill");
    expect(MARGIN_SETS[3]!.water?.map((p) => p.kind)).toContain("punt");
  });
  for (const act of [1, 3])
    it(`act ${act}'s set keeps the same spacing rules`, () => {
      const out = placeMargin(MARGIN_SETS[act]!, cases[1]!.rects, 58, 11);
      expect(out.length).toBeGreaterThan(3);
      for (let a = 0; a < out.length; a++)
        for (let b = a + 1; b < out.length; b++)
          if (out[a]!.kind === out[b]!.kind) expect(Math.hypot(out[a]!.x - out[b]!.x, out[a]!.y - out[b]!.y)).toBeGreaterThanOrEqual(SAME_GAP);
    });
  it("a wide side margin gets several kinds of piece", () => {
    const out = placeMargin(set, cases[1]!.rects, 58, 3);
    expect(new Set(out.map((p) => p.kind)).size).toBeGreaterThanOrEqual(3);
  });
});
