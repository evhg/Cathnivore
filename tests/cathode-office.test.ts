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

// Plan item 16, slice 2: the hub's rules (games/cathode/src/game/office.ts).
import { beaCall, caseDistrict, continueDistrict, doorName, nextJob, stationAt, STATION_REACH } from "../games/cathode/src/game/office";
import { travelOptions } from "../games/cathode/src/game/zones";

describe("the office hub", () => {
  it("finds the station she stands at, and none between them", () => {
    for (const [id, s] of Object.entries(STATIONS)) expect(stationAt(s.x + 0.3, s.z - 0.3), id).toBe(id);
    expect(stationAt(0, 1)).toBeNull();
    // Reaches never overlap ambiguously: each station's own spot picks it.
    const ids = Object.keys(STATIONS);
    for (const a of ids) for (const b of ids) if (a < b) {
      const sa = STATIONS[a as keyof typeof STATIONS], sb = STATIONS[b as keyof typeof STATIONS];
      expect(Math.hypot(sa.x - sb.x, sa.z - sb.z), `${a}-${b}`).toBeGreaterThan(STATION_REACH);
    }
  });

  it("sends the water taxi to the district the open case runs in", () => {
    expect(caseDistrict(["fishMarket"])).toBe("market");
    const act1 = ["fishMarket", "crispLead", "quayContracts", "candorManifest", "crispBoss"];
    expect(caseDistrict(act1)).toBe("clinic");
    expect(caseDistrict([...act1, "vaneLead", "vaneBoss"])).toBe("plaza");
    const all = [...act1, "vaneLead", "vaneBoss", "pellLead", "pellBoss", "boardLead", "boardBoss", "vaultLead"];
    expect(caseDistrict(all)).toBe("vault");
    expect(nextJob([...all, "vaultBoss"])).toBeUndefined();
    expect(caseDistrict([...all, "vaultBoss"])).toBe("market");
    // Always somewhere she can travel to.
    for (const done of [[], act1, all]) expect(travelOptions(done).map((t) => t.id)).toContain(caseDistrict(done));
    expect(doorName(act1)).toBe("Candor Clinic");
  });

  it("gives Bea something to say about every case", () => {
    const seen = new Set<string>();
    const order = ["fishMarket", "crispLead", "quayContracts", "candorManifest", "crispBoss", "vaneLead", "vaneBoss", "pellLead", "pellBoss", "boardLead", "boardBoss", "vaultLead", "vaultBoss"];
    for (let i = 1; i <= order.length; i++) {
      const lines = beaCall(order.slice(0, i));
      expect(lines.length).toBeGreaterThanOrEqual(2);
      for (const l of lines) expect(l).toMatch(/^(Bea|Cath): /);
      seen.add(lines[0]!);
    }
    expect(seen.size).toBeGreaterThanOrEqual(6);
  });

  it("lands Continue in the office once the first job is done", () => {
    expect(continueDistrict([])).toBeUndefined();
    expect(continueDistrict(["fishMarket"])).toBe("office");
  });
});
