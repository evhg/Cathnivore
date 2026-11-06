import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildCath } from "../games/hedgerow/src/render3d/models";

// Plan item 208: the 3D Cath to the character bible's proportions, about five heads tall (she was a chibi, her
// head about a third of her height), with her feet on the ground.
describe("Hedgerow 3D Cath's figure", () => {
  it("her head is a quarter of her height or less, and she stands on the ground", () => {
    const cath = buildCath(null);
    cath.updateMatrixWorld(true);
    const all = new THREE.Box3().setFromObject(cath);
    const head = new THREE.Box3().setFromObject(cath.userData.head as THREE.Object3D);
    const total = all.max.y - all.min.y;
    const headH = head.max.y - head.min.y;
    expect(headH / total).toBeLessThanOrEqual(0.25);
    expect(Math.abs(all.min.y)).toBeLessThan(0.01);
  });

  it("her front locks lie flat on her jacket, wider than deep (they hung like two round bunches)", () => {
    const cath = buildCath(null);
    cath.updateMatrixWorld(true);
    const locks = cath.userData.locks as THREE.Object3D[];
    expect(locks).toHaveLength(2);
    for (const l of locks) {
      const b = new THREE.Box3().setFromObject(l);
      expect(b.max.z - b.min.z).toBeGreaterThan(1.5 * (b.max.x - b.min.x));
    }
  });
});
