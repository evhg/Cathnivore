import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildEnemy, buildRung } from "../games/hedgerow/src/render3d/models";
import { INSTANCED_RUNGS, liveryOf } from "../games/hedgerow/src/render3d/rungs";

// Plan item 730: the instanced convoy draws a distinct model per kind (its shape and its own body colour), and the
// act liveries tint a vehicle softly enough that its kind's hue survives.
function signature(g: THREE.Object3D): string {
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g);
  let verts = 0;
  const colours = new Set<string>();
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    verts += m.geometry.getAttribute("position").count;
    const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
    if (mat.color) colours.add(mat.color.getHexString());
  });
  const s = box.getSize(new THREE.Vector3());
  return `${verts}:${s.x.toFixed(2)}x${s.y.toFixed(2)}x${s.z.toFixed(2)}:${[...colours].sort().join(",")}`;
}

describe("Hedgerow 3D convoy kinds (plan item 730)", () => {
  it("5 or more distinct meshes in the instanced registry", () => {
    const sigs = new Set(INSTANCED_RUNGS.map((k) => signature(buildRung(k) ?? (buildEnemy(k).userData.inner as THREE.Group))));
    expect(sigs.size).toBeGreaterThanOrEqual(5);
    expect(sigs.size).toBe(INSTANCED_RUNGS.length);
  });

  it("a livery never moves a body's hue far: each channel within 25% of white", () => {
    for (let act = 1; act <= 10; act++)
      for (let id = 0; id < 40; id++) {
        const c = liveryOf(act, id);
        for (const v of [c.r, c.g, c.b]) expect(v).toBeGreaterThanOrEqual(0.75);
      }
  });
});
