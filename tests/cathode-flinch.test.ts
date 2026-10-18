import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { Flinch, flinchImpulse, flinchScale, peakPerKick, weaponPush } from "../games/cathode/src/game/anim/springs";
import { tuning } from "../games/cathode/src/game/feel/tuning";
import { animate, type Motion } from "../games/cathode/src/game/animate";
import { Body, enforcerLook } from "../games/cathode/src/game/body";

const DEG = Math.PI / 180;
const front = { x: 0, y: 0, z: -1 };

function motion(f?: Flinch): Motion {
  return { pos: new THREE.Vector3(), yaw: 0, speed: 0, phase: 0, pitch: 0, crouch: 0, aim: 1, kick: 0, flinch: f };
}

describe("CATHODE hit flinch (S4.1)", () => {
  it("scales by the share of health taken, clamped to 0.4..1.4, times poise", () => {
    expect(flinchScale(1, 100)).toBeCloseTo(0.4);
    expect(flinchScale(25, 100)).toBeCloseTo(1);
    expect(flinchScale(200, 100)).toBeCloseTo(1.4);
    expect(flinchScale(25, 100, 0.7)).toBeCloseTo(0.7);
    // Never zero: every hit shows (pillar 3).
    expect(flinchScale(0, 1000, tuning.flinch.poise.shield)).toBeGreaterThan(0.2);
  });

  it("asks each zone for the table's impulse", () => {
    const head = flinchImpulse("head", front, 1, 1);
    expect(head.headTip).toBeCloseTo(tuning.flinch.zones.head.pitchDeg * DEG);
    expect(tuning.flinch.zones.head.pitchDeg).toBeGreaterThanOrEqual(22);
    expect(Math.abs(head.headYaw)).toBeCloseTo(10 * DEG);
    expect(Math.hypot(head.rootX, head.rootZ)).toBeCloseTo(tuning.flinch.zones.head.pushM);
    const torso = flinchImpulse("torso", front, 1, 1);
    expect(torso.torsoTip).toBeCloseTo(6 * DEG);
    expect(Math.abs(torso.twist)).toBeCloseTo(12 * DEG);
    expect(torso.shrug).toBeGreaterThan(0.02);
    expect(Math.hypot(torso.rootX, torso.rootZ)).toBeCloseTo(0.15);
    const arm = flinchImpulse("armR", front, -1, 1);
    expect(arm.armR).toBeCloseTo(28 * DEG);
    expect(arm.muzzleDrop).toBeCloseTo(15 * DEG);
    const leg = flinchImpulse("legL", front, 1, 1);
    expect(leg.kneeL).toBeCloseTo(18 * DEG);
    expect(leg.pelvisDrop).toBeCloseTo(0.06);
  });

  it("twists the hit side away from the round, and pushes along it", () => {
    const left = flinchImpulse("torso", front, 1, 1);
    const right = flinchImpulse("torso", front, -1, 1);
    expect(Math.sign(left.twist)).toBe(-Math.sign(right.twist));
    expect(left.rootZ).toBeLessThan(0);
    // From behind, the twist reverses.
    const behind = flinchImpulse("torso", { x: 0, y: 0, z: 1 }, 1, 1);
    expect(Math.sign(behind.twist)).toBe(-Math.sign(left.twist));
  });

  it("pushes harder with heavier guns", () => {
    expect(weaponPush("pistol", 10)).toBeCloseTo(0.15);
    expect(weaponPush("rifle", 10)).toBeCloseTo(0.25);
    expect(weaponPush("shotgun", 4)).toBeCloseTo(0.45);
    expect(weaponPush("sniper", 40)).toBeCloseTo(0.375);
    const p = flinchImpulse("torso", front, 1, 1, "pistol");
    const s = flinchImpulse("torso", front, 1, 1, "sniper");
    expect(Math.abs(s.rootZ)).toBeCloseTo(Math.abs(p.rootZ) * 2.5);
  });

  it("peaks near the impulse within two frames and settles in about 250 ms", () => {
    const f = new Flinch();
    const imp = flinchImpulse("head", front, 1, 1);
    f.hit("head", imp, front);
    let peak = 0;
    let peakT = 0;
    for (let t = 1; t <= 120; t++) {
      f.update(0.001);
      if (f.get("headTip") > peak) {
        peak = f.get("headTip");
        peakT = t;
      }
    }
    expect(peak / imp.headTip).toBeGreaterThan(0.9);
    expect(peak / imp.headTip).toBeLessThan(1.1);
    expect(peakT).toBeGreaterThan(20);
    expect(peakT).toBeLessThan(60);
    for (let t = 120; t < 320; t++) f.update(0.001);
    expect(Math.abs(f.get("headTip"))).toBeLessThan(imp.headTip * 0.05);
    expect(peakPerKick(tuning.flinch.spring)).toBeGreaterThan(0);
  });

  it("is stable at a 100 ms frame and stays clamped under a hail of hits", () => {
    const f = new Flinch();
    for (let i = 0; i < 40; i++) {
      f.hit("torso", flinchImpulse("torso", front, 1, 1.4, "shotgun", 2), front);
      f.update(0.1);
    }
    expect(Math.abs(f.get("torsoTip"))).toBeLessThanOrEqual(tuning.flinch.maxDeg * DEG + 1e-9);
    expect(Math.hypot(f.get("rootX"), f.get("rootZ"))).toBeLessThan(1);
    for (let i = 0; i < 40; i++) f.update(0.1);
    expect(f.still).toBe(true);
  });

  it("moves the head visibly: at least 8 cm 60 ms after a pistol headshot (8 px at 10 m on 5K)", () => {
    const b0 = new Body(enforcerLook());
    animate(b0, motion());
    const rest = b0.joints.head.clone();
    const f = new Flinch();
    const b = new Body(enforcerLook());
    f.hit("head", flinchImpulse("head", front, 1, flinchScale(25, 130)), front);
    for (let t = 0; t < 60; t += 1000 / 240) f.update(1 / 240);
    animate(b, motion(f));
    // Going with the round: the head goes back (-z, away from a shooter in front).
    expect(b.joints.head.z).toBeLessThan(rest.z);
    expect(b.joints.head.distanceTo(rest)).toBeGreaterThan(0.08);
  });

  it("buckles the hit knee and drops the pelvis on a leg hit; bones keep their lengths", () => {
    const b0 = new Body(enforcerLook());
    animate(b0, motion());
    const f = new Flinch();
    const b = new Body(enforcerLook());
    f.hit("legL", flinchImpulse("legL", front, 1, 1), front);
    for (let i = 0; i < 9; i++) f.update(1 / 240);
    animate(b, motion(f));
    expect(b.joints.pelvis.y).toBeLessThan(b0.joints.pelvis.y);
    expect(b.joints.kneeL.z).toBeGreaterThan(b0.joints.kneeL.z);
    const len = (a: THREE.Vector3, c: THREE.Vector3) => a.distanceTo(c);
    expect(len(b.joints.neck, b.joints.head)).toBeCloseTo(len(b0.joints.neck, b0.joints.head), 3);
    expect(len(b.joints.hipL, b.joints.kneeL)).toBeCloseTo(len(b0.joints.hipL, b0.joints.kneeL), 3);
  });
});

