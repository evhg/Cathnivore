// C17 Second Wind's outlines (docs/design/cathode-combat.md S6.5): every live enemy gets a 2u --blood-hot outline
// that shows through walls, and they stay red while the world's grade drains to grey.
//
// The outlines draw after the whole post chain, straight onto the canvas, so the grade (and its 90% grey) never
// touches them: that is the "stencil bit" of the spec, done by order instead (the renderer has no stencil buffer).
// Each outlined mesh gets two twins on a layer only this pass sees, sharing its geometry and skeleton:
//   1. a mask: its front faces into a freshly cleared depth buffer, with a faint red fill (the man behind a wall
//      reads as a ghost), and
//   2. a hull: its back faces pushed out along the screen-space normal by 2u, depth-tested against the mask, so
//      only the rim outside his own silhouette survives. No depth from the world: the outline is seen through cover.

import * as THREE from "three";

/** The layer only the outline pass renders (the world's cameras never enable it). */
export const LAYER_OUTLINE = 5;

const BLOOD_HOT = new THREE.Color("#ff3b55");

interface Twin {
  src: THREE.Mesh;
  mask: THREE.Mesh;
  hull: THREE.Mesh;
}

export class Outlines {
  private readonly maskMat: THREE.MeshBasicMaterial;
  private readonly hullMat: THREE.MeshBasicMaterial;
  private readonly uPx = { value: 4 };
  private readonly uRes = { value: new THREE.Vector2(1, 1) };
  private readonly twins = new Map<THREE.Mesh, Twin>();
  /** 0..1: the whole effect's strength (the revive fades it over 200 ms). */
  strength = 0;
  private wanted = new Set<THREE.Mesh>();

  constructor() {
    this.maskMat = new THREE.MeshBasicMaterial({ color: BLOOD_HOT, transparent: true, opacity: 0.1, depthTest: true, depthWrite: true, fog: false, toneMapped: false });
    this.hullMat = new THREE.MeshBasicMaterial({ color: BLOOD_HOT, transparent: true, opacity: 1, side: THREE.BackSide, depthTest: true, depthWrite: false, fog: false, toneMapped: false });
    this.hullMat.onBeforeCompile = (sh) => {
      sh.uniforms.uPx = this.uPx;
      sh.uniforms.uRes = this.uRes;
      sh.vertexShader = sh.vertexShader.replace("void main() {", "uniform float uPx;\nuniform vec2 uRes;\nvoid main() {").replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        {
          #if defined( USE_ENVMAP ) || defined( USE_SKINNING )
            vec3 oN = objectNormal;
          #else
            vec3 oN = normal;
          #endif
          vec4 cN = projectionMatrix * vec4( normalize( normalMatrix * oN ), 0.0 );
          float l = length( cN.xy );
          if ( l > 1e-5 ) gl_Position.xy += cN.xy / l * uPx * 2.0 / uRes * gl_Position.w;
          // Pushed 0.6 m back: inside his own silhouette the mask's front faces are always nearer, so only the rim
          // outside it draws (no inner seams where an arm crosses the chest).
          vec4 back = projectionMatrix * vec4( mvPosition.xyz - vec3( 0.0, 0.0, 0.6 ), 1.0 );
          gl_Position.z = back.z / back.w * gl_Position.w;
        }`,
      );
    };
    this.hullMat.customProgramCacheKey = () => "cathode-outline-hull";
  }

  /** The meshes to outline this frame (the twins of meshes no longer listed hide, and are dropped by `clear`). */
  set(meshes: Iterable<THREE.Mesh>): void {
    this.wanted = new Set(meshes);
    for (const m of this.wanted) if (!this.twins.has(m)) this.twins.set(m, this.make(m));
  }

  /** Drops every twin (Second Wind is over). */
  clear(): void {
    for (const t of this.twins.values()) {
      t.mask.removeFromParent();
      t.hull.removeFromParent();
    }
    this.twins.clear();
    this.wanted.clear();
    this.strength = 0;
  }

  get active(): boolean {
    return this.strength > 0.001 && this.twins.size > 0;
  }

  private make(src: THREE.Mesh): Twin {
    const twin = (mat: THREE.Material, order: number): THREE.Mesh => {
      let m: THREE.Mesh;
      if ((src as THREE.SkinnedMesh).isSkinnedMesh) {
        const s = src as THREE.SkinnedMesh;
        const k = new THREE.SkinnedMesh(s.geometry, mat);
        k.bind(s.skeleton, s.bindMatrix);
        k.bindMode = s.bindMode;
        if (s.boundingSphere) k.boundingSphere = s.boundingSphere;
        m = k;
      } else m = new THREE.Mesh(src.geometry, mat);
      m.name = "outline";
      m.position.copy(src.position);
      m.quaternion.copy(src.quaternion);
      m.scale.copy(src.scale);
      m.layers.set(LAYER_OUTLINE);
      m.renderOrder = order;
      m.frustumCulled = false;
      m.castShadow = m.receiveShadow = false;
      src.parent?.add(m);
      return m;
    };
    return { src, mask: twin(this.maskMat, 1000), hull: twin(this.hullMat, 1001) };
  }

  /**
   * Draws the outlines over the finished frame (call after the post chain). `heightPx` is the drawing buffer's
   * height: the line is 2u, a HUD unit being 1/1080 of the screen's height.
   */
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
    if (!this.active) return;
    for (const t of this.twins.values()) {
      const on = this.wanted.has(t.src) && t.src.visible && isShown(t.src);
      t.mask.visible = t.hull.visible = on;
    }
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.uRes.value.copy(size);
    this.uPx.value = Math.max(3, (2.6 * size.y) / 1080);
    this.hullMat.opacity = this.strength;
    this.maskMat.opacity = 0.08 * this.strength;
    const mask = camera.layers.mask;
    const bg = scene.background;
    const auto = renderer.autoClear;
    const shadow = renderer.shadowMap.autoUpdate;
    const fog = scene.fog;
    renderer.setRenderTarget(null);
    renderer.autoClear = false;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = false;
    scene.background = null;
    scene.fog = null;
    camera.layers.set(LAYER_OUTLINE);
    renderer.clearDepth();
    renderer.render(scene, camera);
    camera.layers.mask = mask;
    scene.background = bg;
    scene.fog = fog;
    renderer.autoClear = auto;
    renderer.shadowMap.autoUpdate = shadow;
  }
}

/** Every ancestor visible (a hidden body root hides its twins too). */
function isShown(o: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}
