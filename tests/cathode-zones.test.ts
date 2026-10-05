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
