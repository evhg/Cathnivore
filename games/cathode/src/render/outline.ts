// C17 Second Wind's outlines (docs/design/cathode-combat.md S6.5): every live enemy gets a 2u --blood-hot outline
// that shows through walls, and they stay red while the world's grade drains to grey.
//
// The outlines draw after the whole post chain, straight onto the canvas, so the grade (and its 90% grey) never
// touches them: that is the "stencil bit" of the spec, done by order instead (the renderer has no stencil buffer).
//
// A screen-space edge, not a pushed back-face hull (the hull broke into dotted, stair-stepped fragments wherever
// the body's flat-shaded normals split, and drew every mesh twice):
//   1. a mask: each outlined mesh's twin (same geometry and skeleton, on a layer only this pass sees) renders white
//      into a small coverage target with no world depth, so a man behind a wall is still in it, then
//   2. one full-screen pass dilates that mask by 2u with two rings of bilinear taps and a soft outer ring, and
//      draws the rim outside the silhouette (plus a faint red ghost fill inside it) over the finished frame.
// The line is continuous at every size and anti-aliased by the mask's bilinear filtering, and it costs one draw
// per outlined mesh plus one quad.

import * as THREE from "three";

/** The layer only the outline pass renders (the world's cameras never enable it). */
export const LAYER_OUTLINE = 5;

/**
 * The mask's height cap in pixels, and its supersampling: it renders at up to 2x the drawing buffer (a phone's
 * 1.35x buffer is only ~530 px high, and a 1x mask stair-stepped every diagonal once the canvas was scaled up 2.2x
 * to the screen; C17 review). The edge pass then reads it through bilinear taps, so its coverage, and the line's
 * alpha, falls off over a sub-pixel ramp: an anti-aliased line at any DPR.
 */
const MASK_MAX_H = 2160;
const MASK_SS = 2;
/** Taps per ring: 12 around at 2u leaves gaps under a pixel at 844x390@3 and under 1.4 px at 5K. */
const DIRS = 12;

