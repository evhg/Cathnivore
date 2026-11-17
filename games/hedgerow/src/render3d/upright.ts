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
