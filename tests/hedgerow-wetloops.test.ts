// Plan item 346: the 3D ponds' banks follow each wet region's outline, traced into loops of corners.
import { describe, expect, it } from "vitest";
import { meander, wetLoops } from "../games/hedgerow/src/render3d/terrain";

const set = (cells: Array<[number, number]>) => new Set(cells.map(([c, r]) => `${c},${r}`));

describe("wet region outlines", () => {
  it("trace a lone cell as its four corners", () => {
    const loops = wetLoops(set([[2, 3]]));
    expect(loops).toHaveLength(1);
    expect(loops[0]!.map((p) => p.join(",")).sort()).toEqual(["2,3", "2,4", "3,3", "3,4"]);
  });
  it("trace a straight run as one rectangle and an L as six corners", () => {
    expect(wetLoops(set([[0, 0], [1, 0], [2, 0]]))[0]).toHaveLength(4);
    expect(wetLoops(set([[0, 0], [1, 0], [1, 1]]))[0]).toHaveLength(6);
  });
  it("trace two separate ponds as two loops", () => {
    expect(wetLoops(set([[0, 0], [5, 5]]))).toHaveLength(2);
  });
});

// Plan item 429: the banks wander, so no straight water edge runs longer than one cell.
describe('a river bank meanders (plan item 429)', () => {
  it('has no straight run longer than one cell, and stays within 0.09 of the outline', () => {
    const pts = Array.from({ length: 2 }, (_, i) => ({ x: i * 6, z: 0, nx: 0, nz: -1 }))
    const m = meander([...pts, { x: 6, z: 1, nx: 0, nz: 1 }, { x: 0, z: 1, nx: 0, nz: 1 }])
    const top = m.filter((p) => p.z < 0.3 && p.x > 0.3 && p.x < 5.7)
    for (const p of top) expect(Math.abs(p.z)).toBeLessThanOrEqual(0.09)
    // the longest run with the bank within 0.01 of a straight line
    let run = 0
    let best = 0
    for (let i = 1; i < top.length; i++) {
      run = Math.abs(top[i]!.z - top[i - 1]!.z) < 0.004 ? run + Math.hypot(top[i]!.x - top[i - 1]!.x, 0) : 0
      best = Math.max(best, run)
    }
    expect(best).toBeLessThan(1)
  })
})
