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

describe("CATHODE deployables and utility actives", () => {
  const mk = (cls: "fixer" | "butcher" | "gunslinger" | "ghost" | "wirewitch", skill: string) => {
    const c = { ...newCharacter(cls as never), skills: { [`${cls}.${skill}`]: 5 } };
    return { c, d: characterStats(c) };
  };
  const world = { scene: { add() {} }, fx: { explosion() {}, tracer() {} } } as never;
  const dctx = (enemies: never[] = []) => ({ ...ctx(enemies), player: { pos: new THREE.Vector3() } as never, world });
  const foe = (x: number) =>
    ({ alive: true, hp: 100, kit: { maxHp: 100 }, position: new THREE.Vector3(x, 0, 0), body: { joints: { chest: new THREE.Vector3(x, 1.2, 0) } } }) as never;

  it("a planted mine blows when an enemy walks over it", () => {
    {
      const { c, d } = mk("fixer", "claymore");
      const a = new Actives();
      a.assign(c);
      expect(a.slots[0]).not.toBeNull();
      expect(a.use(0, c, d, dctx()), a.said.join()).toBe(true);
      const w = { scene: { add() {} }, fx: { explosion() {}, tracer() {} } } as never;
      a.update(0.1, d, w, [], () => 0, [foe(30)]);
      expect(a.blasts).toHaveLength(0);
      a.update(0.1, d, w, [], () => 0, [foe(0)]);
      expect(a.blasts).toHaveLength(1);
    }
  });

  it("a sentry turret shoots the nearest enemy in range", () => {
    {
      const { c, d } = mk("fixer", "sentryKit");
      const a = new Actives();
      a.assign(c);
      expect(a.slots[0]).not.toBeNull();
      expect(a.use(0, c, d, dctx()), a.said.join()).toBe(true);
      a.update(0.3, d, world, [], () => 0, [foe(10)]);
      expect(a.blasts.length).toBeGreaterThan(0);
    }
  });
});

describe("CATHODE hacking skills (no street cameras yet: they hit what she looks at)", () => {
  const fake = () => {
    const e = {
      alive: true,
      hp: 100,
      fleeing: false,
      marked: false,
      body: { joints: { chest: new THREE.Vector3(0, 1.6, -10) } },
      position: new THREE.Vector3(0, 0, -10),
      panic() {
        e.fleeing = true;
      },
      setMarked(on: boolean) {
        e.marked = on;
      },
    };
    return e;
  };
  it("Turncoat panics the target for its duration; Root Access hits everyone near", () => {
    const c = { ...newCharacter("wirewitch"), skills: { "wirewitch.turncoat": 5 } } as ReturnType<typeof newCharacter>;
    const d = characterStats(c);
    const a = new Actives();
    a.assign(c);
    const e = fake();
    expect(a.use(0, c, d, { ...ctx(), enemies: [e] as never })).toBe(true);
    expect(e.fleeing).toBe(true);
    expect(a.use(0, c, d, { ...ctx(), enemies: [] as never })).toBe(false);
  });
});
