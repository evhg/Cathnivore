// C16 (S3.5): the sniper's laser as a screen-space ribbon. The beam is 3 mm of light in the world, which at 18 m and a
// phone's 0.5 render scale falls under one pixel and vanishes. This draws it as a camera-facing quad between two world
// points whose core is never thinner than 1.5 device px, wrapped in a soft additive halo (the rain catching it), and a
// glowing dot where it lands with a pixel floor of its own. The segment is clipped to the near plane in the vertex shader,
// so a beam that ends at the camera (on her chest) still reads as a line running into the lens.
import * as THREE from "three";
import { LAYER_NO_REFLECT } from "../render/reflection";

const RIBBON_VS = /* glsl */ `
uniform vec3 uFrom;
uniform vec3 uTo;
uniform float uHalfW;     // world half-width of the core (m)
uniform float uMinPx;     // core half-width floor (target px)
uniform float uHalo;      // total half-width as a multiple of the core's
uniform vec2 uRes;        // render target size (px)
attribute float aSide;    // -1 or 1 across the beam
attribute float aEnd;     // 0 at uFrom, 1 at uTo
varying float vAcross;
varying float vCore;      // the core's share of the half-width (0..1)
varying float vAlong;
void main() {
  float near = 0.06;
  vec4 a = viewMatrix * vec4(uFrom, 1.0);
  vec4 b = viewMatrix * vec4(uTo, 1.0);
  // Clip the segment to just in front of the lens.
  if (a.z > -near) a.xyz = mix(a.xyz, b.xyz, clamp((a.z + near) / (a.z - b.z), 0.0, 1.0));
  if (b.z > -near) b.xyz = mix(b.xyz, a.xyz, clamp((b.z + near) / (b.z - a.z), 0.0, 1.0));
  vec4 v = aEnd < 0.5 ? a : b;
  vec4 ca = projectionMatrix * a;
  vec4 cb = projectionMatrix * b;
  vec4 c = projectionMatrix * v;
  vec2 sa = ca.xy / ca.w * 0.5 * uRes;
  vec2 sb = cb.xy / cb.w * 0.5 * uRes;
  vec2 d = sb - sa;
  float L = length(d);
  vec2 n = L > 1e-4 ? vec2(-d.y, d.x) / L : vec2(1.0, 0.0);
  // The world width at this end in px, floored.
  float px = uHalfW * projectionMatrix[1][1] * 0.5 * uRes.y / max(-v.z, near);
  float core = max(px, uMinPx);
  float hw = core * uHalo;
  vec2 off = n * aSide * hw;
  c.xy += off / (0.5 * uRes) * c.w;
  gl_Position = c;
  vAcross = aSide;
  vCore = 1.0 / uHalo;
  vAlong = aEnd;
}`;

const RIBBON_FS = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uEnds;      // 0: even along its length; 1: fades out toward uTo; 2: fades out toward both ends
varying float vAcross;
varying float vCore;
varying float vAlong;
void main() {
  float x = abs(vAcross);
  float along = uEnds > 1.5 ? 1.0 - abs(vAlong * 2.0 - 1.0) : uEnds > 0.5 ? 1.0 - vAlong : 1.0;
  // A tapered streak (the flash star's spikes) thins as it fades, so it reads as a point of light, not a bar.
  x /= max(0.15, pow(along, 0.6));
  if (x > 1.0) discard;
  float core = 1.0 - smoothstep(vCore * 0.55, vCore * 1.05, x);
  float halo = exp(-x * x * 7.0) * 0.32;
  // Saturated red, never pushed past 1 (over 1 the grade and tone curve wash it to salmon): the bloom does the glow.
  // Bright like the street's neon: the noir grade drains saturation from dim midtones and keeps it only where colour
  // is both strong and bright (post.ts), so a dim red line reads grey-pink. Pure red, no white added.
  float hot = core * (2.2 + 0.6 * (1.0 - smoothstep(0.0, vCore * 0.5, x)));
  vec3 col = uColor * (hot + halo * 0.8);
  // Premultiplied over: the core covers what's behind it (an additive core over the street's cyan neon summed to
  // salmon), the halo adds light on top.
  float fade = uEnds > 0.5 ? along * along : 1.0;
  gl_FragColor = vec4(col * uOpacity * fade, core * 0.85 * uOpacity * fade);
}`;

const DOT_VS = /* glsl */ `
uniform vec3 uAt;
uniform float uR;      // world radius of the glow (m)
uniform float uMinPx;  // radius floor (target px)
uniform vec2 uRes;
attribute vec2 aCorner;
varying vec2 vUv;
void main() {
  vec4 v = viewMatrix * vec4(uAt, 1.0);
  vec4 c = projectionMatrix * v;
  float px = uR * projectionMatrix[1][1] * 0.5 * uRes.y / max(-v.z, 0.06);
  float r = max(px, uMinPx);
  c.xy += aCorner * r / (0.5 * uRes) * c.w;
  gl_Position = c;
  vUv = aCorner;
}`;

const DOT_FS = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  float d = length(vUv);
  if (d > 1.0) discard;
  float core = 1.0 - smoothstep(0.12, 0.24, d);
  float glow = exp(-d * d * 6.0) * 0.6;
  vec3 col = uColor * (core * 1.6 + glow) + vec3(1.0, 0.85, 0.7) * core * 0.6;
  gl_FragColor = vec4(col * uOpacity, 1.0);
}`;

