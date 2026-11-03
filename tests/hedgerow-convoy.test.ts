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
});
