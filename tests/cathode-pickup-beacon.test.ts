import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { Beacon, beamFade, glintFlash, hudUnit, pulse } from "../games/cathode/src/game/beacon";
import { FIRST_CASE, FirstJob, TAKEDOWN_POSE, TAKE_RANGE, reach, type JobHost } from "../games/cathode/src/game/firstjob";
import { buildDistrict } from "../games/cathode/src/render/levels/index";
import { RayWorld } from "../games/cathode/src/game/ray";
import { PRESS_RADIUS, Pickups } from "../games/cathode/src/game/pickups";

/** S7.1: the first gun can't be missed. */
describe("CATHODE pickup beacon (C3)", () => {
  it("the beam is full down the street, eases near the case and is gone on top of it", () => {
    expect(beamFade(1)).toBe(0);
    expect(beamFade(1.5)).toBe(0);
    expect(beamFade(3)).toBeGreaterThan(0);
    expect(beamFade(5)).toBeCloseTo(0.55);
    expect(beamFade(12)).toBeGreaterThan(0.55);
    expect(beamFade(20)).toBe(1);
    expect(beamFade(60)).toBe(1);
    expect(beamFade(70)).toBeCloseTo(0.5);
    expect(beamFade(90)).toBe(0);
    // Never rises as she walks in from 60 m to 1.5 m.
    let last = 1;
    for (let d = 60; d >= 1.5; d -= 0.25) {
      expect(beamFade(d)).toBeLessThanOrEqual(last + 1e-9);
      last = beamFade(d);
    }
  });

  it("the glint flashes for 350 ms every 2.5 s, and the rim pulses at 1 Hz", () => {
    expect(glintFlash(0.175)).toBeCloseTo(1);
    expect(glintFlash(0.4)).toBe(0);
    expect(glintFlash(2.5 + 0.175)).toBeCloseTo(1);
    expect(pulse(0)).toBeCloseTo(0);
    expect(pulse(0.5)).toBeCloseTo(1);
    expect(pulse(1)).toBeCloseTo(0);
  });

  it("the glint never shrinks below 14u on screen", () => {
    const b = new Beacon({ glint: true });
    const cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 500);
    cam.position.set(0, 1, 40);
    cam.updateMatrixWorld();
    b.update(0.175, 40, cam, 1440, 2560);
    const size = b.glint!.scale.x;
    const mPerPx = (2 * 40 * Math.tan(THREE.MathUtils.degToRad(35))) / 1440;
    expect(size / mPerPx).toBeGreaterThanOrEqual(14 * hudUnit(2560, 1440) * 0.99);
  });

  it("the case sits within 15 degrees of her facing at the takedown, within 10 m, in plain sight", () => {
    const level = buildDistrict("market", "high");
    const rays = new RayWorld(level.builder.colliders, { mats: level.builder.mats, obbs: level.builder.obbs, thin: level.builder.shotOnly });
    const g = (x: number, z: number) => level.groundHeight?.(x, z) ?? 0;
    const eye = new THREE.Vector3(TAKEDOWN_POSE.x, g(TAKEDOWN_POSE.x, TAKEDOWN_POSE.z) + 1.6, TAKEDOWN_POSE.z);
    // The gun lies on the stall top, about 1 m up.
    const gun = new THREE.Vector3(FIRST_CASE.x, g(FIRST_CASE.x, FIRST_CASE.z) + 1.05, FIRST_CASE.z);
    const to = gun.clone().sub(eye);
    const facing = new THREE.Vector3(-Math.sin(TAKEDOWN_POSE.yaw), 0, -Math.cos(TAKEDOWN_POSE.yaw));
    const yawOff = THREE.MathUtils.radToDeg(new THREE.Vector3(to.x, 0, to.z).angleTo(facing));
    expect(yawOff).toBeLessThanOrEqual(15);
    expect(reach(eye, gun)).toBeLessThanOrEqual(10);
    expect(rays.cast(eye, to.clone().normalize(), to.length() - 0.1)).toBeNull();
  });
});

/** A minimal host: the first job runs without a renderer. */
function host(): JobHost & { armed: string[]; pos: THREE.Vector3 } {
  const pos = new THREE.Vector3(TAKEDOWN_POSE.x, 0, TAKEDOWN_POSE.z);
  const armed: string[] = [];
  const enemy = () =>
    ({
      alive: true,
      state: "unaware",
      position: new THREE.Vector3(),
      body: { joints: { chest: new THREE.Vector3() } },
      die() {
        (this as { alive: boolean }).alive = false;
      },
    }) as never;
  return {
    pos,
    armed,
    player: { pos } as never,
    progress: { unlocks: { weapons: ["pin"] }, character: { classes: ["ghost"] }, teach() {}, jobsDone: [], save() {} } as never,
    scene: new THREE.Scene(),
    markers: {},
    ground: () => 0,
    touch: false,
    spawn: enemy,
    arm: (id) => armed.push(id),
    say() {},
    teach() {},
    banner() {},
  };
}

describe("CATHODE weapons need a press (S7.1)", () => {
  it("walking onto the first gun doesn't take it; a press within reach does, and the lid shuts first", () => {
    const h = host();
    const job = new FirstJob(h);
    job.skipTo(2);
    expect(job.case).not.toBeNull();
    // Out of reach: no prompt, and a press does nothing.
    expect(job.offer()).toBeNull();
    expect(job.take()).toBe(false);
    // Stand right on it: still hers to take, not taken.
    h.pos.set(job.case!.gunAt.x, 0, job.case!.gunAt.z + 0.3);
    for (let i = 0; i < 30; i++) job.update(1 / 30);
    expect(job.stage).toBe(2);
    expect(job.offer()?.weapon).toBe("kestrel");
    // Within the prompt's range, a press takes it; the stage moves on once the lid is shut.
    h.pos.set(job.case!.gunAt.x, 0, job.case!.gunAt.z + TAKE_RANGE - 0.2);
    expect(job.offer()).not.toBeNull();
    expect(job.take()).toBe(true);
    job.update(0.1);
    expect(job.stage).not.toBe(3);
    for (let i = 0; i < 10; i++) job.update(0.05);
    expect(job.stage).toBe(3);
    expect(h.armed).toContain("kestrel");
  });

  it("loot: ammo and cash are walk-in, a new gun waits for a press", () => {
    const p = new Pickups();
    p.drop(new THREE.Vector3(0, 0, 0), { items: [], scrip: 5 });
    p.drop(new THREE.Vector3(10, 0, 0), { items: [], scrip: 0, gun: "corridorAR" });
    const needsPress = (d: { gun?: string }) => !!d.gun;
    expect(p.update(0.1, new THREE.Vector3(0.2, 0, 0), { needsPress })).toEqual([{ items: [], scrip: 5 }]);
    expect(p.update(0.1, new THREE.Vector3(10, 0, 0.2), { needsPress })).toHaveLength(0);
    expect(p.offer?.drop.gun).toBe("corridorAR");
    expect(p.update(0.1, new THREE.Vector3(10, 0, PRESS_RADIUS - 0.5), { needsPress, take: true })).toEqual([{ items: [], scrip: 0, gun: "corridorAR" }]);
    expect(p.list).toHaveLength(0);
  });
});
