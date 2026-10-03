// A humanoid built from rigid armoured segments hung between joints. One representation serves three
// jobs: procedural animation writes joint positions, a Verlet ragdoll simulates them after death, and a
// severed limb is just a segment that leaves the body and tumbles on its own. Segment meshes are placed
// between their two joints every frame, so animation, ragdoll and gore share one code path.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export const JOINTS = [
  "pelvis",
  "chest",
  "neck",
  "head",
  "shoulderL",
  "elbowL",
  "handL",
  "shoulderR",
  "elbowR",
  "handR",
  "hipL",
  "kneeL",
  "footL",
  "hipR",
  "kneeR",
  "footR",
] as const;
export type Joint = (typeof JOINTS)[number];

export type Zone = "head" | "torso" | "armL" | "armR" | "legL" | "legR";

export interface SegmentDef {
  name: string;
  from: Joint;
  to: Joint;
  zone: Zone;
  /** Hit volume radius, metres. */
  radius: number;
  /** Severing this segment also takes these (a forearm goes with the upper arm). */
  carries?: string[];
}

export const SEGMENTS: SegmentDef[] = [
  { name: "abdomen", from: "pelvis", to: "chest", zone: "torso", radius: 0.16 },
  { name: "chest", from: "chest", to: "neck", zone: "torso", radius: 0.2 },
  { name: "head", from: "neck", to: "head", zone: "head", radius: 0.13 },
  { name: "upperArmL", from: "shoulderL", to: "elbowL", zone: "armL", radius: 0.07, carries: ["forearmL"] },
  { name: "forearmL", from: "elbowL", to: "handL", zone: "armL", radius: 0.06 },
  { name: "upperArmR", from: "shoulderR", to: "elbowR", zone: "armR", radius: 0.07, carries: ["forearmR"] },
  { name: "forearmR", from: "elbowR", to: "handR", zone: "armR", radius: 0.06 },
  { name: "thighL", from: "hipL", to: "kneeL", zone: "legL", radius: 0.09, carries: ["shinL"] },
  { name: "shinL", from: "kneeL", to: "footL", zone: "legL", radius: 0.075 },
  { name: "thighR", from: "hipR", to: "kneeR", zone: "legR", radius: 0.09, carries: ["shinR"] },
  { name: "shinR", from: "kneeR", to: "footR", zone: "legR", radius: 0.075 },
];

/** Rest lengths between joints that the ragdoll keeps (bones plus bracing so the torso stays a box). */
const LINKS: Array<[Joint, Joint, number?]> = [
  ["pelvis", "chest"],
  ["chest", "neck"],
  ["neck", "head"],
  ["shoulderL", "elbowL"],
  ["elbowL", "handL"],
  ["shoulderR", "elbowR"],
  ["elbowR", "handR"],
  ["hipL", "kneeL"],
  ["kneeL", "footL"],
  ["hipR", "kneeR"],
  ["kneeR", "footR"],
  // The torso frame: shoulders and hips braced to the spine and each other.
  ["shoulderL", "shoulderR"],
  ["shoulderL", "neck"],
  ["shoulderR", "neck"],
  ["shoulderL", "chest"],
  ["shoulderR", "chest"],
  ["hipL", "hipR"],
  ["hipL", "pelvis"],
  ["hipR", "pelvis"],
  ["hipL", "chest"],
  ["hipR", "chest"],
  ["shoulderL", "pelvis"],
  ["shoulderR", "pelvis"],
  ["head", "chest"],
];

export interface BodyLook {
  armour: THREE.Material;
  suit: THREE.Material;
  visor: THREE.Material;
  gore: THREE.Material;
  boot: THREE.Material;
}

/** The standard Hollowell Enforcer kit: charcoal plates, black undersuit, an amber visor strip. */
export function enforcerLook(visorColor = 0xffa040): BodyLook {
  return {
    armour: new THREE.MeshStandardMaterial({ color: 0x2b2e35, roughness: 0.38, metalness: 0.55 }),
    suit: new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.85, metalness: 0.05 }),
    visor: new THREE.MeshStandardMaterial({ color: 0x110800, emissive: visorColor, emissiveIntensity: 6, roughness: 0.2 }),
    gore: new THREE.MeshStandardMaterial({ color: 0x5a0008, roughness: 0.35, metalness: 0.1, emissive: 0x120000 }),
    boot: new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.6, metalness: 0.2 }),
  };
}

