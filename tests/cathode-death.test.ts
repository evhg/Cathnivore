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

// ---------------------------------------------------------------- C9 "Deaths that land" (S4.4)
import { Body, JOINTS, REST, enforcerLook, type Joint } from "../games/cathode/src/game/body";
import { DEATH, DEATH_VARIANTS, DeathRun, DroppedProp, kneeInfo, limitJoints, pickVariant, poseK, visorLevel, type DeathCtx, type DeathVariant } from "../games/cathode/src/game/death";

const flat = { colliders: [] as THREE.Box3[], ground: () => 0 };
const look = enforcerLook();
function standing(b: Body, lift = 0): void {
  b.revive();
  for (const j of JOINTS) b.joints[j].copy(REST[j]).add(new THREE.Vector3(0, lift, 0));
  b.carry();
  b.carry();
}
function die(b: Body, v: DeathVariant | null, impulse = new THREE.Vector3(0, 0.5, -3.5), ctx: Partial<DeathCtx> = {}): DeathRun | null {
  const run = v ? new DeathRun(v, { side: ctx.side ?? 0, wallBehind: ctx.wallBehind ?? null, rail: ctx.rail ?? null }, new THREE.Vector3(0, 0, 0), 0) : null;
  b.goLimp(impulse, b.joints.chest.clone(), run ?? undefined);
  return run;
}
const base: DeathCtx = { zone: "torso", weaponCls: "pistol", distance: 8, side: 0, seed: 7 };

