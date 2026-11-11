import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildCath } from "../games/hedgerow/src/render3d/models";

// Plan item 310: the 3D Cath worthy of her portrait inside a field-scale budget. Her features are painted on the face
// (cathFaceTexture), not some twenty tiny meshes, and the hair cap carries its own shine band.
describe("Hedgerow 3D Cath's budget", () => {
  it("is 2,000 triangles or fewer", () => {
    const cath = buildCath(null);
    let tris = 0;
    cath.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const g = m.geometry;
      tris += (g.index ? g.index.count : g.getAttribute("position").count) / 3;
    });
    expect(tris).toBeLessThanOrEqual(2000);
  });

  it("shades her hair cap with vertex colours, a shine band lighter than its rim", () => {
    const cath = buildCath(null);
    let cap: THREE.Mesh | null = null;
    cath.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && (m.material as THREE.Material).name === "hairCap") cap ??= m;
    });
    expect(cap).not.toBeNull();
    const col = (cap as unknown as THREE.Mesh).geometry.getAttribute("color");
    let lo = 1;
    let hi = 0;
    for (let i = 0; i < col.count; i++) {
      const l = new THREE.Color(col.getX(i), col.getY(i), col.getZ(i)).getHSL({ h: 0, s: 0, l: 0 }).l;
      lo = Math.min(lo, l);
      hi = Math.max(hi, l);
    }
    expect(hi - lo).toBeGreaterThan(0.08);
  });
});