const geoCache = new Map<string, THREE.BufferGeometry>();
function rbox(w: number, h: number, d: number, r = 0.02): THREE.BufferGeometry {
  const k = `b${w}:${h}:${d}:${r}`;
  let g = geoCache.get(k);
  if (!g) geoCache.set(k, (g = new RoundedBoxGeometry(w, h, d, 2, r)));
  return g;
}
function cyl(rt: number, rb: number, h: number, seg = 10): THREE.BufferGeometry {
  const k = `c${rt}:${rb}:${h}:${seg}`;
  let g = geoCache.get(k);
  if (!g) geoCache.set(k, (g = new THREE.CylinderGeometry(rt, rb, h, seg)));
  return g;
}
function sphere(r: number): THREE.BufferGeometry {
  const k = `s${r}`;
  let g = geoCache.get(k);
  if (!g) geoCache.set(k, (g = new THREE.SphereGeometry(r, 16, 12)));
  return g;
}

function mesh(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  return o;
}

/**
 * Builds a segment's meshes in its local frame: +Y runs from `from` to `to` (length `len`), +Z faces the
 * way the body faces. Each segment also gets a gore cap at both ends, hidden until it's severed.
 */
function buildSegment(name: string, len: number, look: BodyLook): THREE.Group {
  const g = new THREE.Group();
  const { armour: a, suit: s, visor: v, boot: b } = look;
  const mid = len / 2;
  switch (name) {
    case "abdomen":
      g.add(mesh(cyl(0.15, 0.16, len, 12), s, 0, mid, 0));
      g.add(mesh(rbox(0.3, 0.12, 0.2, 0.03), a, 0, len * 0.15, 0.02)); // belt
      g.add(mesh(rbox(0.07, 0.08, 0.05, 0.015), a, 0.11, len * 0.15, 0.12)); // pouches
      g.add(mesh(rbox(0.07, 0.08, 0.05, 0.015), a, -0.11, len * 0.15, 0.12));
      break;
    case "chest":
      g.add(mesh(rbox(0.4, len, 0.24, 0.05), s, 0, mid, 0));
      g.add(mesh(rbox(0.42, len * 0.85, 0.12, 0.04), a, 0, mid + 0.02, 0.09)); // chest plate
      g.add(mesh(rbox(0.38, len * 0.8, 0.1, 0.04), a, 0, mid + 0.02, -0.1)); // back plate
      g.add(mesh(rbox(0.08, 0.03, 0.02, 0.01), v, 0.12, len * 0.75, 0.155)); // status light
      g.add(mesh(rbox(0.16, 0.12, 0.06, 0.02), a, -0.08, len * 0.35, 0.16)); // mag pouch
      break;
    case "head": {
      g.add(mesh(cyl(0.05, 0.06, 0.08), s, 0, 0.03, 0)); // neck
      const helm = mesh(sphere(0.135), a, 0, 0.15, -0.005);
      helm.scale.set(1, 1.05, 1.12);
      g.add(helm);
      g.add(mesh(rbox(0.2, 0.05, 0.08, 0.02), v, 0, 0.15, 0.11)); // the visor strip
      g.add(mesh(rbox(0.22, 0.09, 0.06, 0.02), a, 0, 0.08, 0.1)); // jaw guard
      g.add(mesh(cyl(0.012, 0.012, 0.12, 6), a, 0.1, 0.27, -0.04)); // antenna
      break;
    }
    case "upperArmL":
    case "upperArmR":
      g.add(mesh(cyl(0.06, 0.055, len, 10), s, 0, mid, 0));
      g.add(mesh(rbox(0.16, 0.1, 0.16, 0.04), a, 0, 0.02, 0)); // pauldron
      break;
    case "forearmL":
    case "forearmR":
      g.add(mesh(cyl(0.05, 0.045, len, 10), s, 0, mid, 0));
      g.add(mesh(rbox(0.09, len * 0.6, 0.1, 0.025), a, 0, mid, 0.01)); // vambrace
      g.add(mesh(rbox(0.07, 0.09, 0.05, 0.02), b, 0, len + 0.03, 0.01)); // glove
      break;
    case "thighL":
    case "thighR":
      g.add(mesh(cyl(0.085, 0.07, len, 10), s, 0, mid, 0));
      g.add(mesh(rbox(0.15, len * 0.55, 0.06, 0.025), a, 0, mid, 0.07)); // thigh plate
      break;
    case "shinL":
    case "shinR":
      g.add(mesh(cyl(0.065, 0.055, len, 10), s, 0, mid, 0));
      g.add(mesh(rbox(0.11, len * 0.6, 0.06, 0.025), a, 0, mid, 0.06)); // shin guard
      g.add(mesh(rbox(0.12, 0.08, 0.1, 0.025), a, 0, 0.02, 0.05)); // knee pad
      g.add(mesh(rbox(0.11, 0.08, 0.24, 0.03), b, 0, len + 0.02, 0.05)); // boot
      break;
  }
  const capA = mesh(cyl(0.05, 0.05, 0.02, 10), look.gore, 0, 0, 0);
  const capB = mesh(cyl(0.05, 0.05, 0.02, 10), look.gore, 0, len, 0);
  capA.name = "capFrom";
  capB.name = "capTo";
  capA.visible = capB.visible = false;
  g.add(capA, capB);
  return g;
}