describe("CATHODE hit flash (S4.1)", () => {
  it("is white for one frame, then red from 0.6 fading to nothing by 175 ms", async () => {
    const { flashLevel } = await import("../games/cathode/src/game/body");
    expect(flashLevel(0)).toBeGreaterThanOrEqual(1.5);
    expect(flashLevel(16)).toBeGreaterThanOrEqual(1.5);
    expect(flashLevel(26)).toBeLessThanOrEqual(0.6);
    expect(flashLevel(26)).toBeGreaterThan(0.5);
    expect(flashLevel(100)).toBeLessThan(flashLevel(50));
    expect(flashLevel(tuning.hitFlash.whiteMs + tuning.hitFlash.fadeMs + 1)).toBe(0);
  });

  it("a kill rims the whole body's silhouette red past the flash, then dies away into a cold edge (C2; C9: a short pulse on the edge only, the body keeps its shading)", () => {
    const b = new Body(enforcerLook());
    b.flash("chest");
    b.deathGlow();
    const D = tuning.hitFlash.death;
    b.updateFlash(D.holdMs + 60);
    expect(b.rimUniform.value.x).toBeGreaterThan(D.level * 0.3);
    expect(b.rimUniform.value.x).toBeGreaterThan(b.rimUniform.value.y * 20);
    // The faces aren't filled: the segment flash has died away.
    b.updateFlash(200);
    expect(b.flashOf("head")).toBe(0);
    // C9: the pulse is over inside 0.65 s and leaves only a faint cold edge on the dead.
    b.updateFlash(D.holdMs + D.fadeMs);
    expect(b.rimUniform.value.x).toBeCloseTo(D.cold[0], 5);
    expect(b.rimUniform.value.z).toBeGreaterThan(b.rimUniform.value.x);
    expect(D.holdMs + D.fadeMs).toBeLessThanOrEqual(650);
  });

  it("lights only the hit segment, through one shared uniform with no material clones", () => {
    const look = enforcerLook();
    const b = new Body(look);
    b.flash("head");
    expect(b.flashOf("head")).toBeGreaterThan(1);
    expect(b.flashOf("chest")).toBe(0);
    b.updateFlash(60);
    const red = b.flashUniform.value[3]!;
    expect(red.x).toBeGreaterThan(red.y * 4);
    b.updateFlash(200);
    expect(b.flashOf("head")).toBe(0);
    // Every merged segment mesh carries its slot; the materials are the look's own.
    const mats = new Set<unknown>();
    b.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.visible) {
        expect(m.geometry.getAttribute("aSeg")).toBeTruthy();
        mats.add(m.material);
      }
    });
    expect(mats.size).toBeLessThanOrEqual(4);
  });
});
