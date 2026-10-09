import { describe, expect, it } from "vitest";
import { buildDistrict, DISTRICTS, districtInfo } from "../games/cathode/src/render/levels";

describe("cathode district registry", () => {
  it("falls back to the market for unknown ids", () => {
    expect(districtInfo("nope").id).toBe("market");
    expect(districtInfo(undefined).id).toBe("market");
  });
  it("builds every district with the markers the game needs", () => {
    for (const d of DISTRICTS) {
      const lv = buildDistrict(d.id, "phone");
      expect(lv.markers.player?.length, d.id).toBeGreaterThan(0);
      expect(lv.markers.extract?.length, d.id).toBeGreaterThan(0);
      expect(lv.markers.perch?.length, d.id).toBeGreaterThan(1);
      expect(lv.shelters.length, d.id).toBeGreaterThan(0);
      expect(lv.lights.length, d.id).toBeGreaterThan(5);
      expect(lv.builder.colliders.length, d.id).toBeGreaterThan(5);
    }
  });
  it("keeps the clinic's start inside its bounds", () => {
    const lv = buildDistrict("clinic", "phone");
    const p = lv.markers.player![0]!;
    const b = lv.theme!.bounds;
    expect(p.x).toBeGreaterThan(b.xMin);
    expect(p.x).toBeLessThan(b.xMax);
    expect(p.z).toBeGreaterThan(b.zMin);
    expect(p.z).toBeLessThan(b.zMax);
  });
});

import { travelOptions, travelUrl } from "../games/cathode/src/game/zones";

describe("cathode travel", () => {
  it("offers the clinic only after the act 1 boss", () => {
    expect(travelOptions([]).map((d) => d.id)).toEqual(["market"]);
    expect(travelOptions(["crispBoss"]).map((d) => d.id)).toEqual(["market", "clinic"]);
  });
  it("builds addresses that keep play and set the district", () => {
    expect(travelUrl("clinic", "?play")).toBe("?play&district=clinic");
    expect(travelUrl("market", "?play&district=clinic")).toBe("?play");
  });
});