/** Joint positions in body space (feet on y=0, facing +Z), for the rest pose and as animation anchors. */
export const REST: Record<Joint, THREE.Vector3> = {
  pelvis: new THREE.Vector3(0, 0.98, 0),
  chest: new THREE.Vector3(0, 1.2, 0),
  neck: new THREE.Vector3(0, 1.52, 0),
  head: new THREE.Vector3(0, 1.8, 0),
  shoulderL: new THREE.Vector3(0.22, 1.46, 0),
  elbowL: new THREE.Vector3(0.26, 1.16, 0),
  handL: new THREE.Vector3(0.28, 0.9, 0.04),
  shoulderR: new THREE.Vector3(-0.22, 1.46, 0),
  elbowR: new THREE.Vector3(-0.26, 1.16, 0),
  handR: new THREE.Vector3(-0.28, 0.9, 0.04),
  hipL: new THREE.Vector3(0.11, 0.94, 0),
  kneeL: new THREE.Vector3(0.12, 0.5, 0.02),
  footL: new THREE.Vector3(0.12, 0.06, 0),
  hipR: new THREE.Vector3(-0.11, 0.94, 0),
  kneeR: new THREE.Vector3(-0.12, 0.5, 0.02),
  footR: new THREE.Vector3(-0.12, 0.06, 0),
};

interface Seg {
  def: SegmentDef;
  group: THREE.Group;
  len: number;
  /** Severed: the segment flies on its own (two free points). */
  loose: { a: THREE.Vector3; b: THREE.Vector3; pa: THREE.Vector3; pb: THREE.Vector3; t: number } | null;
}

const up = new THREE.Vector3(0, 1, 0);
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpM = new THREE.Matrix4();
const tmpX = new THREE.Vector3();
const tmpZ = new THREE.Vector3();

export interface RagdollWorld {
  colliders: THREE.Box3[];
  ground(x: number, z: number): number;
}

export class Body {
  readonly root = new THREE.Group();
  /** World-space joint positions this frame. */
  readonly joints = {} as Record<Joint, THREE.Vector3>;
  private prev = {} as Record<Joint, THREE.Vector3>;
  readonly segs = new Map<string, Seg>();
  /** Joints a severed segment took with it no longer exist on the body. */
  readonly lost = new Set<string>();
  ragdoll = false;
  private rest = new Map<string, number>();
  /** Which way the body faces (for segment roll), updated by animation. */
  readonly facing = new THREE.Vector3(0, 0, 1);
  restTime = 0;

  constructor(
    readonly look: BodyLook,
    scale = 1,
  ) {
    for (const j of JOINTS) {
      this.joints[j] = REST[j].clone().multiplyScalar(scale);
      this.prev[j] = this.joints[j].clone();
    }
    for (const def of SEGMENTS) {
      const len = REST[def.from].distanceTo(REST[def.to]) * scale;
      const group = buildSegment(def.name, len, look);
      group.userData.segment = def.name;
      this.root.add(group);
      this.segs.set(def.name, { def, group, len, loose: null });
    }
    for (const [a, b] of LINKS) this.rest.set(`${a}|${b}`, REST[a].distanceTo(REST[b]) * scale);
  }

  /** Places every attached segment between its joints. */
  pose(): void {
    tmpZ.copy(this.facing).normalize();
    for (const s of this.segs.values()) {
      if (s.loose) {
        place(s.group, s.loose.a, s.loose.b, tmpZ.set(0, 0, 1));
        continue;
      }
      place(s.group, this.joints[s.def.from], this.joints[s.def.to], tmpZ);
    }
  }

