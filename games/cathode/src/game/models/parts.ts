// C10 (S3.1): the enemy parts library. Pure geometry (no materials, no DOM), cached by its parameters, so a body
// is assembled from shared pieces and tests can count triangles in Node.
//
// - plate: a chamfered Shape extrude (bevelled on every edge), bent round a cylinder so it hugs a torso or a limb.
// - shell: a closed profile turned round Y over an arc, with end caps (pauldrons, helmet bands, knee cops).
// - tube: a soft-suit limb, a lathe along Y whose radius follows a curve (a bicep's swell, a calf).
// Every piece carries `userData.edge` (1 on a bevel, 0 on a face) for the kit's edge wear.

import * as THREE from "three";
import { toCreasedNormals } from "three/addons/utils/BufferGeometryUtils.js";
import type { P2 } from "../gunkit";

const cache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = cache.get(key);
  if (!g) cache.set(key, (g = make()));
  return g;
}

/** Edge factor from a face normal in the part's own frame: 1 on a 45 degree bevel, 0 on a flat face. */
function edgeOf(n: THREE.BufferAttribute, i: number, axisY = false): number {
  const x = Math.abs(n.getX(i));
  const y = Math.abs(n.getY(i));
  const z = Math.abs(n.getZ(i));
  const m = axisY ? Math.max(y, Math.hypot(x, z)) : Math.max(x, y, z);
  return THREE.MathUtils.smoothstep(1 - m, 0.04, 0.22);
}

/** A polygon with each corner cut by `c` (m): a machined, chamfered outline. Points run counter-clockwise. */
export function chamfer(pts: P2[], c: number): P2[] {
  if (c <= 0) return pts;
  const out: P2[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i]!;
    const a = pts[(i + n - 1) % n]!;
    const b = pts[(i + 1) % n]!;
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]);
    const lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const ka = Math.min(c, la * 0.45) / la;
    const kb = Math.min(c, lb * 0.45) / lb;
    out.push([p[0] + (a[0] - p[0]) * ka, p[1] + (a[1] - p[1]) * ka]);
    out.push([p[0] + (b[0] - p[0]) * kb, p[1] + (b[1] - p[1]) * kb]);
  }
  return out;
}

export interface PlateOpts {
  /** Thickness (m) without the bevel. */
  depth?: number;
  /** Bevel size and segments (0 for a distant LOD). */
  bevel?: number;
  bevelSeg?: number;
  /** Bend radius (m) round a vertical axis behind the plate (0 = flat). */
  bend?: number;
  /** Bend round the horizontal axis too (a plate curving over the top of a shoulder or down a shin), m. */
  bendY?: number;
  /** Cut-outs (a riot shield's viewport), in the outline's plane. */
  holes?: P2[][];
}

/**
 * A plate from an outline in its XY plane (x across, y up), its back face on z = 0 and its front at +z, bent round
 * a cylinder whose axis runs along Y at z = -bend (so the plate's centre line stays at z = 0).
 */
export function plate(pts: P2[], o: PlateOpts = {}): THREE.BufferGeometry {
  const depth = o.depth ?? 0.014;
  const bevel = o.bevel ?? 0.006;
  const bseg = bevel > 0 ? (o.bevelSeg ?? 2) : 0;
  const hk = (o.holes ?? []).map((h) => h.map((p) => p.map((v) => v.toFixed(4)).join(",")).join(";")).join("|");
  const key = `plate:${pts.map((p) => p.map((v) => v.toFixed(4)).join(",")).join(";")}:${depth}:${bevel}:${bseg}:${o.bend ?? 0}:${o.bendY ?? 0}:${hk}`;
  return cached(key, () => {
    const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const h of o.holes ?? []) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
    let g: THREE.BufferGeometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel * 0.8,
      bevelSize: bevel,
      bevelOffset: -bevel,
      bevelSegments: bseg,
      curveSegments: 4,
    });
    g.translate(0, 0, bevel * 0.8);
    if (g.index) g = g.toNonIndexed();
    g.deleteAttribute("uv");
    g.computeVertexNormals();
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    const nor = g.getAttribute("normal") as THREE.BufferAttribute;
    const edge = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) edge[i] = edgeOf(nor, i);
    bend(g, o.bend ?? 0, o.bendY ?? 0);
    g.userData.edge = edge;
    return g;
  });
}

/** Bends a part round Y (radius `r`, axis at z = -r) and then round X (radius `ry`, axis at z = -ry), in place. */
export function bend(g: THREE.BufferGeometry, r: number, ry = 0): void {
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const nor = g.getAttribute("normal") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    let nx = nor.getX(i);
    let ny = nor.getY(i);
    let nz = nor.getZ(i);
    if (r > 0) {
      const a = x / r;
      const c = Math.cos(a);
      const s = Math.sin(a);
      x = (r + z) * s;
      z = (r + z) * c - r;
      const nx2 = nx * c + nz * s;
      nz = -nx * s + nz * c;
      nx = nx2;
    }
    if (ry > 0) {
      const a = y / ry;
      const c = Math.cos(a);
      const s = Math.sin(a);
      y = (ry + z) * s;
      z = (ry + z) * c - ry;
      const ny2 = ny * c + nz * s;
      nz = -ny * s + nz * c;
      ny = ny2;
    }
    pos.setXYZ(i, x, y, z);
    nor.setXYZ(i, nx, ny, nz);
  }
  pos.needsUpdate = true;
  nor.needsUpdate = true;
}

