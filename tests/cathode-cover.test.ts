import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { RayWorld } from "../games/cathode/src/game/ray";
import { Combat, type Build } from "../games/cathode/src/game/combat";
import { ENFORCER, Enemy, type Sight } from "../games/cathode/src/game/enemy";
import { SLICE_WEAPONS } from "../games/cathode/src/game/weapons";
import { penetrate, passes } from "../games/cathode/src/sim/penetration";
import type { World } from "../games/cathode/src/render/types";
import type { Shot } from "../games/cathode/src/game/weapons";

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const box = (a: [number, number, number], b: [number, number, number]) => new THREE.Box3(V(...a), V(...b));
const pistol = SLICE_WEAPONS.find((w) => w.id === "kestrel")!;
const build: Build = { damage: () => 1, headshot: 1, crit: 0, critMul: 1 };
const far: Sight = { eye: V(0, 1.6, 400), chest: V(0, 1.2, 400), light: 0, low: 1, speed: 0, stealth: 0 };

const fx = new Proxy({}, { get: () => () => undefined }) as World["fx"];
const fakeWorld = { fx, wind: V(0, 0, 0), surfaceAt: () => "concrete" } as unknown as World;

/** A guard standing at (0, 0, -10) facing her, and Cath at the origin. */
function scene(rays: RayWorld) {
  const e = new Enemy({ ...ENFORCER }, [V(0, 0, -10)], 1);
  e.motion.yaw = 0;
  e.update(0.016, far, { cast: () => null, clear: () => false } as never, [], () => 0);
  const combat = new Combat(fakeWorld, rays, [e], false);
  return { e, combat };
}

const shoot = (combat: Combat, from: THREE.Vector3, to: THREE.Vector3) => {
  const dir = to.clone().sub(from).normalize();
  const shot = { weapon: pistol, origin: from, muzzle: from.clone(), dirs: [dir] } as unknown as Shot;
  combat.fire(shot, build);
};

describe("CATHODE combat bus (S0)", () => {
  it("a lethal round emits fire, then hit, then kill, in that order", () => {
    const rays = new RayWorld([], { mats: [] });
    const { e, combat } = scene(rays);
    e.hp = 1;
    const seen: string[] = [];
    for (const k of ["fire", "hit", "kill"] as const) combat.bus.on(k, () => seen.push(k));
    let kill: { headshot: boolean; last: boolean } | null = null;
    combat.bus.on("kill", (k) => (kill = k));
    shoot(combat, V(0, 1.6, 0), e.body.joints.head.clone());
    expect(seen).toEqual(["fire", "hit", "kill"]);
    expect(kill).toMatchObject({ headshot: true, last: true });
  });

  it("traceShot takes plain points and defaults to the held gun", () => {
    const { e, combat } = scene(new RayWorld([], { mats: [] }));
    combat.held = () => ({ w: pistol, build });
    const h = e.body.joints.head;
    const t = combat.traceShot({ x: 0, y: 1.6, z: 0 }, { x: h.x, y: h.y, z: h.z });
    expect(t.zone).toBe("head");
  });
});

