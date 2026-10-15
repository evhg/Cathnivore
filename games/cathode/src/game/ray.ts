// Ray casts against the world's collision boxes: bullets, line of sight and the kill-cam's path. The boxes
// are bucketed on a coarse XZ grid so a ray only tests the cells it crosses. Every collider carries the
// material rounds meet (for penetration and impacts, S1.1); rotated props test as oriented boxes, so a
// crate turned 30 degrees isn't its own fat bounding box; "thin" cover (glass, shutters, rails, awnings)
// stops rounds but not bodies, so it's only in the bullet rays, never in movement.

import * as THREE from "three";
import type { CoverMat } from "../sim/penetration";

export interface Obb {
  center: THREE.Vector3;
  half: THREE.Vector3;
  yaw: number;
}

export interface WorldHit {
  dist: number;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  box: THREE.Box3;
  mat: CoverMat;
  /** Stops rounds, not movement. */
  thin: boolean;
  /** Where the ray leaves this collider (for an exit impact and penetration). */
  exit: number;
}

interface Entry {
  box: THREE.Box3;
  mat: CoverMat;
  thin: boolean;
  obb: Obb | null;
}

export interface RayWorldOpts {
  /** Parallel to the boxes: what each is made of (default concrete). */
  mats?: CoverMat[];
  /** Parallel to the boxes: the oriented box for rotated props. */
  obbs?: (Obb | null)[];
  /** Shot-only colliders. */
  thin?: { box: THREE.Box3; mat: CoverMat; obb?: Obb }[];
}

const CELL = 8;

export class RayWorld {
  private grid = new Map<string, Entry[]>();
  private ray = new THREE.Ray();
  private hitPoint = new THREE.Vector3();
  private stamp = new Map<Entry, number>();
  private pass = 0;
  readonly entries: Entry[] = [];

  constructor(readonly boxes: THREE.Box3[], opts: RayWorldOpts = {}) {
    boxes.forEach((b, i) => this.entries.push({ box: b, mat: opts.mats?.[i] ?? "concrete", thin: false, obb: opts.obbs?.[i] ?? null }));
    for (const t of opts.thin ?? []) this.entries.push({ box: t.box, mat: t.mat, thin: true, obb: t.obb ?? null });
    for (const e of this.entries) {
      const b = e.box;
      for (let x = Math.floor(b.min.x / CELL); x <= Math.floor(b.max.x / CELL); x++)
        for (let z = Math.floor(b.min.z / CELL); z <= Math.floor(b.max.z / CELL); z++) {
          const k = `${x},${z}`;
          let list = this.grid.get(k);
          if (!list) this.grid.set(k, (list = []));
          list.push(e);
        }
    }
  }

