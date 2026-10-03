// Effects for the 3D battlefield: additive sparks (they bloom), tumbling debris with a bounce, shockwave
// rings, beams, flying projectiles, ground decals, and floating numbers drawn as crisp HTML over the canvas.

import * as THREE from "three";

const MAX_SPARKS = 1500;

export class Sparks {
  readonly points: THREE.Points;
  private pos = new Float32Array(MAX_SPARKS * 3);
  private col = new Float32Array(MAX_SPARKS * 3);
  private size = new Float32Array(MAX_SPARKS);
  private vel = new Float32Array(MAX_SPARKS * 3);
  private life = new Float32Array(MAX_SPARKS);
  private age = new Float32Array(MAX_SPARKS);
  private base = new Float32Array(MAX_SPARKS);
  private grav = new Float32Array(MAX_SPARKS);
  private next = 0;

  constructor() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute("size", new THREE.BufferAttribute(this.size, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 300 } },
      vertexShader: `attribute float size; attribute vec3 color; varying vec3 vColor; uniform float scale;
        void main() { vColor = color; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vColor; void main() { vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(d));
        if (a <= 0.0) discard; gl_FragColor = vec4(vColor * a, a); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    for (let i = 0; i < MAX_SPARKS; i++) this.life[i] = 0;
  }

  setScale(px: number): void {
    (this.points.material as THREE.ShaderMaterial).uniforms.scale!.value = px;
  }

  private c = new THREE.Color();

  emit(x: number, y: number, z: number, color: THREE.ColorRepresentation, n: number, speed = 2, size = 0.12, life = 0.6, gravity = -4): void {
    const c = this.c.set(color);
    for (let k = 0; k < n; k++) {
      const i = this.next;
      const j = i * 3;
      this.next = (this.next + 1) % MAX_SPARKS;
      const a = Math.random() * Math.PI * 2;
      const up = Math.random();
      const v = speed * (0.4 + Math.random() * 0.8);
      this.pos[j] = x;
      this.pos[j + 1] = y;
      this.pos[j + 2] = z;
      this.vel[j] = Math.cos(a) * v * (1 - up * 0.5);
      this.vel[j + 1] = v * (0.4 + up);
      this.vel[j + 2] = Math.sin(a) * v * (1 - up * 0.5);
      this.col[j] = c.r;
      this.col[j + 1] = c.g;
      this.col[j + 2] = c.b;
      this.base[i] = size * (0.6 + Math.random() * 0.8);
      this.life[i] = life * (0.6 + Math.random() * 0.8);
      this.age[i] = 0;
      this.grav[i] = gravity;
    }
  }

  update(dt: number): void {
    for (let i = 0; i < MAX_SPARKS; i++) {
      if (this.life[i]! <= 0) {
        this.size[i] = 0;
        continue;
      }
      this.age[i]! += dt;
      const k = this.age[i]! / this.life[i]!;
      if (k >= 1) {
        this.life[i] = 0;
        this.size[i] = 0;
        continue;
      }
      this.vel[i * 3 + 1]! += this.grav[i]! * dt;
      this.pos[i * 3]! += this.vel[i * 3]! * dt;
      this.pos[i * 3 + 1]! += this.vel[i * 3 + 1]! * dt;
      this.pos[i * 3 + 2]! += this.vel[i * 3 + 2]! * dt;
      if (this.pos[i * 3 + 1]! < 0.01) {
        this.pos[i * 3 + 1] = 0.01;
        this.vel[i * 3 + 1] = -this.vel[i * 3 + 1]! * 0.3;
      }
      this.size[i] = this.base[i]! * (1 - k);
    }
    const g = this.points.geometry;
    g.attributes.position!.needsUpdate = true;
    g.attributes.size!.needsUpdate = true;
    g.attributes.color!.needsUpdate = true;
  }
}

const MAX_DEBRIS = 400;

/** Tumbling chunks: cardboard, glass, bodywork. They bounce once or twice and fade by shrinking. */
export class Debris {
  readonly mesh: THREE.InstancedMesh;
  private p = new Float32Array(MAX_DEBRIS * 3);
  private v = new Float32Array(MAX_DEBRIS * 3);
  private r = new Float32Array(MAX_DEBRIS * 3);
  private s = new Float32Array(MAX_DEBRIS);
  private age = new Float32Array(MAX_DEBRIS);
  private life = new Float32Array(MAX_DEBRIS);
  private next = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private sv = new THREE.Vector3();
  private pv = new THREE.Vector3();

  constructor() {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.6 }), MAX_DEBRIS);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < MAX_DEBRIS; i++) {
      this.mesh.setMatrixAt(i, zero);
      this.mesh.setColorAt(i, new THREE.Color("#ffffff"));
    }
  }

  emit(x: number, y: number, z: number, colors: string[], n: number, size = 0.06, speed = 2.2): void {
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX_DEBRIS;
      const a = Math.random() * Math.PI * 2;
      this.p.set([x, y, z], i * 3);
      this.v.set([Math.cos(a) * speed * Math.random(), 1.5 + Math.random() * speed, Math.sin(a) * speed * Math.random()], i * 3);
      this.r.set([Math.random() * 6, Math.random() * 6, Math.random() * 6], i * 3);
      this.s[i] = size * (0.6 + Math.random() * 0.9);
      this.age[i] = 0;
      this.life[i] = 1.4 + Math.random() * 0.8;
      this.mesh.setColorAt(i, new THREE.Color(colors[k % colors.length]!));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number): void {
    for (let i = 0; i < MAX_DEBRIS; i++) {
      if (this.life[i]! <= 0) continue;
      this.age[i]! += dt;
      const k = this.age[i]! / this.life[i]!;
      if (k >= 1) {
        this.life[i] = 0;
        this.m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this.m);
        continue;
      }
      this.v[i * 3 + 1]! -= 9 * dt;
      for (let a = 0; a < 3; a++) this.p[i * 3 + a]! += this.v[i * 3 + a]! * dt;
      if (this.p[i * 3 + 1]! < this.s[i]! / 2) {
        this.p[i * 3 + 1] = this.s[i]! / 2;
        this.v[i * 3 + 1] = Math.abs(this.v[i * 3 + 1]!) * 0.35;
        this.v[i * 3]! *= 0.6;
        this.v[i * 3 + 2]! *= 0.6;
      } else for (let a = 0; a < 3; a++) this.r[i * 3 + a]! += dt * 8;
      const sc = this.s[i]! * (k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1);
      this.q.setFromEuler(this.e.set(this.r[i * 3]!, this.r[i * 3 + 1]!, this.r[i * 3 + 2]!));
      this.m.compose(this.pv.set(this.p[i * 3]!, this.p[i * 3 + 1]!, this.p[i * 3 + 2]!), this.q, this.sv.set(sc, sc, sc));
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Frees what an effect owns: geometry and materials, except the cached ones it borrowed (marked shared). */
export function disposeOwn(o: THREE.Object3D): void {
  const mesh = o as THREE.Mesh;
  if (!mesh.isMesh) return;
  if (!mesh.geometry.userData.shared) mesh.geometry.dispose();
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const mat of mats) if (!(mat as THREE.Material & { shared?: boolean }).shared) mat.dispose();
  if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
}

/** Marks a geometry as borrowed by many effects, so finishing one effect doesn't free it. */
export function sharedGeometry<T extends THREE.BufferGeometry>(g: T): T {
  g.userData.shared = true;
  return g;
}

let leafGeo: THREE.BufferGeometry | null = null;
let leafMat: THREE.Material | null = null;
/** A small leaf: a diamond, slightly cupped. */
function leafGeometry(): THREE.BufferGeometry {
  if (leafGeo) return leafGeo;
  const g = new THREE.BufferGeometry();
  // prettier-ignore
  const p = [-0.045, 0, 0, 0, 0.008, 0.02, 0.045, 0, 0, -0.045, 0, 0, 0.045, 0, 0, 0, 0.008, -0.02];
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  leafGeo = sharedGeometry(g);
  return leafGeo;
}
function leafMaterial(): THREE.Material {
  leafMat ??= Object.assign(new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide }), { shared: true });
  return leafMat;
}

let dustGeo: THREE.BufferGeometry | null = null;

interface Timed {
  obj: THREE.Object3D;
  age: number;
  life: number;
  update: (k: number, dt: number) => void;
}

/** Short-lived scene objects (rings, beams, projectiles, decals) with an update per frame. */
export class Transients {
  private items: Timed[] = [];
  constructor(private scene: THREE.Object3D) {}

  add(obj: THREE.Object3D, life: number, update: (k: number, dt: number) => void): void {
    this.scene.add(obj);
    this.items.push({ obj, age: 0, life, update });
  }

  ring(x: number, y: number, z: number, color: string, radius: number, life = 0.45): void {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    this.add(m, life, (k) => {
      m.scale.setScalar(radius * (0.2 + k * 0.8));
      mat.opacity = 0.9 * (1 - k);
    });
  }

  beam(ax: number, ay: number, az: number, bx: number, by: number, bz: number, color: string, width = 0.06, life = 0.18): void {
    const a = new THREE.Vector3(ax, ay, az);
    const b = new THREE.Vector3(bx, by, bz);
    const len = a.distanceTo(b);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(width, width, len, 6, 1, true), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    this.add(m, life, (k) => {
      mat.opacity = 1 - k;
      m.scale.x = m.scale.z = 1 - k * 0.7;
    });
  }

  decal(x: number, y: number, z: number, color: string, radius: number, life = 6): void {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false });
    const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 20), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y + 0.015, z);
    this.add(m, life, (k) => (mat.opacity = 0.6 * (1 - k)));
  }

  /** A gust: a ring of leaves swirling out from (x, z) and lifting as it goes. One draw call. */
  swirl(x: number, y: number, z: number, radius: number, colors: readonly string[], life = 0.9): void {
    const n = 22;
    const m = new THREE.InstancedMesh(leafGeometry(), leafMaterial(), n);
    m.frustumCulled = false;
    const seed = Math.random() * 10;
    const tmp = new THREE.Color();
    for (let i = 0; i < n; i++) m.setColorAt(i, tmp.set(colors[i % colors.length]!));
    const mx = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const pv = new THREE.Vector3();
    const sv = new THREE.Vector3();
    m.position.set(x, y, z);
    this.add(m, life, (k) => {
      const out = radius * (0.15 + 0.85 * (1 - (1 - k) * (1 - k)));
      const sc = k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + k * 5 + Math.sin(seed + i) * 0.3;
        const r = out * (0.75 + 0.25 * Math.sin(seed * 3 + i * 1.7));
        pv.set(Math.cos(a) * r, 0.08 + k * 0.5 * (0.5 + 0.5 * Math.sin(i * 2.3 + seed)) + Math.sin(k * 9 + i) * 0.05, Math.sin(a) * r);
        q.setFromEuler(e.set(k * 14 + i, -a, k * 9 + i * 0.5));
        mx.compose(pv, q, sv.set(sc, sc, sc));
        m.setMatrixAt(i, mx);
      }
      m.instanceMatrix.needsUpdate = true;
    });
  }

  /** A puff of dust rolling out from the base of something just built. One draw call. */
  dust(x: number, y: number, z: number, radius: number, color: string, n = 10, life = 0.7): void {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 1, transparent: true, opacity: 0.7, depthWrite: false, flatShading: true });
    dustGeo ??= sharedGeometry(new THREE.IcosahedronGeometry(1, 0));
    const m = new THREE.InstancedMesh(dustGeo, mat, n);
    m.frustumCulled = false;
    m.position.set(x, y, z);
    const seeds = Array.from({ length: n }, (_, i) => [(i / n) * Math.PI * 2 + Math.random() * 0.4, 0.7 + Math.random() * 0.6, Math.random()] as const);
    const mx = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pv = new THREE.Vector3();
    const sv = new THREE.Vector3();
    this.add(m, life, (k) => {
      const out = 1 - (1 - k) * (1 - k) * (1 - k);
      for (let i = 0; i < n; i++) {
        const [a, sp, ph] = seeds[i]!;
        const r = radius * (0.55 + 0.6 * out * sp);
        pv.set(Math.cos(a) * r, 0.03 + out * 0.12 * (0.5 + ph), Math.sin(a) * r);
        const sc = radius * (0.12 + 0.2 * out) * (0.7 + ph * 0.6);
        mx.compose(pv, q, sv.set(sc, sc * 0.7, sc));
        m.setMatrixAt(i, mx);
      }
      m.instanceMatrix.needsUpdate = true;
      mat.opacity = 0.7 * (1 - k) * (1 - k);
    });
  }

  update(dt: number): void {
    let w = 0;
    for (let r = 0; r < this.items.length; r++) {
      const it = this.items[r]!;
      it.age += dt;
      it.update(Math.min(1, it.age / it.life), dt);
      if (it.age < it.life) {
        this.items[w++] = it;
        continue;
      }
      this.scene.remove(it.obj);
      it.obj.traverse(disposeOwn);
    }
    this.items.length = w;
  }

  clear(): void {
    for (const it of this.items) this.scene.remove(it.obj);
    this.items = [];
  }
}

/** Floating text (bounties, "SPLAT!", "CRUNCH!") as HTML over the canvas: always crisp, cheap to draw. */
export class Floaters {
  private items: Array<{ el: HTMLElement; pos: THREE.Vector3; age: number; life: number }> = [];
  private v = new THREE.Vector3();
  constructor(private layer: HTMLElement) {}

  add(text: string, pos: THREE.Vector3, color: string, big = 1): void {
    const el = document.createElement("span");
    el.className = "floater";
    el.textContent = text;
    el.style.setProperty("--c", color);
    el.style.setProperty("--s", String(big));
    this.layer.append(el);
    this.items.push({ el, pos: pos.clone(), age: 0, life: 1.1 });
  }

  update(dt: number, camera: THREE.Camera, w: number, h: number): void {
    for (const it of this.items) {
      it.age += dt;
      it.pos.y += dt * 0.6;
      this.v.copy(it.pos).project(camera);
      const x = (this.v.x * 0.5 + 0.5) * w;
      const y = (-this.v.y * 0.5 + 0.5) * h;
      const k = it.age / it.life;
      it.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${k < 0.15 ? 0.6 + k * 3 : 1.05 - k * 0.1})`;
      it.el.style.opacity = String(Math.min(1, 2.2 * (1 - k)));
    }
    for (const it of this.items) if (it.age >= it.life) it.el.remove();
    this.items = this.items.filter((it) => it.age < it.life);
  }

  clear(): void {
    for (const it of this.items) it.el.remove();
    this.items = [];
  }
}

