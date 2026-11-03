import { describe, expect, it } from "vitest";
import { buildOffice, officeLights, STATIONS } from "../games/cathode/src/render/levels/office";

// Plan item 58: the office is lit like a set, the same on every load, with a light over every station.
describe("officeLights", () => {
  it("has a fixed count per tier (the phone keeps two)", () => {
    expect(officeLights("phone")).toHaveLength(2);
    expect(officeLights("high")).toHaveLength(4);
    expect(officeLights("ultra")).toHaveLength(4);
    expect(officeLights("high")).toEqual(officeLights("high"));
  });
  for (const q of ["phone", "high"] as const)
    it(`every station has a light within 2 m (${q})`, () => {
      const lights = buildOffice(q).lights;
      for (const [id, s] of Object.entries(STATIONS)) {
        const near = lights.some((l) => Math.hypot(l.pos.x - s.x, l.pos.z - s.z) <= 2);
        expect(near, id).toBe(true);
      }
    });
});
