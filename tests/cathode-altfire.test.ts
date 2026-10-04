import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { Arsenal } from "../games/cathode/src/game/weapons";

function run(a: Arsenal, secs: number): number {
  const eye = new THREE.Vector3();
  const dir = new THREE.Vector3(0, 0, -1);
  const q = new THREE.Quaternion();
  let shots = 0;
  let pellets = 0;
  for (let t = 0; t < secs; t += 1 / 60) {
    const s = a.update(1 / 60, false, eye, dir, q, 1);
    if (s) {
      shots++;
      pellets += s.dirs.length;
    }
  }
  return a.altKind === "both" ? pellets : shots;
}

describe("CATHODE alt-fires", () => {
  const arsenal = () => {
    const a = new Arsenal(new THREE.Scene());
    return a;
  };
  it("the pistol bursts three rounds", () => {
    const a = arsenal();
    a.equip(1);
    run(a, 0.5);
    const before = a.ammo.mag;
    expect(a.altFire()).toBe(true);
    expect(run(a, 1)).toBe(3);
    expect(a.ammo.mag).toBe(before - 3);
  });
  it("the revolver fans the whole cylinder", () => {
    const a = arsenal();
    a.equip(4);
    run(a, 0.5);
    expect(a.altFire()).toBe(true);
    expect(run(a, 2)).toBe(6);
    expect(a.ammo.mag).toBe(0);
  });
  it("the shotgun fires both barrels as one blast", () => {
    const a = arsenal();
    a.equip(2);
    run(a, 0.5);
    expect(a.altFire()).toBe(true);
    expect(run(a, 1)).toBe(18);
    expect(a.ammo.mag).toBe(4);
  });
  it("the sledge slams and the sniper has no alt", () => {
    const a = arsenal();
    a.equip(9);
    run(a, 0.5);
    expect(a.altFire()).toBe(true);
    expect(a.slamNow).toBe(true);
    a.equip(3);
    expect(a.altFire()).toBe(false);
  });
});

describe("CATHODE parry", () => {
  it("the Night Shift parries for half a second, then recovers", () => {
    const a = new Arsenal(new THREE.Scene());
    const i = a.held.findIndex((h) => h.def.id === "nightShift");
    a.equip(i);
    run(a, 1);
    expect(a.altKind).toBe("parry");
    expect(a.altFire()).toBe(true);
    expect(a.parryT).toBeGreaterThan(0.4);
    run(a, 0.6);
    expect(a.parryT).toBe(0);
  });
});
