// Level construction kit. Everything static is built in world space, UV-mapped by box projection at real
// scale (so a brick is a brick wherever it lands), then merged into one mesh per material: the whole
// district draws in a few dozen calls. Solid pieces also register a Box3 collider with its surface.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Surface } from "./types";

export interface BoxOpts {
  /** Rotation about Y, radians. */
  rotY?: number;
  /** Register a collider with this surface (axis-aligned bounds of the rotated box). */
  collide?: Surface;
  /** Texture metres per repeat (default 2). */
  uv?: number;
  /** Skip faces: "top" "bottom" "px" "nx" "pz" "nz". */
  skip?: string[];
}

const FACE_NAMES = ["px", "nx", "top", "bottom", "pz", "nz"];

/** Rewrites UVs by box projection in world space: each vertex picks the plane its normal faces most. */
export function boxProjectUV(g: THREE.BufferGeometry, scale: number, offset = 0): void {
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const nor = g.getAttribute("normal") as THREE.BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    let u: number;
    let v: number;
    if (ay >= ax && ay >= az) {
      u = x;
      v = z;
    } else if (ax >= az) {
      u = z * Math.sign(nor.getX(i) || 1);
      v = y;
    } else {
      u = -x * Math.sign(nor.getZ(i) || 1);
      v = y;
    }
    uv[i * 2] = u / scale + offset;
    uv[i * 2 + 1] = v / scale + offset * 0.37;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

export class Builder {
  readonly parts = new Map<string, THREE.BufferGeometry[]>();
  readonly colliders: THREE.Box3[] = [];
  readonly surfaces: Surface[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();

  /** Adds a geometry already positioned in world space (it is consumed). */
  add(key: string, g: THREE.BufferGeometry, uvScale?: number): void {
    const geo = g.index ? g.toNonIndexed() : g;
    if (g !== geo) g.dispose();
    if (!geo.getAttribute("normal")) geo.computeVertexNormals();
    if (uvScale) boxProjectUV(geo, uvScale, this.uvJitter(key));
    if (!geo.getAttribute("uv")) boxProjectUV(geo, 2);
    // Keep only what every material needs so all parts merge.
    for (const name of Object.keys(geo.attributes)) if (!["position", "normal", "uv"].includes(name)) geo.deleteAttribute(name);
    geo.morphAttributes = {};
    let list = this.parts.get(key);
    if (!list) this.parts.set(key, (list = []));
    list.push(geo);
  }

  /** A different UV offset per material key so repeated surfaces don't line up exactly. */
  private uvJitter(key: string): number {
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 997;
    return (h % 13) * 0.137;
  }

  /** An axis-aligned (or Y-rotated) box from its centre and size. */
  box(key: string, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, o: BoxOpts = {}): void {
    let g: THREE.BufferGeometry = new THREE.BoxGeometry(sx, sy, sz);
    if (o.skip?.length) g = dropFaces(g, o.skip);
    this.e.set(0, o.rotY ?? 0, 0);
    this.q.setFromEuler(this.e);
    this.m.compose(new THREE.Vector3(cx, cy, cz), this.q, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(this.m);
    if (o.collide) {
      g.computeBoundingBox();
      this.collide(g.boundingBox!.clone(), o.collide);
    }
    this.add(key, g, o.uv ?? 2);
  }

  /** A box from min/max corners (axis-aligned). */
  boxMinMax(key: string, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, o: BoxOpts = {}): void {
    this.box(key, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), o);
  }

  collide(b: THREE.Box3, s: Surface): void {
    this.colliders.push(b);
    this.surfaces.push(s);
  }

  /** A cylinder between two points (pipes, poles, rails). */
  cylinder(key: string, a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 8, collide?: Surface): void {
    const len = a.distanceTo(b);
    const g = new THREE.CylinderGeometry(r, r, len, seg, 1, true);
    const dir = new THREE.Vector3().subVectors(b, a).normalize();
    this.q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    this.m.compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), this.q, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(this.m);
    if (collide) {
      g.computeBoundingBox();
      this.collide(g.boundingBox!.clone().expandByScalar(0.02), collide);
    }
    this.add(key, g, 1);
  }

  /** A sagging cable between two points (catenary-ish parabola), as a thin tube. */
  cable(key: string, a: THREE.Vector3, b: THREE.Vector3, sag: number, r = 0.015): void {
    const pts: THREE.Vector3[] = [];
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = new THREE.Vector3().lerpVectors(a, b, t);
      p.y -= sag * 4 * t * (1 - t);
      pts.push(p);
    }
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, r, 3, false);
    this.add(key, g, 1);
  }

  /** Any geometry, transformed by position/rotation/scale. */
  shape(key: string, g: THREE.BufferGeometry, pos: THREE.Vector3, rotY = 0, scale?: THREE.Vector3, uv = 1, rotX = 0, rotZ = 0): void {
    this.e.set(rotX, rotY, rotZ);
    this.q.setFromEuler(this.e);
    this.m.compose(pos, this.q, scale ?? new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(this.m);
    this.add(key, g, uv);
  }

  /** Merges every part into one mesh per material. Missing materials are skipped (and reported). */
  build(materials: Record<string, THREE.Material>, group: THREE.Group, opts: { shadows: boolean; layer?: (key: string) => number }): void {
    for (const [key, list] of this.parts) {
      const mat = materials[key];
      if (!mat) {
        console.warn(`cathode: no material "${key}"`);
        continue;
      }
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.name = `static:${key}`;
      mesh.matrixAutoUpdate = false;
      mesh.castShadow = opts.shadows && !key.startsWith("glow") && !key.startsWith("glass");
      mesh.receiveShadow = opts.shadows;
      const layer = opts.layer?.(key) ?? 0;
      if (layer) mesh.layers.set(layer);
      group.add(mesh);
    }
    this.parts.clear();
  }
}

