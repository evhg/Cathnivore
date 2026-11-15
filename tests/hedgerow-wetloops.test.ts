// Plan item 346: the 3D ponds' banks follow each wet region's outline, traced into loops of corners.
import { describe, expect, it } from "vitest";
import { wetLoops } from "../games/hedgerow/src/render3d/terrain";

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
