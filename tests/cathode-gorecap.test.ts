// C19 (S4.5 "The stump"): the lathe gore caps are built facing out, lit the right way, and stay small.
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildCap, CAP } from "../games/cathode/src/game/models/gorecap";

/** Faces whose winding agrees with their stored normal, and how many face up. */
function faces(g: THREE.BufferGeometry) {
  const p = g.getAttribute("position");
  const nn = g.getAttribute("normal");
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const s = new THREE.Vector3();
  let agree = 0;
  let total = 0;
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i);
    b.fromBufferAttribute(p, i + 1);
    c.fromBufferAttribute(p, i + 2);
    n.crossVectors(b.clone().sub(a), c.clone().sub(a));
    if (n.lengthSq() < 1e-14) continue;
    n.normalize();
    s.fromBufferAttribute(nn, i);
    total++;
    if (n.dot(s) > 0) agree++;
  }
  return { agree, total };
}

describe("cathode gore caps", () => {
  for (const cyber of [false, true])
    it(`${cyber ? "cyber" : "flesh"}: windings agree with normals, the top faces up, under budget`, () => {
      const g = buildCap(0.07, cyber, false);
      const f = faces(g);
      expect(f.agree / f.total).toBeGreaterThan(0.97);
      // Sample the core's normal opposite the bone (the bone sits off centre at +x): it faces out of the cut (+Y).
      const p = g.getAttribute("position");
      const nn = g.getAttribute("normal");
      let best = -1;
      let bestY = -Infinity;
      for (let i = 0; i < p.count; i++)
        if (Math.hypot(p.getX(i) + 0.03, p.getZ(i)) < 0.012 && p.getY(i) > bestY) {
          bestY = p.getY(i);
          best = i;
        }
      expect(nn.getY(best)).toBeGreaterThan(0.9);
      expect(p.count / 3).toBeLessThan(700);
      expect(buildCap(0.07, cyber, true).getAttribute("position").count / 3).toBeLessThan(420);
      // The bone stands proud of the flesh.
      g.computeBoundingBox();
      expect(g.boundingBox!.max.y).toBeGreaterThan(CAP.boneProudM);
    });
  it("cyber caps carry a glowing ring (colour above 1); flesh caps don't", () => {
    const max = (g: THREE.BufferGeometry) => Math.max(...(g.getAttribute("color").array as Float32Array));
    expect(max(buildCap(0.06, true, false))).toBeGreaterThan(1.5);
    expect(max(buildCap(0.06, false, false))).toBeLessThanOrEqual(1);
  });
});