  /** Hands animation over to physics, with an impulse at a point. */
  goLimp(impulse: THREE.Vector3, at?: THREE.Vector3): void {
    if (this.ragdoll) return;
    this.ragdoll = true;
    for (const j of JOINTS) {
      // Give every joint the body's current motion, plus the hit's push (stronger near the hit).
      const near = at ? Math.max(0.25, 1 - this.joints[j].distanceTo(at) * 0.8) : 0.6;
      this.prev[j].copy(this.joints[j]).addScaledVector(impulse, -near / 60);
    }
  }

  /** Keeps prev in step with animated joints, so the ragdoll inherits the body's velocity when it starts. */
  carry(): void {
    for (const j of JOINTS) this.prev[j].copy(this.joints[j]);
  }

  /** Severs a segment (and what it carries): it flies off with `vel`; stumps show gore caps. */
  sever(name: string, vel: THREE.Vector3): string[] {
    const s = this.segs.get(name);
    if (!s || s.loose) return [];
    const out: string[] = [];
    const go = (seg: Seg, v: THREE.Vector3) => {
      const a = this.joints[seg.def.from].clone();
      const b = this.joints[seg.def.to].clone();
      const spin = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random(), (Math.random() - 0.5) * 2);
      seg.loose = {
        a,
        b,
        pa: a.clone().addScaledVector(v, -1 / 60),
        pb: b.clone().addScaledVector(v.clone().add(spin), -1 / 60),
        t: 0,
      };
      seg.group.getObjectByName("capFrom")!.visible = true;
      this.lost.add(seg.def.name);
      out.push(seg.def.name);
      for (const c of seg.def.carries ?? []) {
        const cs = this.segs.get(c);
        if (cs && !cs.loose) {
          // A carried segment stays rigidly attached to the flying part: fly it with the same velocity.
          go(cs, v);
        }
      }
    };
    go(s, vel);
    // The stump: the parent end of the cut shows a cap.
    for (const p of this.segs.values()) {
      if (!p.loose && (p.def.to === s.def.from || p.def.from === s.def.from)) {
        const cap = p.def.to === s.def.from ? "capTo" : "capFrom";
        p.group.getObjectByName(cap)!.visible = true;
      }
    }
    if (s.def.zone === "head") {
      const chest = this.segs.get("chest");
      if (chest) chest.group.getObjectByName("capTo")!.visible = true;
    }
    return out;
  }

  /** Verlet step for the ragdoll and every severed piece. */
  physics(dt: number, w: RagdollWorld): void {
    const g = -19 * dt * dt;
    if (this.ragdoll) {
      this.restTime += dt;
      for (const j of JOINTS) {
        const p = this.joints[j];
        const q = this.prev[j];
        const vx = (p.x - q.x) * 0.985;
        const vy = (p.y - q.y) * 0.985;
        const vz = (p.z - q.z) * 0.985;
        q.copy(p);
        p.x += vx;
        p.y += vy + g;
        p.z += vz;
      }
      for (let it = 0; it < 6; it++) {
        for (const [a, b] of LINKS) {
          const r = this.rest.get(`${a}|${b}`)!;
          solve(this.joints[a], this.joints[b], r, 0.5, 0.5);
        }
        for (const j of JOINTS) collide(this.joints[j], this.prev[j], w);
      }
    }
    for (const s of this.segs.values()) {
      const l = s.loose;
      if (!l) continue;
      l.t += dt;
      for (const [p, q] of [
        [l.a, l.pa],
        [l.b, l.pb],
      ] as const) {
        const vx = (p.x - q.x) * 0.99;
        const vy = (p.y - q.y) * 0.99;
        const vz = (p.z - q.z) * 0.99;
        q.copy(p);
        p.x += vx;
        p.y += vy + g;
        p.z += vz;
      }
      for (let it = 0; it < 3; it++) {
        solve(l.a, l.b, s.len, 0.5, 0.5);
        collide(l.a, l.pa, w);
        collide(l.b, l.pb, w);
      }
    }
  }

  /** Hit test a ray against the attached segments' capsules; returns the nearest hit. */
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): { seg: SegmentDef; dist: number; point: THREE.Vector3 } | null {
    let best: { seg: SegmentDef; dist: number; point: THREE.Vector3 } | null = null;
    for (const s of this.segs.values()) {
      if (s.loose) continue;
      const a = this.joints[s.def.from];
      const b = this.joints[s.def.to];
      const t = rayCapsule(origin, dir, a, b, s.def.radius * (s.def.zone === "head" ? 1.15 : 1.25));
      if (t !== null && t <= maxDist && (!best || t < best.dist))
        best = { seg: s.def, dist: t, point: origin.clone().addScaledVector(dir, t) };
    }
    return best;
  }

  dispose(): void {
    this.root.removeFromParent();
  }
}

