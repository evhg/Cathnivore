// C10 (S3.2): cloth on the enemies. The Enforcer's knee-length split tabard is 8 strips of 4 Verlet particles (4
// strips in front of the legs, 4 behind), pinned to the belt in the pelvis's frame, held in a panel by soft links
// between neighbouring strips, stiffened by a bend link down each strip, and pushed out of the leg and hip
// capsules. It keeps simulating through the death (the ragdoll's pelvis carries the pins). The sniper's coat tails
// are the same cloth, longer, round the back and sides. One dynamic mesh per body (one draw call), drawn on the
// enemy material, double-sided by duplicated faces.

import * as THREE from "three";
import type { Joint } from "./rig";
import { BANDS, ATLAS_MM } from "../render/guntex";

export interface ClothDef {
  /** Strips: where each is pinned in the pelvis frame (x to his left, y up from the pelvis joint, z ahead) and its width. */
  pins: Array<{ x: number; y: number; z: number }>;
  width: number;
  /** Particles per strip and the rest length between them (m). */
  rows: number;
  seg: number;
  /** The finish: sRGB base colour, roughness, sheen. */
  color: number;
  rough: number;
  sheen: number;
}

/** S3.2's tabard: 8 strips x 4 particles, front and back of the legs, knee length. */
export const TABARD: ClothDef = (() => {
  const pins: ClothDef["pins"] = [];
  for (const z of [0.13, -0.13]) for (let i = 0; i < 4; i++) pins.push({ x: (i - 1.5) * 0.06, y: 0.0, z });
  return { pins, width: 0.058, rows: 4, seg: 0.15, color: 0x15171c, rough: 0.78, sheen: 0.15 };
})();

/** The sniper's coat tails: 10 strips round the back and sides, 5 particles each, mid-shin. */
export const COAT_TAILS: ClothDef = (() => {
  const pins: ClothDef["pins"] = [];
  for (let i = 0; i < 10; i++) {
    const a = Math.PI * 0.5 + (i / 9) * Math.PI;
    pins.push({ x: Math.cos(a) * -0.175, y: 0.02, z: Math.sin(a) * -0.13 + (Math.abs(Math.cos(a)) > 0.8 ? 0.02 : 0) });
  }
  return { pins, width: 0.06, rows: 5, seg: 0.15, color: 0x1c1f26, rough: 0.7, sheen: 0.6 };
})();

const tA = new THREE.Vector3();
const tB = new THREE.Vector3();
const tC = new THREE.Vector3();
const across = new THREE.Vector3();
const up = new THREE.Vector3();
const fwd = new THREE.Vector3();
// write()'s scratch: no per-frame allocation (S0: zero per-frame JS allocations in combat).
const cxT = new THREE.Vector3();

/** A capsule the cloth can't enter: two joints and a radius. */
type Cap = [Joint, Joint, number];
const CAPS: Cap[] = [
  ["hipL", "kneeL", 0.112],
  ["hipR", "kneeR", 0.112],
  ["kneeL", "footL", 0.09],
  ["kneeR", "footR", 0.09],
  ["pelvis", "chest", 0.125],
];

