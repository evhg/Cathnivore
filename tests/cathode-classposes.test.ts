import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { buildFrontCath } from "../games/cathode/src/render/frontcath";

// The model paints a few canvas textures; this test only reads her bones, so a do-nothing 2D context will do.
const anything: unknown = new Proxy(function () {}, { get: (_t, k) => (k === Symbol.toPrimitive ? () => 0 : anything), apply: () => anything });
beforeAll(() => {
  vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => anything }) });
});
afterAll(() => vi.unstubAllGlobals());

// Plan item 42: the class pick shows Cath facing the camera in each class's signature pose. Held mid-clip, the five
// poses put her bones in five different places (no two classes share a pose).
const CLASSES = ["ghost", "butcher", "gunslinger", "wirewitch", "fixer"];

function poseOf(cls: string): number[] {
  const c = buildFrontCath(false);
  c.play(cls, 0.5);
  c.update(1 / 60, 10, { x: 0, z: 0 });
  c.group.updateMatrixWorld(true);
  const out: number[] = [];
  const v = new THREE.Vector3();
  c.group.traverse((o) => {
    if (o.type === "Group" || o.type === "Object3D" || o.type === "Bone") {
      o.getWorldPosition(v);
      out.push(v.x, v.y, v.z);
      const q = o.getWorldQuaternion(new THREE.Quaternion());
      out.push(q.x, q.y, q.z, q.w);
    }
  });
  return out;
}

describe("NIGHT SHIFT class-pick poses (plan item 42)", () => {
  it("are five distinct poses", () => {
    const poses = CLASSES.map(poseOf);
    for (const p of poses) expect(p.length).toBeGreaterThan(20);
    for (let i = 0; i < poses.length; i++)
      for (let j = i + 1; j < poses.length; j++) {
        const d = poses[i]!.reduce((s, x, k) => s + Math.abs(x - (poses[j]![k] ?? 0)), 0);
        expect(d, `${CLASSES[i]} vs ${CLASSES[j]}`).toBeGreaterThan(0.05);
      }
  });
});
