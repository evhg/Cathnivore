import { describe, expect, it } from "vitest";
import { convoy, MAX_LAG, type ConvoyUnit } from "../games/hedgerow/src/convoy";

// A seeded pile: 600 vehicles over a few cells of two lanes, as a late round packs them.
function pile(n: number, seed = 7): ConvoyUnit[] {
  let s = seed;
  const r = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  return Array.from({ length: n }, (_, id) => ({ id, dist: 20 + r() * 6, len: 0.4 + r() * 0.35, ...(r() < 0.3 ? { lane: 1 as const } : {}) }));
}

describe("convoy (plan item 45)", () => {
  for (const two of [false, true])
    it(`keeps same-file gaps at or above vehicle length with 600 vehicles (${two ? "two abreast" : "single file"})`, () => {
      const units = pile(600);
      const c = convoy(units, () => two);
      const byId = new Map(units.map((u) => [u.id, u]));
      for (const lane of [undefined, 1]) {
        for (const side of two ? [-1, 1] : [0]) {
          const file = [...c.slots].filter(([id, sl]) => (byId.get(id)!.lane ?? undefined) === lane && sl.side === side).sort((a, b) => b[1].dist - a[1].dist);
          for (let i = 1; i < file.length; i++) {
            const a = byId.get(file[i - 1]![0])!;
            const b = byId.get(file[i]![0])!;
            expect(file[i - 1]![1].dist - file[i]![1].dist).toBeGreaterThanOrEqual((a.len + b.len) / 2 - 1e-9);
          }
        }
      }
      // Never drawn ahead of where it is, nor more than MAX_LAG behind; everyone is either drawn or in a column.
      for (const [id, sl] of c.slots) {
        const u = byId.get(id)!;
        expect(sl.dist).toBeLessThanOrEqual(u.dist + 1e-9);
        expect(u.dist - sl.dist).toBeLessThanOrEqual(MAX_LAG + 1e-9);
      }
      expect(c.slots.size + c.inColumn.size).toBe(600);
      expect(c.columns.reduce((n, col) => n + col.count, 0)).toBe(c.inColumn.size);
      expect(c.slots.size).toBeGreaterThan(two ? 40 : 20);
    });
  it("is deterministic under a fixed seed", () => {
    const a = convoy(pile(600, 3), () => true);
    const b = convoy(pile(600, 3), () => true);
    expect([...a.slots]).toEqual([...b.slots]);
    expect(a.columns).toEqual(b.columns);
  });
  it("leaves a sparse lane where it is", () => {
    const c = convoy([{ id: 1, dist: 10, len: 0.5 }, { id: 2, dist: 5, len: 0.5 }]);
    expect(c.slots.get(1)).toEqual({ dist: 10, side: 0 });
    expect(c.slots.get(2)).toEqual({ dist: 5, side: 0 });
    expect(c.columns).toEqual([]);
  });
  // Plan item 657: an ambush's burst mid-lane and the depot's queue, each packed past what the lane can show.
  it("gives each packed queue its own column, at its own place, and never draws one behind the gate", () => {
    const units: ConvoyUnit[] = [
      ...Array.from({ length: 30 }, (_, i) => ({ id: i, dist: 18 + (i % 3) * 0.9 + i * 0.01, len: 0.6 })),
      ...Array.from({ length: 24 }, (_, i) => ({ id: 100 + i, dist: (i % 3) * 0.8 + i * 0.01, len: 0.4 })),
    ];
    const c = convoy(units, () => true);
    expect(c.columns.length).toBe(2);
    for (const [id, col] of c.columnOf) {
      const u = units.find((v) => v.id === id)!;
      expect(Math.abs(col.dist - u.dist)).toBeLessThanOrEqual(MAX_LAG + 1);
    }
    for (const sl of c.slots.values()) expect(sl.dist).toBeGreaterThanOrEqual(0);
    expect(c.columns.reduce((n, col) => n + col.count, 0)).toBe(c.inColumn.size);
  });
});

// Plan item 684: a late round's queue drives the lane in single file: no two drawn vehicles' bodies overlap by more
// than 15% of the shorter, a column's head included, and nobody is drawn off the lane's line.
describe("single file (plan item 684)", () => {
  it("draws no two vehicles overlapping by more than 15%, round 15 of level 34 packed", async () => {
    const { layOutField, placeOnLane } = await import("../games/hedgerow/src/convoy");
    const { drawnLen, ROAD_GAP } = await import("../games/hedgerow/src/sprites");
    const { LEVELS } = await import("../games/hedgerow/src/levels");
    const level = LEVELS.find((l) => l.id === 34)!;
    const kinds = ["lorry", "van", "hatchback", "truck", "drone", "director", "pickup", "artic"] as const;
    let s = 11;
    const r = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
    // 180 vehicles bunched in three knots (the depot, a bridge, mid-lane) on both lanes.
    const enemies = Array.from({ length: 180 }, (_, id) => ({ id, kind: kinds[id % kinds.length]!, dist: [0.3, 9, 17][id % 3]! + r() * 1.5, ...(r() < 0.4 ? { lane: 1 as const } : {}) }));
    const lay = layOutField(enemies, (k) => drawnLen(k as (typeof kinds)[number]) * ROAD_GAP);
    for (const lane of [undefined, 1]) {
      const drawn: Array<{ d: number; len: number }> = [];
      for (const e of enemies) {
        if ((e.lane ?? undefined) !== lane) continue;
        const sl = lay.slots.get(e.id);
        if (sl) {
          expect(sl.side).toBe(0);
          drawn.push({ d: sl.dist, len: drawnLen(e.kind) });
        }
        const col = lay.columnOf.get(e.id);
        // A column's head is drawn in the file (before item 684 the column stood on the queue's leader, 3-5 deep).
        if (col?.at !== undefined && lay.inColumn.get(e.id) === 0) drawn.push({ d: col.at, len: drawnLen(e.kind) });
      }
      drawn.sort((a, b) => b.d - a.d);
      for (let i = 1; i < drawn.length; i++) {
        const a = drawn[i - 1]!;
        const b = drawn[i]!;
        const overlap = (a.len + b.len) / 2 - (a.d - b.d);
        expect(overlap).toBeLessThanOrEqual(0.15 * Math.min(a.len, b.len) + 1e-9);
      }
      expect(drawn.length).toBeGreaterThan(8);
    }
    // Every column is counted whole; one whose head would stand behind the gate waits at the depot, drawn nowhere.
    expect(lay.columns.reduce((n, c) => n + c.count, 0)).toBe(lay.inColumn.size);
    expect(lay.columns.some((c) => c.at !== undefined)).toBe(true);
    for (const c of lay.columns) if (c.at !== undefined) expect(c.at).toBeGreaterThanOrEqual(0);
    for (const e of enemies.slice(0, 40)) {
      const p = placeOnLane(level, e, lay);
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    }
  });
});