const EdgeShader = {
  uniforms: {
    tMask: { value: null as THREE.Texture | null },
    uPx: { value: new THREE.Vector2(1, 1) },
    uR: { value: 3 },
    uStrength: { value: 1 },
    uFill: { value: 0.08 },
    uAvoid: { value: new THREE.Vector4(0, 0, 0, 0) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tMask;
    uniform vec2 uPx;
    uniform float uR;
    uniform float uStrength;
    uniform float uFill;
    // A HUD cluster's box (uv, x0 y0 x1 y1): the line fades out under it, so the vitals read over a man behind them.
    uniform vec4 uAvoid;
    varying vec2 vUv;
    // --blood-hot (#ff3b55), already in the canvas's sRGB: the pass writes it as is, after the grade.
    const vec3 HOT = vec3(1.0, 0.231, 0.333);
    void main() {
      float c = texture2D(tMask, vUv).r;
      float inner = 0.0;
      float outer = 0.0;
      float ring = 0.0;
      for (int i = 0; i < ${DIRS}; i++) {
        float a = (float(i) + 0.5) * ${((2 * Math.PI) / DIRS).toFixed(6)};
        vec2 d = vec2(cos(a), sin(a)) * uPx;
        float h = texture2D(tMask, vUv + d * uR * 0.5).r;
        float f = texture2D(tMask, vUv + d * uR).r;
        inner = max(inner, max(h, f));
        ring += h;
        // The outer edge over a 1.5 px ramp (three taps), so the rim's outside is a gradient, not a step.
        outer = max(outer, 0.5 * texture2D(tMask, vUv + d * (uR + 0.5)).r + 0.3 * texture2D(tMask, vUv + d * (uR + 1.0)).r + 0.2 * texture2D(tMask, vUv + d * (uR + 1.6)).r);
      }
      // A pixel the body surrounds on (nearly) every side is a seam in his mesh, not the outside: closed, so the
      // rim never speckles the inside of a man.
      c = max(c, smoothstep(0.72, 0.92, ring / ${DIRS}.0));
      // The rim: full out to 2u, then a soft 1.5 px outer ramp (no stair-steps), and nothing over his own body.
      float rim = max(smoothstep(0.0, 0.75, inner), outer * 0.55) * (1.0 - smoothstep(0.15, 0.85, c));
      float a = max(rim, c * uFill) * uStrength;
      if (uAvoid.z > uAvoid.x) {
        vec2 e = min(vUv - uAvoid.xy, uAvoid.zw - vUv) / max(uPx * 24.0, vec2(1e-5));
        a *= 1.0 - 0.85 * clamp(min(e.x, e.y), 0.0, 1.0);
      }
      if (a < 0.002) discard;
      gl_FragColor = vec4(HOT, a);
    }`,
};

interface Twin {
  src: THREE.Mesh;
  mask: THREE.Mesh;
}

export class Outlines {
  private readonly maskMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
  private readonly edgeMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(EdgeShader.uniforms),
    vertexShader: EdgeShader.vertexShader,
    fragmentShader: EdgeShader.fragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  private readonly quadScene = new THREE.Scene();
  private readonly quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly target = new THREE.WebGLRenderTarget(4, 4, { depthBuffer: false, type: THREE.UnsignedByteType, format: THREE.RGBAFormat });
  private readonly size = new THREE.Vector2();
  private readonly clear0 = new THREE.Color();
  private readonly twins = new Map<THREE.Mesh, Twin>();
  /** A screen box (CSS fractions, y down: x, y, w, h) the line fades out under; null for none. */
  avoid(r: { x: number; y: number; w: number; h: number } | null): void {
    const v = this.edgeMat.uniforms.uAvoid!.value as THREE.Vector4;
    if (!r) v.set(0, 0, 0, 0);
    else v.set(r.x, 1 - (r.y + r.h), r.x + r.w, 1 - r.y);
  }

  /** 0..1: the whole effect's strength (the revive fades it over 200 ms). */
  strength = 0;
  private readonly wanted = new Set<THREE.Mesh>();

  constructor() {
    this.target.texture.minFilter = this.target.texture.magFilter = THREE.LinearFilter;
    this.target.texture.generateMipmaps = false;
    this.edgeMat.uniforms.tMask!.value = this.target.texture;
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.edgeMat);
    quad.frustumCulled = false;
    this.quadScene.add(quad);
  }

  /** The meshes to outline this frame (the twins of meshes no longer listed hide, and are dropped by `clear`). */
  set(meshes: Iterable<THREE.Mesh>): void {
    this.wanted.clear();
    for (const m of meshes) {
      this.wanted.add(m);
      if (!this.twins.has(m)) this.twins.set(m, this.make(m));
    }
  }

  /** Drops every twin (Second Wind is over). */
  clear(): void {
    for (const t of this.twins.values()) t.mask.removeFromParent();
    this.twins.clear();
    this.wanted.clear();
    this.strength = 0;
  }

  get active(): boolean {
    return this.strength > 0.001 && this.twins.size > 0;
  }

  private make(src: THREE.Mesh): Twin {
    let m: THREE.Mesh;
    if ((src as THREE.SkinnedMesh).isSkinnedMesh) {
      const s = src as THREE.SkinnedMesh;
      const k = new THREE.SkinnedMesh(s.geometry, this.maskMat);
      k.bind(s.skeleton, s.bindMatrix);
      k.bindMode = s.bindMode;
      if (s.boundingSphere) k.boundingSphere = s.boundingSphere;
      m = k;
    } else m = new THREE.Mesh(src.geometry, this.maskMat);
    m.name = "outline";
    m.position.copy(src.position);
    m.quaternion.copy(src.quaternion);
    m.scale.copy(src.scale);
    m.layers.set(LAYER_OUTLINE);
    m.frustumCulled = false;
    m.castShadow = m.receiveShadow = false;
    src.parent?.add(m);
    return { src, mask: m };
  }

  /**
   * Draws the outlines over the finished frame (call after the post chain). The line is 2u, a HUD unit being
   * 1/1080 of the drawing buffer's height.
   */
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
    if (!this.active) return;
    for (const t of this.twins.values()) t.mask.visible = this.wanted.has(t.src) && t.src.visible && isShown(t.src);
    const size = renderer.getDrawingBufferSize(this.size);
    const k = Math.min(MASK_SS, MASK_MAX_H / Math.max(1, size.y));
    const mw = Math.max(4, Math.round(size.x * k));
    const mh = Math.max(4, Math.round(size.y * k));
    if (this.target.width !== mw || this.target.height !== mh) this.target.setSize(mw, mh);
    const u = this.edgeMat.uniforms;
    (u.uPx!.value as THREE.Vector2).set(1 / size.x, 1 / size.y);
    u.uR!.value = Math.max(2.5, (2.4 * size.y) / 1080);
    u.uStrength!.value = this.strength;

    const mask = camera.layers.mask;
    const bg = scene.background;
    const fog = scene.fog;
    const auto = renderer.autoClear;
    const shadow = renderer.shadowMap.autoUpdate;
    const clearA = renderer.getClearAlpha();
    renderer.getClearColor(this.clear0);
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = false;
    scene.background = null;
    scene.fog = null;
    camera.layers.set(LAYER_OUTLINE);
    renderer.setRenderTarget(this.target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, false, false);
    renderer.autoClear = false;
    renderer.render(scene, camera);
    camera.layers.mask = mask;
    scene.background = bg;
    scene.fog = fog;
    renderer.setClearColor(this.clear0, clearA);
    renderer.setRenderTarget(null);
    renderer.render(this.quadScene, this.quadCam);
    renderer.autoClear = auto;
    renderer.shadowMap.autoUpdate = shadow;
  }
}

/** Every ancestor visible (a hidden body root hides its twins too). */
function isShown(o: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}
