import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { shadowUpright } from "../games/hedgerow/src/render3d/upright";

// Plan item 469: a node leaned back to a steep lens casts its upright shadow (the lean is for the eye, not the sun).
describe("shadowUpright", () => {
  it("draws each mesh into the shadow map where it would stand unleaned, then puts it back", () => {
    const root = new THREE.Group();
    root.position.set(4, 0.5, 7);
    root.rotation.y = 0.8;
    const lean = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    mesh.position.set(0, 1.2, 0.1);
    lean.add(mesh);
    root.add(lean);
    shadowUpright(lean, (m) => m.identity());
    root.updateMatrixWorld(true);
    const upright = mesh.matrixWorld.clone();
    lean.rotation.x = -0.5;
    root.updateMatrixWorld(true);
    const leaned = mesh.matrixWorld.clone();
    expect(leaned.equals(upright)).toBe(false);
    const cam = new THREE.OrthographicCamera();
    cam.position.set(3, 10, 2);
    cam.updateMatrixWorld(true);
    const fn = mesh.onBeforeShadow as unknown as (...a: unknown[]) => void;
    fn(null, mesh, null, cam);
    mesh.matrixWorld.elements.forEach((v, i) => expect(v).toBeCloseTo(upright.elements[i]!, 6));
    const mv = new THREE.Matrix4().multiplyMatrices(cam.matrixWorldInverse, upright);
    mesh.modelViewMatrix.elements.forEach((v, i) => expect(v).toBeCloseTo(mv.elements[i]!, 6));
    (mesh.onAfterShadow as unknown as () => void)();
    expect(mesh.matrixWorld.equals(leaned)).toBe(true);
  });
});