export class Cloth {
  readonly mesh: THREE.Mesh;
  private readonly p: Float32Array;
  private readonly q: Float32Array;
  private readonly n: number;
  private acc = 0;
  private init = false;
  /** Seconds the cloth has barely moved (it stops simulating once its body sleeps and it has settled). */
  private still = 0;
  asleep = false;
  constructor(
    readonly def: ClothDef,
    material: THREE.Material,
    readonly substeps = 2,
  ) {
    const S = def.pins.length;
    const R = def.rows;
    this.n = S * R;
    this.p = new Float32Array(this.n * 3);
    this.q = new Float32Array(this.n * 3);
    // Two faces (front and back) per quad: S strips x (R-1) quads x 2 sides x 2 triangles x 3 vertices.
    const verts = S * (R - 1) * 12;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(verts * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const col = new Float32Array(verts * 3);
    const c = new THREE.Color(def.color);
    for (let i = 0; i < verts; i++) col.set([c.r, c.g, c.b], i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const mr = new Float32Array(verts * 4);
    for (let i = 0; i < verts; i++) mr.set([0, def.rough, 0, def.sheen], i * 4);
    g.setAttribute("aMR", new THREE.BufferAttribute(mr, 4));
    g.setAttribute("aEdge", new THREE.BufferAttribute(new Float32Array(verts), 1));
    const band = new Float32Array(verts * 2);
    const b = BANDS.nylon;
    for (let i = 0; i < verts; i++) band.set([b.v0, b.vh], i * 2);
    g.setAttribute("aBand", new THREE.BufferAttribute(band, 2));
    // Atlas coordinates: u across the strip, v down it, in the band's own millimetres.
    const uvt = new Float32Array(verts * 2);
    let o = 0;
    for (let s = 0; s < S; s++)
      for (let r = 0; r < R - 1; r++) {
        const u0 = (s * def.width * 1000) / ATLAS_MM;
        const u1 = ((s + 1) * def.width * 1000) / ATLAS_MM;
        const v0 = (r * def.seg * 1000) / b.mmH;
        const v1 = ((r + 1) * def.seg * 1000) / b.mmH;
        const quad: Array<[number, number]> = [
          [u0, v0],
          [u1, v0],
          [u1, v1],
          [u0, v0],
          [u1, v1],
          [u0, v1],
        ];
        for (let side = 0; side < 2; side++) for (const [u, v] of side ? [...quad].reverse() : quad) uvt.set([u, v], (o++) * 2);
      }
    g.setAttribute("aUvT", new THREE.BufferAttribute(uvt, 2));
    g.setAttribute("aSeg", new THREE.BufferAttribute(new Float32Array(verts), 1));
    g.setAttribute("aLod", new THREE.BufferAttribute(new Float32Array(verts), 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1);
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.castShadow = true;
    this.mesh.name = "cloth";
  }

  /** The pinned row's points in world space for this pose. */
  private pin(J: Record<Joint, THREE.Vector3>, scale: number, i: number, out: THREE.Vector3): THREE.Vector3 {
    const d = this.def.pins[i]!;
    return out.copy(J.pelvis).addScaledVector(across, d.x * scale).addScaledVector(up, d.y * scale).addScaledVector(fwd, d.z * scale);
  }

  private frame(J: Record<Joint, THREE.Vector3>): void {
    across.subVectors(J.hipL, J.hipR);
    up.subVectors(J.chest, J.pelvis);
    if (across.lengthSq() < 1e-8) across.set(1, 0, 0);
    if (up.lengthSq() < 1e-8) up.set(0, 1, 0);
    across.normalize();
    up.addScaledVector(across, -up.dot(across)).normalize();
    fwd.crossVectors(across, up).normalize();
  }

  /** Hangs the cloth straight down from its pins (a new body, a stage reset). */
  reset(J: Record<Joint, THREE.Vector3>, scale = 1): void {
    this.frame(J);
    const R = this.def.rows;
    for (let s = 0; s < this.def.pins.length; s++) {
      this.pin(J, scale, s, tA);
      for (let r = 0; r < R; r++) {
        const k = (s * R + r) * 3;
        // Down the body's spine axis, and out a touch over the thighs so the first step doesn't start inside a leg.
        const x = tA.x - up.x * r * this.def.seg * scale;
        const y = tA.y - up.y * r * this.def.seg * scale;
        const z = tA.z - up.z * r * this.def.seg * scale;
        const sg = this.def.pins[s]!.z >= 0 ? 1 : -1;
        this.p[k] = x + fwd.x * 0.02 * r * sg;
        this.p[k + 1] = y;
        this.p[k + 2] = z + fwd.z * 0.02 * r * sg;
        this.q[k] = this.p[k]!;
        this.q[k + 1] = this.p[k + 1]!;
        this.q[k + 2] = this.p[k + 2]!;
      }
    }
    this.init = true;
    this.asleep = false;
    this.still = 0;
    this.write();
  }

  /** Steps the cloth `dt` seconds (fixed 60 Hz steps, `substeps` each) against the body's current joints. */
  step(dt: number, J: Record<Joint, THREE.Vector3>, scale = 1, bodyAsleep = false, wind = 0): void {
    if (!this.init) this.reset(J, scale);
    if (this.asleep) return;
    this.acc = Math.min(this.acc + dt, 0.1);
    const h = 1 / 60;
    let moved = 0;
    while (this.acc >= h) {
      this.acc -= h;
      for (let k = 0; k < this.substeps; k++) moved = Math.max(moved, this.sub(h / this.substeps, J, scale, wind));
    }
    this.write();
    if (bodyAsleep && moved < 0.0008) {
      this.still += dt;
      if (this.still > 1) this.asleep = true;
    } else this.still = 0;
  }

  private sub(h: number, J: Record<Joint, THREE.Vector3>, scale: number, wind: number): number {
    const { p, q } = this;
    const S = this.def.pins.length;
    const R = this.def.rows;
    const g = -9.8 * h * h;
    this.frame(J);
    let moved = 0;
    const damp = 0.975;
    for (let i = 0; i < this.n; i++) {
      if (i % R === 0) continue;
      const k = i * 3;
      const vx = (p[k]! - q[k]!) * damp;
      const vy = (p[k + 1]! - q[k + 1]!) * damp;
      const vz = (p[k + 2]! - q[k + 2]!) * damp;
      moved = Math.max(moved, Math.abs(vx) + Math.abs(vy) + Math.abs(vz));
      q[k] = p[k]!;
      q[k + 1] = p[k + 1]!;
      q[k + 2] = p[k + 2]!;
      p[k] = p[k]! + vx + wind * h * h * 0.6;
      p[k + 1] = p[k + 1]! + vy + g;
      p[k + 2] = p[k + 2]! + vz;
    }
    const L = this.def.seg * scale;
    const W = (this.def.pins.length > 1 ? Math.hypot(this.def.pins[1]!.x - this.def.pins[0]!.x, this.def.pins[1]!.z - this.def.pins[0]!.z) : this.def.width) * scale;
    for (let it = 0; it < 3; it++) {
      for (let s = 0; s < S; s++) {
        this.pin(J, scale, s, tA);
        const k0 = s * R * 3;
        // The pinned row moves with the belt (its old position too, so it carries no velocity of its own).
        p[k0] = q[k0] = tA.x;
        p[k0 + 1] = q[k0 + 1] = tA.y;
        p[k0 + 2] = q[k0 + 2] = tA.z;
        for (let r = 1; r < R; r++) {
          link(p, s * R + r - 1, s * R + r, L, r === 1 ? 0 : 0.5, r === 1 ? 1 : 0.5);
          if (r >= 2) link(p, s * R + r - 2, s * R + r, L * 2, r === 2 ? 0 : 0.12, r === 2 ? 0.25 : 0.12);
        }
      }
      // Neighbouring strips hang together loosely (a split panel, not a skirt of ribbons).
      for (let s = 0; s + 1 < S; s++) {
        if ((this.def.pins[s]!.z >= 0) !== (this.def.pins[s + 1]!.z >= 0)) continue;
        for (let r = 1; r < R; r++) link(p, s * R + r, (s + 1) * R + r, W, 0.25, 0.25);
      }
      for (let i = 0; i < this.n; i++) {
        if (i % R === 0) continue;
        for (const [a, b, rad] of CAPS) pushOut(p, i * 3, J[a], J[b], rad * scale);
      }
    }
    return moved;
  }

  /** Writes the ribbons: each strip a quad strip `width` wide across the pelvis frame, both faces. */
  private write(): void {
    const g = this.mesh.geometry;
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    const nor = g.getAttribute("normal") as THREE.BufferAttribute;
    const P = pos.array as Float32Array;
    const N = nor.array as Float32Array;
    const S = this.def.pins.length;
    const R = this.def.rows;
    const hw = this.def.width / 2;
    let o = 0;
    const cx = cxT.set(0, 0, 0);
    let minY = Infinity;
    for (let s = 0; s < S; s++) {
      // Across: the strip's own sideways, the pelvis's across axis turned with where the pin sits (the coat's
      // side tails wrap round).
      const d = this.def.pins[s]!;
      const a = Math.atan2(d.x, d.z);
      tC.copy(across).multiplyScalar(Math.cos(a)).addScaledVector(fwd, -Math.sin(a));
      for (let r = 0; r < R - 1; r++) {
        const i0 = (s * R + r) * 3;
        const i1 = (s * R + r + 1) * 3;
        const ax = this.p[i0]!;
        const ay = this.p[i0 + 1]!;
        const az = this.p[i0 + 2]!;
        const bx = this.p[i1]!;
        const by = this.p[i1 + 1]!;
        const bz = this.p[i1 + 2]!;
        minY = Math.min(minY, by);
        cx.x += bx;
        cx.y += by;
        cx.z += bz;
        const v = [
          [ax - tC.x * hw, ay - tC.y * hw, az - tC.z * hw],
          [ax + tC.x * hw, ay + tC.y * hw, az + tC.z * hw],
          [bx + tC.x * hw, by + tC.y * hw, bz + tC.z * hw],
          [bx - tC.x * hw, by - tC.y * hw, bz - tC.z * hw],
        ] as const;
        // Normal from the quad.
        tA.set(bx - ax, by - ay, bz - az);
        tB.crossVectors(tC, tA).normalize();
        const tri = [v[0], v[1], v[2], v[0], v[2], v[3]];
        for (let side = 0; side < 2; side++) {
          const list = side ? [...tri].reverse() : tri;
          const sg = side ? -1 : 1;
          for (const w of list) {
            P[o * 3] = w[0];
            P[o * 3 + 1] = w[1];
            P[o * 3 + 2] = w[2];
            N[o * 3] = tB.x * sg;
            N[o * 3 + 1] = tB.y * sg;
            N[o * 3 + 2] = tB.z * sg;
            o++;
          }
        }
      }
    }
    pos.needsUpdate = true;
    nor.needsUpdate = true;
    const k = S * (R - 1);
    g.boundingSphere!.center.set(cx.x / k, cx.y / k, cx.z / k);
    g.boundingSphere!.radius = 0.9;
  }

  /** The lowest particle's height (m), for tests. */
  get lowest(): number {
    let m = Infinity;
    for (let i = 0; i < this.n; i++) m = Math.min(m, this.p[i * 3 + 1]!);
    return m;
  }
  /** A particle (strip, row) in world space, for tests. */
  at(s: number, r: number, out = new THREE.Vector3()): THREE.Vector3 {
    const k = (s * this.def.rows + r) * 3;
    return out.set(this.p[k]!, this.p[k + 1]!, this.p[k + 2]!);
  }
}

/** Distance link between particles a and b, moving them by weights wa and wb. */
function link(p: Float32Array, a: number, b: number, rest: number, wa: number, wb: number): void {
  const ka = a * 3;
  const kb = b * 3;
  const dx = p[kb]! - p[ka]!;
  const dy = p[kb + 1]! - p[ka + 1]!;
  const dz = p[kb + 2]! - p[ka + 2]!;
  const d = Math.hypot(dx, dy, dz);
  if (d < 1e-6) return;
  const k = (d - rest) / d;
  p[ka] = p[ka]! + dx * k * wa;
  p[ka + 1] = p[ka + 1]! + dy * k * wa;
  p[ka + 2] = p[ka + 2]! + dz * k * wa;
  p[kb] = p[kb]! - dx * k * wb;
  p[kb + 1] = p[kb + 1]! - dy * k * wb;
  p[kb + 2] = p[kb + 2]! - dz * k * wb;
}

/** Pushes particle k out of the capsule a-b of radius r. */
function pushOut(p: Float32Array, k: number, a: THREE.Vector3, b: THREE.Vector3, r: number): void {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const ll = abx * abx + aby * aby + abz * abz;
  if (ll < 1e-8) return;
  const px = p[k]! - a.x;
  const py = p[k + 1]! - a.y;
  const pz = p[k + 2]! - a.z;
  const t = Math.max(0, Math.min(1, (px * abx + py * aby + pz * abz) / ll));
  const dx = px - abx * t;
  const dy = py - aby * t;
  const dz = pz - abz * t;
  const d = Math.hypot(dx, dy, dz);
  if (d >= r || d < 1e-6) return;
  const s = (r - d) / d;
  p[k] = p[k]! + dx * s;
  p[k + 1] = p[k + 1]! + dy * s;
  p[k + 2] = p[k + 2]! + dz * s;
}
