// S11 cover points (docs/design/cathode-combat.md C16). Generated at build time by scripts/cathode-cover.ts into
// render/levels/<district>.cover.json: every 0.75 m along the sides of each solid collider that stands on the
// floor, half a metre out from it, at crouch height (a top 0.95 to 1.75 m up: he kneels behind it and peeks over)
// or full height (1.75 m and up: he stands behind it and leans out round the edge, so only points near an edge
// are kept). Each point stores how much of the half-space in front of it the cover actually hides (a fan of rays),
// so a lone post scores low and a long wall high. The runtime scores the points against Cath (squad.ts).

import * as THREE from "three";
import type { RayWorld } from "../ray";

export type CoverKind = "crouch" | "full";

export interface CoverPoint {
  x: number;
  y: number;
  z: number;
  /** The way he faces to use it: into the cover, toward what it hides him from (unit, flat). */
  fx: number;
  fz: number;
  kind: CoverKind;
  /** 0..1: the share of the fan in front of him the cover stops. */
  prot: number;
  /** Full cover: the side he leans out on (+1 his left as he faces it, -1 his right). Crouch cover: 0. */
  lean: -1 | 0 | 1;
}

export interface CoverFile {
  version: 1;
  district: string;
  spacing: number;
  /** [x, y, z, fx, fz, kind (0 crouch, 1 full), prot, lean] */
  points: number[][];
}

export const COVER_SPACING = 0.75;
/** How far out from the face the point stands (his radius plus a hand's width). */
export const COVER_STANDOFF = 0.5;
/** A body's radius against colliders (enemy.ts moveWithCollision). */
export const BODY_R = 0.3;
const CROUCH_MIN = 0.95;
const FULL_MIN = 1.75;
const FAN = 9;
const FAN_DEG = 60;
const FAN_M = 4;

export interface Bounds {
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
}

/** True when (x, z) at floor height `y` is inside a body-blocking collider grown by `r`. */
export function insideCollider(colliders: readonly THREE.Box3[], x: number, y: number, z: number, r = BODY_R): boolean {
  for (const c of colliders) {
    if (c.max.y < y + 0.4 || c.min.y > y + 1.7) continue;
    if (x > c.min.x - r && x < c.max.x + r && z > c.min.z - r && z < c.max.z + r) return true;
  }
  return false;
}

/** Ground the generator and the tests agree is walkable: in bounds, above the water, not a step off a ledge. */
export function navigable(colliders: readonly THREE.Box3[], ground: (x: number, z: number) => number, b: Bounds, x: number, z: number): boolean {
  if (x < b.xMin + 0.4 || x > b.xMax - 0.4 || z < b.zMin + 0.4 || z > b.zMax - 0.4) return false;
  const y = ground(x, z);
  if (!Number.isFinite(y) || y < -0.25) return false;
  // Level within a step across his footprint.
  for (const [dx, dz] of [[0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]] as const) if (Math.abs(ground(x + dx, z + dz) - y) > 0.25) return false;
  return !insideCollider(colliders, x, y, z);
}

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();

/** The fan's share stopped within 4 m, from `at` toward `facing`. */
function protectionAt(rays: RayWorld, at: THREE.Vector3, fx: number, fz: number): number {
  let blocked = 0;
  for (let i = 0; i < FAN; i++) {
    const a = ((i / (FAN - 1)) * 2 - 1) * ((FAN_DEG * Math.PI) / 180);
    const c = Math.cos(a);
    const s = Math.sin(a);
    v2.set(fx * c - fz * s, 0, fx * s + fz * c);
    const h = rays.cast(at, v2, FAN_M);
    if (h && h.dist <= FAN_M) blocked++;
  }
  return blocked / FAN;
}

