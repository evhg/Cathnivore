// C10 (docs/design/cathode-combat.md S3.1): the 21-joint rig's ragdoll keeps its bones. After a death push and
// 600 settle steps every segment and every brace in LINKS holds its rest length within 2%, and the five riding
// joints (spine2, the clavicles, the wrists) stay where the authored poses put them.
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { Body, LINKS, REST, SEGMENTS, enforcerLook } from "../games/cathode/src/game/body";
import { animate } from "../games/cathode/src/game/animate";
import { DeathRun, DEATH_VARIANTS } from "../games/cathode/src/game/death";
import { deriveJoints, JOINTS } from "../games/cathode/src/game/rig";

const flat = { colliders: [] as THREE.Box3[], ground: () => 0 };

describe("CATHODE body (C10)", () => {
  it("authored poses fill the riding joints: spine2 on the spine, wrists a palm up the forearm", () => {
    const b = new Body(enforcerLook());
    animate(b, { pos: new THREE.Vector3(), yaw: 0.4, speed: 1.2, phase: 1, pitch: 0.1, crouch: 0, aim: 0.6, kick: 0 });
    const J = b.joints;
    const copy = Object.fromEntries(JOINTS.map((j) => [j, J[j].clone()])) as typeof J;
    deriveJoints(copy);
    for (const j of ["spine2", "clavicleL", "clavicleR", "wristL", "wristR"] as const) expect(J[j].distanceTo(copy[j])).toBeLessThan(1e-6);
    expect(J.wristR.distanceTo(J.handR)).toBeCloseTo(0.07, 3);
  });

  for (const v of [null, ...DEATH_VARIANTS.filter((x) => x !== "rail" && x !== "crawlout")])
    it(`holds every rest length within 2% after 600 settle steps (${v ?? "plain ragdoll"})`, () => {
      const b = new Body(enforcerLook());
      animate(b, { pos: new THREE.Vector3(), yaw: 0, speed: 0, phase: 0, pitch: 0, crouch: 0, aim: 0, kick: 0 });
      b.carry();
      const run = v ? new DeathRun(v, { side: 0.3 }, new THREE.Vector3(), 0) : undefined;
      b.goLimp(new THREE.Vector3(0.5, 0.8, -4), b.joints.chest.clone(), run);
      for (let i = 0; i < 600; i++) b.physics(1 / 60, flat);
      const J = b.joints;
      for (const s of SEGMENTS) {
        const rest = REST[s.from].distanceTo(REST[s.to]);
        expect(Math.abs(J[s.from].distanceTo(J[s.to]) - rest) / rest, s.name).toBeLessThan(0.02);
      }
      for (const [a, c] of LINKS) {
        const rest = REST[a].distanceTo(REST[c]);
        expect(Math.abs(J[a].distanceTo(J[c]) - rest) / rest, `${a}-${c}`).toBeLessThan(0.02);
      }
      for (const j of JOINTS) expect(Number.isFinite(J[j].x + J[j].y + J[j].z)).toBe(true);
      expect(b.asleep).toBe(true);
    });

  it("the tabard hangs knee-length from the belt and stays out of the legs", () => {
    const b = new Body(enforcerLook());
    const m = { pos: new THREE.Vector3(), yaw: 0, speed: 1.6, phase: 0, pitch: 0, crouch: 0, aim: 0, kick: 0 };
    for (let i = 0; i < 180; i++) {
      m.phase += 0.12;
      m.pos.z += 1.6 / 60;
      animate(b, m);
      b.pose(1 / 60);
    }
    const c = b.cloth!;
    // Knee length: the hem ends around the knees (0.5 m), never on the street.
    expect(c.lowest).toBeGreaterThan(0.3);
    expect(c.lowest).toBeLessThan(0.7);
    // No particle inside a thigh.
    const J = b.joints;
    for (let s = 0; s < 8; s++)
      for (let r = 1; r < 4; r++) {
        const p = c.at(s, r);
        for (const [a, k] of [["hipL", "kneeL"], ["hipR", "kneeR"]] as const) {
          const ab = new THREE.Vector3().subVectors(J[k], J[a]);
          const t = THREE.MathUtils.clamp(new THREE.Vector3().subVectors(p, J[a]).dot(ab) / ab.lengthSq(), 0, 1);
          const d = p.distanceTo(J[a].clone().addScaledVector(ab, t));
          expect(d).toBeGreaterThan(0.1);
        }
      }
  });
});
