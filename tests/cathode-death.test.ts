import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { DeathCam, GunDrop, deathState, resyncState } from "../games/cathode/src/game/death-cam";
import { tuning } from "../games/cathode/src/game/feel/tuning";
import { DEATH_LINES, deathLine } from "../games/cathode/src/game/voice";
import { freshResume, restartResume, UNLOCKS_KEY, type Store } from "../games/cathode/src/sim/checkpoint";
import { SAVE_KEY, makeSave, serialize } from "../games/cathode/src/sim/save";
import { newCharacter } from "../games/cathode/src/sim/character";

const D = tuning.death;

describe("C8 death sequence (S6.6)", () => {
  it("deathState only ever moves one way, and the card shows at 2200 ms", () => {
    let prev = deathState(0);
    for (let t = 1; t <= 4000; t += 1) {
      const s = deathState(t);
      for (const k of ["death", "ink", "bars", "killer", "card", "fall", "ca"] as const) expect(s[k]).toBeGreaterThanOrEqual(prev[k] - 1e-12);
      expect(s.fov).toBeLessThanOrEqual(prev.fov + 1e-12);
      expect(s.muffleHz).toBeLessThanOrEqual(prev.muffleHz + 1e-9);
      prev = s;
    }
    expect(deathState(D.cardMs - 1).card).toBe(0);
    expect(deathState(D.cardMs + 50).card).toBeGreaterThan(0);
    expect(deathState(D.cardMs + D.cardFadeMs).card).toBeCloseTo(1, 6);
    expect(deathState(2199).phase).toBe("freeze");
    expect(deathState(2200).phase).toBe("card");
  });

  it("follows the spec's table: hit-stop, slow fall, uDeath 0.35 then 0.8, ink 0.85, FOV 75 to 62, muffle to 900 Hz", () => {
    expect(deathState(50).worldScale).toBe(0);
    expect(deathState(500).worldScale).toBeCloseTo(D.slow, 6);
    expect(deathState(1600).worldScale).toBe(0);
    expect(deathState(D.death1Ms).death).toBeCloseTo(0.35, 6);
    expect(deathState(D.settleEndMs).death).toBeCloseTo(0.8, 6);
    expect(deathState(D.inkFromMs).ink).toBe(0);
    expect(deathState(D.inkFromMs + D.inkMs).ink).toBeCloseTo(0.85, 6);
    expect(deathState(0).fov).toBe(75);
    expect(deathState(D.fallEndMs).fov).toBeCloseTo(62, 6);
    expect(deathState(D.stopMs + D.muffleMs).muffleHz).toBeCloseTo(900, 3);
    expect(deathState(899).skippable).toBe(false);
    expect(deathState(900).skippable).toBe(true);
    expect(deathState(D.barsFromMs - 1).bars).toBe(0);
    expect(deathState(D.barsFromMs + D.barsMs).bars).toBeCloseTo(1, 6);
  });

  it("the re-sync runs 900 ms: the ink out over 300, a 250 ms glitch, then a 350 ms fade from black", () => {
    let prevInk = Infinity;
    for (let t = 0; t <= 900; t += 5) {
      const r = resyncState(t);
      expect(r.ink).toBeLessThanOrEqual(prevInk + 1e-12);
      prevInk = r.ink;
    }
    expect(resyncState(0).ink).toBeCloseTo(D.ink, 6);
    expect(resyncState(300).ink).toBeCloseTo(0, 6);
    expect(resyncState(100).glitch).toBe(0);
    expect(resyncState(420).glitch).toBeGreaterThan(0.3);
    expect(resyncState(550).black).toBeGreaterThan(0.99);
    expect(resyncState(900).black).toBeCloseTo(0, 6);
    expect(resyncState(899).done).toBe(false);
    expect(resyncState(900).done).toBe(true);
  });

  const seed = (o: Partial<Parameters<DeathCam["start"]>[0]> = {}) => ({
    feet: new THREE.Vector3(0, 0, 0),
    eyeHeight: 1.62,
    yaw: 0,
    vel: new THREE.Vector3(),
    from: new THREE.Vector3(0, 1.4, -9),
    share: 0.3,
    ground: () => 0,
    seed: 0.4,
    ...o,
  });

  it("the body cam goes down knees first, stops 0.12 m off the floor and rolls 60 to 80 degrees", () => {
    const cam = new DeathCam();
    cam.start(seed());
    const run = (sec: number) => {
      for (let t = 0; t < sec - 1e-9; t += 1 / 60) cam.update(1 / 60);
    };
    run(0.1);
    expect(cam.pos.y).toBeGreaterThan(1.5);
    run(0.25);
    // Knees first: the hips have dropped before the head reaches the floor.
    expect(cam.p[2]!.y).toBeLessThan(1.62 * 0.55 - 0.2);
    run(1.5);
    expect(cam.pos.y).toBeGreaterThanOrEqual(D.groundM - 1e-6);
    expect(cam.pos.y).toBeLessThan(D.groundM + 0.06);
    const roll = Math.abs(THREE.MathUtils.radToDeg(cam.roll));
    expect(roll).toBeGreaterThanOrEqual(60);
    expect(roll).toBeLessThanOrEqual(80);
  });

  it("frames the killer once she's down, and a replay lands on the same pose", () => {
    const a = new DeathCam();
    a.start(seed({ from: new THREE.Vector3(6, 1.4, -6) }));
    a.killer = new THREE.Vector3(6, 1.3, -6);
    for (let i = 0; i < 120; i++) a.update(1 / 60);
    const to = Math.atan2(-(6 - a.pos.x), -(-6 - a.pos.z));
    let dy = a.yaw - to;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    expect(Math.abs(dy)).toBeLessThan(0.25);
    const b = new DeathCam();
    b.start(seed({ from: new THREE.Vector3(6, 1.4, -6) }));
    b.killer = a.killer;
    b.sampleAt(2000);
    expect(b.pos.distanceTo(a.pos)).toBeLessThan(1e-5);
    expect(b.yaw).toBeCloseTo(a.yaw, 3);
  });

  it("reduced motion: no roll, the camera slides 0.8 m down and holds", () => {
    const cam = new DeathCam();
    cam.start(seed({ reducedMotion: true }));
    for (let i = 0; i < 120; i++) cam.update(1 / 60);
    expect(cam.roll).toBe(0);
    expect(cam.pos.y).toBeCloseTo(1.62 - D.reducedSlideM, 6);
  });

  it("the gun leaves her hand at 120 ms and clatters on the floor between 500 and 800 ms", () => {
    const obj = new THREE.Object3D();
    obj.position.set(0.25, 1.3, -0.4);
    let landedAt = -1;
    let t = D.gunDropMs;
    const drop = new GunDrop(obj, () => 0, () => {
      if (landedAt < 0) landedAt = t;
    });
    drop.vel.set(0, 0.6, -1.1);
    drop.spin.set(5.5, 3.2, -7.5);
    for (; t < 3000 && !drop.atRest; t += 1000 / 240) drop.update(1 / 240);
    expect(landedAt).toBeGreaterThanOrEqual(500);
    expect(landedAt).toBeLessThanOrEqual(800);
    expect(drop.atRest).toBe(true);
    expect(obj.position.y).toBeCloseTo(0.03, 6);
  });

  it("24 death lines, none of them 'Game Over', and never the same line twice running", () => {
    const all = Object.values(DEATH_LINES).flat();
    expect(all).toHaveLength(24);
    expect(new Set(all).size).toBe(24);
    for (const l of all) expect(l.toLowerCase()).not.toContain("game over");
    for (let i = 0; i < 50; i++) {
      const a = deathLine("bullet", i / 50);
      expect(deathLine("bullet", i / 50, a)).not.toBe(a);
    }
  });
});