export type MoteKind = "pollen" | "fireflies" | "glow";

export interface MoteOptions {
  kind: MoteKind;
  color: string;
  /** World-space size of a mote (before perspective). */
  size: number;
  /** The box the motes live in: x and z in cell units, y in height. */
  box: { x0: number; x1: number; z0: number; z1: number; y0: number; y1: number };
  /** Fixed points (lantern halos) instead of drifting motes. */
  at?: readonly THREE.Vector3[];
  wind?: number;
}

/**
 * The air over the field, as one point cloud: pollen and thistledown drifting on the breeze by day,
 * blinking fireflies and soft lantern halos at night. One draw call, no allocation per frame.
 */
export class Motes {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private alpha: Float32Array;
  private home: Float32Array;
  private phase: Float32Array;
  private n: number;

  constructor(
    count: number,
    private o: MoteOptions,
  ) {
    const n = o.at ? o.at.length : count;
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.alpha = new Float32Array(n);
    this.home = new Float32Array(n * 3);
    this.phase = new Float32Array(n);
    const sizes = new Float32Array(n);
    const b = o.box;
    for (let i = 0; i < n; i++) {
      const p = o.at?.[i];
      this.home[i * 3] = p ? p.x : b.x0 + Math.random() * (b.x1 - b.x0);
      this.home[i * 3 + 1] = p ? p.y : b.y0 + Math.random() * (b.y1 - b.y0);
      this.home[i * 3 + 2] = p ? p.z : b.z0 + Math.random() * (b.z1 - b.z0);
      this.pos.set(this.home.subarray(i * 3, i * 3 + 3), i * 3);
      this.phase[i] = Math.random() * 100;
      sizes[i] = o.size * (0.6 + Math.random() * 0.8);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute("alpha", new THREE.BufferAttribute(this.alpha, 1));
    geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    const additive = o.kind !== "pollen";
    const mat = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 300 }, color: { value: new THREE.Color(o.color) } },
      vertexShader: `attribute float size; attribute float alpha; varying float vAlpha; uniform float scale;
        void main() { vAlpha = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: additive
        ? `uniform vec3 color; varying float vAlpha; void main() { float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d); a = a * a * vAlpha; if (a <= 0.003) discard;
          gl_FragColor = vec4(color * a + vec3(smoothstep(0.12, 0.0, d) * vAlpha), a); }`
        : `uniform vec3 color; varying float vAlpha; void main() { float a = smoothstep(0.5, 0.15, length(gl_PointCoord - 0.5)) * vAlpha;
          if (a <= 0.01) discard; gl_FragColor = vec4(color, a); }`,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  setScale(px: number): void {
    (this.points.material as THREE.ShaderMaterial).uniforms.scale!.value = px;
  }

  update(dt: number, t: number): void {
    const b = this.o.box;
    const w = b.x1 - b.x0;
    const wind = this.o.wind ?? 1;
    for (let i = 0; i < this.n; i++) {
      const j = i * 3;
      const ph = this.phase[i]!;
      if (this.o.kind === "glow") {
        // Lantern halos: a candle's flicker.
        this.alpha[i] = 0.55 + Math.sin(t * 7 + ph) * 0.08 + Math.sin(t * 13.3 + ph * 2) * 0.06;
        continue;
      }
      if (this.o.kind === "fireflies") {
        // Lazy loops around home, a slow blink.
        this.pos[j] = this.home[j]! + Math.sin(t * 0.37 + ph) * 0.6 + Math.sin(t * 0.9 + ph * 3) * 0.15;
        this.pos[j + 1] = this.home[j + 1]! + Math.sin(t * 0.8 + ph * 2) * 0.12;
        this.pos[j + 2] = this.home[j + 2]! + Math.cos(t * 0.31 + ph) * 0.6;
        const blink = Math.max(0, Math.sin(t * (0.9 + (ph % 1) * 0.6) + ph));
        this.alpha[i] = blink * blink * blink;
        continue;
      }
      // Pollen and seeds: carried along on the breeze, bobbing, wrapping round the field.
      let x = this.pos[j]! + dt * wind * (0.25 + Math.sin(ph) * 0.08);
      if (x > b.x1) x -= w;
      this.pos[j] = x;
      this.pos[j + 1] = this.home[j + 1]! + Math.sin(t * 0.9 + ph) * 0.15;
      this.pos[j + 2] = this.home[j + 2]! + Math.sin(t * 0.5 + ph * 1.7) * 0.3;
      const edge = Math.min(1, (x - b.x0) / 1.5, (b.x1 - x) / 1.5);
      this.alpha[i] = Math.max(0, edge) * (0.55 + 0.35 * Math.sin(t * 2 + ph));
    }
    const g = this.points.geometry;
    g.attributes.position!.needsUpdate = true;
    g.attributes.alpha!.needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}

/**
 * A few birds wheeling high over the field (rooks inland, gulls on the coast, bats at night), as one
 * instanced mesh of flapping V shapes.
 */
export class Birds {
  readonly mesh: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private pv = new THREE.Vector3();
  private sv = new THREE.Vector3();
  private phase: number[] = [];

  constructor(
    private n: number,
    private cx: number,
    private cz: number,
    private span: number,
    private bats = false,
    color = bats ? "#14101a" : "#2e2a2a",
  ) {
    const g = new THREE.BufferGeometry();
    // Two wings meeting at the body; the tips are raised so scaling y flaps them.
    // prettier-ignore
    const p = [
      0.05, 0, 0, -0.04, 0, 0, 0, 0.06, -0.15,
      -0.04, 0, 0, 0.05, 0, 0, 0, 0.06, 0.15,
    ];
    g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    g.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(g, mat, n);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < n; i++) this.phase.push(Math.random() * 100);
  }

  update(t: number): void {
    for (let i = 0; i < this.n; i++) {
      const ph = this.phase[i]!;
      const sp = this.bats ? 0.55 : 0.16;
      const a = t * sp * (i % 2 ? 1 : -1) + ph;
      const r = this.span * (0.55 + 0.3 * Math.sin(ph * 1.3 + t * 0.05));
      const wob = this.bats ? Math.sin(t * 3.1 + ph) * 0.4 : 0;
      this.pv.set(this.cx + Math.cos(a) * r + wob, (this.bats ? 2.2 : 3.4) + Math.sin(t * 0.4 + ph) * 0.3 + i * 0.12, this.cz + Math.sin(a) * r * 0.7);
      // Fly along the circle: heading is the tangent.
      const dir = i % 2 ? 1 : -1;
      const heading = Math.atan2(-Math.cos(a) * 0.7 * dir, -Math.sin(a) * dir);
      this.q.setFromEuler(this.e.set(0, heading, Math.sin(t * 0.7 + ph) * 0.25 * dir));
      // Rooks flap in bursts and glide; bats never stop.
      const burst = this.bats ? 1 : Math.max(0, Math.sin(t * 0.6 + ph));
      const flap = Math.sin(t * (this.bats ? 22 : 9) + ph) * (0.25 + 0.75 * burst);
      const s = this.bats ? 0.9 : 1.4;
      this.m.compose(this.pv, this.q, this.sv.set(s, s * flap, s));
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.dispose();
  }
}
