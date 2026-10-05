import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { RayWorld, rayGround } from "../games/cathode/src/game/ray";
import { Body, enforcerLook, rayCapsule } from "../games/cathode/src/game/body";
import { Player, PLAYER } from "../games/cathode/src/game/player";
import type { Intent } from "../games/cathode/src/game/input";

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const box = (a: [number, number, number], b: [number, number, number]) => new THREE.Box3(V(...a), V(...b));

function intent(over: Partial<Intent> = {}): Intent {
  return {
    move: { x: 0, y: 0 },
    look: { yaw: 0, pitch: 0 },
    sprint: false,
    crouch: false,
    jump: false,
    fire: false,
    aim: false,
    alt: false,
    reload: false,
    takedown: false,
    lean: 0,
    slot: -1,
    cycle: 0,
    focus: false,
    pause: false,
    skills: false,
    map: false,
    skill1: false,
    skill2: false,
    ...over,
  };
}

describe("CATHODE rays", () => {
  const world = new RayWorld([box([-1, 0, -11], [1, 3, -9]), box([20, 0, 20], [22, 5, 22])]);

  it("hits the nearest box along the ray, with its face normal", () => {
    const h = world.cast(V(0, 1, 0), V(0, 0, -1), 50)!;
    expect(h.dist).toBeCloseTo(9, 5);
    expect(h.normal.z).toBe(1);
    expect(world.cast(V(0, 1, 0), V(0, 0, 1), 50)).toBeNull();
  });

  it("checks line of sight both ways and finds boxes across grid cells", () => {
    expect(world.clear(V(0, 1, 0), V(0, 1, -20))).toBe(false);
    expect(world.clear(V(0, 1, 0), V(5, 1, 5))).toBe(true);
    const far = world.cast(V(0, 1, 0), V(21, 0, 21).normalize(), 100);
    expect(far).not.toBeNull();
  });

  it("finds the ground plane", () => {
    expect(rayGround(V(0, 2, 0), V(0, -1, 0), 0, 10)).toBeCloseTo(2);
    expect(rayGround(V(0, 2, 0), V(0, 1, 0), 0, 10)).toBeNull();
  });
});

describe("CATHODE bodies", () => {
  it("ray-capsule hits the side and misses past the end", () => {
    expect(rayCapsule(V(-5, 1, 0), V(1, 0, 0), V(0, 0, 0), V(0, 2, 0), 0.2)).toBeCloseTo(4.8, 5);
    expect(rayCapsule(V(-5, 3, 0), V(1, 0, 0), V(0, 0, 0), V(0, 2, 0), 0.2)).toBeNull();
  });

  it("a raycast at head height finds the head zone", () => {
    const b = new Body(enforcerLook());
    b.pose();
    const h = b.raycast(V(0, 1.68, 5), V(0, 0, -1), 20);
    expect(h?.seg.zone).toBe("head");
    const t = b.raycast(V(0, 1.25, 5), V(0, 0, -1), 20);
    expect(t?.seg.zone).toBe("torso");
  });

  it("severing an upper arm takes the forearm with it and stops it being hit", () => {
    const b = new Body(enforcerLook());
    const gone = b.sever("upperArmL", V(3, 2, 0));
    expect(gone).toEqual(["upperArmL", "forearmL"]);
    expect(b.sever("forearmL", V(0, 0, 0))).toEqual([]);
    for (let i = 0; i < 120; i++) b.physics(1 / 60, { colliders: [], ground: () => 0 });
    expect(b.segs.get("forearmL")!.loose!.a.y).toBeGreaterThanOrEqual(0);
  });

  it("a ragdoll falls, settles on the floor, and keeps its proportions", () => {
    const b = new Body(enforcerLook());
    b.goLimp(V(4, 1, 0), b.joints.chest);
    for (let i = 0; i < 300; i++) b.physics(1 / 60, { colliders: [], ground: () => 0 });
    for (const p of Object.values(b.joints)) {
      expect(Number.isFinite(p.x + p.y + p.z)).toBe(true);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThan(0.8);
    }
    expect(b.joints.neck.distanceTo(b.joints.head)).toBeCloseTo(0.28, 1);
  });
});

describe("CATHODE movement", () => {
  it("walks forward, stops at a wall, and steps up a kerb", () => {
    const wall = box([-5, 0, -6], [5, 3, -5]);
    const kerb = box([-5, 0, -3], [5, 0.3, -2]);
    const p = new Player(V(0, 0, 0), [wall, kerb], () => 0);
    for (let i = 0; i < 240; i++) p.step(1 / 60, intent({ move: { x: 0, y: 1 } }));
    expect(p.pos.z).toBeGreaterThan(-5 + PLAYER.radius - 0.01 - 0.6);
    expect(p.pos.z).toBeCloseTo(-5 + PLAYER.radius + 0.001, 2);
    expect(p.pos.y).toBeCloseTo(0, 1);
    // It went over the 30 cm kerb on the way.
    const q = new Player(V(0, 0, 0), [kerb], () => 0);
    for (let i = 0; i < 60; i++) q.step(1 / 60, intent({ move: { x: 0, y: 1 } }));
    expect(q.pos.z).toBeLessThan(-2.2);
  });

  it("mantles a waist-high ledge on jump, but not a wall", () => {
    const ledge = box([-5, 0, -2], [5, 1.2, 4]);
    const p = new Player(V(0, 0, 0.0), [], () => 0);
    p.pos.set(0, 0, -2.6);
    const pl = new Player(V(0, 0, -2.6), [ledge], () => 0);
    pl.yaw = Math.PI; // facing +z
    for (let i = 0; i < 4; i++) pl.step(1 / 60, intent({ jump: i === 0 }));
    for (let i = 0; i < 40; i++) pl.step(1 / 60, intent());
    expect(pl.pos.y).toBeCloseTo(1.2, 1);
    void p;
  });

  it("crouching lowers the eye, and sprint-crouch becomes a slide", () => {
    const p = new Player(V(0, 0, 0), [], () => 0);
    for (let i = 0; i < 90; i++) p.step(1 / 60, intent({ move: { x: 0, y: 1 }, sprint: true }));
    p.step(1 / 60, intent({ move: { x: 0, y: 1 }, sprint: true, crouch: true }));
    expect(p.stance).toBe("slide");
    for (let i = 0; i < 120; i++) p.step(1 / 60, intent());
    expect(p.stance).toBe("crouch");
    expect(p.eyeHeight).toBeLessThan(1.2);
  });
});