/** Removes named faces from a BoxGeometry (indexed, 6 groups of 2 triangles in px nx py ny pz nz order). */
function dropFaces(g: THREE.BufferGeometry, skip: string[]): THREE.BufferGeometry {
  const idx = g.index!;
  const keep: number[] = [];
  for (let f = 0; f < 6; f++) {
    if (skip.includes(FACE_NAMES[f]!)) continue;
    for (let k = 0; k < 6; k++) keep.push(idx.getX(f * 6 + k));
  }
  g.setIndex(keep);
  g.clearGroups();
  return g;
}

/** A Jersey barrier cross-section (metres), extruded along its length. */
export function jerseyGeometry(length: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-0.305, 0);
  s.lineTo(-0.305, 0.075);
  s.lineTo(-0.23, 0.33);
  s.lineTo(-0.08, 0.81);
  s.lineTo(0.08, 0.81);
  s.lineTo(0.23, 0.33);
  s.lineTo(0.305, 0.075);
  s.lineTo(0.305, 0);
  s.lineTo(-0.305, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: length, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 1 });
  g.translate(0, 0, -length / 2);
  return g;
}

/** A car body: a side profile extruded across its width, bevelled, so it reads as a car rather than boxes. */
export function carBodyGeometry(kind: "sedan" | "van" | "hatch"): { body: THREE.BufferGeometry; glass: THREE.BufferGeometry; width: number; length: number } {
  const s = new THREE.Shape();
  const g = new THREE.Shape();
  let width = 1.8;
  let length = 4.6;
  if (kind === "sedan") {
    // x along the car (front at +x), y up.
    s.moveTo(-2.3, 0.32);
    s.lineTo(-2.32, 0.78);
    s.quadraticCurveTo(-2.2, 0.92, -1.75, 0.95);
    s.lineTo(-1.25, 0.98);
    s.lineTo(-0.85, 1.42);
    s.quadraticCurveTo(-0.6, 1.47, 0.2, 1.46);
    s.lineTo(0.55, 1.42);
    s.lineTo(1.15, 1.0);
    s.quadraticCurveTo(2.1, 0.95, 2.28, 0.8);
    s.lineTo(2.3, 0.35);
    s.quadraticCurveTo(2.25, 0.25, 2.0, 0.25);
    s.lineTo(-2.0, 0.25);
    s.quadraticCurveTo(-2.28, 0.25, -2.3, 0.32);
    g.moveTo(-1.18, 1.0);
    g.lineTo(-0.82, 1.39);
    g.lineTo(0.52, 1.39);
    g.lineTo(1.08, 1.0);
    g.lineTo(-1.18, 1.0);
  } else if (kind === "hatch") {
    length = 3.9;
    width = 1.72;
    s.moveTo(-1.95, 0.3);
    s.lineTo(-1.97, 1.05);
    s.quadraticCurveTo(-1.9, 1.48, -1.5, 1.5);
    s.lineTo(0.2, 1.5);
    s.lineTo(0.85, 1.0);
    s.quadraticCurveTo(1.8, 0.92, 1.93, 0.75);
    s.lineTo(1.95, 0.35);
    s.quadraticCurveTo(1.9, 0.25, 1.7, 0.25);
    s.lineTo(-1.7, 0.25);
    s.quadraticCurveTo(-1.93, 0.25, -1.95, 0.3);
    g.moveTo(-1.88, 1.06);
    g.lineTo(-1.82, 1.42);
    g.lineTo(0.18, 1.43);
    g.lineTo(0.78, 1.02);
    g.lineTo(-1.88, 1.06);
  } else {
    length = 5.4;
    width = 2.0;
    s.moveTo(-2.7, 0.35);
    s.lineTo(-2.7, 2.3);
    s.quadraticCurveTo(-2.68, 2.4, -2.55, 2.42);
    s.lineTo(1.35, 2.42);
    s.quadraticCurveTo(1.6, 2.4, 1.75, 2.1);
    s.lineTo(2.35, 1.25);
    s.quadraticCurveTo(2.62, 1.1, 2.68, 0.85);
    s.lineTo(2.7, 0.4);
    s.quadraticCurveTo(2.65, 0.3, 2.4, 0.3);
    s.lineTo(-2.5, 0.3);
    s.quadraticCurveTo(-2.68, 0.3, -2.7, 0.35);
    g.moveTo(1.2, 1.25);
    g.lineTo(1.25, 2.25);
    g.lineTo(1.6, 2.15);
    g.lineTo(2.25, 1.27);
    g.lineTo(1.2, 1.25);
  }
  const body = new THREE.ExtrudeGeometry(s, { depth: width - 0.16, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 3, curveSegments: 6 });
  body.translate(0, 0, -(width - 0.16) / 2);
  const glass = new THREE.ExtrudeGeometry(g, { depth: width - 0.1, bevelEnabled: false });
  glass.translate(0, 0, -(width - 0.1) / 2);
  return { body, glass, width, length };
}