/**
 * A closed profile `ry` ([radius, y] going round the section) turned round Y from `phi0` over `phiLen` radians (phi
 * 0 faces +Z, pi/2 faces +X), with flat caps on the open ends. `seg` segments over the arc.
 */
/**
 * C11: hero detail, for the one body a takedown frames at 0.3 to 1 m. While `hero` is set, lathe and shell
 * profiles are refined along their smooth runs (a Catmull-Rom midpoint between points that turn less than the
 * crease), so a helmet's dome curves at the rim instead of showing its eleven facets. Corners stay corners.
 */
export const partsDetail = { hero: false };
export function refine(ry: P2[], crease: number, closed = false): P2[] {
  if (!partsDetail.hero || ry.length < 3) return ry;
  const n = ry.length;
  const P = (i: number): P2 => (closed ? ry[((i % n) + n) % n]! : ry[Math.max(0, Math.min(n - 1, i))]!);
  const turn = (i: number): number => {
    if (!closed && (i <= 0 || i >= n - 1)) return 0;
    const a = P(i - 1);
    const b = P(i);
    const c = P(i + 1);
    const a1 = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const a2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
    return Math.abs(Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1)));
  };
  const out: P2[] = [];
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    out.push(P(i));
    if (turn(i) < crease && turn(i + 1) < crease) {
      const p0 = P(i - 1);
      const p1 = P(i);
      const p2 = P(i + 1);
      const p3 = P(i + 2);
      // Catmull-Rom at t = 0.5.
      out.push([(-p0[0] + 9 * p1[0] + 9 * p2[0] - p3[0]) / 16, (-p0[1] + 9 * p1[1] + 9 * p2[1] - p3[1]) / 16]);
    }
  }
  if (!closed) out.push(P(n - 1));
  return out;
}

export function shell(ry0: P2[], phi0: number, phiLen: number, seg: number, crease = 0.6): THREE.BufferGeometry {
  const ry = refine(ry0, crease, true);
  const key = `shell:${ry.map((p) => p.map((v) => v.toFixed(4)).join(",")).join(";")}:${phi0.toFixed(4)}:${phiLen.toFixed(4)}:${seg}:${crease}`;
  return cached(key, () => {
    const pts = ry.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y));
    const closed = phiLen < Math.PI * 2 - 1e-3;
    const ring = new THREE.LatheGeometry([...pts, pts[0]!.clone()], seg, phi0, phiLen);
    let g: THREE.BufferGeometry = ring.toNonIndexed();
    g.deleteAttribute("uv");
    g = toCreasedNormals(g, crease);
    const parts: THREE.BufferGeometry[] = [g];
    if (closed) {
      const shape = new THREE.Shape(pts.map((p) => p.clone()));
      for (const [phi, end] of [
        [phi0, false],
        [phi0 + phiLen, true],
      ] as const) {
        const c: THREE.BufferGeometry = new THREE.ShapeGeometry(shape, 1).toNonIndexed();
        c.deleteAttribute("uv");
        const rad = new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi));
        const tan = new THREE.Vector3(Math.cos(phi), 0, -Math.sin(phi));
        const m = new THREE.Matrix4().makeBasis(rad, new THREE.Vector3(0, 1, 0), end ? tan : tan.clone().negate());
        c.applyMatrix4(m);
        if (m.determinant() < 0) flip(c);
        // A shape's winding decides which way its face points: make it face out of the shell either way.
        c.computeVertexNormals();
        const n = c.getAttribute("normal") as THREE.BufferAttribute;
        const want = end ? tan : tan.clone().negate();
        if (n.count && n.getX(0) * want.x + n.getZ(0) * want.z < 0) {
          flip(c);
          c.computeVertexNormals();
        }
        parts.push(c);
      }
    }
    const out = merge(parts);
    const nor = out.getAttribute("normal") as THREE.BufferAttribute;
    const edge = new Float32Array(nor.count);
    // A shell's faces turn with it: its bevels are where the section's corners are (creased normals that point
    // neither out along the radius nor up).
    const pos = out.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < nor.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const l = Math.hypot(x, z) || 1;
      const radial = Math.abs((nor.getX(i) * x + nor.getZ(i) * z) / l);
      const up = Math.abs(nor.getY(i));
      const tang = Math.abs((nor.getX(i) * z - nor.getZ(i) * x) / l);
      edge[i] = THREE.MathUtils.smoothstep(1 - Math.max(radial, up, tang), 0.04, 0.22);
    }
    out.userData.edge = edge;
    return out;
  });
}

