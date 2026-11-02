import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildDistrict, districtInfo, DISTRICTS } from "../games/cathode/src/render/levels/index";
import { OFFICE, STATIONS } from "../games/cathode/src/render/levels/office";

// Plan item 16, slice 1: Cath's office is a walkable room with five stations she can stand at, no patrols, and
// it stays off the case list of districts.
describe("Cath's office", () => {
  const level = buildDistrict("office", "phone");
  const cols = level.builder.colliders;
  const blocked = (x: number, z: number) => cols.some((c) => c.clone().expandByScalar(0.3).containsPoint(new THREE.Vector3(x, 1, z)));

  it("is built by id but is not one of the case districts", () => {
    expect(districtInfo("office").name).toBe("Cath's office");
    expect(DISTRICTS.map((d) => d.id)).not.toContain("office");
  });

  it("has every station on open floor inside the walkable bounds, and no patrols", () => {
    const bounds = level.theme!.bounds;
    for (const [id, s] of Object.entries(STATIONS)) {
      expect(level.markers[`station:${id}`]?.[0]?.x, id).toBe(s.x);
      expect(s.x >= bounds.xMin && s.x <= bounds.xMax && s.z >= bounds.zMin && s.z <= bounds.zMax, `${id} in bounds`).toBe(true);
      expect(blocked(s.x, s.z), `${id} on open floor`).toBe(false);
    }
    expect(Object.keys(level.markers).filter((k) => k.startsWith("patrol:"))).toEqual([]);
    expect(blocked(level.markers.player![0]!.x, level.markers.player![0]!.z)).toBe(false);
  });

  it("is closed: walls on every side and a roof", () => {
    const { xW, xE, zN, zS, ceil } = OFFICE;
    const covers = (p: THREE.Vector3) => cols.some((c) => c.containsPoint(p));
    expect(covers(new THREE.Vector3(0, 1, zN - 0.1))).toBe(true);
    expect(covers(new THREE.Vector3(0, 1, zS + 0.1))).toBe(true);
    expect(covers(new THREE.Vector3(xW - 0.1, 1, 0))).toBe(true);
    expect(covers(new THREE.Vector3(xE + 0.1, 1.5, -1))).toBe(true); // the window's glass
    expect(covers(new THREE.Vector3(0, ceil + 0.1, 0))).toBe(true);
  });
});
