import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { Actives } from "../games/cathode/src/game/actives";

import { newCharacter, characterStats } from "../games/cathode/src/sim/character";

function learned(cls: "fixer" | "butcher", skill: string) {
  const c = { ...newCharacter(cls), skills: { [`${cls}.${skill}`]: 5 } };
  return { c, d: characterStats(c) };
}
const ctx = (enemies: never[] = []) => ({
  player: {} as never,
  eye: new THREE.Vector3(0, 1.6, 0),
  fwd: new THREE.Vector3(0, 0, -1),
  enemies,
  world: {} as never,
  maxHp: 100,
});

describe("CATHODE active skills (Fixer and Butcher)", () => {
  it("Stim heals over its duration", () => {
    const { c, d } = learned("fixer", "stim");
    const a = new Actives();
    a.assign(c);
    expect(a.use(0, c, d, ctx())).toBe(true);
    let total = 0;
    for (let i = 0; i < 40; i++) {
      a.update(0.1, d, {} as never, [], () => 0);
      total += a.heal;
      a.heal = 0;
    }
    expect(total).toBeGreaterThan(10);
    expect(total).toBeLessThanOrEqual(80.5);
  });

  it("Juggernaut cuts damage taken while it runs, then stops", () => {
    const { c, d } = learned("butcher", "juggernaut");
    const a = new Actives();
    a.assign(c);
    expect(a.running().guard).toBe(1);
    const ok = a.use(0, c, d, ctx());
    expect(ok, a.said.join()).toBe(true);
    expect(a.running().guard).toBeLessThan(1);
  });

  it("Cleave queues a silent blast in front of her", () => {
    const { c, d } = learned("butcher", "cleave");
    const a = new Actives();
    a.assign(c);
    expect(a.use(0, c, d, ctx())).toBe(true);
    expect(a.blasts).toHaveLength(1);
    expect(a.blasts[0]!.silent).toBe(true);
    expect(a.blasts[0]!.pos.z).toBeLessThan(0);
  });
});

describe("CATHODE gun-buff actives", () => {
  const gs = (skill: string) => {
    const c = { ...newCharacter("gunslinger"), skills: { [`gunslinger.${skill}`]: 5 } };
    return { c, d: characterStats(c) };
  };
  it("Six for Six raises pistol damage while it runs", () => {
    const { c, d } = gs("sixForSix");
    const a = new Actives();
    a.assign(c);
    expect(a.weaponMod("pistol").dmg).toBe(1);
    expect(a.use(0, c, d, ctx()), a.said.join()).toBe(true);
    expect(a.weaponMod("pistol").dmg).toBeGreaterThan(1.5);
    expect(a.weaponMod("sniper").dmg).toBe(1);
  });
  it("Spin Reload refills the magazine and boosts the next shots, then runs out", () => {
    const { c, d } = gs("spinReload");
    const a = new Actives();
    a.assign(c);
    expect(a.use(0, c, d, ctx()), a.said.join()).toBe(true);
    expect(a.refill).toBe(true);
    expect(a.takeNextShot("pistol").mul).toBeCloseTo(1.2);
    for (let i = 0; i < 10; i++) a.takeNextShot("pistol");
    expect(a.takeNextShot("pistol").mul).toBe(1);
  });
});