/** A soft limb along +Y from 0 to `len`: radius r(t) for t in 0..1 sampled at `rings`, `seg` round. */
export function limb(len: number, r: (t: number) => number, seg: number, rings0: number, caps = true): THREE.BufferGeometry {
  const rings = partsDetail.hero ? rings0 * 2 : rings0;
  const key = `limb:${len.toFixed(4)}:${[0, 0.25, 0.5, 0.75, 1].map((t) => r(t).toFixed(4)).join(",")}:${seg}:${rings}:${caps}`;
  return cached(key, () => {
    const pts: THREE.Vector2[] = [];
    if (caps) pts.push(new THREE.Vector2(0, -r(0) * 0.35));
    for (let i = 0; i <= rings; i++) {
      const t = i / rings;
      pts.push(new THREE.Vector2(r(t), t * len));
    }
    if (caps) pts.push(new THREE.Vector2(0, len + r(1) * 0.35));
    let g: THREE.BufferGeometry = new THREE.LatheGeometry(pts, seg).toNonIndexed();
    g.deleteAttribute("uv");
    g = toCreasedNormals(g, 1.2);
    g.userData.edge = new Float32Array(g.getAttribute("position").count);
    return g;
  });
}

/** An ellipsoid-ish lathe body along Y (a torso core, a skull): `ry` [radius, y] open profile, scaled in x and z. */
export function body(ry0: P2[], sx: number, sz: number, seg: number): THREE.BufferGeometry {
  const ry = refine(ry0, 0.9);
  const key = `body:${ry.map((p) => p.map((v) => v.toFixed(4)).join(",")).join(";")}:${sx}:${sz}:${seg}`;
  return cached(key, () => {
    let g: THREE.BufferGeometry = new THREE.LatheGeometry(
      ry.map(([r, y]) => new THREE.Vector2(r, y)),
      seg,
    ).toNonIndexed();
    g.deleteAttribute("uv");
    g = toCreasedNormals(g, 0.9);
    g.scale(sx, 1, sz);
    g.computeVertexNormals();
    g = toCreasedNormals(g, 0.9);
    g.userData.edge = new Float32Array(g.getAttribute("position").count);
    return g;
  });
}

/** A rounded box with its edges marked for wear (cached). */
export function box(w: number, h: number, d: number, r: number, seg = 2): THREE.BufferGeometry {
  const key = `box:${w}:${h}:${d}:${r}:${seg}`;
  return cached(key, () => {
    if (seg <= 0 || r <= 0) {
      const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
      g.deleteAttribute("uv");
      const nor = g.getAttribute("normal") as THREE.BufferAttribute;
      g.userData.edge = new Float32Array(nor.count);
      return g;
    }
    // A chamfered box (an extruded chamfered rectangle, its faces bevelled) reads as machined at a fraction of a
    // rounded box's triangles.
    const b = Math.min(r, d / 3, w / 3, h / 3);
    const pts = chamfer(
      [
        [-w / 2, -h / 2],
        [w / 2, -h / 2],
        [w / 2, h / 2],
        [-w / 2, h / 2],
      ],
      Math.min(r, w / 2.2, h / 2.2),
    );
    const src = plate(pts, { depth: Math.max(1e-4, d - 1.6 * b), bevel: b, bevelSeg: seg > 2 ? 2 : 1 });
    const g = src.clone();
    g.translate(0, 0, -d / 2);
    g.userData = { edge: src.userData.edge };
    return g;
  });
}

/** A cylinder along Y (a filter, a radio whip, a coolant can), its rims marked for wear. */
export function cyl(r0: number, r1: number, h: number, seg: number): THREE.BufferGeometry {
  const key = `cyl:${r0}:${r1}:${h}:${seg}`;
  return cached(key, () => {
    let g: THREE.BufferGeometry = new THREE.CylinderGeometry(r1, r0, h, seg).toNonIndexed();
    g.deleteAttribute("uv");
    g = toCreasedNormals(g, 0.7);
    const nor = g.getAttribute("normal") as THREE.BufferAttribute;
    const edge = new Float32Array(nor.count);
    for (let i = 0; i < nor.count; i++) edge[i] = edgeOf(nor, i, true);
    g.userData.edge = edge;
    return g;
  });
}

function flip(g: THREE.BufferGeometry): void {
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i += 3) {
    for (const name of Object.keys(g.attributes)) {
      const a = g.getAttribute(name) as THREE.BufferAttribute;
      const k = a.itemSize;
      for (let c = 0; c < k; c++) {
        const t = a.array[(i + 1) * k + c]!;
        a.array[(i + 1) * k + c] = a.array[(i + 2) * k + c]!;
        a.array[(i + 2) * k + c] = t;
      }
    }
  }
}

function merge(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  for (const g of list) {
    const p = g.getAttribute("position") as THREE.BufferAttribute;
    const n = g.getAttribute("normal") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nor.push(n.getX(i), n.getY(i), n.getZ(i));
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  return out;
}

/** Triangles in a geometry. */
export function tris(g: THREE.BufferGeometry): number {
  return (g.index ? g.index.count : g.getAttribute("position").count) / 3;
}
