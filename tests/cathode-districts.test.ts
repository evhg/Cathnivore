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

import { plazaGround, PLAZA } from "../games/cathode/src/render/levels/plaza";

describe("hollowell plaza", () => {
  it("opens after Vane and keeps every marker inside the bounds", () => {
    expect(travelOptions(["crispBoss", "vaneBoss"]).map((d) => d.id)).toEqual(["market", "clinic", "plaza"]);
    const lv = buildDistrict("plaza", "phone");
    const b = lv.theme!.bounds;
    for (const key of ["player", "boss:pell", "boss:guard", "boss:reinforce", "lead:register", "lead:guard"]) {
      for (const p of lv.markers[key]!) {
        expect(p.x, key).toBeGreaterThan(b.xMin);
        expect(p.x, key).toBeLessThan(b.xMax);
        expect(p.z, key).toBeGreaterThan(b.zMin);
        expect(p.z, key).toBeLessThan(b.zMax);
      }
    }
    expect(lv.theme!.water).toBe(false);
  });
  it("climbs the council steps in 30 cm risers to the landing", () => {
    expect(plazaGround(0, 0)).toBe(0);
    expect(plazaGround(0, PLAZA.stepZ0 - 0.1)).toBeCloseTo(PLAZA.stepRise);
    expect(plazaGround(0, -45)).toBeCloseTo(PLAZA.stepCount * PLAZA.stepRise);
    expect(plazaGround(15, -45)).toBe(0);
  });
});

import { towerGround, TOWER, TOWER_H1, TOWER_H2 } from "../games/cathode/src/render/levels/tower";

describe("the board tower", () => {
  it("opens after Pell and keeps its markers in bounds and on the floor they belong to", () => {
    expect(travelOptions(["crispBoss", "vaneBoss", "pellBoss"]).map((d) => d.id)).toEqual(["market", "clinic", "plaza", "tower"]);
    const lv = buildDistrict("tower", "phone");
    const b = lv.theme!.bounds;
    for (const [key, list] of Object.entries(lv.markers)) {
      for (const p of list) {
        expect(p.x, key).toBeGreaterThan(b.xMin);
        expect(p.x, key).toBeLessThan(b.xMax);
        expect(p.z, key).toBeGreaterThan(b.zMin);
        expect(p.z, key).toBeLessThan(b.zMax);
        expect(p.y, key).toBeCloseTo(towerGround(p.x, p.z), 5);
      }
    }
  });
  it("climbs in risers the player can step over", () => {
    expect(towerGround(0, TOWER.zS - 5)).toBe(0);
    expect(towerGround(0, -10)).toBeCloseTo(TOWER_H1);
    expect(towerGround(0, -55)).toBeCloseTo(TOWER_H2);
    expect(TOWER.rise).toBeLessThan(0.42);
    let prev = 0;
    for (let z = TOWER.zS; z > TOWER.zN; z -= 0.1) {
      const g = towerGround(0, z);
      expect(g - prev).toBeLessThan(0.36);
      prev = g;
    }
  });
});

import { vaultGround, VAULT } from "../games/cathode/src/render/levels/vault";

describe("the hollow vault", () => {
  it("opens after the Chair and keeps its markers in bounds, on solid floor", () => {
    expect(travelOptions(["crispBoss", "vaneBoss", "pellBoss", "boardBoss"]).map((d) => d.id)).toEqual(["market", "clinic", "plaza", "tower", "vault"]);
    const lv = buildDistrict("vault", "phone");
    const b = lv.theme!.bounds;
    for (const [key, list] of Object.entries(lv.markers)) {
      for (const p of list) {
        expect(p.x, key).toBeGreaterThan(b.xMin);
        expect(p.x, key).toBeLessThan(b.xMax);
        expect(p.z, key).toBeGreaterThan(b.zMin);
        expect(p.z, key).toBeLessThan(b.zMax);
        expect(vaultGround(p.x, p.z), key).toBe(0);
      }
    }
  });
  it("drops into the chasm off the bridge", () => {
    expect(vaultGround(0, 0)).toBe(0);
    expect(vaultGround(7, 0)).toBe(VAULT.drop);
    expect(vaultGround(7, 12)).toBe(0);
  });
});
