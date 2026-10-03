import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { SLICE_WEAPONS } from "../games/cathode/src/game/weapons";
import { buildGun } from "../games/cathode/src/game/viewmodel";

describe("CATHODE playable weapons", () => {
  it("every carried weapon has a model with a muzzle and hands", () => {
    for (const w of SLICE_WEAPONS) {
      const r = buildGun(w.model);
      expect(r.muzzle, w.id).toBeTruthy();
      expect(r.root.children.length, w.id).toBeGreaterThan(2);
      expect(new THREE.Box3().setFromObject(r.root).isEmpty(), w.id).toBe(false);
    }
  });
  it("covers revolver, SMG and rifle with sane numbers", () => {
    const by = Object.fromEntries(SLICE_WEAPONS.map((w) => [w.weaponClass, w]));
    for (const c of ["revolver", "smg", "rifle"]) expect(by[c], c).toBeTruthy();
    expect(by.smg!.cycle).toBeLessThan(by.rifle!.cycle);
    expect(by.revolver!.damage).toBeGreaterThan(by.rifle!.damage);
  });
});
