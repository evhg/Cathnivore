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

  emit(x: number, y: number, z: number, color: THREE.ColorRepresentation, n: number, speed = 2, size = 0.12, life = 0.6, gravity = -4): void {
    const c = new THREE.Color(color);
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX_SPARKS;
      const a = Math.random() * Math.PI * 2;
      const up = Math.random();
      const v = speed * (0.4 + Math.random() * 0.8);
      this.pos.set([x, y, z], i * 3);
      this.vel.set([Math.cos(a) * v * (1 - up * 0.5), v * (0.4 + up), Math.sin(a) * v * (1 - up * 0.5)], i * 3);
      this.col.set([c.r, c.g, c.b], i * 3);
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

  update(dt: number): void {
    for (const it of this.items) {
      it.age += dt;
      it.update(Math.min(1, it.age / it.life), dt);
    }
    const done = this.items.filter((it) => it.age >= it.life);
    for (const it of done) {
      this.scene.remove(it.obj);
      it.obj.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry.dispose();
          const mat = mesh.material as THREE.Material;
          if (!(mat as THREE.Material & { shared?: boolean }).shared) mat.dispose();
        }
      });
    }
    this.items = this.items.filter((it) => it.age < it.life);
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
