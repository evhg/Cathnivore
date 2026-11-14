// Plan item 202: Hedgerow 2D's margin placer: seeded, inside its rects, clear of keep-outs and of each other, and
// never two identical pieces within 200 px.
import { describe, expect, it } from "vitest";
import { LIVE_PIECES, MARGIN_SETS, SAME_GAP, placeMargin, withLooks } from "../games/hedgerow/src/margins";

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
  it("every act but Brindle Hills has its own set, with its own land", () => {
    const names = new Set<string>();
    const grounds = new Set<string>();
    for (let act = 1; act <= 9; act++) {
      const m = MARGIN_SETS[act];
      expect(m, `act ${act}`).toBeDefined();
      names.add(m!.name);
      grounds.add(m!.ground);
    }
    expect(names.size).toBe(9);
    expect(grounds.size).toBe(9);
    expect(MARGIN_SETS[0]).toBeUndefined();
  });
  for (const act of [4, 5, 6, 7, 8, 9])
    it(`act ${act}'s set: several kinds, no repeat within ${SAME_GAP} px, no overlaps`, () => {
      for (const seed of [3, 41, 977]) {
        const out = placeMargin(MARGIN_SETS[act]!, cases[1]!.rects, 58, seed);
        expect(new Set(out.map((p) => p.kind)).size).toBeGreaterThanOrEqual(3);
        for (let a = 0; a < out.length; a++)
          for (let b = a + 1; b < out.length; b++) {
            const A = out[a]!;
            const B = out[b]!;
            if (A.kind === B.kind) expect(Math.hypot(A.x - B.x, A.y - B.y)).toBeGreaterThanOrEqual(SAME_GAP);
            expect(Math.abs(A.x - B.x) >= (A.w + B.w) / 2 || Math.abs(A.y - B.y) >= (A.h + B.h) / 2).toBe(true);
          }
      }
    });
  it("each later act has at least one ambient loop", () => {
    for (const act of [4, 5, 6, 7, 8, 9]) expect(MARGIN_SETS[act]!.pieces.some((p) => LIVE_PIECES.has(p.kind)), `act ${act}`).toBe(true);
  });
});

// Plan item 224: Hollowell's adverts stand in the Ballot's and the Merger's margins, the pieces wide enough for
// the panel (about 2.3 of its scale), and the Saltmarsh keeps its salt pans.
describe("margin billboards", () => {
  it("the Ballot and the Merger carry billboards wide enough for their panels", () => {
    for (const act of [7, 8]) {
      const b = MARGIN_SETS[act]!.pieces.find((p) => p.kind === "billboard");
      expect(b, `act ${act + 1}`).toBeTruthy();
      expect(b!.w).toBeGreaterThanOrEqual(2.2);
    }
    expect(MARGIN_SETS[2]!.pieces.some((p) => p.kind === "saltpan")).toBe(true);
  });
  // Plan item 388: the same lollipop willow ran nine times down level 34's margin. No sprite drawn more than twice
  // with an identical transform (kind, size, flip, lean, tint), and what grows faces both ways.
  for (const [si, m] of Object.entries(MARGIN_SETS))
    if (m)
      it(`set ${si} (${m.name}): no piece drawn alike more than twice`, () => {
        const counts = new Map<string, number>();
        let flipped = 0;
        let grown = 0;
        for (const [i, c] of cases.entries()) {
          const out = withLooks(placeMargin(m, c.rects, c.cell, 31 + i, []), 5 + i);
          for (const p of out) {
            const l = p.look!;
            const key = [p.kind, p.w.toFixed(1), p.h.toFixed(1), l.flip, l.lean.toFixed(3), l.light.toFixed(2), l.sat.toFixed(2)].join();
            counts.set(key, (counts.get(key) ?? 0) + 1);
            if (l.lean !== 0 || l.flip === -1) grown++;
            if (l.flip === -1) flipped++;
          }
        }
        expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
        if (grown > 4) expect(flipped).toBeGreaterThan(0);
      });
});
