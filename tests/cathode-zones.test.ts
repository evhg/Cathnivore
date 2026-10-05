import { describe, expect, it } from "vitest";
import { ZONES, ZoneWatch, zoneAt } from "../games/cathode/src/game/zones";

describe("quay zones", () => {
  it("covers every z exactly once", () => {
    for (let z = -100; z <= 100; z += 0.5) expect(ZONES.filter((q) => z >= q.zMin && z < q.zMax).length).toBe(1);
  });
  it("announces a zone once on entry, not at spawn", () => {
    const w = new ZoneWatch();
    expect(w.update(50)).toBeUndefined();
    expect(w.update(49)).toBeUndefined();
    expect(w.update(30)?.id).toBe("stalls");
    expect(w.update(29)).toBeUndefined();
    expect(zoneAt(-60)?.id).toBe("quay");
  });
});

import { MAP_BOUNDS, mapPoint, zoneBands } from "../games/cathode/src/game/zones";

describe("district map", () => {
  it("puts north at the top and clamps outside points", () => {
    expect(mapPoint(0, MAP_BOUNDS.zMin).y).toBe(0);
    expect(mapPoint(0, MAP_BOUNDS.zMax).y).toBe(1);
    expect(mapPoint(-999, 999)).toEqual({ x: 0, y: 1 });
  });
  it("bands tile the map without gaps", () => {
    const b = zoneBands().sort((a, c) => a.y0 - c.y0);
    expect(b[0].y0).toBe(0);
    expect(b[b.length - 1].y1).toBe(1);
    for (let i = 1; i < b.length; i++) expect(b[i].y0).toBeCloseTo(b[i - 1].y1, 9);
  });
});