describe("C8 Retry from checkpoint (S6.6)", () => {
  const store = (m: Record<string, string>): Store => ({ getItem: (k) => m[k] ?? null });
  const saved = () => {
    const c = newCharacter("ghost");
    c.xp = 140;
    return {
      [SAVE_KEY]: serialize(makeSave(c, "2026-10-18T00:00:00.000Z", { jobsDone: ["fishMarket"] })),
      [UNLOCKS_KEY]: JSON.stringify({ weapons: ["pin", "kestrel"], features: ["fire", "aim"] }),
    };
  };

  it("restartFromCheckpoint matches a fresh resume deep-equal, apart from deaths++", () => {
    const m = saved();
    const fresh = freshResume(store(m), 2);
    const restart = restartResume(store(m), 2);
    expect(restart.deaths).toBe(3);
    expect({ ...restart, deaths: fresh.deaths }).toEqual(fresh);
  });

  it("what the dying session held in memory doesn't come back: only the stored checkpoint does", () => {
    const m = saved();
    const live = freshResume(store(m));
    // The fight: XP and a gun picked up after the checkpoint, never saved.
    live.character!.xp += 900;
    live.unlocks!.weapons.push("vandal");
    const back = restartResume(store(m), 0);
    expect(back.character!.xp).toBe(140);
    expect(back.unlocks!.weapons).toEqual(["pin", "kestrel"]);
  });

  it("an empty or broken store resumes from the defaults", () => {
    expect(freshResume(store({}))).toEqual({ character: null, jobsDone: [], unlocks: null, deaths: 0 });
    expect(freshResume(store({ [SAVE_KEY]: "{nope", [UNLOCKS_KEY]: "[" })).character).toBeNull();
  });
});