  /**
   * The nearest collider a ray hits within maxDist, or null. With `thin: false` shot-only cover is ignored
   * (line of sight through glass, movement probes).
   */
  cast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, o: { thin?: boolean } = {}): WorldHit | null {
    return this.walk(origin, dir, maxDist, o.thin ?? true, 1)[0] ?? null;
  }

  /** Every collider along the ray within maxDist, nearest first (for penetration). */
  castAll(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, limit = 4): WorldHit[] {
    return this.walk(origin, dir, maxDist, true, limit);
  }

  private walk(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, thin: boolean, limit: number): WorldHit[] {
    this.ray.set(origin, dir);
    this.pass++;
    const found: WorldHit[] = [];
    // Walk the grid cells along the ray (a simple DDA in XZ).
    let cx = Math.floor(origin.x / CELL);
    let cz = Math.floor(origin.z / CELL);
    const stepX = dir.x > 0 ? 1 : -1;
    const stepZ = dir.z > 0 ? 1 : -1;
    const tDeltaX = dir.x !== 0 ? Math.abs(CELL / dir.x) : Infinity;
    const tDeltaZ = dir.z !== 0 ? Math.abs(CELL / dir.z) : Infinity;
    let tMaxX = dir.x !== 0 ? ((dir.x > 0 ? (cx + 1) * CELL : cx * CELL) - origin.x) / dir.x : Infinity;
    let tMaxZ = dir.z !== 0 ? ((dir.z > 0 ? (cz + 1) * CELL : cz * CELL) - origin.z) / dir.z : Infinity;
    let t = 0;
    for (let guard = 0; guard < 256 && t <= maxDist; guard++) {
      const list = this.grid.get(`${cx},${cz}`);
      if (list) {
        for (const e of list) {
          if (this.stamp.get(e) === this.pass) continue;
          this.stamp.set(e, this.pass);
          if (!thin && e.thin) continue;
          const h = this.hitEntry(e, origin, dir);
          if (h && h.dist <= maxDist) found.push(h);
        }
      }
      // Hits inside this cell can't be beaten by a later cell.
      if (found.length >= limit) {
        found.sort((a, b) => a.dist - b.dist);
        if (found[limit - 1]!.dist <= Math.min(tMaxX, tMaxZ)) break;
      }
      if (tMaxX < tMaxZ) {
        t = tMaxX;
        tMaxX += tDeltaX;
        cx += stepX;
      } else {
        t = tMaxZ;
        tMaxZ += tDeltaZ;
        cz += stepZ;
      }
    }
    found.sort((a, b) => a.dist - b.dist);
    return found.slice(0, limit);
  }

  private hitEntry(e: Entry, origin: THREE.Vector3, dir: THREE.Vector3): WorldHit | null {
    if (!e.obb) {
      if (!this.ray.intersectBox(e.box, this.hitPoint)) return null;
      const d = this.hitPoint.distanceTo(origin);
      const exit = slabExit(e.box.min, e.box.max, origin, dir);
      return { dist: d, point: this.hitPoint.clone(), normal: boxNormal(e.box, this.hitPoint), box: e.box, mat: e.mat, thin: e.thin, exit };
    }
    // Into the box's own frame (a yaw about its centre), slab test there, then back out.
    const { center, half, yaw } = e.obb;
    const c = Math.cos(-yaw);
    const s = Math.sin(-yaw);
    const ox = origin.x - center.x;
    const oz = origin.z - center.z;
    const lo = new THREE.Vector3(ox * c + oz * s, origin.y - center.y, -ox * s + oz * c);
    const ld = new THREE.Vector3(dir.x * c + dir.z * s, dir.y, -dir.x * s + dir.z * c);
    const r = slab(half, lo, ld);
    if (!r) return null;
    const [tin, tout, axis, sign] = r;
    const point = origin.clone().addScaledVector(dir, tin);
    const ln = new THREE.Vector3(axis === 0 ? sign : 0, axis === 1 ? sign : 0, axis === 2 ? sign : 0);
    const cw = Math.cos(yaw);
    const sw = Math.sin(yaw);
    const normal = new THREE.Vector3(ln.x * cw + ln.z * sw, ln.y, -ln.x * sw + ln.z * cw);
    return { dist: tin, point, normal, box: e.box, mat: e.mat, thin: e.thin, exit: tout };
  }

  /** True if nothing solid lies between a and b. Glass and other thin cover don't block the view. */
  clear(a: THREE.Vector3, b: THREE.Vector3): boolean {
    const d = new THREE.Vector3().subVectors(b, a);
    const len = d.length();
    if (len < 1e-4) return true;
    return this.cast(a, d.divideScalar(len), len - 0.05, { thin: false }) === null;
  }
}

/** Slab test against a centred box of half extents h: [tIn, tOut, entry axis, entry normal sign], or null. */
function slab(h: THREE.Vector3, o: THREE.Vector3, d: THREE.Vector3): [number, number, number, number] | null {
  let tin = -Infinity;
  let tout = Infinity;
  let axis = 0;
  let sign = 1;
  const oa = [o.x, o.y, o.z];
  const da = [d.x, d.y, d.z];
  const ha = [h.x, h.y, h.z];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(da[i]!) < 1e-12) {
      if (oa[i]! < -ha[i]! || oa[i]! > ha[i]!) return null;
      continue;
    }
    let t1 = (-ha[i]! - oa[i]!) / da[i]!;
    let t2 = (ha[i]! - oa[i]!) / da[i]!;
    let sg = -1;
    if (t1 > t2) {
      [t1, t2] = [t2, t1];
      sg = 1;
    }
    if (t1 > tin) {
      tin = t1;
      axis = i;
      sign = sg;
    }
    tout = Math.min(tout, t2);
    if (tin > tout) return null;
  }
  if (tout < 0) return null;
  return [Math.max(0, tin), tout, axis, sign];
}

/** Where a ray leaves an axis-aligned box. */
function slabExit(min: THREE.Vector3, max: THREE.Vector3, o: THREE.Vector3, d: THREE.Vector3): number {
  const c = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
  const h = new THREE.Vector3().subVectors(max, min).multiplyScalar(0.5);
  const r = slab(h, o.clone().sub(c), d);
  return r ? r[1] : 0;
}

function boxNormal(b: THREE.Box3, p: THREE.Vector3): THREE.Vector3 {
  const e = 1e-3;
  if (Math.abs(p.x - b.min.x) < e) return new THREE.Vector3(-1, 0, 0);
  if (Math.abs(p.x - b.max.x) < e) return new THREE.Vector3(1, 0, 0);
  if (Math.abs(p.y - b.min.y) < e) return new THREE.Vector3(0, -1, 0);
  if (Math.abs(p.y - b.max.y) < e) return new THREE.Vector3(0, 1, 0);
  if (Math.abs(p.z - b.min.z) < e) return new THREE.Vector3(0, 0, -1);
  return new THREE.Vector3(0, 0, 1);
}

/** Ground plane hit (y = height) for rays that miss every box. */
export function rayGround(origin: THREE.Vector3, dir: THREE.Vector3, height: number, maxDist: number): number | null {
  if (dir.y >= -1e-4) return null;
  const t = (height - origin.y) / dir.y;
  return t > 0 && t <= maxDist ? t : null;
}