const additive = {
  transparent: true,
  depthWrite: false,
  depthTest: true,
  blending: THREE.AdditiveBlending,
  fog: false,
  toneMapped: false,
} as const;

const res = new THREE.Vector2();
function feedRes(r: THREE.WebGLRenderer, u: { value: THREE.Vector2 }): void {
  const t = r.getRenderTarget();
  if (t) u.value.set(t.width, t.height);
  else r.getDrawingBufferSize(u.value);
}

/** The beam: a camera-facing ribbon between two world points. Not culled (its geometry is placeholder). */
export class LaserBeam extends THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> {
  constructor(color = 0xff3b1a) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(new Array(12).fill(0), 3));
    g.setAttribute("aSide", new THREE.Float32BufferAttribute([-1, 1, -1, 1], 1));
    g.setAttribute("aEnd", new THREE.Float32BufferAttribute([0, 0, 1, 1], 1));
    g.setIndex([0, 2, 1, 1, 2, 3]);
    const m = new THREE.ShaderMaterial({
      ...additive,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      side: THREE.DoubleSide,
      uniforms: {
        uFrom: { value: new THREE.Vector3() },
        uTo: { value: new THREE.Vector3() },
        uHalfW: { value: 0.0015 },
        uMinPx: { value: 1 },
        uHalo: { value: 6 },
        uRes: { value: res.clone() },
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: 0.85 },
        uEnds: { value: 0 },
      },
      vertexShader: RIBBON_VS,
      fragmentShader: RIBBON_FS,
    });
    super(g, m);
    this.frustumCulled = false;
    this.renderOrder = 5;
    this.name = "laser";
    this.onBeforeRender = (r) => feedRes(r, m.uniforms.uRes as { value: THREE.Vector2 });
  }
  /** Spans the beam from `a` to `b` (world), `halfW` metres of core, floored at `minPx` target px (half-width). */
  span(a: THREE.Vector3, b: THREE.Vector3, halfW: number, opacity: number, minPx = 1): void {
    const u = this.material.uniforms;
    (u.uFrom!.value as THREE.Vector3).copy(a);
    (u.uTo!.value as THREE.Vector3).copy(b);
    u.uHalfW!.value = halfW;
    u.uOpacity!.value = opacity;
    u.uMinPx!.value = minPx;
  }
}

/** The landing dot: a camera-facing glow disc with a pixel floor. */
export class LaserDot extends THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> {
  constructor(color = 0xff5a30) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(new Array(12).fill(0), 3));
    g.setAttribute("aCorner", new THREE.Float32BufferAttribute([-1, -1, 1, -1, -1, 1, 1, 1], 2));
    g.setIndex([0, 1, 2, 2, 1, 3]);
    const m = new THREE.ShaderMaterial({
      ...additive,
      side: THREE.DoubleSide,
      uniforms: {
        uAt: { value: new THREE.Vector3() },
        uR: { value: 0.09 },
        uMinPx: { value: 6 },
        uRes: { value: res.clone() },
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: 0.95 },
      },
      vertexShader: DOT_VS,
      fragmentShader: DOT_FS,
    });
    super(g, m);
    this.frustumCulled = false;
    this.renderOrder = 6;
    this.name = "laserDot";
    this.onBeforeRender = (r) => feedRes(r, m.uniforms.uRes as { value: THREE.Vector2 });
  }
  place(at: THREE.Vector3, r: number, opacity: number, minPx = 6): void {
    const u = this.material.uniforms;
    (u.uAt!.value as THREE.Vector3).copy(at);
    u.uR!.value = r;
    u.uOpacity!.value = opacity;
    u.uMinPx!.value = minPx;
  }
}