describe("C9 deaths that land (S4.4)", () => {
  it("picks the variant from the spec's table, the same way every time", () => {
    expect(pickVariant({ ...base, zone: "head" })).toBe("headshot");
    expect(pickVariant({ ...base, weaponCls: "shotgun", distance: 3 })).toBe("blownback");
    expect(pickVariant({ ...base, explosive: true })).toBe("blownback");
    expect(pickVariant({ ...base, zone: "legL" })).toBe("knees");
    expect(pickVariant({ ...base, wallBehind: 0.8 })).toBe("wallslump");
    expect(pickVariant({ ...base, wallBehind: 1.6 })).toBe("gutclutch");
    expect(pickVariant({ ...base, rail: { z: -0.6, h: 1 } })).toBe("rail");
    expect(pickVariant({ ...base, side: 0.9 })).toBe("spin");
    expect(pickVariant({ ...base, zone: "armR", side: -0.8 })).toBe("spin");
    expect(pickVariant({ ...base, crawlEnded: true })).toBe("crawlout");
    // The first gun kill of a new save is always the gut clutch, even from the side.
    expect(pickVariant({ ...base, side: 0.9, firstGunKill: true })).toBe("gutclutch");
    // Deterministic: the same hit, the same death, across a thousand random contexts.
    const zones = ["head", "torso", "armL", "armR", "legL", "legR"] as const;
    const cls = ["pistol", "rifle", "shotgun", "sniper", "smg", "melee"];
    let seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const c: DeathCtx = { zone: zones[i % 6]!, weaponCls: cls[(i * 7) % 6]!, distance: (i * 13) % 30, side: Math.sin(i), seed: i, wallBehind: i % 5 === 0 ? 0.9 : null };
      const v = pickVariant(c);
      expect(pickVariant({ ...c })).toBe(v);
      seen.add(v);
    }
    expect(seen.size).toBeGreaterThanOrEqual(5);
    seen = new Set();
  });

  it("the pose spring fades from 0.6 to 0 along a smoothstep over the active phase", () => {
    expect(poseK("gutclutch", 0)).toBeCloseTo(0.6, 6);
    expect(poseK("gutclutch", 675)).toBeCloseTo(0.3, 6);
    expect(poseK("gutclutch", 900)).toBe(0);
    // The slump's sit is held until he sleeps in it.
    expect(poseK("wallslump", 5000)).toBeGreaterThan(0);
    expect(poseK("headshot", 0)).toBe(0);
    for (let t = 0; t < 900; t += 10) expect(poseK("gutclutch", t + 10)).toBeLessThanOrEqual(poseK("gutclutch", t));
  });

  it("the gut clutch drops the pelvis about half a metre by 500 ms with both hands at the wound", () => {
    const b = new Body(look);
    standing(b);
    die(b, "gutclutch", new THREE.Vector3(0, 0, -0.5));
    for (let i = 0; i < 30; i++) b.physics(1 / 60, flat);
    expect(b.joints.pelvis.y).toBeLessThan(REST.pelvis.y - 0.3);
    expect(b.joints.pelvis.y).toBeGreaterThan(0.25);
    // Hands in front of the belly, close together.
    expect(b.joints.handL.distanceTo(b.joints.handR)).toBeLessThan(0.3);
    expect(b.joints.handL.z).toBeGreaterThan(b.joints.pelvis.z);
  });

  it("the variants put the body in different places: no two deaths end in the same heap", () => {
    const ends: Record<string, THREE.Vector3[]> = {};
    for (const v of ["headshot", "gutclutch", "spin", "wallslump", "knees"] as DeathVariant[]) {
      const b = new Body(look);
      standing(b);
      const w = v === "wallslump" ? { colliders: [new THREE.Box3(new THREE.Vector3(-3, 0, -1.4), new THREE.Vector3(3, 3, -0.9))], ground: () => 0 } : flat;
      die(b, v, new THREE.Vector3(0, 0.3, -3.5), { side: 0.8, wallBehind: 0.9 });
      for (let i = 0; i < 180; i++) b.physics(1 / 60, w);
      ends[v] = JOINTS.map((j) => b.joints[j].clone());
    }
    const keys = Object.keys(ends);
    for (let i = 0; i < keys.length; i++)
      for (let k = i + 1; k < keys.length; k++) {
        const a = ends[keys[i]!]!;
        const c = ends[keys[k]!]!;
        const mean = a.reduce((s, p, n) => s + p.distanceTo(c[n]!), 0) / a.length;
        expect(mean, `${keys[i]} vs ${keys[k]}`).toBeGreaterThan(0.12);
      }
    // The slump sits him up against the wall: the head stays well off the floor.
    expect(ends.wallslump![JOINTS.indexOf("head")]!.y).toBeGreaterThan(0.45);
  });

  it("after a 1 m fall the knees bend only forward and stay within range, every frame for 600 steps", () => {
    for (const v of [null, "headshot", "gutclutch", "spin", "knees"] as (DeathVariant | null)[]) {
      const b = new Body(look);
      standing(b, 1);
      die(b, v, new THREE.Vector3(1.5, 0.5, -3));
      for (let i = 0; i < 600; i++) {
        b.physics(1 / 60, flat);
        if (i < 2) continue;
        for (const s of ["L", "R"] as const) {
          const k = kneeInfo(b.joints, s);
          expect(k.interiorDeg, `${v} step ${i} knee${s}`).toBeGreaterThanOrEqual(180 - DEATH.kneeDeg - 1);
          expect(k.front, `${v} step ${i} knee${s} bends backward`).toBeGreaterThan(-0.02);
        }
        const u = new THREE.Vector3().subVectors(b.joints.neck, b.joints.chest).normalize();
        const hv = new THREE.Vector3().subVectors(b.joints.head, b.joints.neck).normalize();
        expect((Math.acos(Math.min(1, u.dot(hv))) * 180) / Math.PI).toBeLessThanOrEqual(DEATH.neckDeg + 2);
      }
    }
  });

  it("a body sleeps within 2 s of going limp, and stays where it lies", () => {
    for (const v of DEATH_VARIANTS) {
      if (v === "rail") continue;
      const b = new Body(look);
      standing(b);
      const run = die(b, v, new THREE.Vector3(0.5, 0.4, -3.5), { side: 0.7, wallBehind: 0.9 });
      const limitS = (run?.dur ?? 0) / 1000 + 2;
      let t = 0;
      while (!b.asleep && t < limitS + 1) {
        b.physics(1 / 60, flat);
        t += 1 / 60;
      }
      expect(b.asleep, v).toBe(true);
      expect(t, v).toBeLessThanOrEqual(limitS + 1e-6);
      const at = JOINTS.map((j) => b.joints[j].clone());
      for (let i = 0; i < 60; i++) b.physics(1 / 60, flat);
      JOINTS.forEach((j, i) => expect(b.joints[j].distanceTo(at[i]!)).toBe(0));
      expect(b.asleepFor).toBeGreaterThan(0.9);
    }
  });

  it("no NaN and nothing flies off over 10k random lethal impulses (the quick fuzz)", () => {
    const b = new Body(look);
    let rnd = 12345;
    const r = () => ((rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const box = { colliders: [new THREE.Box3(new THREE.Vector3(-0.6, 0, 0.4), new THREE.Vector3(0.6, 1, 1.2))], ground: (x: number) => (x > 1 ? 0.15 : 0) };
    for (let n = 0; n < 10000; n++) {
      standing(b, r() * 1.2);
      const v = DEATH_VARIANTS[Math.floor(r() * DEATH_VARIANTS.length)]!;
      const s = r() < 0.05 ? 400 : 60;
      const imp = new THREE.Vector3((r() - 0.5) * s, (r() - 0.3) * s, (r() - 0.5) * s);
      die(b, r() < 0.15 ? null : v, imp, { side: r() * 2 - 1, wallBehind: r() < 0.3 ? 0.4 + r() : null, rail: r() < 0.1 ? { z: r() - 0.5, h: 1 } : null });
      if (r() < 0.3) b.kick(JOINTS[Math.floor(r() * JOINTS.length)]!, new THREE.Vector3(r() * 30, r() * 30, r() * 30));
      const steps = 4 + Math.floor(r() * 8);
      let reach = 4.5;
      for (let i = 0; i < steps; i++) {
        const dt = r() < 0.1 ? 0.1 : 1 / 60;
        reach += DEATH.maxSpeed * dt * 1.2;
        b.physics(dt, box);
      }
      for (const j of JOINTS) {
        const p = b.joints[j];
        const ok = Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z) && p.length() < reach;
        if (!ok) expect(`death ${n} ${v} ${j} at ${p.toArray()}`).toBe("finite and within reach");
      }
    }
  }, 30_000);

  it("limits fix a knee bent backward and a head folded onto the chest", () => {
    const J = {} as Record<Joint, THREE.Vector3>;
    for (const j of JOINTS) J[j] = REST[j].clone();
    J.kneeL.set(REST.kneeL.x, 0.5, -0.2); // bent the wrong way
    J.head.set(0, 1.3, 0.2); // folded down onto the chest
    limitJoints(J);
    expect(kneeInfo(J, "L").front).toBeGreaterThanOrEqual(-1e-6);
    const u = new THREE.Vector3().subVectors(J.neck, J.chest).normalize();
    const h = new THREE.Vector3().subVectors(J.head, J.neck).normalize();
    expect((Math.acos(u.dot(h)) * 180) / Math.PI).toBeLessThanOrEqual(DEATH.neckDeg + 1e-3);
  });

  it("the visor light goes out over 900 ms with two flickers", () => {
    expect(visorLevel(0)).toBe(1);
    expect(visorLevel(900)).toBe(0);
    expect(visorLevel(280)).toBeLessThan(visorLevel(310) * 0.5);
    expect(visorLevel(530)).toBeLessThan(visorLevel(560) * 0.5);
    expect(visorLevel(450)).toBeLessThan(visorLevel(100));
  });

  it("a dropped rifle clatters at least twice and comes to rest flat on the floor", () => {
    const hits: number[] = [];
    const g = new DroppedProp(new THREE.Vector3(0, 1.1, 0), new THREE.Vector3(0, 1.0, 0.62), new THREE.Vector3(0.5, 1, 0.4), 3, (s) => hits.push(s));
    for (let i = 0; i < 300 && !g.asleep; i++) g.step(1 / 60, () => 0);
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(g.asleep).toBe(true);
    expect(Math.abs(g.a.y - g.b.y)).toBeLessThan(0.02);
    expect(g.a.y).toBeLessThan(0.06);
  });
});
