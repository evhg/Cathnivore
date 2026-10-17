// The Kestrel's smoke and heat (S2.3), drawn in the first-person layer so it sits over the gun where it
// belongs, but kept in the world: each wisp remembers where it was let go in world space and is re-projected
// into camera space every frame, so turning away leaves it hanging in the air behind her aim instead of
// riding the viewmodel. One instanced draw for every wisp, one more for the crown's glow while it's hot.

import * as THREE from "three";
import { tuning } from "./feel/tuning";

const S = tuning.kestrel.smoke;

interface Wisp {
  /** World position (m). */
  p: THREE.Vector3;
  v: THREE.Vector3;
  age: number;
  life: number;
  s0: number;
  s1: number;
  a: number;
  spin: number;
}

const VERT = /* glsl */ `
attribute vec4 aWisp;   // xyz camera-space centre, w size (m)
attribute vec2 aAlpha;  // x alpha, y rotation
varying vec2 vUv;
varying float vA;
void main() {
  vUv = uv;
  vA = aAlpha.x;
  float c = cos(aAlpha.y), s = sin(aAlpha.y);
  vec2 q = mat2(c, -s, s, c) * position.xy * aWisp.w;
  // The view camera sits at the origin looking down -Z: camera space is view space, so the quad faces her.
  gl_Position = projectionMatrix * vec4(aWisp.xyz + vec3(q, 0.0), 1.0);
}
`;
const FRAG = /* glsl */ `
uniform vec3 uColor;
varying vec2 vUv;
varying float vA;
// A soft disc broken by two octaves of cheap value noise, so a wisp reads as smoke, not a sprite.
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  vec2 d = vUv - 0.5;
  float r = length(d) * 2.0;
  float body = smoothstep(1.0, 0.15, r);
  float tex = 0.55 + 0.45 * n(vUv * 5.0 + vA * 3.1) * n(vUv * 11.0 - vA * 1.7);
  float a = body * tex * vA;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor, a);
}
`;

export class GunSmoke {
  private readonly wisps: Wisp[] = [];
  private readonly max: number;
  private readonly mesh: THREE.Mesh;
  private readonly geo: THREE.InstancedBufferGeometry;
  private readonly aWisp: THREE.InstancedBufferAttribute;
  private readonly aAlpha: THREE.InstancedBufferAttribute;
  private readonly mat: THREE.ShaderMaterial;
  /** The crown's glow ring (heat above 0.6). */
  readonly glow: THREE.Mesh;
  private readonly eye = new THREE.Vector3();
  private readonly qInv = new THREE.Quaternion();
  private readonly q = new THREE.Quaternion();
  private readonly tmp = new THREE.Vector3();