export function place(group: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, facing: THREE.Vector3): void {
  // An orthonormal frame: Y along the bone, Z as close to the facing direction as the bone allows.
  tmpA.subVectors(b, a).normalize();
  tmpX.crossVectors(tmpA, facing);
  if (tmpX.lengthSq() < 1e-6) tmpX.crossVectors(tmpA, Math.abs(tmpA.y) > 0.9 ? tmpB.set(1, 0, 0) : up);
  tmpX.normalize();
  tmpB.crossVectors(tmpX, tmpA).normalize();
  tmpM.makeBasis(tmpX, tmpA, tmpB);
  group.position.copy(a);
  group.quaternion.setFromRotationMatrix(tmpM);
}

function solve(a: THREE.Vector3, b: THREE.Vector3, rest: number, wa: number, wb: number): void {
  tmpA.subVectors(b, a);
  const d = tmpA.length();
  if (d < 1e-6) return;
  const diff = (d - rest) / d;
  a.addScaledVector(tmpA, diff * wa);
  b.addScaledVector(tmpA, -diff * wb);
}

function collide(p: THREE.Vector3, q: THREE.Vector3, w: RagdollWorld): void {
  const floor = w.ground(p.x, p.z) + 0.05;
  if (p.y < floor) {
    p.y = floor;
    // Ground friction: kill most sliding.
    q.x = p.x - (p.x - q.x) * 0.4;
    q.z = p.z - (p.z - q.z) * 0.4;
    q.y = p.y + (p.y - q.y) * 0.2;
  }
  for (const c of w.colliders) {
    if (p.x <= c.min.x || p.x >= c.max.x || p.y <= c.min.y || p.y >= c.max.y || p.z <= c.min.z || p.z >= c.max.z) continue;
    // Push out along the shallowest axis.
    const dx1 = p.x - c.min.x,
      dx2 = c.max.x - p.x,
      dy1 = p.y - c.min.y,
      dy2 = c.max.y - p.y,
      dz1 = p.z - c.min.z,
      dz2 = c.max.z - p.z;
    const m = Math.min(dx1, dx2, dy1, dy2, dz1, dz2);
    if (m === dy2) p.y = c.max.y + 0.01;
    else if (m === dx1) p.x = c.min.x - 0.01;
    else if (m === dx2) p.x = c.max.x + 0.01;
    else if (m === dz1) p.z = c.min.z - 0.01;
    else if (m === dz2) p.z = c.max.z + 0.01;
    else p.y = c.min.y - 0.01;
  }
}

/** Distance along a unit ray to a capsule a-b of radius r, or null. */
export function rayCapsule(o: THREE.Vector3, d: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, r: number): number | null {
  // Closest approach between the ray and the segment, then a sphere test at that point on the segment.
  const ba = new THREE.Vector3().subVectors(b, a);
  const oa = new THREE.Vector3().subVectors(o, a);
  const baba = ba.dot(ba);
  const bard = ba.dot(d);
  const baoa = ba.dot(oa);
  const rdoa = d.dot(oa);
  const oaoa = oa.dot(oa);
  const A = baba - bard * bard;
  let B = baba * rdoa - baoa * bard;
  let C = baba * oaoa - baoa * baoa - r * r * baba;
  let h = B * B - A * C;
  if (h >= 0) {
    const t = (-B - Math.sqrt(h)) / A;
    const y = baoa + t * bard;
    if (y > 0 && y < baba && t > 0) return t;
    // The caps.
    const oc = y <= 0 ? oa : new THREE.Vector3().subVectors(o, b);
    B = d.dot(oc);
    C = oc.dot(oc) - r * r;
    h = B * B - C;
    if (h > 0) {
      const tc = -B - Math.sqrt(h);
      if (tc > 0) return tc;
    }
  }
  return null;
}
