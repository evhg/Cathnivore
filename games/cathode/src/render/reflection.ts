// The wet street's hero effect: a planar reflection of the whole scene in the ground plane, rendered from
// a mirrored camera with an oblique near plane (so nothing under the street leaks in), into a mipmapped
// half-float target. The ground and water shaders (shading.ts) sample it with ripple distortion and a
// roughness-driven blur, weighted by three's own Fresnel. Phone renders it at half resolution.

import * as THREE from "three";

/** Layer for things the reflection must not see: the mirror surfaces themselves, rain and lens effects. */
export const LAYER_NO_REFLECT = 1;

export class PlanarReflection {
  readonly target: THREE.WebGLRenderTarget;
  readonly matrix = new THREE.Matrix4();
  private readonly cam = new THREE.PerspectiveCamera();
  private readonly plane = new THREE.Plane();
  private readonly clip = new THREE.Vector4();
  private readonly q = new THREE.Vector4();
  private readonly v = new THREE.Vector3();
  private readonly t = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly rot = new THREE.Matrix4();
  private readonly normal = new THREE.Vector3(0, 1, 0);
  private readonly hidden: THREE.Object3D[] = [];

  constructor(
    private readonly height: number,
    private scale: number,
    /** Phone budget (S0): meshes whose bounding sphere covers less than this (radius / distance) are left out. */
    private readonly cull = 0,
  ) {
    this.target = new THREE.WebGLRenderTarget(4, 4, {
      type: THREE.HalfFloatType,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
    });
    this.cam.layers.set(0);
  }

  setSize(width: number, height: number): void {
    this.target.setSize(Math.max(4, Math.round(width * this.scale)), Math.max(4, Math.round(height * this.scale)));
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    const mirror = this.v.set(0, this.height, 0);
    const camPos = this.t.setFromMatrixPosition(camera.matrixWorld);
    if (camPos.y < this.height + 0.02) camPos.y = this.height + 0.02;
    // Reflect the eye and the look target through the plane.
    const view = new THREE.Vector3().subVectors(mirror, camPos);
    view.reflect(this.normal).negate().add(mirror);
    this.rot.extractRotation(camera.matrixWorld);
    this.look.set(0, 0, -1).applyMatrix4(this.rot).add(camPos);
    const target = new THREE.Vector3().subVectors(mirror, this.look);
    target.reflect(this.normal).negate().add(mirror);
    const cam = this.cam;
    cam.position.copy(view);
    cam.up.set(0, 1, 0).applyMatrix4(this.rot).reflect(this.normal);
    cam.lookAt(target);
    cam.far = camera.far;
    cam.near = camera.near;
    cam.updateMatrixWorld();
    cam.projectionMatrix.copy(camera.projectionMatrix);
    // Texture matrix: world → mirror clip → [0,1].
    this.matrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.matrix.multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
    // Oblique near plane at the mirror (Lengyel).
    this.plane.setFromNormalAndCoplanarPoint(this.normal, mirror).applyMatrix4(cam.matrixWorldInverse);
    this.clip.set(this.plane.normal.x, this.plane.normal.y, this.plane.normal.z, this.plane.constant);
    const pm = cam.projectionMatrix.elements;
    this.q.set((Math.sign(this.clip.x) + pm[8]!) / pm[0]!, (Math.sign(this.clip.y) + pm[9]!) / pm[5]!, -1, (1 + pm[10]!) / pm[14]!);
    this.clip.multiplyScalar(2 / this.clip.dot(this.q));
    pm[2] = this.clip.x;
    pm[6] = this.clip.y;
    pm[10] = this.clip.z + 1 - 0.003;
    pm[14] = this.clip.w;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();

    const prevTarget = renderer.getRenderTarget();
    // Shadow maps refresh in the main pass, never here: the mirror leaves small meshes out (below), and a
    // shadow map drawn without them would lose their shadows for the frame.
    const prevShadow = renderer.shadowMap.autoUpdate;
    const prevNeeds = renderer.shadowMap.needsUpdate;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = false;
    renderer.setRenderTarget(this.target);
    renderer.clear();
    // The mirror is rippled and blurred: small things far off (limbs, bolts, bottles) are invisible in it but
    // cost a draw call each. Hide them for this pass only.
    const hidden = this.hidden;
    if (this.cull > 0) hideSmall(scene, this.t.setFromMatrixPosition(camera.matrixWorld), this.cull, hidden);
    renderer.render(scene, cam);
    showAll(hidden);
    renderer.setRenderTarget(prevTarget);
    renderer.shadowMap.autoUpdate = prevShadow;
    renderer.shadowMap.needsUpdate = prevNeeds;
  }

  dispose(): void {
    this.target.dispose();
  }
}

const cullCentre = new THREE.Vector3();
/**
 * Hides (and lists in `out`) every visible layer-0 mesh whose bounding sphere spans less than `k` radians from
 * `eye` (radius over distance). Instanced meshes are aggregates and always stay. Undo with showAll(out).
 */
export function hideSmall(scene: THREE.Object3D, eye: THREE.Vector3, k: number, out: THREE.Object3D[]): void {
  const k2 = k * k;
  scene.traverseVisible((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh || !m.layers.isEnabled(0)) return;
    const g = m.geometry;
    if (!g.boundingSphere) g.computeBoundingSphere();
    const bs = g.boundingSphere!;
    const r = bs.radius * m.matrixWorld.getMaxScaleOnAxis();
    if (r * r < k2 * cullCentre.copy(bs.center).applyMatrix4(m.matrixWorld).distanceToSquared(eye)) {
      m.visible = false;
      out.push(m);
    }
  });
}

/** Like hideSmall, for the shadow pass: small visible casters stop casting (listed in `out`; set them back). */
export function unshadowSmall(scene: THREE.Object3D, eye: THREE.Vector3, k: number, out: THREE.Object3D[]): void {
  const k2 = k * k;
  scene.traverseVisible((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.castShadow || (m as THREE.InstancedMesh).isInstancedMesh) return;
    const g = m.geometry;
    if (!g.boundingSphere) g.computeBoundingSphere();
    const bs = g.boundingSphere!;
    const r = bs.radius * m.matrixWorld.getMaxScaleOnAxis();
    if (r * r < k2 * cullCentre.copy(bs.center).applyMatrix4(m.matrixWorld).distanceToSquared(eye)) {
      m.castShadow = false;
      out.push(m);
    }
  });
}

export function showAll(list: THREE.Object3D[]): void {
  for (const m of list) m.visible = true;
  list.length = 0;
}
