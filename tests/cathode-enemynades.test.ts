import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { EnemyNades, NADE_FUSE } from "../games/cathode/src/game/enemynades";

const flat = () => 0;

describe("cathode enemy grenades (S3.5)", () => {
  it("lands near its aim point and bangs on a 2.8 s fuse", () => {
    const scene = new THREE.Scene();
    const n = new EnemyNades(scene);
    n.throw(new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(0, 0, 12));
    let bang: THREE.Vector3 | null = null;
    let t = 0;
    while (!bang && t < 5) {
      n.update(1 / 60, flat, [], (at) => (bang = at));
      t += 1 / 60;
    }
    expect(bang).not.toBeNull();
    expect(t).toBeGreaterThan(NADE_FUSE - 0.05);
    expect(t).toBeLessThan(NADE_FUSE + 0.05);
    // Skittered a little past the aim, not off down the street.
    expect(Math.abs(bang!.z - 12)).toBeLessThan(2.5);
    expect(n.blasts.length).toBe(1);
    expect(n.live().length).toBe(0);
  });

  it("is live with its fuse share for the HUD ring while it flies", () => {
    const n = new EnemyNades(new THREE.Scene());
    n.throw(new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(4, 0, 8));
    n.advance(0.5, flat, []);
    const live = n.live();
    expect(live.length).toBe(1);
    expect(live[0]!.left).toBeCloseTo((NADE_FUSE - 0.5) / NADE_FUSE, 1);
    // Mid-arc it's up in the air.
    expect(live[0]!.pos.y).toBeGreaterThan(1);
  });
});