let smokeTex: THREE.CanvasTexture | null = null;
function smokeTexture(): THREE.CanvasTexture | null {
  if (smokeTex || typeof document === "undefined") return smokeTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  if (!g) return null;
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grd.addColorStop(0, "rgba(200,200,205,0.55)");
  grd.addColorStop(0.5, "rgba(170,172,178,0.22)");
  grd.addColorStop(1, "rgba(150,150,155,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  smokeTex = new THREE.CanvasTexture(c);
  smokeTex.colorSpace = THREE.SRGBColorSpace;
  return smokeTex;
}

/**
 * A held muzzle flash for a screenshot stage (the live flash lasts a frame or two): the flash star a little out
 * from the muzzle with a pixel floor, its warm light, and a few soft puffs of smoke drifting up from it.
 */
export function stageFlash(at: THREE.Vector3, dir: THREE.Vector3): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  // C16 review: a soft round glow read as a lamp on the crate. A muzzle flash is a star: the bright core a hand's
  // width out of the muzzle, a long spike thrown forward along the bore and four shorter ones round it (the
  // muzzle device's ports), each with a pixel floor so it stays a star on a phone.
  const c = at.clone().addScaledVector(dir, 0.12);
  const star = new LaserDot(0xffa040);
  star.place(c, 0.11, 0.9, 7);
  const core = new LaserDot(0xfff0c0);
  core.place(c, 0.045, 1, 3.5);
  const up = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const u = new THREE.Vector3().crossVectors(dir, up).normalize();
  const v = new THREE.Vector3().crossVectors(u, dir).normalize();
  const spike = (a: THREE.Vector3, b: THREE.Vector3, halfW: number, minPx: number, ends: number, color: number) => {
    const s = new LaserBeam(color);
    s.material.uniforms.uHalo!.value = 2.2;
    s.material.uniforms.uEnds!.value = ends;
    s.span(a, b, halfW, 1, minPx);
    out.push(s);
  };
  // Forward along the bore, then a cross tilted 20 degrees off the vertical, and a fainter diagonal pair.
  spike(at.clone().addScaledVector(dir, 0.02), at.clone().addScaledVector(dir, 0.55), 0.022, 2.2, 1, 0xffc070);
  const tilt = (k: number) => u.clone().multiplyScalar(Math.cos(k)).addScaledVector(v, Math.sin(k));
  for (const [k, len, w] of [[0.35, 0.3, 0.012], [0.35 + Math.PI / 2, 0.24, 0.011], [0.35 + Math.PI / 4, 0.13, 0.008], [0.35 - Math.PI / 4, 0.13, 0.008]] as const) {
    const d = tilt(k);
    spike(c.clone().addScaledVector(d, -len), c.clone().addScaledVector(d, len), w, 1.4, 2, 0xffb860);
  }
  // Up and back over his hands (a light at the muzzle's tip would rake the cover's face toward her).
  const light = new THREE.PointLight(0xffa850, 1.4, 2.2, 2);
  light.position.copy(at).addScaledVector(dir, -0.3).add(new THREE.Vector3(0, 0.22, 0));
  out.push(star, core, light);
  // The spikes over the glow, the core over both.
  core.renderOrder = 8;
  const t = smokeTexture();
  if (t) {
    for (let i = 0; i < 4; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.5 - i * 0.08, fog: true }));
      sp.position.copy(at).addScaledVector(dir, 0.12 + i * 0.1).add(new THREE.Vector3(0, 0.05 + i * 0.09, 0));
      sp.scale.setScalar(0.2 + i * 0.12);
      out.push(sp);
    }
  }
  // A held stage flash stays out of the mirror pass (the phone's reflection budget).
  for (const o of out) if (!(o as THREE.Light).isLight) o.layers.set(LAYER_NO_REFLECT);
  return out;
}

/**
 * C16 review: a small prop held up for a screenshot (the reload stage's spent mag) made readable in the dark street
 * without a light pool under it: its bodies in a lighter blued steel, and every hard edge traced with a thin warm
 * highlight, the way a lamp catches a magazine's lips and seams. Returns the prop, to be removed with the stage.
 */
export function litEdges(obj: THREE.Object3D, color = 0xffd2a0): THREE.Object3D[] {
  const steel = new THREE.MeshStandardMaterial({ color: 0x6a7078, metalness: 0.7, roughness: 0.3, emissive: 0x1c1610 });
  const meshes: THREE.Mesh[] = [];
  obj.traverse((o) => {
    // A copy of a LOD'd part keeps the LOD's hidden flag (the guard's mag was dropped from his far gun): show it.
    o.visible = true;
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  for (const m of meshes) {
    m.material = steel;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 28), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6, fog: false }));
    edges.name = "litEdges";
    m.add(edges);
  }
  return [obj];
}

/** Lays a dropped prop down on its long side (whichever local axis is longest goes horizontal), turned to `yaw`. */
export function layFlat(obj: THREE.Object3D, yaw: number): void {
  obj.quaternion.identity();
  obj.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
  const q = new THREE.Quaternion();
  // The long axis to world X, then a quarter roll onto its broad face, then the yaw.
  if (size.y >= size.x && size.y >= size.z) q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  else if (size.z >= size.x) q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  const roll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.25);
  obj.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw).multiply(roll).multiply(q);
  obj.updateMatrixWorld(true);
}
