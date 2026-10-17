import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { solveTwoBone } from "../games/cathode/src/game/feel/ik";
import { ease, eventsBetween, sampleTrack, type Clip } from "../games/cathode/src/game/feel/clip";

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

describe("CATHODE two-bone IK (S0, C4)", () => {
  it("lands the end effector within 1 mm of a reachable target, bones keep their lengths", () => {
    const root = v(0.18, -0.28, 0.35);
    for (const target of [v(0.1, -0.2, -0.1), v(-0.05, -0.1, 0.05), v(0.3, -0.4, 0.2)]) {
      const r = solveTwoBone(root, target, v(0.6, -1, 0.3), 0.32, 0.3);
      expect(r.reached).toBe(true);
      expect(r.end.distanceTo(target)).toBeLessThan(0.001);
      expect(Math.abs(r.mid.distanceTo(root) - 0.32)).toBeLessThan(1e-6);
      expect(Math.abs(r.mid.distanceTo(r.end) - 0.3)).toBeLessThan(1e-6);
    }
  });

  it("bends toward the pole", () => {
    const r = solveTwoBone(v(0, 0, 0), v(0, 0, -0.4), v(0, -1, -0.2), 0.3, 0.3);
    expect(r.mid.y).toBeLessThan(-0.1);
    const r2 = solveTwoBone(v(0, 0, 0), v(0, 0, -0.4), v(1, 0, -0.2), 0.3, 0.3);
    expect(r2.mid.x).toBeGreaterThan(0.1);
  });

  it("straightens toward an unreachable target, or slides the root so the end still lands", () => {
    const root = v(0, 0, 0);
    const far = v(0, 0, -1);
    const r = solveTwoBone(root, far, v(0, -1, 0), 0.3, 0.3);
    expect(r.reached).toBe(false);
    expect(r.end.z).toBeCloseTo(-0.597, 2);
    const s = solveTwoBone(root, far, v(0, -1, 0), 0.3, 0.3, true);
    expect(s.end.distanceTo(far)).toBeLessThan(0.001);
    expect(s.root.z).toBeLessThan(-0.39);
  });

  it("survives a pole on the line and a target on the root", () => {
    const r = solveTwoBone(v(0, 0, 0), v(0, 0, -0.4), v(0, 0, -1), 0.3, 0.3);
    expect(Number.isFinite(r.mid.x + r.mid.y + r.mid.z)).toBe(true);
    const z = solveTwoBone(v(0, 0, 0), v(0, 0, 0), v(0, -1, 0), 0.3, 0.25);
    expect(Number.isFinite(z.mid.x + z.mid.y + z.mid.z)).toBe(true);
  });
});

describe("CATHODE keyframe clips (S0)", () => {
  const clip: Clip = {
    dur: 400,
    tracks: { mag: [[0, [0, 0, 0], [0, 0, 0]], [100, [0, -0.1, 0], [0.5, 0, 0], "linear"], [400, [0, 0, 0], [0, 0, 0], "out"]] },
    events: [[50, "magOut"], [300, "magIn"], [300, "click"]],
  };

  it("interpolates between keys with the key's ease and clamps at the ends", () => {
    expect(sampleTrack(clip.tracks.mag!, 50).pos[1]).toBeCloseTo(-0.05, 6);
    expect(sampleTrack(clip.tracks.mag!, 50).rot[0]).toBeCloseTo(0.25, 6);
    expect(sampleTrack(clip.tracks.mag!, 250).pos[1]).toBeCloseTo(-0.1 + 0.1 * ease("out", 0.5), 6);
    expect(sampleTrack(clip.tracks.mag!, -10).pos[1]).toBe(0);
    expect(sampleTrack(clip.tracks.mag!, 900).pos[1]).toBe(0);
  });

  it("eases are monotonic from 0 to 1", () => {
    for (const k of ["linear", "in", "out", "inOut", undefined] as const) {
      expect(ease(k, 0)).toBeCloseTo(0, 6);
      expect(ease(k, 1)).toBeCloseTo(1, 6);
      let prev = -1;
      for (let u = 0; u <= 1.0001; u += 0.05) {
        const e = ease(k, u);
        expect(e).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = e;
      }
    }
    expect(ease("outBack", 0.7)).toBeGreaterThan(1);
  });

  it("gives each event once in the frame that crosses it", () => {
    expect(eventsBetween(clip, 0, 49)).toEqual([]);
    expect(eventsBetween(clip, 49, 50)).toEqual(["magOut"]);
    expect(eventsBetween(clip, 50, 60)).toEqual([]);
    expect(eventsBetween(clip, 200, 320)).toEqual(["magIn", "click"]);
    // A whole clip in one long frame.
    expect(eventsBetween(clip, 0, 400)).toEqual(["magOut", "magIn", "click"]);
  });
});
