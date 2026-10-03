// Ray casts against the world's collision boxes: bullets, line of sight and the kill-cam's path. The boxes
// are bucketed on a coarse XZ grid so a ray only tests the cells it crosses.

import * as THREE from "three";

export interface WorldHit {
  dist: number;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  box: THREE.Box3;
}

const CELL = 8;

export class RayWorld {
  private grid = new Map<string, THREE.Box3[]>();
  private ray = new THREE.Ray();
  private hitPoint = new THREE.Vector3();
  private stamp = new Map<THREE.Box3, number>();
  private pass = 0;

  constructor(readonly boxes: THREE.Box3[]) {
    for (const b of boxes) {
      for (let x = Math.floor(b.min.x / CELL); x <= Math.floor(b.max.x / CELL); x++)
        for (let z = Math.floor(b.min.z / CELL); z <= Math.floor(b.max.z / CELL); z++) {
          const k = `${x},${z}`;
          let list = this.grid.get(k);
          if (!list) this.grid.set(k, (list = []));
          list.push(b);
        }
    }
  }

  /** The nearest box a ray hits within maxDist, or null. */
  cast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): WorldHit | null {
    this.ray.set(origin, dir);
    this.pass++;
    let best: WorldHit | null = null;
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
        for (const b of list) {
          if (this.stamp.get(b) === this.pass) continue;
          this.stamp.set(b, this.pass);
          if (!this.ray.intersectBox(b, this.hitPoint)) continue;
          const d = this.hitPoint.distanceTo(origin);
          if (d <= maxDist && (!best || d < best.dist)) best = { dist: d, point: this.hitPoint.clone(), normal: boxNormal(b, this.hitPoint), box: b };
        }
      }
      // A hit inside this cell can't be beaten by a later cell.
      if (best && best.dist <= Math.min(tMaxX, tMaxZ)) break;
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
    return best;
  }

  /** True if nothing solid lies between a and b. */
  clear(a: THREE.Vector3, b: THREE.Vector3): boolean {
    const d = new THREE.Vector3().subVectors(b, a);
    const len = d.length();
    if (len < 1e-4) return true;
    return this.cast(a, d.divideScalar(len), len - 0.05) === null;
  }
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