describe("CATHODE cover (S1.1)", () => {
  it("a solid crate in the way gives `blocked` and no hit", () => {
    const rays = new RayWorld([box([-0.6, 0, -6.6], [0.6, 1.1, -5.4])], { mats: ["wood"] });
    // Wood passes at 45% for a pistol... so make it concrete: never passes.
    const solid = new RayWorld([box([-0.6, 0, -6.6], [0.6, 1.1, -5.4])], { mats: ["concrete"] });
    const { e, combat } = scene(solid);
    const blocked: unknown[] = [];
    combat.bus.on("blocked", (b) => blocked.push(b));
    shoot(combat, V(0, 0.9, 0), e.body.joints.chest.clone().setY(0.9));
    expect(combat.hits.length).toBe(0);
    expect(combat.blocks).toBe(1);
    expect(blocked.length).toBe(1);
    expect(rays.cast(V(0, 0.9, 0), V(0, 0, -1), 20)?.mat).toBe("wood");
  });

  it("a head over the crate is hittable; the chest behind it isn't", () => {
    const rays = new RayWorld([box([-0.6, 0, -6.6], [0.6, 1.1, -5.4])], { mats: ["concrete"] });
    const { e, combat } = scene(rays);
    shoot(combat, V(0, 1.6, 0), e.body.joints.head.clone());
    expect(combat.hits.length).toBe(1);
    expect(combat.hits[0]!.zone).toBe("head");
    const t = combat.traceShot(V(0, 1.0, 0), e.body.joints.chest.clone().setY(1.0), pistol, build);
    expect(t.enemy).toBeNull();
    expect(t.blockedBy).toBe("solid");
  });

  it("glass passes at 70% and marks the hit as penetrated", () => {
    const glass = new RayWorld([], { thin: [{ box: box([-2, 0, -5.02], [2, 3, -4.98]), mat: "glass" }] });
    const open = new RayWorld([]);
    const a = scene(glass);
    const b = scene(open);
    shoot(a.combat, V(0, 1.2, 0), a.e.body.joints.chest.clone());
    shoot(b.combat, V(0, 1.2, 0), b.e.body.joints.chest.clone());
    expect(a.combat.hits.length).toBe(1);
    expect(a.combat.hits[0]!.data!.penetrated).toBe(true);
    expect(b.combat.hits[0]!.data!.penetrated).toBe(false);
    expect(a.combat.hits[0]!.damage / b.combat.hits[0]!.damage).toBeCloseTo(0.7, 5);
  });

  it("thin cover stops rounds but not sight; solid stops both", () => {
    const rays = new RayWorld([box([-2, 0, -3], [2, 3, -2.9])], { mats: ["concrete"], thin: [{ box: box([-2, 0, -5.02], [2, 3, -4.98]), mat: "metalSheet" }] });
    expect(rays.cast(V(0, 1, -4), V(0, 0, -1), 10)?.mat).toBe("metalSheet");
    expect(rays.clear(V(0, 1, -4), V(0, 1, -8))).toBe(true);
    expect(rays.clear(V(0, 1, 0), V(0, 1, -8))).toBe(false);
  });

  it("an oriented box: a ray past the AABB corner of a rotated crate passes", () => {
    // A 2 m crate turned 45 degrees: its AABB is 2.83 m wide, but the corner region is empty.
    const half = V(1, 0.5, 1);
    const center = V(0, 0.5, -10);
    const yaw = Math.PI / 4;
    const aabbHalf = Math.SQRT2;
    const aabb = box([-aabbHalf, 0, -10 - aabbHalf], [aabbHalf, 1, -10 + aabbHalf]);
    const rays = new RayWorld([aabb], { obbs: [{ center, half, yaw }] });
    const plain = new RayWorld([aabb]);
    // Along x at z = -10 + 1.2: inside the AABB, outside the diamond (|x| + |dz| <= 1.414 needs |x| <= 0.21).
    const o = V(-5, 0.5, -10 + 1.2);
    const d = V(1, 0, 0);
    expect(plain.cast(o, d, 20)).not.toBeNull();
    const h = rays.cast(o, d, 20);
    expect(h === null || Math.abs(h.point.x) <= 0.22).toBe(true);
    // Straight through the middle hits the face at the diamond's corner (x = -1.414).
    const mid = rays.cast(V(-5, 0.5, -10), d, 20)!;
    expect(mid.point.x).toBeCloseTo(-Math.SQRT2, 3);
    expect(mid.exit).toBeCloseTo(5 + Math.SQRT2, 3);
  });

  it("a round past a head gives a near miss: a duck and shakier aim", () => {
    const { e, combat } = scene(new RayWorld([]));
    const misses: unknown[] = [];
    combat.bus.on("nearMiss", (m) => misses.push(m));
    const head = e.body.joints.head.clone();
    shoot(combat, V(0, head.y, 0), head.clone().add(V(0.42, 0, 0)));
    expect(combat.hits.length).toBe(0);
    expect(misses.length).toBe(1);
    expect(e.aimMul()).toBeLessThan(1);
    expect(e.duckT).toBeGreaterThan(0);
  });

  it("penetration rules: one layer for a pistol, sheet metal only for the sniper", () => {
    expect(penetrate(["glass"], "pistol").damageMul).toBeCloseTo(0.7);
    expect(penetrate(["glass", "glass"], "pistol").stoppedAt).toBe(1);
    expect(penetrate(["glass", "wood"], "sniper").damageMul).toBeCloseTo(0.7 * 0.45);
    expect(passes("metalSheet", "pistol")).toBe(false);
    expect(passes("metalSheet", "sniper")).toBe(true);
    expect(passes("concrete", "sniper")).toBe(false);
    expect(passes("glass", "melee")).toBe(false);
  });

  it("ballistic sniper rounds punch through two thin layers, keep the share, and stop at concrete", () => {
    const sniper = SLICE_WEAPONS.find((w) => w.id === "widowmaker")!;
    const fly = (rays: RayWorld, low = false) => {
      const { e, combat } = scene(rays);
      e.hp = 1e6;
      // C15: plates don't scale linearly (a plate takes a fixed HP before it breaks): measure the share on bare flesh.
      Object.assign(e, { armour: null });
      const from = V(0, low ? 0.9 : 1.2, 0);
      // The round drops under a millimetre over 10 m: aim straight at the chest (or level, low behind the crate).
      const dir = (low ? e.body.joints.chest.clone().setY(0.9) : e.body.joints.chest.clone()).sub(from).normalize();
      const blocked: unknown[] = [];
      combat.bus.on("blocked", (b) => blocked.push(b));
      combat.fire({ weapon: sniper, origin: from, muzzle: from.clone(), dirs: [dir] } as unknown as Shot, build);
      for (let i = 0; i < 60; i++) combat.update(1 / 60, build);
      return { combat, blocked };
    };
    const pane = (z: number, mat: "glass" | "wood" | "metalSheet") => ({ box: box([-2, 0, z - 0.02], [2, 3, z + 0.02]), mat });
    const open = fly(new RayWorld([]));
    const two = fly(new RayWorld([], { thin: [pane(-3, "glass"), pane(-6, "wood")] }));
    const three = fly(new RayWorld([], { thin: [pane(-2, "glass"), pane(-4, "metalSheet"), pane(-6, "wood")] }));
    // A waist-high concrete crate with his head showing over it: the round stops, and it reads as blocked.
    const wall = fly(new RayWorld([box([-0.6, 0, -6.6], [0.6, 1.1, -5.4])], { mats: ["concrete"] }), true);
    expect(open.combat.hits.length).toBe(1);
    expect(open.combat.hits[0]!.data!.penetrated).toBe(false);
    expect(two.combat.hits.length).toBe(1);
    expect(two.combat.hits[0]!.data!.penetrated).toBe(true);
    expect(two.combat.hits[0]!.damage / open.combat.hits[0]!.damage).toBeCloseTo(0.7 * 0.45, 5);
    // Two layers is the budget: the third stops it.
    expect(three.combat.hits.length).toBe(0);
    expect(three.blocked.length).toBe(1);
    expect(wall.combat.hits.length).toBe(0);
    expect(wall.blocked.length).toBe(1);
  });
});