  constructor(scene: THREE.Scene, phone = false) {
    this.max = phone ? 16 : 32;
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute("position", base.getAttribute("position"));
    geo.setAttribute("uv", base.getAttribute("uv"));
    this.aWisp = new THREE.InstancedBufferAttribute(new Float32Array(this.max * 4), 4);
    this.aAlpha = new THREE.InstancedBufferAttribute(new Float32Array(this.max * 2), 2);
    this.aWisp.setUsage(THREE.DynamicDrawUsage);
    this.aAlpha.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("aWisp", this.aWisp);
    geo.setAttribute("aAlpha", this.aAlpha);
    geo.instanceCount = 0;
    this.geo = geo;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uColor: { value: new THREE.Color(0.55, 0.56, 0.6) } },
      transparent: true,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.name = "vm:smoke";
    scene.add(this.mesh);
    const gm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.36, 0.1).multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    // A short band round the can's last centimetre (the crown faces away from her; the band reads from behind).
    this.glow = new THREE.Mesh(new THREE.CylinderGeometry(0.0181, 0.0181, 0.012, phone ? 12 : 24, 1, true).rotateX(Math.PI / 2), gm);
    this.glow.visible = false;
    this.glow.name = "vm:crown";
  }

  /** The camera this frame (world position and rotation): wisps are kept in the world. */
  setView(eye: THREE.Vector3, q: THREE.Quaternion): void {
    this.eye.copy(eye);
    this.q.copy(q);
    this.qInv.copy(q).invert();
  }

  /** Lets go of a shot's smoke: 3 wisps at the muzzle and 1 at the port (camera-space points), `mul` 1..3 with heat. */
  puff(muzzle: THREE.Vector3, port: THREE.Vector3, fwd: THREE.Vector3, mul: number): void {
    const toWorld = (p: THREE.Vector3) => p.clone().applyQuaternion(this.q).add(this.eye);
    const fw = fwd.clone().applyQuaternion(this.q);
    const n = Math.round(3 * Math.min(1.6, mul));
    for (let i = 0; i < n; i++) {
      const v = fw.clone().multiplyScalar(0.12 + Math.random() * 0.25).add(new THREE.Vector3((Math.random() - 0.5) * 0.08, S.riseMps * (0.7 + Math.random() * 0.6), (Math.random() - 0.5) * 0.08));
      this.add(toWorld(muzzle.clone().addScaledVector(fwd, 0.006 + i * 0.012)), v, mul);
    }
    this.add(toWorld(port), new THREE.Vector3(0.05, S.riseMps * 1.2, 0).applyQuaternion(this.q), mul * 0.8);
  }

  private add(p: THREE.Vector3, v: THREE.Vector3, mul: number): void {
    if (this.wisps.length >= this.max) this.wisps.shift();
    const k = 0.75 + Math.random() * 0.5;
    this.wisps.push({ p, v, age: 0, life: (S.lifeMs / 1000) * (0.8 + Math.random() * 0.4), s0: S.size0 * k, s1: S.size1 * k * (0.8 + 0.2 * mul), a: S.alpha * Math.min(2.2, 0.75 + 0.45 * mul), spin: (Math.random() - 0.5) * 2 });
  }

  /** Ambient light around the gun (linear), so the smoke is lit by the place, not a flat grey. */
  tint(c: THREE.Color, level: number): void {
    const l = 0.25 + 0.6 * Math.min(1, Math.max(0, level));
    this.mat.uniforms.uColor!.value.setRGB(0.5 * l + c.r * 0.12, 0.5 * l + c.g * 0.12, 0.52 * l + c.b * 0.12);
  }

  update(dt: number, heatGlow: number): void {
    let n = 0;
    for (let i = this.wisps.length - 1; i >= 0; i--) {
      const w = this.wisps[i]!;
      w.age += dt;
      if (w.age >= w.life) this.wisps.splice(i, 1);
    }
    for (const w of this.wisps) {
      // Drag on the shot's forward push, a slow rise, a little curl.
      w.v.multiplyScalar(Math.exp(-dt * 3.5));
      w.v.y += dt * 0.1;
      w.p.addScaledVector(w.v, dt);
      const u = w.age / w.life;
      const c = this.tmp.copy(w.p).sub(this.eye).applyQuaternion(this.qInv);
      if (c.z > -0.02) continue; // behind the near plane: skip
      this.aWisp.setXYZW(n, c.x, c.y, c.z, w.s0 + (w.s1 - w.s0) * Math.sqrt(u));
      this.aAlpha.setXY(n, w.a * (1 - u) * Math.min(1, u * 12 + 0.25), w.spin + u * w.spin * 1.5);
      n++;
    }
    this.geo.instanceCount = n;
    this.aWisp.needsUpdate = true;
    this.aAlpha.needsUpdate = true;
    this.mesh.visible = n > 0;
    const gm = this.glow.material as THREE.MeshBasicMaterial;
    gm.opacity = heatGlow * 0.9;
    this.glow.visible = heatGlow > 0.01;
  }

  get count(): number {
    return this.wisps.length;
  }

  clear(): void {
    this.wisps.length = 0;
    this.geo.instanceCount = 0;
    this.mesh.visible = false;
  }
}
