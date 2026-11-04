import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { TOWERS, type TowerKind } from "../games/hedgerow/src/engine";
import { buildTower } from "../games/hedgerow/src/render3d/models";

// Plan item 81: every tower type has its own 3D silhouette (a bounding box or a part count no other type shares),
// and each tier up adds something you can see.
const KINDS = Object.keys(TOWERS) as TowerKind[];
const sig = (g: THREE.Group) => {
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g);
  const size = box.getSize(new THREE.Vector3());
  let parts = 0;
  let verts = 0;
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      parts++;
      verts += m.geometry.attributes.position!.count * ((m as THREE.InstancedMesh).count ?? 1);
    }
  });
  return { size: size.toArray().map((x) => Math.round(x * 100) / 100), parts, verts };
};

describe("Hedgerow 3D tower models", () => {
  it("each type differs from every other in its bounding box or its part count", () => {
    const s = KINDS.map((k) => [k, sig(buildTower(k, 1, null))] as const);
    for (let i = 0; i < s.length; i++)
      for (let j = i + 1; j < s.length; j++) {
        const [a, sa] = s[i]!;
        const [b, sb] = s[j]!;
        const same = sa.parts === sb.parts && sa.size.every((x, k) => Math.abs(x - sb.size[k]!) < 0.02);
        expect(same, `${a} and ${b} share a silhouette`).toBe(false);
      }
  });

  it("each tier up shows: more geometry or a taller or wider model", () => {
    for (const k of KINDS) {
      const t = [1, 2, 3].map((tier) => sig(buildTower(k, tier, null)));
      for (let i = 1; i < 3; i++) {
        const grew = t[i]!.verts > t[i - 1]!.verts || t[i]!.size.some((x, d) => x > t[i - 1]!.size[d]! + 0.01);
        expect(grew, `${k} tier ${i + 1} looks like tier ${i}`).toBe(true);
      }
    }
  });
});
