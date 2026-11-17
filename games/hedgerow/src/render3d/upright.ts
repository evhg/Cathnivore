import * as THREE from "three";

/**
 * Plan item 469: a node leaned back towards a steep lens (an upright phone) casts the shadow it would cast standing
 * upright. Its lean is a trick for the eye, not the sun: leaned, the farmhouse's shadow ran three plots long across the
 * phone's field. `upright` writes the node's local matrix without the lean; each mesh under it swaps its world matrix
 * for the upright one while the shadow map draws it.
 */
export function shadowUpright(node: THREE.Object3D, upright: (m: THREE.Matrix4) => THREE.Matrix4): void {
  const m0 = new THREE.Matrix4();
  const pInv = new THREE.Matrix4();
  const corr = new THREE.Matrix4();
  node.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    const saved = new THREE.Matrix4();
    o.onBeforeShadow = (_r, _o, _c, shadowCamera) => {
      const p = node.parent;
      if (!p) return;
      // corr = P * M0 * M^-1 * P^-1, so the mesh's world matrix P * M * L becomes P * M0 * L.
      corr.copy(node.matrix).invert().premultiply(upright(m0)).premultiply(p.matrixWorld).multiply(pInv.copy(p.matrixWorld).invert());
      saved.copy(o.matrixWorld);
      o.matrixWorld.premultiply(corr);
      // The shadow map took the model-view matrix before this hook: redo it from the upright world matrix.
      o.modelViewMatrix.multiplyMatrices(shadowCamera.matrixWorldInverse, o.matrixWorld);
    };
    o.onAfterShadow = () => {
      if (node.parent) o.matrixWorld.copy(saved);
    };
  });
}

/**
 * Plan item 469: hides the instances of `m` whose base stands inside one of `boxes` (seen from above), and shows again
 * those that no longer do; the instances' own matrices are kept, so a later call (another frame size) starts afresh.
 * Returns how many are hidden.
 */
export function clearUnder(m: THREE.InstancedMesh, boxes: THREE.Box3[]): number {
  const orig = (m.userData.orig as Float32Array | undefined) ?? (m.userData.orig = m.instanceMatrix.array.slice() as Float32Array);
  const a = m.instanceMatrix.array as Float32Array;
  let hidden = 0;
  for (let i = 0; i < m.count; i++) {
    const o = i * 16;
    const x = orig[o + 12]!, z = orig[o + 14]!;
    const under = boxes.some((b) => x >= b.min.x && x <= b.max.x && z >= b.min.z && z <= b.max.z);
    for (let k = 0; k < 16; k++) a[o + k] = under ? 0 : orig[o + k]!;
    if (under) hidden++;
  }
  m.instanceMatrix.needsUpdate = true;
  return hidden;
}
