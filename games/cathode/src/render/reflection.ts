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

  constructor(
    private readonly height: number,
    private scale: number,
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
    const prevShadow = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(this.target);
    renderer.clear();
    renderer.render(scene, cam);
    renderer.setRenderTarget(prevTarget);
    renderer.shadowMap.autoUpdate = prevShadow;
  }

  dispose(): void {
    this.target.dispose();
  }
}