export function generateCover(district: string, colliders: readonly THREE.Box3[], rays: RayWorld, ground: (x: number, z: number) => number, bounds: Bounds): CoverPoint[] {
  const out: CoverPoint[] = [];
  const seen = new Set<string>();
  for (const c of colliders) {
    const cx = (c.min.x + c.max.x) / 2;
    const cz = (c.min.z + c.max.z) / 2;
    // Four faces: (along-axis start/end, the fixed coordinate, the outward normal).
    const faces: Array<{ ax: "x" | "z"; a0: number; a1: number; fixed: number; nx: number; nz: number }> = [
      { ax: "x", a0: c.min.x, a1: c.max.x, fixed: c.max.z, nx: 0, nz: 1 },
      { ax: "x", a0: c.min.x, a1: c.max.x, fixed: c.min.z, nx: 0, nz: -1 },
      { ax: "z", a0: c.min.z, a1: c.max.z, fixed: c.max.x, nx: 1, nz: 0 },
      { ax: "z", a0: c.min.z, a1: c.max.z, fixed: c.min.x, nx: -1, nz: 0 },
    ];
    // Far off the play space: skip quickly.
    if (cx < bounds.xMin - 30 || cx > bounds.xMax + 30 || cz < bounds.zMin - 30 || cz > bounds.zMax + 30) continue;
    for (const f of faces) {
      const len = f.a1 - f.a0;
      if (len < 0.3) continue;
      const inset = Math.min(0.3, len / 2);
      const n = Math.max(1, Math.floor((len - 2 * inset) / COVER_SPACING) + 1);
      const step = n > 1 ? (len - 2 * inset) / (n - 1) : 0;
      for (let i = 0; i < n; i++) {
        const a = n > 1 ? f.a0 + inset + i * step : (f.a0 + f.a1) / 2;
        const x = f.ax === "x" ? a : f.fixed + f.nx * COVER_STANDOFF;
        const z = f.ax === "z" ? a : f.fixed + f.nz * COVER_STANDOFF;
        const key = `${x.toFixed(1)},${z.toFixed(1)}`;
        if (seen.has(key)) continue;
        if (!navigable(colliders, ground, bounds, x, z)) continue;
        const y = ground(x, z);
        // It must stand on this floor, and its top must be the cover's top (nothing stacked on it counts).
        if (c.min.y > y + 0.35) continue;
        const top = c.max.y - y;
        if (top < CROUCH_MIN) continue;
        const kind: CoverKind = top >= FULL_MIN ? "full" : "crouch";
        const fx = -f.nx;
        const fz = -f.nz;
        const prot = protectionAt(rays, v1.set(x, y + (kind === "crouch" ? 0.8 : 1.3), z), fx, fz);
        if (prot <= 0.5) continue;
        let lean: -1 | 0 | 1 = 0;
        if (kind === "full") {
          // Lean side: a step to the side at shoulder height is open, and from there the way ahead is clear.
          for (const s of [1, -1] as const) {
            // His left as he faces (fx, fz) is (fz, -fx) (body +X, animate.ts).
            const lx = x + fz * s * 0.8;
            const lz = z - fx * s * 0.8;
            if (insideCollider(colliders, lx, y, lz, 0.22)) continue;
            v1.set(lx, y + 1.5, lz);
            const h = rays.cast(v1, v2.set(fx, 0, fz), 2.5);
            if (!h) {
              lean = s;
              break;
            }
          }
          if (!lean) continue;
        } else {
          // Crouch: over the top must be open.
          v1.set(x, y + Math.max(1.45, top + 0.25), z);
          if (rays.cast(v1, v2.set(fx, 0, fz), 3)) continue;
        }
        seen.add(key);
        out.push({ x, y, z, fx, fz, kind, prot, lean });
      }
    }
  }
  void district;
  return out;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export function packCover(district: string, pts: readonly CoverPoint[]): CoverFile {
  return { version: 1, district, spacing: COVER_SPACING, points: pts.map((p) => [r2(p.x), r2(p.y), r2(p.z), r2(p.fx), r2(p.fz), p.kind === "full" ? 1 : 0, r2(p.prot), p.lean]) };
}

export function unpackCover(f: CoverFile): CoverPoint[] {
  return f.points.map(([x, y, z, fx, fz, k, prot, lean]) => ({ x: x!, y: y!, z: z!, fx: fx!, fz: fz!, kind: k ? "full" : "crouch", prot: prot!, lean: (lean ?? 0) as -1 | 0 | 1 }));
}

/** The districts with a cover file, and the walkable bounds the market falls back to. */
export const COVER_DISTRICTS = ["market", "clinic", "plaza", "tower", "vault"] as const;
export const MARKET_BOUNDS: Bounds = { xMin: -26, xMax: 16, zMin: -70, zMax: 66 };
