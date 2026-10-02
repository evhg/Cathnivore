// Procedural low-poly models for Hedgerow's 3D battlefield. 1 world unit = 1 cell; y is up. Every builder
// returns a Group whose userData names the parts the renderer animates: `turret` (turns to its target: its
// local +Z is the facing), `sails` (spins about its local Z; also the child named "sails"), `barrel` (the
// cannon's barrel, for recoil), `bees` (orbit), `ducks` (paddle), `arm` (throws), `light` (blinks), `flag`
// (flutters), `shield` (an enemy's breakable shell; also the child named "shield").
//
// Static detail is merged per material at the end of every builder (`bake`), so a richly detailed tower is
// still only a handful of draw calls; anything the renderer animates is left as its own object.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { EnemyKind, MegaId, TowerKind } from "../engine";
import { bubble, C, chrome, glass, gloss, glow, matte, metal } from "./palette";

type M = THREE.Material;

// Primitive geometries are shared by every model that uses the same size.
const geoCache = new Map<string, THREE.BufferGeometry>();
function geo<T extends THREE.BufferGeometry>(k: string, make: () => T): T {
  let g = geoCache.get(k) as T | undefined;
  if (!g) {
    g = make();
    geoCache.set(k, g);
  }
  return g;
}

function mesh(g: THREE.BufferGeometry, mat: M, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
const boxGeo = (w: number, h: number, d: number) => geo(`box${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
/** A box standing on y. */
const box = (w: number, h: number, d: number, mat: M, x = 0, y = 0, z = 0) => mesh(boxGeo(w, h, d), mat, x, y + h / 2, z);
/** A box centred on y (for slabs that get rotated). */
const bx = (w: number, h: number, d: number, mat: M, x = 0, y = 0, z = 0) => mesh(boxGeo(w, h, d), mat, x, y, z);
const cyl = (rt: number, rb: number, h: number, mat: M, x = 0, y = 0, z = 0, seg = 10) =>
  mesh(geo(`cyl${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), mat, x, y + h / 2, z);
const ball = (r: number, mat: M, x = 0, y = 0, z = 0, detail = 1) =>
  mesh(geo(`ico${r},${detail}`, () => new THREE.IcosahedronGeometry(r, detail)), mat, x, y, z);
const cone = (r: number, h: number, mat: M, x = 0, y = 0, z = 0, seg = 8) =>
  mesh(geo(`cone${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg)), mat, x, y + h / 2, z);
/** A torus in the XY plane (its axis is Z). */
const torus = (r: number, tube: number, mat: M, x = 0, y = 0, z = 0, tubular = 16, radial = 4, arc = Math.PI * 2) =>
  mesh(geo(`tor${r},${tube},${tubular},${radial},${arc}`, () => new THREE.TorusGeometry(r, tube, radial, tubular, arc)), mat, x, y, z);
/** A flat ring lying on the ground plane at height y. */
function ring(r: number, tube: number, mat: M, x = 0, y = 0, z = 0, tubular = 16): THREE.Mesh {
  const t = torus(r, tube, mat, x, y, z, tubular);
  t.rotation.x = Math.PI / 2;
  return t;
}
/** A disc facing +Z (clock faces, logos, portholes). */
function disc(r: number, depth: number, mat: M, x = 0, y = 0, z = 0, seg = 12): THREE.Mesh {
  const d = mesh(geo(`cyl${r},${r},${depth},${seg}`, () => new THREE.CylinderGeometry(r, r, depth, seg)), mat, x, y, z);
  d.rotation.x = Math.PI / 2;
  return d;
}

function group(...children: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  for (const c of children) g.add(c);
  return g;
}
function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T {
  o.position.set(x, y, z);
  return o;
}
function rot<T extends THREE.Object3D>(o: T, x: number, y = 0, z = 0): T {
  o.rotation.set(x, y, z);
  return o;
}
function scaled<T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T {
  o.scale.set(x, y, z);
  return o;
}

/** userData keys whose object moves as one rigid piece (its own static detail can be merged inside it). */
const RIGID = new Set(["turret", "sails", "barrel", "shield", "tractor", "arm", "flag", "inner"]);

/**
 * Merge static meshes into one mesh per material. Objects named in `root.userData` (and named objects such as
 * "sails"/"shield") are left in place so the renderer can move them; rigid ones are merged inside themselves.
 */
function bake(root: THREE.Object3D): void {
  const keep = new Set<THREE.Object3D>();
  const rigid: THREE.Object3D[] = [];
  const collect = (o: THREE.Object3D) => {
    for (const [k, v] of Object.entries(o.userData)) {
      if (v instanceof THREE.Object3D) {
        keep.add(v);
        if (RIGID.has(k)) rigid.push(v);
      } else if (Array.isArray(v)) for (const x of v) if (x instanceof THREE.Object3D) keep.add(x);
    }
  };
  root.traverse((o) => {
    collect(o);
    if (o.name && o !== root) {
      keep.add(o);
      rigid.push(o);
    }
  });
  root.updateMatrixWorld(true);
  mergeUnder(root, keep);
  for (const r of new Set(rigid)) if (r !== root) mergeUnder(r, keep);
}

function mergeUnder(root: THREE.Object3D, keep: Set<THREE.Object3D>): void {
  const inv = root.matrixWorld.clone().invert();
  const byMat = new Map<M, THREE.Mesh[]>();
  const walk = (o: THREE.Object3D): void => {
    if (keep.has(o)) return;
    const m = o as THREE.Mesh;
    if (m.isMesh && !Array.isArray(m.material)) {
      const list = byMat.get(m.material) ?? [];
      list.push(m);
      byMat.set(m.material, list);
    }
    for (const c of o.children) walk(c);
  };
  for (const c of root.children) walk(c);
  const rel = new THREE.Matrix4();
  for (const [mat, list] of byMat) {
    if (list.length < 2) continue;
    const parts: THREE.BufferGeometry[] = [];
    for (const m of list) {
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal" && name !== "uv") g.deleteAttribute(name);
      if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position!.count * 2), 2));
      g.clearGroups();
      g.morphAttributes = {};
      rel.multiplyMatrices(inv, m.matrixWorld);
      g.applyMatrix4(rel);
      parts.push(g);
    }
    const merged = mergeGeometries(parts);
    for (const p of parts) p.dispose();
    if (!merged) continue;
    const out = new THREE.Mesh(merged, mat);
    out.castShadow = list.some((m) => m.castShadow);
    out.receiveShadow = list.some((m) => m.receiveShadow);
    for (const m of list) m.removeFromParent();
    root.add(out);
  }
}

// ---- shared props ----

const iron = () => metal("#3b3f44", 0.55);

/** A hanging/standing lantern: iron cap and base around a warm glowing pane. */
function lantern(x: number, y: number, z: number, color = "#ffd27a", s = 1): THREE.Group {
  const g = group(
    box(0.05 * s, 0.012 * s, 0.05 * s, iron(), 0, 0, 0),
    box(0.036 * s, 0.05 * s, 0.036 * s, glow(color, 1.8), 0, 0.012 * s, 0),
    cone(0.034 * s, 0.025 * s, iron(), 0, 0.062 * s, 0, 4),
  );
  return at(g, x, y, z);
}
/** A lamp on a post. */
function lampPost(x: number, z: number, h = 0.32, color = "#ffd98a"): THREE.Group {
  return group(cyl(0.012, 0.016, h, iron(), x, 0, z, 6), lantern(x, h, z, color));
}
/** A pennant on a pole; the flag is returned in `.userData.flag` so callers can hand it to the renderer. */
function pennant(color: string, x: number, y: number, z: number, h = 0.3, w = 0.12): THREE.Group {
  // The flag hangs from a pivot on the pole, so turning it about Y flutters it from the pole.
  const flag = at(group(box(w, w * 0.6, 0.006, matte(color, 0.8), w / 2 + 0.008, 0, 0)), 0, h - w * 0.6, 0);
  const g = group(cyl(0.008, 0.008, h, matte(C.woodDark), 0, 0, 0, 5), ball(0.016, metal(C.gold, 0.3), 0, h + 0.01, 0, 0), flag);
  g.userData.flag = flag;
  return at(g, x, y, z);
}
const BUNTING = ["#c4433a", "#f2c94c", "#3f6fb5", "#f4ede1", "#5f8f3f"];
/** A string of triangular flags along X from x0 to x1 at height y, sagging in the middle. */
function bunting(x0: number, x1: number, y: number, z: number, n = 7, sag = 0.04): THREE.Group {
  const g = new THREE.Group();
  const len = x1 - x0;
  g.add(bx(len, 0.005, 0.005, matte(C.ink), x0 + len / 2, y - sag * 0.6, z));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const fy = y - Math.sin(t * Math.PI) * sag;
    const f = scaled(rot(cone(0.025, 0.05, matte(BUNTING[i % BUNTING.length]!, 0.8), 0, 0, 0, 3), Math.PI), 1, 1, 0.25);
    f.position.set(x0 + t * len, fy - 0.025, z);
    g.add(f);
  }
  return g;
}
/** A wooden crate; `fill` puts produce on top. */
function crate(x: number, z: number, s = 0.1, fill?: string, ry = 0): THREE.Group {
  const g = group(box(s, s * 0.8, s, matte(C.wood)), box(s * 1.02, s * 0.12, s * 1.02, matte(C.woodDark), 0, s * 0.62, 0), box(s * 1.02, s * 0.12, s * 1.02, matte(C.woodDark), 0, s * 0.08, 0));
  if (fill) for (let i = 0; i < 3; i++) g.add(ball(s * 0.22, matte(fill, 0.6), (i - 1) * s * 0.3, s * 0.82, (i % 2) * s * 0.15 - s * 0.07, 0));
  g.rotation.y = ry;
  return at(g, x, 0, z);
}
/** A tied burlap sack. */
function sack(x: number, z: number, s = 1, color = "#b89a6a", lean = 0): THREE.Group {
  const g = group(
    scaled(ball(0.07, matte(color, 0.95), 0, 0.075, 0, 1), 1, 1.15, 0.85),
    cone(0.03, 0.05, matte(color, 0.95), 0, 0.15, 0, 5),
    cyl(0.022, 0.022, 0.012, matte(C.strawDark), 0, 0.15, 0, 6),
  );
  g.scale.setScalar(s);
  g.rotation.z = lean;
  return at(g, x, 0, z);
}
/** A round hay bale lying on its side, axis along Z (rotate the group to turn it). */
function hayBale(x: number, z: number, r = 0.08, ry = 0): THREE.Group {
  const b = rot(cyl(r, r, r * 1.6, matte(C.straw), 0, -r * 0.8, 0, 10), Math.PI / 2);
  const g = group(b, rot(cyl(r * 1.01, r * 1.01, 0.012, matte(C.strawDark), 0, -0.006, 0, 10), Math.PI / 2));
  g.children.forEach((c) => (c.position.y += r));
  g.rotation.y = ry;
  return at(g, x, 0, z);
}
/** A window box of flowers, on the face at z. */
function flowerBox(x: number, y: number, z: number, w = 0.12): THREE.Group {
  const g = group(box(w, 0.03, 0.035, matte(C.woodDark), 0, 0, 0));
  const cols = ["#e8748b", "#f2c94c", "#f4ede1", "#c46ad9"];
  for (let i = 0; i < 4; i++) g.add(ball(0.014, matte(cols[i % 4]!, 0.7), -w / 2 + 0.015 + (i * (w - 0.03)) / 3, 0.036, 0, 0));
  g.add(box(w * 0.95, 0.012, 0.03, matte(C.leaf), 0, 0.03, 0));
  return at(g, x, y, z);
}
/** A little bunch of flowers on stems. */
function flower(x: number, z: number, color: string, h = 0.08): THREE.Group {
  return group(cyl(0.004, 0.004, h, matte(C.leafDark), x, 0, z, 4), ball(0.018, matte(color, 0.7), x, h, z, 0));
}
/** A bulrush clump. */
function reeds(x: number, z: number, n = 3, h = 0.22): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const a = i * 2.4;
    const ox = Math.cos(a) * 0.025;
    const oz = Math.sin(a) * 0.025;
    const hh = h * (0.8 + (i % 3) * 0.12);
    const stalk = cyl(0.004, 0.005, hh, matte(C.leafLight), ox, 0, oz, 4);
    stalk.rotation.z = (i - 1) * 0.12;
    g.add(stalk, cyl(0.011, 0.011, 0.05, matte("#6a4628"), ox - (i - 1) * 0.012 * hh * 5, hh - 0.03, oz, 6));
  }
  return at(g, x, 0, z);
}
/** A lily pad, with a flower on some. */
function lily(x: number, y: number, z: number, r = 0.06, bloom = false): THREE.Group {
  const g = group(cyl(r, r, 0.008, matte(C.leafLight), 0, 0, 0, 8));
  if (bloom) g.add(cone(0.02, 0.025, matte("#f2a8c0", 0.6), 0, 0.008, 0, 5));
  return at(g, x, y, z);
}
/** A hip roof over a w x d rectangle: two pitched slabs, gable triangles and a ridge beam. */
function pitchedRoof(w: number, d: number, rise: number, mat: M, y: number, gableMat?: M, ridgeMat?: M): THREE.Group {
  const g = new THREE.Group();
  const half = d / 2 + 0.03;
  const len = Math.hypot(half, rise) + 0.02;
  const a = Math.atan2(rise, half);
  for (const side of [-1, 1]) {
    const slab = bx(w + 0.06, 0.035, len, mat, 0, y + rise / 2, (side * half) / 2);
    slab.rotation.x = side * a;
    g.add(slab);
  }
  const tri = new THREE.Shape();
  tri.moveTo(-d / 2, 0);
  tri.lineTo(0, rise);
  tri.lineTo(d / 2, 0);
  tri.lineTo(-d / 2, 0);
  const gab = mesh(new THREE.ExtrudeGeometry(tri, { depth: w, bevelEnabled: false }), gableMat ?? mat, -w / 2, y, 0);
  gab.rotation.y = Math.PI / 2;
  g.add(gab);
  const ridge = rot(cyl(0.02, 0.02, w + 0.1, ridgeMat ?? matte(C.woodDark), 0, -(w + 0.1) / 2, 0, 6), 0, 0, Math.PI / 2);
  ridge.position.set(0, y + rise + 0.012, 0);
  g.add(ridge);
  return g;
}
/** A triangular pediment facing +Z, from z0 back to z0-depth. */
function pediment(w: number, rise: number, depth: number, mat: M, y: number, z0: number): THREE.Mesh {
  const ped = new THREE.Shape();
  ped.moveTo(-w / 2, 0);
  ped.lineTo(0, rise);
  ped.lineTo(w / 2, 0);
  ped.lineTo(-w / 2, 0);
  return mesh(new THREE.ExtrudeGeometry(ped, { depth, bevelEnabled: false }), mat, 0, y, z0 - depth);
}
/** A wooden cart wheel in the YZ plane (axle along X): rim, spokes, hub. */
function cartWheel(r: number, x: number, y: number, z: number, wood = C.wood): THREE.Group {
  const g = new THREE.Group();
  g.add(rot(torus(r, r * 0.12, matte(wood), 0, 0, 0, 14, 4), 0, Math.PI / 2));
  for (let i = 0; i < 3; i++) g.add(rot(bx(0.014, r * 1.9, 0.016, matte(wood), 0, 0, 0), (i * Math.PI) / 3));
  g.add(rot(cyl(r * 0.22, r * 0.22, 0.05, iron(), 0, -0.025, 0, 8), 0, 0, Math.PI / 2));
  return at(g, x, y, z);
}
/** A straw-skep beehive (lathe of coils). */
function skep(r: number, h: number, straw: M, y = 0, x = 0, z = 0): THREE.Group {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    pts.push(new THREE.Vector2(r * Math.sin(Math.acos(t * 0.95)) + r * 0.06 * Math.sin(t * 40), t * h));
  }
  const g = group(mesh(geo(`skep${r},${h}`, () => new THREE.LatheGeometry(pts, 14)), straw, 0, 0, 0));
  const band = matte(C.strawDark);
  for (const t of [0.25, 0.5, 0.75]) g.add(ring(r * Math.sin(Math.acos(t * 0.95)) + r * 0.02, r * 0.045, band, 0, t * h, 0, 14));
  g.add(cone(r * 0.22, h * 0.14, band, 0, h * 0.92, 0, 7));
  g.add(cyl(r * 0.17, r * 0.17, 0.02, matte(C.ink), 0, h * 0.12, r * 0.9, 8));
  return at(g, x, y, z);
}
/** A cheerful straw-filled figure (scarecrow crew); faces +Z. */
function strawman(coat: string, hat = C.straw, s = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.02, 0.02, 0.2, matte(C.wood), 0, 0, 0, 5));
  g.add(box(0.16, 0.18, 0.11, matte(coat), 0, 0.16, 0));
  g.add(cone(0.06, 0.06, matte(C.straw), 0, 0.12, 0, 6));
  g.add(box(0.36, 0.04, 0.04, matte(C.wood), 0, 0.29, 0));
  for (const sd of [-1, 1]) g.add(rot(cone(0.022, 0.05, matte(C.straw), sd * 0.2, 0.285, 0, 5), 0, 0, -sd * Math.PI / 2));
  g.add(ball(0.075, matte("#e6cf9a"), 0, 0.42, 0, 1));
  g.add(ball(0.012, matte(C.ink), -0.025, 0.435, 0.068, 0), ball(0.012, matte(C.ink), 0.025, 0.435, 0.068, 0));
  g.add(cyl(0.12, 0.12, 0.015, matte(hat), 0, 0.47, 0, 12), cone(0.065, 0.1, matte(hat), 0, 0.48, 0, 8));
  g.scale.setScalar(s);
  return g;
}

const TIER_RING = ["#8a5a35", "#b9c0c8", "#d4ae58"];
const SPEC_RING = ["#e0503a", "#3f8fe0"];

/** The plinth every tower stands on; its rim shows the tier (wood, silver, gold) or the specialisation (glowing). */
function plinth(tier: number, spec: 0 | 1 | null): THREE.Group {
  const g = group(cyl(0.4, 0.44, 0.08, matte(C.stoneDark, 0.95), 0, 0, 0, 12), cyl(0.37, 0.4, 0.012, matte(C.stone, 0.95), 0, 0.075, 0, 12));
  const rim =
    tier === 4 && spec !== null ? glow(SPEC_RING[spec]!, 1.6) : tier >= 2 ? metal(TIER_RING[tier - 1]!, 0.3) : matte(TIER_RING[0]!);
  g.add(ring(0.42, 0.03, rim, 0, 0.08, 0, 24));
  // Studs round the rim from silver up.
  if (tier >= 2)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      g.add(ball(0.018, rim, Math.cos(a) * 0.42, 0.1, Math.sin(a) * 0.42, 0));
    }
  return g;
}

export function buildTower(kind: TowerKind, tier: number, spec: 0 | 1 | null): THREE.Group {
  const root = new THREE.Group();
  root.add(plinth(tier, spec));
  const body = new THREE.Group();
  body.position.y = 0.08;
  root.add(body);
  const scale = 1 + (Math.min(tier, 3) - 1) * 0.07;
  body.scale.setScalar(scale);
  const ud = root.userData as Record<string, THREE.Object3D | THREE.Object3D[]>;
  const turret = new THREE.Group();
  ud.turret = turret;
  switch (kind) {
    case "hedgerow": {
      const leaf = spec === 0 ? matte("#2f5a2a") : spec === 1 ? matte("#56743a") : matte(C.leaf);
      const leaf2 = spec === 0 ? matte("#24481f") : matte(C.leafLight);
      const n = 3 + Math.min(tier, 3) + (spec === 1 ? 2 : 0);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = i === 0 ? 0 : 0.2 + (spec === 1 ? 0.06 : 0);
        body.add(ball(0.2 + (i % 2) * 0.04, i % 2 ? leaf : leaf2, Math.cos(a) * r, 0.22 + (i % 3) * 0.05, Math.sin(a) * r, 1));
      }
      // Woody stems at the foot and a crown of smaller leaf clusters.
      for (let i = 0; i < 3; i++) body.add(rot(cyl(0.018, 0.026, 0.14, matte(C.woodDark), Math.cos(i * 2.1) * 0.12, 0, Math.sin(i * 2.1) * 0.12, 5), 0, 0, (i - 1) * 0.3));
      body.add(ball(0.13, leaf2, 0.05, 0.47, -0.04, 1));
      const berry = matte(spec === 1 ? "#5b2a5e" : "#e8748b", 0.6);
      for (let i = 0; i < 4 + tier; i++) {
        const a = i * 2.3;
        body.add(ball(0.035, berry, Math.cos(a) * 0.28, 0.25 + (i % 3) * 0.08, Math.sin(a) * 0.28, 0));
      }
      // Hawthorn blossom from tier 2.
      if (tier >= 2)
        for (let i = 0; i < 6 + tier * 2; i++) {
          const a = i * 1.9;
          const r = 0.1 + (i % 3) * 0.08;
          body.add(ball(0.02, matte("#fbf5ea", 0.6), Math.cos(a) * r, 0.42 - r * 0.35, Math.sin(a) * r, 0));
        }
      // A little stile in front, and a robin on top from tier 3.
      for (const x of [-0.17, 0.17]) body.add(box(0.035, 0.2, 0.035, matte(C.wood), x, 0, 0.37));
      body.add(box(0.38, 0.03, 0.02, matte(C.wood), 0, 0.08, 0.375), box(0.38, 0.03, 0.02, matte(C.wood), 0, 0.15, 0.375));
      if (tier >= 3) {
        const robin = group(ball(0.035, matte("#7a5a3e"), 0, 0, 0, 0), ball(0.024, matte("#d9612b"), 0.012, -0.005, 0.02, 0), cone(0.008, 0.02, matte(C.ink), 0, 0.01, 0.04, 3));
        robin.children[2]!.rotation.x = Math.PI / 2;
        body.add(at(robin, 0.06, 0.62, 0.02));
      }
      if (spec === 0)
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          const t = cone(0.025, 0.14, matte("#e9e1cf"), Math.cos(a) * 0.34, 0.2, Math.sin(a) * 0.34, 4);
          t.rotation.z = -Math.cos(a) * 1.2;
          t.rotation.x = Math.sin(a) * 1.2;
          body.add(t);
        }
      break;
    }
    case "scarecrow": {
      body.add(cyl(0.03, 0.035, 0.75, matte(C.wood)));
      // A tuft of grass at the foot, a hay bale and (from tier 2) a pumpkin.
      for (let i = 0; i < 5; i++) body.add(cone(0.03, 0.08, matte(C.leafLight), Math.cos(i * 1.3) * 0.08, 0, Math.sin(i * 1.3) * 0.08, 4));
      body.add(hayBale(0.24, 0.16, 0.07, 0.4));
      if (tier >= 2) body.add(scaled(ball(0.07, matte("#e98a2b"), -0.24, 0.05, 0.18, 1), 1, 0.75, 1), cyl(0.008, 0.01, 0.04, matte(C.leafDark), -0.24, 0.09, 0.18, 4));
      turret.position.y = 0.48;
      body.add(turret);
      const coat = matte(spec === 1 ? "#2f2f3a" : spec === 0 ? "#d9822b" : tier >= 3 ? "#3f6fb5" : "#c4433a");
      turret.add(box(0.3, 0.3, 0.18, coat, 0, -0.18, 0));
      // Straw skirt, a patch, two buttons, a rope belt.
      turret.add(cyl(0.12, 0.17, 0.1, matte(C.straw), 0, -0.26, 0, 7));
      turret.add(box(0.07, 0.07, 0.01, matte(spec === 1 ? "#5a5a6a" : "#e2c06a"), 0.07, -0.12, 0.092));
      turret.add(ball(0.013, matte(C.ink), 0, -0.04, 0.092, 0), ball(0.013, matte(C.ink), 0, -0.1, 0.092, 0));
      turret.add(box(0.31, 0.025, 0.19, matte(C.strawDark), 0, -0.16, 0));
      const arm = new THREE.Group();
      arm.add(box(0.7, 0.05, 0.05, matte(C.wood), 0, -0.02, 0));
      arm.add(box(0.12, 0.08, 0.08, coat, -0.3, -0.04, 0), box(0.12, 0.08, 0.08, coat, 0.3, -0.04, 0));
      for (const sd of [-1, 1]) arm.add(rot(cone(0.035, 0.07, matte(C.straw), sd * 0.38, -0.035, 0, 5), 0, 0, -sd * Math.PI / 2));
      turret.add(arm);
      ud.arm = arm;
      const head = ball(spec === 0 ? 0.15 : 0.12, matte(spec === 0 ? "#e98a2b" : "#e6cf9a"), 0, 0.16, 0, 1);
      turret.add(head);
      // A face, so it reads as a scarecrow from any angle: button eyes, a stitched smile, a straw collar.
      turret.add(ball(0.02, matte(C.ink), -0.045, 0.18, 0.11, 0), ball(0.02, matte(C.ink), 0.045, 0.18, 0.11, 0));
      turret.add(box(0.07, 0.012, 0.01, matte(C.ink), 0, 0.12, 0.112));
      turret.add(cone(0.08, 0.06, matte(C.straw), 0, 0.0, 0, 7));
      const hatMat = matte(spec === 1 ? "#3a3340" : C.straw);
      const brim = cyl(0.2, 0.2, 0.025, hatMat, 0, 0.24, 0, 14);
      turret.add(brim, cone(0.11, 0.16, hatMat, 0, 0.26, 0, 10), cyl(0.112, 0.112, 0.03, matte(spec === 1 ? "#7a1f2a" : "#c4433a"), 0, 0.265, 0, 10));
      if (tier >= 2) turret.add(rot(cone(0.02, 0.08, matte("#f4ede1"), 0.08, 0.3, 0, 4), 0, 0, -0.5));
      if (spec === 1)
        for (const side of [-1, 1]) {
          const crow = group(ball(0.06, matte("#1d1b22"), 0, 0, 0, 0), cone(0.02, 0.06, matte(C.gold), 0.06 * side, 0.01, 0, 4), ball(0.012, glow("#ffd23f", 2), 0.04 * side, 0.03, 0.03, 0));
          crow.position.set(0.32 * side, 0.03, 0);
          turret.add(crow);
        }
      if (tier >= 3) turret.add(box(0.08, 0.04, 0.02, glow("#ffd76a", 0.8), 0, -0.05, 0.1));
      break;
    }
    case "beehive": {
      const straw = matte(spec === 0 ? "#c98a3a" : spec === 1 ? "#e8b13c" : "#d9a649");
      // A plank stand on four legs.
      for (const [x, z] of [
        [-0.2, -0.2],
        [0.2, -0.2],
        [0.2, 0.2],
        [-0.2, 0.2],
      ] as const)
        body.add(box(0.04, 0.08, 0.04, matte(C.woodDark), x, 0, z));
      body.add(box(0.5, 0.04, 0.5, matte(C.wood), 0, 0.06, 0));
      body.add(box(0.52, 0.012, 0.06, matte(C.woodDark), 0, 0.1, 0.22));
      body.add(skep(0.3, 0.55, straw, 0.1));
      if (spec === 0) {
        const crown = new THREE.Group();
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          crown.add(cone(0.03, 0.09, metal(C.gold, 0.3), Math.cos(a) * 0.08, 0.68, Math.sin(a) * 0.08, 4));
        }
        crown.add(ring(0.085, 0.015, metal(C.gold, 0.3), 0, 0.68, 0, 12));
        body.add(crown);
      }
      if (spec === 1)
        for (let i = 0; i < 4; i++) {
          const a = i * 1.6;
          body.add(cone(0.035, 0.12, gloss("#f0b429", 0), Math.cos(a) * 0.27, 0.12, Math.sin(a) * 0.27, 6));
        }
      // Wildflowers round the stand; a honey jar from tier 2; a smoker from tier 3.
      const fcol = ["#c46ad9", "#f2c94c", "#f4ede1", "#e8748b", "#7fa0e8"];
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05 + 0.3;
        body.add(flower(Math.cos(a) * 0.37, Math.sin(a) * 0.37, fcol[i % fcol.length]!, 0.07 + (i % 2) * 0.04));
      }
      if (tier >= 2) body.add(cyl(0.035, 0.035, 0.06, glow("#f2a516", 0.6), 0.19, 0.1, 0.19, 8), cyl(0.038, 0.038, 0.012, matte("#e8d9b8"), 0.19, 0.16, 0.19, 8));
      if (tier >= 3) body.add(cyl(0.03, 0.03, 0.08, metal("#9aa0a6"), -0.19, 0.1, 0.19, 8), cone(0.03, 0.04, metal("#9aa0a6"), -0.19, 0.18, 0.19, 8));
      // Bees: little glowing dots that orbit (animated by the renderer).
      const bees = new THREE.Group();
      for (let i = 0; i < 3 + Math.min(tier, 3); i++) bees.add(ball(0.025, glow("#ffd23f", 1.2), 0, 0, 0, 0));
      bees.position.y = 0.44;
      body.add(bees);
      ud.bees = bees;
      break;
    }
    case "stall": {
      body.add(box(0.62, 0.26, 0.36, matte(C.wood)));
      // Plank lines and a lighter counter top.
      for (const y of [0.08, 0.17]) body.add(box(0.63, 0.012, 0.005, matte(C.woodDark), 0, y, 0.181));
      body.add(box(0.66, 0.025, 0.4, matte("#a87448"), 0, 0.26, 0));
      const goods = spec === 1 ? ["#e8c27a", "#e8c27a", "#e8c27a"] : ["#d4544a", "#f2c94c", "#5f8f3f", "#e98a2b"];
      goods.forEach((g, i) => body.add(ball(0.055, matte(g, 0.5), -0.21 + i * (0.42 / (goods.length - 1)), 0.33, 0.06, 0)));
      // Back posts, front posts.
      for (const x of [-0.29, 0.29]) body.add(box(0.03, 0.62, 0.03, matte(C.wood), x, 0, -0.15));
      for (const x of [-0.29, 0.29]) body.add(box(0.025, 0.52, 0.025, matte(C.wood), x, 0, 0.17));
      const awn = spec === 0 ? "#3f6fb5" : spec === 1 ? "#e98a2b" : "#c4433a";
      for (let i = 0; i < 5; i++) {
        const strip = box(0.14, 0.03, 0.46, matte(i % 2 ? C.cream : awn), -0.28 + i * 0.14, 0.6, 0.02);
        strip.rotation.x = 0.35;
        body.add(strip);
        // Scalloped valance along the front edge.
        body.add(box(0.13, 0.05, 0.008, matte(i % 2 ? awn : C.cream), -0.28 + i * 0.14, 0.49, 0.24));
      }
      body.add(cyl(0.05, 0.05, 0.015, metal(C.gold, 0.25), 0.2, 0.275, 0.12, 12));
      // Crates of produce in front and a chalkboard.
      body.add(crate(-0.18, 0.27, 0.1, "#d4544a", 0.1), crate(0.02, 0.28, 0.09, "#5f8f3f", -0.15));
      const board = group(box(0.1, 0.14, 0.012, matte("#2b2b2b")), box(0.08, 0.004, 0.004, matte("#f4ede1"), 0, 0.09, 0.008), box(0.05, 0.004, 0.004, matte("#f4ede1"), 0, 0.06, 0.008));
      board.rotation.x = -0.2;
      body.add(at(board, 0.25, 0, 0.29));
      if (tier >= 2) body.add(lantern(0, 0.42, 0.17));
      if (tier >= 3) {
        const p = pennant(awn, 0.29, 0.62, -0.15, 0.18, 0.1);
        body.add(p);
        ud.flag = p.userData.flag as THREE.Object3D;
      }
      break;
    }
    case "pond": {
      const wide = spec === 1 ? 1.25 : 1;
      body.add(cyl(0.4 * wide, 0.42 * wide, 0.05, matte(C.stoneDark), 0, 0, 0, 16));
      const water = mesh(new THREE.CylinderGeometry(0.34 * wide, 0.34 * wide, 0.02, 20), gloss(spec === 1 ? "#5f8f7a" : C.water, 0.1), 0, 0.05, 0);
      body.add(water);
      ud.water = water;
      // Edging stones, reeds, lily pads.
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * Math.PI * 2;
        const s = mesh(geo("rock05", () => new THREE.DodecahedronGeometry(0.05, 0)), matte(i % 2 ? C.stone : "#b3aa97", 0.95), Math.cos(a) * 0.37 * wide, 0.06, Math.sin(a) * 0.37 * wide);
        s.scale.set(1, 0.6, 1);
        s.rotation.y = i;
        body.add(s);
      }
      body.add(reeds(-0.27 * wide, -0.16 * wide, 4), reeds(0.24 * wide, -0.24 * wide, 3, 0.18));
      body.add(lily(-0.12, 0.062, 0.18, 0.06, true), lily(0.16, 0.062, 0.1, 0.05));
      const ducks = new THREE.Group();
      const n = spec === 0 ? 2 : Math.min(tier, 3);
      for (let i = 0; i < n; i++) {
        const d = duck(spec === 0);
        d.userData.phase = i * 2.1;
        ducks.add(d);
      }
      body.add(ducks);
      ud.ducks = ducks;
      // A little jetty from tier 2, a duck house on a post from tier 3.
      if (tier >= 2) for (let i = 0; i < 3; i++) body.add(box(0.07, 0.015, 0.16, matte(i % 2 ? C.wood : "#9a6a40"), 0.3 * wide - i * 0.075, 0.07, 0.22 * wide));
      if (tier >= 3) {
        const house = group(cyl(0.012, 0.012, 0.16, matte(C.woodDark), 0, 0, 0, 5), box(0.1, 0.07, 0.08, matte(C.cream), 0, 0.16, 0), rot(cone(0.085, 0.06, matte(C.red), 0, 0.23, 0, 4), 0, Math.PI / 4), disc(0.018, 0.005, matte(C.ink), 0, 0.195, 0.041, 8));
        body.add(at(house, 0, 0.05, -0.29 * wide));
      }
      if (spec === 1)
        for (let i = 0; i < 3; i++) body.add(cyl(0.07, 0.07, 0.01, matte(C.leafLight), Math.cos(i * 2) * 0.22, 0.065, Math.sin(i * 2) * 0.22, 8));
      break;
    }
    case "barn": {
      const red = matte(spec === 1 ? "#b8863e" : C.red);
      const trim = matte(C.cream);
      body.add(box(0.58, 0.36, 0.44, red));
      // Board lines and white corner trim.
      for (let i = 1; i < 6; i++) body.add(box(0.008, 0.36, 0.006, matte(spec === 1 ? "#9a6e30" : "#9a4230"), -0.29 + i * 0.097, 0, 0.222));
      for (const x of [-0.29, 0.29]) for (const z of [-0.22, 0.22]) body.add(box(0.03, 0.36, 0.03, trim, x, 0, z));
      const roof = new THREE.Shape();
      roof.moveTo(-0.33, 0);
      roof.lineTo(-0.2, 0.2);
      roof.lineTo(0.2, 0.2);
      roof.lineTo(0.33, 0);
      roof.lineTo(-0.33, 0);
      body.add(mesh(new THREE.ExtrudeGeometry(roof, { depth: 0.5, bevelEnabled: false }), matte(C.woodDark), 0, 0.36, -0.25));
      body.add(box(0.42, 0.02, 0.52, matte("#4a2f1a"), 0, 0.56, 0));
      body.add(box(0.68, 0.025, 0.02, trim, 0, 0.35, 0.252));
      // Doors with the white X, a hayloft with hay, a lantern.
      body.add(box(0.2, 0.24, 0.01, matte(C.cream), 0, 0, 0.225));
      const x1 = box(0.27, 0.025, 0.012, matte(C.red), 0, 0.12, 0.232);
      x1.rotation.z = 0.8;
      const x2 = x1.clone();
      x2.rotation.z = -0.8;
      body.add(x1, x2);
      body.add(box(0.11, 0.1, 0.012, matte("#3a2416"), 0, 0.39, 0.252), ball(0.045, matte(C.straw), 0, 0.4, 0.26, 0));
      body.add(lantern(0.15, 0.26, 0.24));
      for (const x of [-0.292, 0.292]) body.add(box(0.008, 0.08, 0.1, glow("#ffd98a", 0.7), x, 0.18, 0));
      // Milk churns.
      for (const [x, z] of [
        [-0.36, 0.2],
        [-0.36, 0.08],
      ] as const)
        body.add(cyl(0.04, 0.045, 0.1, metal("#c7ccd1", 0.35), x, 0, z, 8), cyl(0.025, 0.04, 0.03, metal("#c7ccd1", 0.35), x, 0.1, z, 8));
      // A weather vane from tier 2: a gold cockerel on the ridge.
      if (tier >= 2) {
        const vane = group(
          cyl(0.006, 0.006, 0.16, iron(), 0, 0, 0, 4),
          box(0.12, 0.008, 0.008, iron(), 0, 0.1, 0),
          scaled(ball(0.03, metal(C.gold, 0.25), 0, 0.15, 0, 0), 1.3, 1, 0.4),
          cone(0.012, 0.04, metal(C.gold, 0.25), 0.03, 0.16, 0, 4),
        );
        body.add(at(vane, 0, 0.57, 0));
      }
      if (tier >= 3) body.add(bunting(-0.3, 0.3, 0.34, 0.27, 7, 0.04));
      if (spec === 0) {
        const tractor = group(
          box(0.2, 0.12, 0.14, gloss("#3f8a3d", 0.1), 0, 0.04, 0),
          box(0.08, 0.1, 0.1, glass(), -0.04, 0.16, 0),
          cyl(0.07, 0.07, 0.04, matte(C.ink), 0.06, 0.07, 0.08, 10),
          cyl(0.05, 0.05, 0.04, matte(C.ink), -0.08, 0.05, 0.08, 10),
        );
        tractor.children[2]!.rotation.x = Math.PI / 2;
        tractor.children[3]!.rotation.x = Math.PI / 2;
        tractor.add(cyl(0.012, 0.012, 0.1, iron(), 0.06, 0.16, -0.03, 5), ball(0.015, glow("#fff2b0", 2), 0.1, 0.12, 0.04, 0));
        tractor.position.set(0.42, 0, 0.1);
        body.add(tractor);
        ud.tractor = tractor;
      }
      if (spec === 1)
        for (const x of [-0.38, 0.38]) {
          const bale = cyl(0.1, 0.1, 0.16, matte(C.straw), x, 0.1, 0.12, 12);
          bale.rotation.x = Math.PI / 2;
          body.add(bale);
        }
      break;
    }
    case "silo": {
      const w = spec === 1 ? 0.24 : 0.18;
      const shell = spec === 0 ? metal("#6f9a4a", 0.45) : metal("#c7ccd1", 0.35);
      body.add(cyl(w + 0.045, w + 0.06, 0.06, matte(C.stone, 0.95), 0, 0, 0, 14));
      body.add(cyl(w, w, 0.75, shell, 0, 0, 0, 16));
      for (let i = 1; i < 5; i++) body.add(ring(w + 0.005, 0.012, metal("#7a8086"), 0, i * 0.15, 0, 20));
      const dome = mesh(geo(`dome${w}`, () => new THREE.SphereGeometry(w, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2)), shell, 0, 0.75, 0);
      body.add(dome, cone(0.025, 0.06, iron(), 0, 0.75 + w - 0.01, 0, 6), ball(0.02, metal(C.gold, 0.3), 0, 0.75 + w + 0.06, 0, 0));
      // A ladder up the back-right side.
      const ladder = new THREE.Group();
      for (const x of [-0.035, 0.035]) ladder.add(box(0.01, 0.78, 0.01, iron(), x, 0, 0));
      for (let i = 0; i < 9; i++) ladder.add(box(0.07, 0.008, 0.008, iron(), 0, 0.06 + i * 0.085, 0));
      ladder.position.set(Math.sin(2.4) * (w + 0.02), 0, Math.cos(2.4) * (w + 0.02));
      ladder.rotation.y = 2.4;
      body.add(ladder);
      // A feed trough at the foot.
      body.add(box(0.2, 0.05, 0.08, matte(C.woodDark), -0.22, 0, -0.18), box(0.18, 0.012, 0.06, matte(C.straw), -0.22, 0.045, -0.18));
      turret.position.y = 0.6;
      body.add(turret);
      // The spout faces +Z (the turret's forward), with a funnel mouth and a hopper behind.
      const spout = cyl(0.04, 0.05, 0.2, metal("#8a8f94"), 0, -0.1, 0, 8);
      const spoutArm = group(spout, at(rot(cone(0.06, 0.06, metal("#8a8f94"), 0, -0.03, 0, 8), Math.PI), 0, 0.12, 0));
      spoutArm.rotation.x = Math.PI / 2 + 0.15;
      spoutArm.position.set(0, 0, w + 0.06);
      turret.add(spoutArm, ring(w + 0.02, 0.018, metal("#5f656b"), 0, 0, 0, 20), box(0.08, 0.08, 0.06, metal("#8a8f94"), 0, -0.04, w + 0.01));
      body.add(box(0.06, 0.06, 0.02, glow("#ffd76a", 1), 0, 0.5, w));
      if (tier >= 2) body.add(ring(w + 0.05, 0.01, iron(), 0, 0.74, 0, 16), lantern(-w - 0.02, 0.36, 0.06));
      if (tier >= 3) body.add(ball(0.025, glow("#ff6a3a", 2.5), 0, 0.75 + w + 0.1, 0, 0));
      break;
    }
    case "mast": {
      const lattice = metal("#5a5e63", 0.5);
      for (const [x, z] of [
        [-0.14, -0.14],
        [0.14, -0.14],
        [0.14, 0.14],
        [-0.14, 0.14],
      ] as const)
        // Legs splay from the foot and lean in to the top frame.
        body.add(strut([x, 0, z], [x * 0.3, 1.02, z * 0.3], 0.017, lattice));
      // Square frames at each level, with alternating red/white paint near the top.
      for (let i = 1; i < 5; i++) {
        const s = 0.28 - i * 0.04;
        const m = i >= 3 && tier >= 2 ? (i % 2 ? matte("#c4433a") : matte("#f4ede1")) : lattice;
        body.add(box(s, 0.012, 0.012, m, 0, i * 0.2, s / 2), box(s, 0.012, 0.012, m, 0, i * 0.2, -s / 2));
        body.add(box(0.012, 0.012, s, m, s / 2, i * 0.2, 0), box(0.012, 0.012, s, m, -s / 2, i * 0.2, 0));
        if (i < 4) {
          const dg = box(Math.hypot(s, 0.2), 0.008, 0.008, lattice, 0, i * 0.2 + 0.1, s / 2);
          dg.rotation.z = Math.atan2(0.2, s) * (i % 2 ? 1 : -1);
          dg.position.y = i * 0.2 + 0.1 - 0.004;
          body.add(dg);
        }
      }
      // An equipment hut with a lit window at the foot.
      body.add(box(0.16, 0.14, 0.14, matte("#8f969d", 0.7), 0.25, 0, 0.2), box(0.18, 0.02, 0.16, matte("#5b5f66"), 0.25, 0.14, 0.2));
      body.add(box(0.05, 0.04, 0.005, glow("#bfe8ff", 1.2), 0.25, 0.07, 0.273), box(0.005, 0.1, 0.05, matte("#4a4f55"), 0.331, 0, 0.2));
      if (tier >= 2) body.add(box(0.06, 0.1, 0.02, matte("#eef1f4"), 0.07, 0.7, 0.07), box(0.06, 0.1, 0.02, matte("#eef1f4"), -0.07, 0.7, -0.07));
      if (tier >= 3) body.add(ball(0.02, glow("#ff3b30", 2.5), 0.1, 0.6, 0, 0), ball(0.02, glow("#ff3b30", 2.5), -0.1, 0.6, 0, 0));
      turret.position.y = 1.0;
      body.add(turret);
      const dish = mesh(geo("mastDish", () => new THREE.SphereGeometry(0.12, 12, 4, 0, Math.PI * 2, 0, Math.PI / 3)), metal("#d9dde2", 0.3), 0, 0, 0);
      dish.rotation.x = -Math.PI / 2;
      dish.position.z = 0.04;
      turret.add(dish);
      // Feed arm and horn in front of the dish; a whip aerial above.
      const feed = cyl(0.006, 0.006, 0.12, iron(), 0, -0.06, 0, 4);
      turret.add(at(rot(group(feed), Math.PI / 2), 0, 0, 0.08), ball(0.016, metal("#5a5e63"), 0, 0, 0.14, 0));
      turret.add(cyl(0.004, 0.004, 0.22, lattice, 0, 0.08, -0.03, 4));
      const lamp = ball(0.04, glow(spec === 1 ? "#ff3b30" : "#ff6a3a", 3), 0, 0.12, 0, 1);
      turret.add(lamp);
      ud.light = lamp;
      if (spec === 0) turret.add(box(0.14, 0.09, 0.005, matte(C.ink), 0, 0.22, 0), box(0.12, 0.07, 0.006, glow("#7fd6ff", 1.2), 0, 0.23, 0.003));
      break;
    }
    case "tent": {
      const cloth = matte(spec === 1 ? "#f2e6c8" : "#fffbe6");
      const t = cone(0.38, 0.6, cloth, 0, 0, 0, 4);
      t.rotation.y = Math.PI / 4;
      body.add(t);
      // Seams down the edges, a door flap, a finial; the green cross on the front face.
      body.add(cyl(0.012, 0.012, 0.12, matte(C.woodDark), 0, 0.58, 0, 5), ball(0.02, metal(C.gold, 0.3), 0, 0.71, 0, 0));
      body.add(at(rot(box(0.13, 0.24, 0.012, matte("#4a3e2e")), -0.42), 0, 0.12, 0.222));
      const cross = group(box(0.05, 0.16, 0.01, glow("#3fbf8a", 0.8), 0, -0.08, 0), box(0.16, 0.05, 0.01, glow("#3fbf8a", 0.8), 0, -0.025, 0));
      cross.rotation.x = -0.42;
      body.add(at(cross, 0, 0.36, 0.12));
      // Tent pegs at the corners.
      for (const [x, z] of [
        [-1, 1],
        [1, 1],
        [1, -1],
        [-1, -1],
      ] as const) {
        body.add(cyl(0.008, 0.008, 0.04, matte(C.woodDark), x * 0.33, 0, z * 0.33, 4));
      }
      // Supplies: a crate with a cross and a lantern on a post.
      const aid = crate(-0.3, 0.2, 0.1, undefined, 0.3);
      aid.add(box(0.03, 0.06, 0.004, glow("#3fbf8a", 0.6), 0, 0.02, 0.052), box(0.06, 0.02, 0.004, glow("#3fbf8a", 0.6), 0, 0.04, 0.052));
      body.add(aid);
      if (tier >= 2) body.add(lampPost(0.3, 0.26, 0.28, "#ffe6a0"));
      if (tier >= 3) body.add(bunting(-0.25, 0.25, 0.5, 0.06, 6, 0.06));
      if (spec === 1) {
        const urn = group(cyl(0.08, 0.1, 0.22, metal("#b8bcc2"), 0, 0, 0, 12), cyl(0.02, 0.02, 0.05, metal("#8a8f94"), 0.1, 0.06, 0, 6), cone(0.06, 0.05, metal("#b8bcc2"), 0, 0.22, 0, 12));
        urn.position.set(0.32, 0, 0.18);
        body.add(urn);
      }
      if (spec === 0) {
        const p = pennant("#c4433a", 0, 0.6, 0, 0.3, 0.14);
        body.add(p);
        ud.flag = p.userData.flag as THREE.Object3D;
      }
      break;
    }
    case "court": {
      const stone = matte(spec === 0 ? "#e6dcc6" : "#ece6da", 0.7);
      body.add(box(0.72, 0.06, 0.5, matte(C.stoneDark)));
      body.add(box(0.5, 0.03, 0.07, stone, 0, 0, 0.28));
      for (let i = 0; i < 4; i++) {
        const x = -0.27 + i * 0.18;
        body.add(cyl(0.035, 0.04, 0.36, stone, x, 0.06, 0.15, 8), box(0.075, 0.025, 0.075, stone, x, 0.06, 0.15), box(0.08, 0.025, 0.08, stone, x, 0.395, 0.15));
      }
      body.add(box(0.62, 0.36, 0.3, stone, 0, 0.06, -0.08));
      // Door and two lit windows on the back wall.
      body.add(box(0.1, 0.18, 0.01, matte("#5a3a28"), 0, 0.06, 0.072), box(0.06, 0.1, 0.01, glow("#ffe39a", 0.8), -0.18, 0.18, 0.072), box(0.06, 0.1, 0.01, glow("#ffe39a", 0.8), 0.18, 0.18, 0.072));
      body.add(box(0.74, 0.04, 0.5, stone, 0, 0.42, 0));
      body.add(pediment(0.76, 0.18, 0.5, stone, 0.46, 0.25));
      body.add(disc(0.045, 0.01, glow(C.gold, 0.9), 0, 0.53, 0.252, 10));
      turret.position.set(0, 0.56, 0.27);
      body.add(turret);
      turret.add(box(0.2, 0.012, 0.012, metal(C.gold, 0.3)), ball(0.03, metal(C.gold, 0.3), -0.1, -0.03, 0, 0), ball(0.03, metal(C.gold, 0.3), 0.1, -0.03, 0, 0));
      if (tier >= 2) for (const x of [-0.33, 0.33]) body.add(lampPost(x, 0.24, 0.3, "#fff0c0"));
      if (tier >= 3) {
        const p = pennant("#3f6fb5", 0, 0.64, -0.05, 0.26, 0.12);
        body.add(p);
        ud.flag = p.userData.flag as THREE.Object3D;
      }
      if (spec === 1) for (let i = 0; i < 3; i++) body.add(box(0.12, 0.004, 0.16, matte("#fffdf6"), 0.3 + i * 0.02, 0.07 + i * 0.01, 0.2));
      break;
    }
    case "hall": {
      body.add(box(0.66, 0.42, 0.46, matte("#b36a4a")));
      // Stone plinth course and quoins.
      body.add(box(0.68, 0.05, 0.48, matte(C.stone)));
      for (const x of [-0.33, 0.33]) body.add(box(0.035, 0.42, 0.035, matte(C.stone), x, 0, 0.23));
      body.add(pediment(0.76, 0.22, 0.5, matte(C.woodDark), 0.42, 0.25));
      body.add(box(0.74, 0.02, 0.5, matte(C.cream), 0, 0.42, 0));
      // Door with steps and a fanlight; windows with frames and flower boxes.
      body.add(box(0.14, 0.22, 0.01, matte(C.cream), 0, 0.03, 0.235), box(0.1, 0.18, 0.012, matte("#2f5a3a"), 0, 0.03, 0.237));
      body.add(box(0.22, 0.03, 0.08, matte(C.stone), 0, 0, 0.27));
      for (const x of [-0.2, 0.2]) {
        body.add(box(0.12, 0.12, 0.008, matte(C.cream), x, 0.21, 0.232), box(0.1, 0.1, 0.01, glow("#ffe39a", 0.9), x, 0.22, 0.235));
        body.add(flowerBox(x, 0.18, 0.25, 0.12));
      }
      body.add(disc(0.04, 0.01, glow("#ffe39a", 0.9), 0, 0.51, 0.252, 10));
      // A cupola with a clock face.
      body.add(box(0.12, 0.1, 0.12, matte(C.cream), 0, 0.56, 0), rot(cone(0.11, 0.1, matte("#5b5f66"), 0, 0.66, 0, 4), 0, Math.PI / 4), ball(0.015, metal(C.gold, 0.3), 0, 0.77, 0, 0));
      body.add(disc(0.035, 0.008, glow("#fff4d0", 1), 0, 0.61, 0.062, 10));
      body.add(cyl(0.01, 0.01, 0.4, matte(C.ink), 0.26, 0.42, 0.18, 4));
      const banner = box(0.18, 0.12, 0.01, matte(spec === 0 ? "#c4433a" : spec === 1 ? C.gold : "#3f6fb5"), 0.36, 0.7, 0.18);
      body.add(banner);
      ud.flag = banner;
      if (tier >= 2) body.add(bunting(-0.33, 0.33, 0.41, 0.25, 8, 0.05));
      if (tier >= 3) for (const x of [-0.3, 0.3]) body.add(lantern(x, 0.3, 0.26));
      break;
    }
    case "windmill": {
      const lvl = Math.min(tier, 3);
      const H = 0.56 + (lvl - 1) * 0.05;
      const white = matte(C.cream, 0.8);
      const stoneBase = spec === 1;
      const y0 = stoneBase ? 0.14 : 0.06;
      // An octagonal smock tower, turned so a flat face looks forward (+Z).
      for (const m of [
        cyl(0.24, 0.26, y0, matte(C.stone, 0.95), 0, 0, 0, 8),
        cyl(0.13, 0.21, H - y0, white, 0, y0, 0, 8),
        cyl(0.205, 0.215, 0.04, matte("#3a3430"), 0, y0, 0, 8),
      ])
        body.add(rot(m, 0, Math.PI / 8));
      // A door and small lit windows up the tower.
      body.add(box(0.08, 0.14, 0.02, matte(C.woodDark), 0, y0, 0.19), cone(0.045, 0.03, matte(C.woodDark), 0, y0 + 0.14, 0.19, 4));
      const rAt = (h: number) => (0.21 - 0.08 * (h / (H - y0))) * Math.cos(Math.PI / 8);
      for (const [a, h] of [
        [0, 0.28],
        [-Math.PI / 2, 0.16],
        [Math.PI / 2, 0.36],
      ] as const)
        body.add(rot(box(0.035, 0.05, 0.02, glow("#ffd98a", 1), Math.sin(a) * rAt(h + 0.025), y0 + h, Math.cos(a) * rAt(h + 0.025)), 0, a));
      // A reefing stage (gallery) from tier 2.
      if (tier >= 2) {
        const gy = y0 + (H - y0) * 0.3;
        body.add(cyl(0.27, 0.27, 0.02, matte(C.wood), 0, gy, 0, 12), ring(0.26, 0.008, matte(C.woodDark), 0, gy + 0.08, 0, 16));
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          body.add(box(0.012, 0.08, 0.012, matte(C.woodDark), Math.cos(a) * 0.26, gy, Math.sin(a) * 0.26));
        }
        if (tier >= 3) body.add(lantern(0.2, gy + 0.08, 0.17));
      }
      // Flour sacks by the door.
      body.add(sack(-0.17, 0.25, 0.8, "#efe6d2"), sack(-0.25, 0.17, 0.7, "#efe6d2", 0.3));
      if (spec === 1)
        // Millstones leaning on the base and one lying flat.
        for (const [x, z, ry] of [
          [0.27, 0.12, 0.5],
          [0.2, -0.24, -0.8],
        ] as const) {
          const ms = group(rot(cyl(0.11, 0.11, 0.04, matte("#9a958c", 0.95), 0, -0.02, 0, 12), Math.PI / 2), rot(cyl(0.02, 0.02, 0.042, matte(C.ink), 0, -0.021, 0, 6), Math.PI / 2));
          ms.rotation.set(-0.25, ry, 0);
          body.add(at(ms, x, 0.11, z));
        }
      if (spec === 1) body.add(cyl(0.13, 0.13, 0.04, matte("#8f897d", 0.95), -0.27, 0, -0.1, 12));
      // The cap turns into the wind (toward the lane), carrying the sails and a fantail.
      turret.position.y = H;
      body.add(turret);
      turret.add(cyl(0.155, 0.15, 0.06, matte(C.woodDark), 0, 0, 0, 8));
      turret.add(scaled(mesh(geo("millCap", () => new THREE.SphereGeometry(0.16, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2)), matte(spec === 0 ? "#3f6fb5" : "#4a5a3a", 0.8), 0, 0.06, 0), 1, 0.9, 1.15));
      turret.add(ball(0.02, metal(C.gold, 0.3), 0, 0.22, 0, 0));
      const tail = group(box(0.012, 0.012, 0.16, matte(C.woodDark), 0, 0, -0.08));
      for (let i = 0; i < 4; i++) {
        const pivot = group(bx(0.006, 0.07, 0.02, matte(C.cream), 0, 0.04, 0));
        pivot.rotation.z = (i * Math.PI) / 2;
        tail.add(at(pivot, 0, 0.006, -0.16));
      }
      turret.add(at(tail, 0, 0.1, -0.12));
      // Sails on a hub: a child named "sails", spinning about its local Z.
      const sails = new THREE.Group();
      sails.name = "sails";
      sails.position.set(0, 0.08, 0.2);
      sails.add(rot(cyl(0.02, 0.025, 0.1, matte(C.woodDark), 0, -0.05, 0, 8), Math.PI / 2), ball(0.035, matte(C.woodDark), 0, 0, 0.03, 0));
      const L = spec === 0 ? 0.37 : 0.28 + (lvl - 1) * 0.025;
      const sw = spec === 0 ? 0.14 : 0.1;
      const frame = matte(C.woodDark);
      const canvas = matte(spec === 0 ? "#f1e6cc" : "#efe4cc", 0.9, false);
      for (let i = 0; i < 4; i++) {
        const arm = new THREE.Group();
        arm.rotation.z = (i * Math.PI) / 2;
        arm.add(box(0.025, L + 0.04, 0.02, frame, 0, -0.02, 0.03));
        arm.add(box(0.01, L - 0.06, 0.012, frame, sw, 0.06, 0.03));
        const bars = spec === 0 ? 3 : 5;
        for (let j = 0; j < bars; j++) arm.add(box(sw, 0.008, 0.01, frame, sw / 2, 0.08 + (j * (L - 0.1)) / (bars - 1), 0.03));
        if (spec === 0) arm.add(box(sw + 0.02, L - 0.04, 0.004, canvas, sw / 2 + 0.005, 0.05, 0.022));
        else if (tier >= 2 && i % 2 === 0) arm.add(box(sw * 0.5, L - 0.1, 0.004, canvas, sw * 0.3, 0.08, 0.022));
        sails.add(arm);
      }
      turret.add(sails);
      ud.sails = sails;
      break;
    }
    case "cannon": {
      const lvl = Math.min(tier, 3);
      const wood = matte(C.wood);
      const dark = matte(C.woodDark);
      const brass = metal("#c9a14a", 0.3);
      // A plank turntable on the plinth.
      body.add(cyl(0.3, 0.32, 0.04, dark, 0, 0, 0, 12));
      for (let i = -2; i <= 2; i++) body.add(box(0.008, 0.005, 0.56 - Math.abs(i) * 0.08, matte("#4a2f1a"), i * 0.11, 0.04, 0));
      // Seed potatoes: sacks and a heap beside the gun (more with each tier).
      body.add(sack(-0.3, 0.18, 1, "#b89a6a", 0.1), sack(-0.33, 0.03, 0.85, "#a88a5a", -0.2));
      if (lvl >= 2) body.add(sack(0.31, -0.2, 0.9, "#b89a6a", 0.15));
      const spud = matte("#b08a5a", 0.9);
      for (let i = 0; i < 4 + lvl * 2; i++) {
        const a = i * 1.7;
        const r = (i % 3) * 0.025;
        body.add(scaled(ball(0.024, spud, -0.22 + Math.cos(a) * r, 0.03 + (i > 5 ? 0.03 : 0), -0.25 + Math.sin(a) * r, 0), 1.2, 0.9, 1));
      }
      if (spec === 0)
        for (const [x, z, s] of [
          [0.3, 0.17, 1],
          [0.33, 0.02, 0.75],
        ] as const)
          body.add(scaled(ball(0.08 * s, matte("#e98a2b", 0.7), x, 0.06 * s, z, 1), 1, 0.72, 1), cyl(0.008, 0.012, 0.04, matte(C.leafDark), x, 0.1 * s, z, 4));
      turret.position.y = 0.04;
      body.add(turret);
      // The carriage: two cheeks, an axle, spoked wheels and a trail to the ground behind.
      for (const sd of [-1, 1]) {
        turret.add(box(0.035, 0.12, 0.3, wood, sd * 0.09, 0.03, -0.02), box(0.036, 0.04, 0.12, wood, sd * 0.09, 0.15, 0.0));
        if (lvl >= 3) turret.add(box(0.04, 0.012, 0.3, iron(), sd * 0.09, 0.1, -0.02));
        turret.add(cartWheel(0.11, sd * 0.155, 0.11, 0.04, C.woodDark));
      }
      turret.add(at(rot(cyl(0.015, 0.015, 0.34, iron(), 0, -0.17, 0, 6), 0, 0, Math.PI / 2), 0, 0.11, 0.04));
      const trail = box(0.1, 0.04, 0.24, dark, 0, 0, -0.2);
      trail.rotation.x = -0.25;
      turret.add(trail);
      // The barrel: a child named "barrel" (elevated, facing +Z).
      const barrel = new THREE.Group();
      barrel.name = "barrel";
      barrel.position.set(0, 0.19, 0.0);
      const barrelMat = spec === 0 ? metal("#4a5a3a", 0.55) : metal("#3b3f44", 0.5);
      const addBarrel = (r: number, len: number, x: number, y: number, flare: boolean) => {
        const lathe = mesh(barrelGeo(r, len, flare), barrelMat, x, y, 0);
        lathe.rotation.x = Math.PI / 2;
        barrel.add(lathe);
        barrel.add(disc(r * 0.6, 0.004, matte(C.ink), x, y, len * 0.31));
        barrel.add(ball(r * 0.35, barrelMat, x, y, -0.12 * len - r * 0.25, 0));
        for (let b = 0; b < (flare ? Math.min(lvl, 2) : lvl); b++) {
          const t = [0.08, 0.45, 0.7][b]!;
          barrel.add(torus(r * (1 - 0.18 * t) + 0.004, 0.009, brass, x, y, t * len, 12));
        }
      };
      if (spec === 0) {
        addBarrel(0.09, 0.2, 0, 0, false);
        barrel.rotation.x = -0.95;
        barrel.add(scaled(ball(0.06, matte("#e98a2b", 0.7), 0, 0, 0.19, 1), 1, 0.75, 1));
      } else if (spec === 1) {
        for (const x of [-0.045, 0.045]) addBarrel(0.032, 0.32, x, 0, true);
        addBarrel(0.032, 0.32, 0, 0.055, true);
        barrel.rotation.x = -0.3;
      } else {
        addBarrel(0.055, 0.32 + (lvl - 1) * 0.02, 0, 0, false);
        barrel.rotation.x = -0.45;
      }
      barrel.add(rot(cyl(0.016, 0.016, 0.2, iron(), 0, -0.1, 0, 6), 0, 0, Math.PI / 2));
      // A glowing fuse at the breech from tier 2.
      if (tier >= 2) barrel.add(ball(0.014, glow("#ff9a3a", 2.5), 0, 0.06, -0.03, 0));
      turret.add(barrel);
      ud.barrel = barrel;
      if (tier >= 3) {
        const p = pennant(spec === 1 ? "#3f6fb5" : "#c4433a", -0.12, 0.08, -0.22, 0.28, 0.1);
        turret.add(p);
        ud.flag = p.userData.flag as THREE.Object3D;
      }
      break;
    }
  }
  if (!turret.parent) body.add(turret);
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  bake(root);
  return root;
}

// ---- enemies ----

export function enemyScale(kind: EnemyKind): number {
  switch (kind) {
    case "drone":
      return 0.75;
    case "lawyer":
    case "influencer":
      return 0.85;
    case "wrapped":
      return 1.05;
    case "boss":
    case "convoy":
    case "megadozer":
    case "clinic":
    case "blimp":
      return 1.6;
    case "ship":
    case "swarm":
    case "bus":
    case "board":
      return 1.75;
    case "hollowcandor":
      return 2.2;
    case "candor":
      return 1.5;
    case "director":
    case "remnant":
      return 1.1;
    default:
      return 1;
  }
}

export function enemyLift(kind: EnemyKind): number {
  return kind === "drone" ? 0.55 : kind === "blimp" ? 0.9 : kind === "candor" || kind === "hollowcandor" ? 0.2 : 0;
}

interface VehicleOpts {
  len: number;
  h: number;
  w?: number;
  body: string;
  cab?: string;
  stripe?: string;
  wheels?: number;
  matteBody?: boolean;
  /** A glowing logo on the roof (defaults to the stripe colour). */
  logo?: string | null;
}

/** A wheel (axle along Z) that spins about its own local Y: tyre, chrome hubcap, a spoke so the spin shows. */
function wheel(r: number, x: number, z: number): THREE.Group {
  const w = new THREE.Group();
  w.add(cyl(r, r, 0.05, matte("#1d1b1b", 0.9, false), 0, -0.025, 0, 12));
  w.add(cyl(r * 0.55, r * 0.55, 0.056, chrome("#c9d0d8"), 0, -0.028, 0, 6));
  w.add(box(r * 0.9, 0.058, 0.012, metal("#5a5e63"), 0, -0.029, 0));
  w.rotation.x = Math.PI / 2;
  w.position.set(x, r, z);
  return w;
}

/** A vehicle facing +x, wheels on the ground. */
function vehicle(o: VehicleOpts): THREE.Group {
  const g = new THREE.Group();
  const w = o.w ?? 0.3;
  const bodyMat = o.matteBody ? matte(o.body, 0.7, false) : gloss(o.body);
  const wr = 0.07;
  const cabMat = o.cab ? gloss(o.cab) : bodyMat;
  g.add(box(o.len * 0.72, o.h, w, bodyMat, -o.len * 0.14, wr, 0));
  g.add(box(o.len * 0.26, o.h * 0.78, w * 0.96, cabMat, o.len * 0.36, wr, 0));
  // Skirt under the body, so the wheels sit in arches rather than floating beside a box.
  g.add(box(o.len * 0.98, 0.04, w * 0.9, matte("#26282d", 0.6, false), 0, wr - 0.03, 0));
  // Windscreen, side windows (lit from inside), a grille, bumpers, mirrors, head- and tail-lights.
  g.add(box(o.len * 0.02, o.h * 0.34, w * 0.82, glass(), o.len * 0.495, wr + o.h * 0.38, 0));
  for (const side of [-1, 1]) {
    g.add(box(o.len * 0.18, o.h * 0.28, 0.005, glass(), o.len * 0.36, wr + o.h * 0.42, (side * w * 0.965) / 2));
    g.add(box(o.len * 0.16, o.h * 0.05, 0.004, glow("#cfe8ff", 0.5), o.len * 0.36, wr + o.h * 0.42, (side * (w * 0.965 + 0.004)) / 2));
    g.add(box(0.025, 0.03, 0.04, cabMat, o.len * 0.47, wr + o.h * 0.5, side * (w / 2 + 0.02)));
    g.add(box(0.012, 0.035, 0.035, glow("#ff2a2a", 1.8), -o.len * 0.5 - 0.004, wr + o.h * 0.25, side * w * 0.36));
  }
  if (o.stripe) for (const side of [-1, 1]) g.add(box(o.len * 0.7, o.h * 0.14, 0.006, glow(o.stripe, 0.6), -o.len * 0.14, wr + o.h * 0.35, (side * (w + 0.004)) / 2));
  for (const side of [-1, 1]) g.add(ball(0.025, glow("#fff2b0", 2.5), o.len * 0.5, wr + o.h * 0.18, side * w * 0.33, 0));
  g.add(box(0.008, o.h * 0.16, w * 0.4, chrome(), o.len * 0.5 + 0.003, wr + o.h * 0.08, 0));
  g.add(box(0.03, 0.035, w * 1.02, metal("#3a3d42", 0.5), o.len * 0.5, wr - 0.02, 0), box(0.03, 0.035, w * 1.02, metal("#3a3d42", 0.5), -o.len * 0.5, wr - 0.02, 0));
  const logo = o.logo === undefined ? o.stripe : o.logo;
  if (logo) g.add(cyl(0.05, 0.05, 0.012, glow(logo, 1.4), -o.len * 0.14, wr + o.h, 0, 10), cyl(0.056, 0.056, 0.008, chrome(), -o.len * 0.14, wr + o.h, 0, 10));
  const n = o.wheels ?? 2;
  const wheels: THREE.Object3D[] = [];
  for (let i = 0; i < n; i++)
    for (const side of [-1, 1]) {
      const wh = wheel(wr, -o.len * 0.32 + (i * o.len * 0.66) / Math.max(1, n - 1), (side * w) / 2);
      g.add(wh);
      wheels.push(wh);
    }
  g.userData.wheels = wheels;
  return g;
}

function crown(y: number, w: number): THREE.Group {
  const g = new THREE.Group();
  const gold = metal(C.gold, 0.25);
  const ring = mesh(new THREE.TorusGeometry(w, w * 0.18, 6, 16), gold, 0, y, 0);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.add(cone(w * 0.22, w * 0.6, gold, Math.cos(a) * w, y, Math.sin(a) * w, 4));
    g.add(ball(w * 0.12, glow("#ff4a6a", 2), Math.cos(a) * w * 1.05, y + w * 0.15, Math.sin(a) * w * 1.05, 0));
  }
  return g;
}

/** A suited figure facing +x: legs (animated), torso with arms, a tie, a head with neat hair. */
function person(suit: string, head = "#efd6c4", tie = "#c4433a", hair = "#3a2a24"): THREE.Group {
  const g = new THREE.Group();
  const legs = new THREE.Group();
  for (const z of [-0.04, 0.04]) legs.add(box(0.05, 0.2, 0.05, matte("#2b2b30"), 0, 0, z));
  g.add(legs);
  g.add(box(0.16, 0.24, 0.2, matte(suit, 0.6), 0, 0.2, 0));
  for (const z of [-0.12, 0.12]) g.add(box(0.05, 0.2, 0.045, matte(suit, 0.6), 0, 0.22, z), ball(0.025, matte(head, 0.6), 0, 0.21, z, 0));
  g.add(box(0.004, 0.12, 0.05, matte("#f4f6f8", 0.5), 0.081, 0.31, 0), box(0.006, 0.11, 0.025, matte(tie, 0.5), 0.084, 0.31, 0));
  g.add(ball(0.075, matte(head, 0.6), 0, 0.52, 0, 1));
  g.add(scaled(ball(0.078, matte(hair, 0.6), -0.012, 0.55, 0, 0), 1, 0.7, 1));
  g.userData.legs = legs;
  return g;
}

/** Bubble wrap round a box of size (l, h, w) centred at (x, y, 0): a translucent shell studded with bubbles. */
function bubbleWrap(l: number, h: number, w: number, x: number, y: number): THREE.Group {
  const shell = new THREE.Group();
  shell.name = "shield";
  const film = bubble("#dff3ff", 0.32);
  const pop = bubble("#ffffff", 0.55);
  shell.add(bx(l, h, w, film, x, y, 0));
  const r = 0.022;
  const nx = 5;
  for (let i = 0; i < nx; i++) {
    const bxp = x - l / 2 + ((i + 0.5) * l) / nx;
    for (let j = 0; j < 3; j++) shell.add(ball(r, pop, bxp, y + h / 2 + r * 0.4, -w / 2 + ((j + 0.5) * w) / 3, 0));
    for (const side of [-1, 1]) for (let j = 0; j < 2; j++) shell.add(ball(r, pop, bxp, y - h / 4 + (j * h) / 2, side * (w / 2 + r * 0.4), 0));
  }
  for (const side of [-1, 1]) for (let j = 0; j < 2; j++) shell.add(ball(r, pop, x + side * (l / 2 + r * 0.4), y - h / 4 + (j * h) / 2, (j - 0.5) * w * 0.5, 0));
  // Brown parcel tape round the middle and a FRAGILE label.
  const tape = matte("#c9a86a", 0.5, false);
  shell.add(bx(0.05, h + 0.012, w + 0.012, tape, x, y, 0), bx(l + 0.012, h + 0.012, 0.05, tape, x, y, 0));
  for (const side of [-1, 1]) shell.add(bx(0.12, 0.05, 0.004, glow("#ff4a3a", 0.9), x - l * 0.25, y + h * 0.1, side * (w / 2 + 0.008)));
  return shell;
}

export function buildEnemy(kind: EnemyKind): THREE.Group {
  let g: THREE.Group;
  switch (kind) {
    case "van":
      g = vehicle({ len: 0.62, h: 0.3, body: "#f4f6f8", stripe: C.teal });
      g.add(box(0.3, 0.015, 0.22, metal("#5a5e63"), -0.12, 0.38, 0));
      break;
    case "wrapped": {
      g = vehicle({ len: 0.62, h: 0.3, body: "#f4f6f8", stripe: C.teal });
      const shield = bubbleWrap(0.7, 0.36, 0.38, -0.005, 0.07 + 0.17);
      g.add(shield);
      g.userData.shield = shield;
      break;
    }
    case "phantom":
      g = vehicle({ len: 0.62, h: 0.3, body: "#2a2b30", cab: "#202126", matteBody: true, logo: null });
      for (const side of [-1, 1]) g.add(ball(0.025, glow("#ff3b30", 3), 0.31, 0.2, side * 0.1, 0));
      break;
    case "truck":
      g = vehicle({ len: 0.78, h: 0.36, body: "#d93a2f", stripe: "#ffe66b", wheels: 3 });
      for (const side of [-1, 1]) g.add(cyl(0.015, 0.015, 0.22, chrome(), 0.17, 0.2, side * 0.13, 6));
      break;
    case "tender":
      g = vehicle({ len: 0.7, h: 0.24, body: "#8fb8d6", cab: "#d9e6ef", stripe: "#2f5a7a" });
      g.add(box(0.1, 0.03, 0.18, glow("#5ab0ff", 2), 0.25, 0.27, 0));
      break;
    case "director":
      g = vehicle({ len: 0.82, h: 0.22, body: "#16181d", cab: "#16181d", stripe: C.gold });
      for (const side of [-1, 1]) g.add(cyl(0.004, 0.004, 0.08, chrome(), 0.38, 0.22, side * 0.12, 4), box(0.05, 0.03, 0.003, glow(C.gold, 1.2), 0.405, 0.27, side * 0.12));
      break;
    case "clinic":
      g = vehicle({ len: 0.72, h: 0.36, body: "#f7fbfa", stripe: "#7fd1b9", wheels: 3 });
      g.add(box(0.06, 0.16, 0.005, glow("#2fd19c", 2), -0.1, 0.18, 0.16), box(0.16, 0.06, 0.005, glow("#2fd19c", 2), -0.1, 0.23, 0.16));
      g.add(box(0.06, 0.16, 0.005, glow("#2fd19c", 2), -0.1, 0.18, -0.16), box(0.16, 0.06, 0.005, glow("#2fd19c", 2), -0.1, 0.23, -0.16));
      g.add(box(0.12, 0.03, 0.2, glow("#5ab0ff", 2), 0.26, 0.35, 0));
      break;
    case "boss":
      g = vehicle({ len: 0.72, h: 0.36, body: "#16171c", cab: "#22232a", stripe: C.gold, wheels: 3 });
      g.add(crown(0.5, 0.09));
      g.add(box(0.012, 0.12, 0.24, chrome("#e8d9a8"), 0.365, 0.08, 0));
      break;
    case "convoy":
      g = vehicle({ len: 0.84, h: 0.38, body: "#d93a2f", stripe: "#ffe66b", wheels: 4 });
      g.add(crown(0.52, 0.09));
      for (const side of [-1, 1]) g.add(cyl(0.015, 0.015, 0.24, chrome(), 0.19, 0.22, side * 0.13, 6));
      break;
    case "bus":
      g = vehicle({ len: 0.9, h: 0.4, body: "#f2f4f7", stripe: "#d93a2f", wheels: 3, logo: "#2a6fd9" });
      for (const side of [-1, 1]) for (let i = 0; i < 5; i++) g.add(box(0.08, 0.09, 0.005, glow("#bfe0ff", 1.1), -0.4 + i * 0.1, 0.3, side * 0.155));
      g.add(box(0.005, 0.05, 0.2, glow("#ffb02a", 1.6), 0.452, 0.4, 0));
      break;
    case "board":
      g = vehicle({ len: 0.96, h: 0.24, body: "#16181d", cab: "#16181d", stripe: C.gold, wheels: 3 });
      for (let i = 0; i < 4; i++) g.add(ball(0.045, matte("#e9d7c7"), -0.3 + i * 0.13, 0.38, 0, 1), box(0.06, 0.06, 0.08, matte("#2b2b30"), -0.3 + i * 0.13, 0.3, 0));
      g.add(crown(0.48, 0.08));
      break;
    case "ship": {
      g = new THREE.Group();
      const hull = new THREE.Shape();
      hull.moveTo(-0.45, 0.24);
      hull.lineTo(0.48, 0.24);
      hull.lineTo(0.38, 0.06);
      hull.lineTo(-0.42, 0.06);
      hull.lineTo(-0.45, 0.24);
      const h = mesh(new THREE.ExtrudeGeometry(hull, { depth: 0.3, bevelEnabled: false }), gloss("#2f5a7a"), 0, 0, -0.15);
      g.add(h);
      g.add(box(0.94, 0.03, 0.31, gloss("#d93a2f"), 0.01, 0.06, 0));
      for (const side of [-1, 1]) for (let i = 0; i < 5; i++) g.add(disc(0.018, 0.006, glow("#ffe6a0", 1.4), -0.3 + i * 0.15, 0.17, side * 0.152, 8));
      const cols = ["#d93a2f", C.teal, "#f2c94c", "#5b6f8a"];
      for (let i = 0; i < 6; i++) g.add(box(0.17, 0.11, 0.26, matte(cols[i % 4]!, 0.6), -0.32 + (i % 3) * 0.18, 0.24 + Math.floor(i / 3) * 0.11, 0));
      g.add(box(0.14, 0.26, 0.24, gloss("#f4f6f8"), 0.3, 0.24, 0));
      g.add(box(0.12, 0.04, 0.005, glow("#bfe8ff", 1.5), 0.3, 0.42, 0.122));
      g.add(cyl(0.035, 0.04, 0.12, gloss("#16181d"), 0.3, 0.5, 0, 8), cyl(0.041, 0.041, 0.025, glow(C.teal, 1.5), 0.3, 0.58, 0, 8));
      const wheels: THREE.Object3D[] = [];
      for (let i = 0; i < 4; i++)
        for (const side of [-1, 1]) {
          const wh = wheel(0.06, -0.33 + i * 0.22, side * 0.15);
          g.add(wh);
          wheels.push(wh);
        }
      g.userData.wheels = wheels;
      break;
    }
    case "bulldozer":
    case "megadozer": {
      g = new THREE.Group();
      g.add(box(0.5, 0.12, 0.34, matte("#2f2f2f", 0.9), -0.04, 0, 0));
      // Track rollers along both sides.
      for (const side of [-1, 1]) for (let i = 0; i < 4; i++) g.add(at(rot(cyl(0.04, 0.04, 0.02, metal("#5a5e63"), 0, -0.01, 0, 8), Math.PI / 2), -0.22 + i * 0.12, 0.06, side * 0.175));
      g.add(box(0.38, 0.22, 0.28, gloss("#f2b51f", 0.15), -0.06, 0.12, 0));
      g.add(box(0.2, 0.2, 0.22, gloss("#f2b51f", 0.15), -0.12, 0.34, 0));
      g.add(box(0.21, 0.1, 0.18, glass(), -0.12, 0.42, 0));
      g.add(box(0.05, 0.22, 0.42, metal("#9aa0a6", 0.35), 0.28, 0.02, 0));
      for (let i = 0; i < 5; i++) g.add(cone(0.02, 0.04, metal("#9aa0a6", 0.35), 0.31, 0, -0.17 + i * 0.085, 4));
      for (const side of [-1, 1]) g.add(rot(box(0.18, 0.025, 0.025, metal("#5a5e63"), 0.18, 0.1, side * 0.15), 0, 0, -0.3));
      g.add(cyl(0.018, 0.018, 0.2, iron(), 0.04, 0.34, 0.08, 6), box(0.14, 0.04, 0.2, gloss("#16181d"), -0.12, 0.54, 0));
      g.add(box(0.15, 0.025, 0.006, glow(C.teal, 1.2), -0.06, 0.24, 0.142), box(0.15, 0.025, 0.006, glow(C.teal, 1.2), -0.06, 0.24, -0.142));
      if (kind === "megadozer") g.add(crown(0.62, 0.08));
      g.add(ball(0.025, glow("#ff9a1a", 3), -0.12, 0.6, 0, 0));
      break;
    }
    case "drone": {
      g = new THREE.Group();
      g.add(box(0.26, 0.07, 0.26, gloss("#e6eaee", 0.2), 0, 0, 0));
      g.add(scaled(ball(0.1, gloss("#e6eaee", 0.2), 0, 0.07, 0, 1), 1, 0.45, 1));
      const rotors: THREE.Object3D[] = [];
      for (const [x, z] of [
        [0.18, 0.18],
        [-0.18, 0.18],
        [0.18, -0.18],
        [-0.18, -0.18],
      ] as const) {
        g.add(box(0.2, 0.02, 0.02, metal("#5a5e63"), x / 2, 0.04, z / 2).rotateY(Math.atan2(z, x)));
        g.add(cyl(0.025, 0.025, 0.04, metal("#3b3f44"), x, 0.04, z, 8));
        const r = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.005, 12), new THREE.MeshBasicMaterial({ color: "#cfd6dc", transparent: true, opacity: 0.35 }), x, 0.08, z);
        g.add(r);
        rotors.push(r);
      }
      g.userData.rotors = rotors;
      g.add(ball(0.02, glow("#ff3b30", 3), 0.13, 0.03, 0, 0));
      g.add(ball(0.025, gloss("#16181d", 0.2), 0.12, -0.02, 0, 0), ball(0.012, glow("#7fd6ff", 2.5), 0.14, -0.02, 0, 0));
      g.add(box(0.14, 0.11, 0.14, matte("#c79a62"), 0, -0.16, 0));
      g.add(box(0.145, 0.02, 0.145, glow(C.teal, 0.6), 0, -0.12, 0));
      for (const x of [-0.06, 0.06]) g.add(box(0.006, 0.12, 0.006, metal("#5a5e63"), x, -0.08, 0));
      break;
    }
    case "influencer": {
      g = new THREE.Group();
      g.add(box(0.36, 0.02, 0.08, metal("#5a5e63"), 0, 0.06, 0));
      for (const x of [-0.16, 0.16]) {
        const w = cyl(0.05, 0.05, 0.03, matte("#1d1b1b"), x, 0.05, 0, 10);
        w.rotation.x = Math.PI / 2;
        w.position.y = 0.05;
        g.add(w);
      }
      g.add(cyl(0.012, 0.012, 0.4, metal("#5a5e63"), 0.15, 0.06, 0, 5));
      const p = person("#f27ab0", "#f3d2c1", "#ffd6ea", "#e8c27a");
      p.position.y = 0.08;
      g.add(p);
      const ring = mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 20), glow("#ffd6ea", 3), 0.16, 0.8, 0);
      ring.rotation.y = Math.PI / 2;
      g.add(ring);
      g.add(box(0.012, 0.09, 0.05, glow("#bfe8ff", 2), 0.16, 0.76, 0));
      g.userData.legs = p.userData.legs;
      break;
    }
    case "blimp": {
      g = new THREE.Group();
      const env = mesh(new THREE.SphereGeometry(0.42, 20, 12), gloss("#f27ab0", 0.1), 0, 0.3, 0);
      env.scale.set(1, 0.48, 0.48);
      g.add(env);
      for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const fin = box(0.14, 0.12, 0.01, gloss("#e05a98", 0.1), -0.42, 0.24, 0);
        fin.rotation.x = r;
        g.add(fin);
      }
      g.add(box(0.36, 0.18, 0.005, glow("#ffffff", 1.6), 0, 0.28, 0.2), box(0.36, 0.18, 0.005, glow("#ffffff", 1.6), 0, 0.28, -0.2));
      g.add(box(0.2, 0.07, 0.1, gloss("#f4f6f8"), 0, 0.06, 0));
      for (const side of [-1, 1]) for (let i = 0; i < 3; i++) g.add(box(0.04, 0.03, 0.004, glow("#bfe8ff", 1.4), -0.06 + i * 0.06, 0.09, side * 0.052));
      for (const x of [-0.06, 0.06]) g.add(cyl(0.004, 0.004, 0.1, metal("#5a5e63"), x, 0.12, 0, 4));
      g.add(crown(0.56, 0.08));
      break;
    }
    case "lawyer":
      g = person("#4a5260", "#efd6c4", "#7a1f2a", "#9a9aa0");
      g.add(box(0.12, 0.09, 0.03, matte("#3a2a24"), 0.02, 0.1, 0.13), box(0.04, 0.012, 0.012, metal(C.gold, 0.3), 0.02, 0.19, 0.13));
      break;
    case "swarm": {
      g = new THREE.Group();
      const legsAll: THREE.Object3D[] = [];
      for (let i = 0; i < 5; i++) {
        const p = person("#2f343c", "#efd6c4", i % 2 ? C.teal : "#c4433a");
        p.position.set((i % 3) * 0.17 - 0.17, 0, Math.floor(i / 3) * 0.2 - 0.1);
        p.scale.setScalar(0.8);
        g.add(p);
        legsAll.push(p.userData.legs as THREE.Object3D);
      }
      g.add(crown(0.56, 0.07));
      g.userData.legsAll = legsAll;
      break;
    }
    case "hollowcandor":
    case "candor":
    case "remnant": {
      g = new THREE.Group();
      const R = kind === "hollowcandor" ? 0.32 : kind === "candor" ? 0.26 : 0.17;
      const core =
        kind === "remnant"
          ? mesh(new THREE.OctahedronGeometry(R, 0), chrome("#9aa3b5"), 0, R, 0)
          : mesh(new THREE.SphereGeometry(R, 24, 16), chrome(kind === "hollowcandor" ? "#c8ccd8" : "#e4e8f0"), 0, R, 0);
      g.add(core);
      const eye = mesh(new THREE.SphereGeometry(R * 0.3, 16, 10), glow(kind === "hollowcandor" ? "#ff2a2a" : "#2ae0d0", 4), R * 0.82, R * 1.05, 0);
      eye.scale.set(0.5, 1, 1);
      g.add(eye);
      // A seam round the equator and a little pedestal of light under it.
      g.add(ring(R * 1.005, 0.008, glow(kind === "hollowcandor" ? "#ff5a3a" : "#5ae0f0", 1), 0, R, 0, 32));
      g.add(cyl(R * 0.5, R * 0.7, 0.02, glow(kind === "hollowcandor" ? "#ff5a3a" : "#5ae0f0", 0.8), 0, 0, 0, 16));
      if (kind !== "remnant") {
        const rings = new THREE.Group();
        for (let i = 0; i < (kind === "hollowcandor" ? 3 : 2); i++) {
          const ring = mesh(new THREE.TorusGeometry(R * (1.25 + i * 0.18), 0.012, 6, 40), glow(kind === "hollowcandor" ? "#ff5a3a" : "#5ae0f0", 1.5), 0, R, 0);
          ring.rotation.x = Math.PI / 2 + i * 0.5;
          rings.add(ring);
        }
        g.add(rings);
        g.userData.rings = rings;
      }
      if (kind === "hollowcandor") g.add(crown(R * 2.15, 0.12));
      break;
    }
  }
  bake(g);
  const root = new THREE.Group();
  g.scale.multiplyScalar(enemyScale(kind));
  root.add(g);
  root.userData.inner = g;
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return root;
}

// ---- Cath ----

/** Cath: an olive field jacket over a cream blouse, slim trousers, boots, a rolling pin; her head is her portrait. */
export function buildCath(faceTexture: THREE.Texture | null): THREE.Group {
  const root = new THREE.Group();
  const fig = new THREE.Group();
  root.add(fig);
  const legs: THREE.Object3D[] = [];
  for (const z of [-0.05, 0.05]) {
    const leg = new THREE.Group();
    leg.position.set(0, 0.24, z);
    leg.add(box(0.06, 0.22, 0.06, matte("#3a3340", 0.7), 0, -0.24, 0));
    leg.add(box(0.08, 0.05, 0.07, matte("#5a3a28", 0.5), 0.015, -0.26, 0));
    fig.add(leg);
    legs.push(leg);
  }
  // Jacket: a gently flared lathe, collar up.
  const pts = [new THREE.Vector2(0.12, 0), new THREE.Vector2(0.11, 0.1), new THREE.Vector2(0.1, 0.2), new THREE.Vector2(0.11, 0.26), new THREE.Vector2(0.05, 0.3)];
  const jacket = mesh(new THREE.LatheGeometry(pts, 12), matte(C.olive, 0.7), 0, 0.22, 0);
  fig.add(jacket);
  fig.add(box(0.02, 0.1, 0.08, matte("#F7F0E3", 0.5), 0.1, 0.38, 0));
  fig.add(ball(0.012, glow("#ffe9a8", 1), 0.112, 0.44, 0.02, 0));
  const arm = new THREE.Group();
  arm.position.set(0, 0.48, 0.12);
  arm.add(box(0.05, 0.18, 0.05, matte("#56623A", 0.7), 0, -0.14, 0));
  const pin = cyl(0.025, 0.025, 0.26, matte("#d9b384", 0.6), 0, -0.3, 0, 8);
  pin.rotation.z = Math.PI / 2;
  pin.position.set(0.05, -0.24, 0.02);
  arm.add(pin);
  fig.add(arm);
  const arm2 = new THREE.Group();
  arm2.position.set(0, 0.48, -0.12);
  arm2.add(box(0.05, 0.18, 0.05, matte("#56623A", 0.7), 0, -0.14, 0));
  fig.add(arm2);
  // Hair falling down her back.
  fig.add(box(0.05, 0.3, 0.2, matte("#2E211C", 0.5), -0.07, 0.32, 0));
  // Her face, always turned to the camera.
  if (faceTexture) {
    const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: faceTexture, transparent: true }));
    head.scale.set(0.42, 0.5, 1);
    head.position.set(0, 0.72, 0);
    root.add(head);
    root.userData.head = head;
  }
  fig.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  root.userData.legs = legs;
  root.userData.arm = arm;
  root.userData.fig = fig;
  return root;
}

// ---- landmarks ----

export function buildFarmhouse(): THREE.Group {
  const g = new THREE.Group();
  // Whitewashed walls, a pitched red roof of two slabs, gable ends, a chimney, a green door, lit windows.
  g.add(box(0.74, 0.46, 0.56, matte(C.cream, 0.8)));
  const roofMat = matte(C.red, 0.7);
  for (const side of [-1, 1]) {
    const slab = box(0.84, 0.04, 0.38, roofMat, 0, 0, 0);
    slab.position.set(0, 0.6, side * 0.15);
    slab.rotation.x = side * 0.72;
    g.add(slab);
  }
  const gable = new THREE.Shape();
  gable.moveTo(-0.28, 0);
  gable.lineTo(0, 0.26);
  gable.lineTo(0.28, 0);
  gable.lineTo(-0.28, 0);
  const gableGeo = new THREE.ExtrudeGeometry(gable, { depth: 0.72, bevelEnabled: false });
  const gables = mesh(gableGeo, matte(C.cream, 0.8), -0.36, 0.46, 0);
  gables.rotation.y = Math.PI / 2;
  g.add(gables);
  g.add(box(0.1, 0.28, 0.1, matte("#8a5a35"), 0.2, 0.55, -0.1));
  g.add(box(0.14, 0.26, 0.01, matte(C.leaf), 0, 0, 0.285));
  for (const x of [-0.24, 0.24]) g.add(box(0.12, 0.12, 0.01, glow("#ffd98a", 1.2), x, 0.22, 0.285));
  for (const x of [-0.24, 0.24]) g.add(box(0.14, 0.04, 0.05, matte("#e8748b", 0.6), x, 0.14, 0.3));
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  g.userData.chimney = new THREE.Vector3(0.2, 0.86, -0.1);
  return g;
}

export function buildGate(label: string): THREE.Group {
  const g = new THREE.Group();
  for (const z of [-0.55, 0.55]) g.add(box(0.12, 0.9, 0.12, gloss("#cfd6dc", 0.6), 0, 0, z));
  g.add(box(0.1, 0.22, 1.2, gloss(C.teal, 0.2), 0, 0.9, 0));
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 96;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#1f8a8a";
    ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = "#f4fbfb";
    ctx.font = "bold 56px 'Atkinson Hyperlegible', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 256, 50);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.2), new THREE.MeshStandardMaterial({ map: tex, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 0.6 }));
  sign.position.set(0.055, 1.01, 0);
  sign.rotation.y = Math.PI / 2;
  g.add(sign);
  const back = sign.clone();
  back.position.x = -0.055;
  back.rotation.y = -Math.PI / 2;
  g.add(back);
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return g;
}

export function buildTree(kind: "oak" | "pine" | "dead", rand: () => number, leafColors: string[]): THREE.Group {
  const g = new THREE.Group();
  if (kind === "pine") {
    g.add(cyl(0.05, 0.07, 0.3, matte(C.woodDark)));
    for (let i = 0; i < 3; i++) g.add(cone(0.42 - i * 0.1, 0.5, matte(i % 2 ? "#3f6a3a" : "#467548"), 0, 0.25 + i * 0.28, 0, 7));
  } else if (kind === "dead") {
    g.add(cyl(0.04, 0.07, 0.8, matte("#5b4636")));
    const b = cyl(0.02, 0.03, 0.4, matte("#5b4636"), 0.1, 0.5, 0);
    b.rotation.z = -0.8;
    g.add(b);
  } else {
    g.add(cyl(0.06, 0.09, 0.45, matte(C.woodDark)));
    for (let i = 0; i < 4; i++) {
      const a = rand() * Math.PI * 2;
      const r = i === 0 ? 0 : 0.18;
      g.add(ball(0.26 + rand() * 0.1, matte(leafColors[Math.floor(rand() * leafColors.length)]!), Math.cos(a) * r, 0.62 + rand() * 0.2, Math.sin(a) * r, 1));
    }
  }
  const s = 0.8 + rand() * 0.5;
  g.scale.setScalar(s);
  g.rotation.y = rand() * Math.PI * 2;
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

export function buildRock(rand: () => number): THREE.Mesh {
  const m = mesh(new THREE.DodecahedronGeometry(0.16 + rand() * 0.14, 0), matte(rand() > 0.5 ? "#a9a296" : "#8f897d", 0.95));
  m.scale.set(1, 0.6 + rand() * 0.3, 1);
  m.rotation.set(rand(), rand() * 6, rand());
  return m;
}

// ---- landmarks on the horizon, one set per act ----

export function buildWindmill(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.35, 0.5, 1.6, matte(C.cream, 0.85), 0, 0, 0, 10));
  g.add(cone(0.42, 0.45, matte(C.red, 0.7), 0, 1.6, 0, 10));
  const sails = new THREE.Group();
  sails.position.set(0, 1.45, 0.45);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI) / 2;
    arm.add(box(0.06, 0.9, 0.02, matte(C.woodDark), 0, 0.05, 0), box(0.24, 0.7, 0.01, matte("#e9e1cf", 0.9), 0.12, 0.2, 0));
    sails.add(arm);
  }
  g.add(sails);
  g.userData.spin = sails;
  return g;
}

export function buildHouse(rand: () => number, lit = false): THREE.Group {
  const g = new THREE.Group();
  const w = 0.7 + rand() * 0.4;
  const walls = ["#f4ede1", "#e9d9c0", "#d9c4a4", "#efe2c8"][Math.floor(rand() * 4)]!;
  g.add(box(w, 0.55, 0.6, matte(walls, 0.85)));
  for (const side of [-1, 1]) {
    const slab = box(w + 0.1, 0.04, 0.42, matte(rand() > 0.5 ? C.red : "#5b5f66", 0.7));
    slab.position.set(0, 0.68, side * 0.16);
    slab.rotation.x = side * 0.75;
    g.add(slab);
  }
  for (const x of [-w / 4, w / 4]) g.add(box(0.12, 0.12, 0.01, lit ? glow("#ffcf7a", 1.4) : matte("#5a7894", 0.3), x, 0.28, 0.305));
  return g;
}

export function buildOffice(rand: () => number, lit: boolean): THREE.Group {
  const g = new THREE.Group();
  const h = 2.2 + rand() * 2.5;
  const w = 0.8 + rand() * 0.6;
  g.add(box(w, h, w, glass("#3a4f66")));
  const win = lit ? glow("#cfe8ff", 1.3) : matte("#9fb6cc", 0.2);
  for (let y = 0.3; y < h - 0.2; y += 0.32)
    for (let x = -w / 2 + 0.12; x < w / 2 - 0.1; x += 0.2) if (rand() > 0.3) g.add(box(0.1, 0.14, 0.01, win, x + 0.05, y, w / 2 + 0.005));
  g.add(box(w * 0.6, 0.12, 0.01, glow(C.teal, 2), 0, h - 0.25, w / 2 + 0.01));
  return g;
}

export function buildLighthouse(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) g.add(cyl(0.3 - i * 0.04, 0.34 - i * 0.04, 0.5, matte(i % 2 ? "#c4433a" : C.cream, 0.7), 0, i * 0.5, 0, 12));
  g.add(cyl(0.22, 0.22, 0.25, glass("#cfe8ff"), 0, 2, 0, 12));
  const lamp = ball(0.14, glow("#fff1b0", 5), 0, 2.13, 0, 1);
  g.add(lamp, cone(0.26, 0.25, matte("#3a3a3a"), 0, 2.25, 0, 12));
  g.userData.light = lamp;
  return g;
}

export function buildBoat(rand: () => number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.8, 0.18, 0.3, matte(["#c4433a", "#3f6fb5", "#f2c94c"][Math.floor(rand() * 3)]!, 0.6)));
  g.add(cyl(0.015, 0.015, 0.8, matte(C.woodDark), 0, 0.18, 0, 4));
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.6), matte("#f4ede1", 0.8, false));
  (sail.material as THREE.Material).side = THREE.DoubleSide;
  sail.position.set(0.15, 0.6, 0);
  g.add(sail);
  return g;
}

export function buildCrane(): THREE.Group {
  const g = new THREE.Group();
  const yellow = gloss("#f2b51f", 0.3);
  g.add(box(0.16, 3, 0.16, yellow));
  const jib = box(2.4, 0.1, 0.12, yellow, 0.7, 2.95, 0);
  g.add(jib, box(0.4, 0.3, 0.3, gloss("#3a3a3a", 0.3), -0.4, 2.8, 0));
  g.add(ball(0.06, glow("#ff3b30", 4), 1.85, 3.1, 0, 0));
  return g;
}

export function buildWall(len: number): THREE.Group {
  const g = new THREE.Group();
  const stone = matte("#b8ad96", 0.95);
  g.add(box(len, 0.9, 0.35, stone));
  for (let x = -len / 2 + 0.15; x < len / 2; x += 0.35) g.add(box(0.18, 0.18, 0.35, stone, x, 0.9, 0));
  return g;
}

export function buildTowerKeep(): THREE.Group {
  const g = new THREE.Group();
  const stone = matte("#b8ad96", 0.95);
  g.add(cyl(0.45, 0.5, 2, stone, 0, 0, 0, 10), cone(0.55, 0.7, matte("#5b5f66"), 0, 2, 0, 10));
  g.add(box(0.12, 0.2, 0.01, glow("#ffb85a", 2), 0, 1.3, 0.48));
  return g;
}

// ---- shared tower parts (also used by the megastructures) ----

/** A hollow cannon barrel along +Y (rotate x by PI/2 to point it along +Z): breech, taper, muzzle lip, bore. */
function barrelGeo(r: number, len: number, flare: boolean): THREE.BufferGeometry {
  return geo(`barrel${r},${len},${flare}`, () => {
    const prof = flare
      ? [
          [0, -0.1 * len],
          [r * 0.95, -0.1 * len],
          [r * 1.05, -0.04 * len],
          [r * 0.9, 0.2 * len],
          [r * 0.8, 0.7 * len],
          [r * 1.45, len],
          [r * 1.3, len],
          [r * 0.6, 0.8 * len],
          [r * 0.55, 0.3 * len],
        ]
      : [
          [0, -0.12 * len],
          [r * 0.95, -0.12 * len],
          [r * 1.05, -0.06 * len],
          [r, 0],
          [r * 0.82, len * 0.85],
          [r * 1.08, len * 0.9],
          [r * 1.08, len],
          [r * 0.62, len],
          [r * 0.62, len * 0.3],
        ];
    return new THREE.LatheGeometry(
      prof.map(([a, b]) => new THREE.Vector2(a, b)),
      12,
    );
  });
}

/** A duck (or goose) facing +x, sitting on the water at y=0. */
function duck(goose: boolean): THREE.Group {
  const d = group(
    ball(goose ? 0.08 : 0.065, matte(goose ? "#f4f1ea" : "#f2c94c"), 0, 0.09, 0, 1),
    ball(goose ? 0.04 : 0.035, matte(goose ? "#f4f1ea" : "#3f7a4a"), 0.06, goose ? 0.2 : 0.15, 0, 1),
    rot(cone(0.02, 0.05, matte("#e98a2b"), 0.1, goose ? 0.19 : 0.14, 0, 4), 0, 0, -Math.PI / 2),
    rot(cone(0.03, 0.05, matte(goose ? "#e4ddd0" : "#e0b23c"), -0.07, 0.1, 0, 4), 0, 0, Math.PI / 2 + 0.4),
  );
  return d;
}

const UP = new THREE.Vector3(0, 1, 0);
/** A round strut from a to b (lattice members, braces, chutes, ropes). */
function strut(a: [number, number, number], b: [number, number, number], r: number, mat: M, seg = 5): THREE.Mesh {
  const va = new THREE.Vector3(...a);
  const d = new THREE.Vector3(...b).sub(va);
  const len = d.length();
  const m = mesh(geo(`strut${r},${seg}`, () => new THREE.CylinderGeometry(r, r, 1, seg)), mat);
  m.scale.y = len;
  m.position.copy(va).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  return m;
}

// ---- megastructures ----

/** The long plinth under every megastructure: stone, a coloured top, glowing gold trim and a lantern at each corner. */
function megaBase(top: string): THREE.Group {
  const g = group(box(1.9, 0.07, 0.96, matte(C.stoneDark, 0.95)), box(1.84, 0.02, 0.9, matte(top, 0.9), 0, 0.07, 0));
  for (const z of [-0.482, 0.482]) g.add(box(1.86, 0.018, 0.012, glow(C.gold, 1.1), 0, 0.03, z));
  for (const x of [-0.952, 0.952]) g.add(box(0.012, 0.018, 0.94, glow(C.gold, 1.1), x, 0.03, 0));
  for (const x of [-0.88, 0.88]) for (const z of [-0.43, 0.43]) g.add(box(0.06, 0.1, 0.06, matte(C.stone, 0.95), x, 0.07, z), lantern(x, 0.17, z));
  return g;
}

/** Leafy wall segment along X at depth z, with thorns facing out (sign of z) and blossom. */
function hedgeRun(x0: number, x1: number, z: number, y: number, r = 0.1): THREE.Group {
  const g = new THREE.Group();
  const n = Math.max(2, Math.round((x1 - x0) / (r * 1.1)));
  const out = Math.sign(z) || 1;
  for (let i = 0; i < n; i++) {
    const x = x0 + ((i + 0.5) * (x1 - x0)) / n;
    g.add(ball(r * (1 + (i % 2) * 0.15), matte(i % 2 ? C.leaf : C.leafDark), x, y + r, z, 1));
    if (i % 2 === 0) g.add(ball(r * 0.18, matte("#fbf5ea", 0.6), x + r * 0.3, y + r * 1.9, z + out * r * 0.4, 0));
    const th = cone(0.018, 0.08, matte("#e9e1cf"), x, 0, z + out * r * 1.05, 4);
    th.rotation.x = (out * Math.PI) / 2;
    th.position.y = y + r * 0.8;
    g.add(th);
  }
  return g;
}

/**
 * A megastructure: two grown towers merged into one. Built centred on the origin, spanning about x = -0.95..0.95
 * (the axis through the two cells) and z = -0.48..0.48, standing on y = 0, facing +Z. Place it at the midpoint of
 * the two cells and rotate about Y so +X runs from one cell to the other. userData: `turret` (aim, local +Z; its
 * rotation.y is relative to the mega's own rotation), `sails` (spin about local Z), `barrel`, `bees`, `ducks`,
 * `arm`, `light`, `flag` as for towers.
 */
export function buildMega(id: MegaId): THREE.Group {
  const root = new THREE.Group();
  const ud = root.userData as Record<string, THREE.Object3D | THREE.Object3D[]>;
  const Y = 0.09;
  const add = (...o: THREE.Object3D[]) => root.add(...o);
  /** Lift a ground prop (built standing on y = 0) onto the plinth. */
  const onY = <T extends THREE.Object3D>(o: T): T => {
    o.position.y += Y;
    return o;
  };
  switch (id) {
    case "harvester": {
      add(megaBase("#8a7a4a"));
      // The silo, at -x.
      const sx = -0.45;
      const sw = 0.28;
      const sh = 1.08;
      const shell = metal("#c7ccd1", 0.35);
      add(cyl(sw + 0.05, sw + 0.06, 0.08, matte(C.stone, 0.95), sx, Y, 0, 16), cyl(sw, sw, sh, shell, sx, Y, 0, 16));
      for (let i = 1; i < 7; i++) add(ring(sw + 0.006, 0.014, metal("#7a8086"), sx, Y + (i * sh) / 7, 0, 24));
      add(mesh(geo(`dome${sw}`, () => new THREE.SphereGeometry(sw, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2)), shell, sx, Y + sh, 0));
      for (const y of [0.45, 0.8]) add(box(0.07, 0.09, 0.03, glow("#ffd76a", 1.4), sx, Y + y, sw - 0.005));
      add(box(0.3, 0.03, 0.006, glow("#e0503a", 1.2), sx, Y + 0.25, sw + 0.002));
      const ladder = new THREE.Group();
      for (const x of [-0.04, 0.04]) ladder.add(box(0.012, sh, 0.012, iron(), x, 0, 0));
      for (let i = 0; i < 12; i++) ladder.add(box(0.08, 0.01, 0.01, iron(), 0, 0.08 + i * 0.09, 0));
      ladder.rotation.y = -Math.PI / 2;
      add(at(ladder, sx - sw - 0.02, Y, 0));
      // The combine, at +x: body, cab, big and small wheels, header and the spinning reel.
      const red = matte("#c4433a");
      add(box(0.5, 0.3, 0.46, red, 0.3, Y + 0.12, 0), box(0.52, 0.03, 0.48, matte("#e0b23c"), 0.3, Y + 0.42, 0));
      add(box(0.2, 0.2, 0.26, glass("#2a3a4a"), 0.36, Y + 0.45, 0), box(0.22, 0.03, 0.28, red, 0.36, Y + 0.65, 0), box(0.12, 0.08, 0.2, glow("#ffe6a0", 0.6), 0.36, Y + 0.5, 0));
      for (const z of [-0.25, 0.25]) {
        add(at(rot(group(cyl(0.16, 0.16, 0.08, matte("#1d1b1b", 0.9), 0, -0.04, 0, 12), cyl(0.09, 0.09, 0.085, matte("#e0b23c"), 0, -0.0425, 0, 8)), Math.PI / 2), 0.18, Y + 0.16, z));
        add(at(rot(group(cyl(0.1, 0.1, 0.06, matte("#1d1b1b", 0.9), 0, -0.03, 0, 10), cyl(0.06, 0.06, 0.065, matte("#e0b23c"), 0, -0.0325, 0, 8)), Math.PI / 2), 0.48, Y + 0.1, z));
      }
      for (const z of [-0.12, 0.12]) add(ball(0.03, glow("#fff2b0", 2.5), 0.56, Y + 0.32, z, 0));
      add(box(0.14, 0.07, 0.86, matte("#e0b23c"), 0.76, Y + 0.02, 0));
      for (let i = 0; i < 9; i++) add(rot(cone(0.018, 0.08, metal("#9aa0a6", 0.35), 0.86, Y + 0.02, -0.4 + i * 0.1, 4), 0, 0, -Math.PI / 2));
      for (const z of [-0.4, 0.4]) add(strut([0.5, Y + 0.35, z * 0.6], [0.78, Y + 0.24, z], 0.012, iron()));
      const reel = new THREE.Group();
      reel.name = "sails";
      reel.position.set(0.78, Y + 0.24, 0);
      reel.add(rot(cyl(0.02, 0.02, 0.84, iron(), 0, -0.42, 0, 6), Math.PI / 2));
      for (const z of [-0.36, 0.36]) reel.add(torus(0.12, 0.01, matte("#e0b23c"), 0, 0, z, 10));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        reel.add(bx(0.025, 0.025, 0.8, matte("#e0b23c"), Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0));
        for (const z of [-0.36, 0.36]) reel.add(rot(bx(0.012, 0.12, 0.012, iron(), Math.cos(a) * 0.06, Math.sin(a) * 0.06, z), 0, 0, a - Math.PI / 2));
      }
      add(reel);
      ud.sails = reel;
      // A grain chute from the silo's shoulder down to the combine.
      add(strut([sx + 0.22, Y + 1.05, 0.05], [0.24, Y + 0.6, 0.05], 0.035, metal("#8a8f94"), 8));
      add(onY(hayBale(-0.84, 0.2, 0.07, 0.3)), onY(hayBale(-0.82, -0.05, 0.07, -0.2)), onY(sack(-0.15, 0.32, 1)), onY(sack(-0.05, 0.36, 0.85)));
      // The scarecrow rides the silo dome, scythe raised; it turns to the lane.
      const turret = new THREE.Group();
      turret.position.set(sx, Y + sh + sw - 0.05, 0);
      turret.add(strawman("#c4433a", C.straw, 1.1));
      const arm = new THREE.Group();
      arm.position.set(0.21, 0.32, 0.02);
      arm.add(cyl(0.012, 0.012, 0.6, matte(C.wood), 0, -0.15, 0, 5));
      const blade = rot(torus(0.17, 0.014, metal("#d9dde2", 0.25), 0, 0, 0, 10, 4, Math.PI * 0.55), 0, Math.PI / 2, 0);
      arm.add(at(group(blade), 0, 0.42, 0.17));
      arm.children[arm.children.length - 1]!.rotation.x = Math.PI;
      turret.add(arm);
      ud.arm = arm;
      const beacon = ball(0.035, glow("#ff6a3a", 3), 0, 0.68, 0, 1);
      turret.add(beacon);
      ud.light = beacon;
      add(turret);
      ud.turret = turret;
      break;
    }
    case "honeymarsh": {
      add(megaBase("#5f6b3a"));
      add(scaled(cyl(0.45, 0.47, 0.04, matte(C.stoneDark, 0.95), 0, Y, 0, 20), 1.95, 1, 0.98));
      add(scaled(cyl(0.41, 0.41, 0.02, gloss("#8f7f3a", 0.05), 0, Y + 0.035, 0, 20), 1.95, 1, 0.98));
      for (const [x, z, r] of [
        [-0.55, 0.18, 0.09],
        [0.5, -0.2, 0.07],
        [0.3, 0.3, 0.05],
      ] as const)
        add(cyl(r, r, 0.006, glow("#f2a516", 0.7), x, Y + 0.055, z, 10));
      for (const r of [reeds(-0.78, -0.12, 4), reeds(0.8, 0.12, 4, 0.2), reeds(-0.35, -0.36, 3), reeds(0.4, 0.36, 3, 0.18)]) add(onY(r));
      add(lily(-0.4, Y + 0.056, 0.22, 0.06, true), lily(0.55, Y + 0.056, 0.05, 0.05), lily(0.2, Y + 0.056, -0.32, 0.055, true));
      // Stilted platform with a tower of stacked skeps, crowned by a honey lantern.
      for (const x of [-0.2, 0.2]) for (const z of [-0.2, 0.2]) add(box(0.04, 0.42, 0.04, matte(C.woodDark), x, Y, z));
      for (const z of [-0.2, 0.2]) add(strut([-0.2, Y + 0.05, z], [0.2, Y + 0.38, z], 0.01, matte(C.woodDark)));
      add(box(0.54, 0.04, 0.54, matte(C.wood), 0, Y + 0.42, 0));
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.4;
        add(at(rot(cone(0.016, 0.05, glow("#f2a516", 1.2), 0, -0.025, 0, 5), Math.PI), Math.cos(a) * 0.25, Y + 0.395, Math.sin(a) * 0.25));
      }
      const straw = matte("#d9a649");
      add(skep(0.26, 0.42, straw, Y + 0.46), skep(0.2, 0.33, straw, Y + 0.84), skep(0.14, 0.25, straw, Y + 1.14));
      add(cyl(0.035, 0.035, 0.07, glow("#ffb829", 3), 0, Y + 1.38, 0, 8), cone(0.05, 0.05, iron(), 0, Y + 1.45, 0, 6), ball(0.02, metal(C.gold, 0.3), 0, Y + 1.52, 0, 0));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        add(cone(0.02, 0.06, metal(C.gold, 0.3), Math.cos(a) * 0.05, Y + 1.36, Math.sin(a) * 0.05, 4));
      }
      // A plank walk from the front edge to the platform.
      for (let i = 0; i < 4; i++) add(box(0.14, 0.015, 0.05, matte(i % 2 ? C.wood : "#9a6a40"), 0, Y + 0.05 + i * 0.1, 0.42 - i * 0.05));
      // Two lesser hives on posts in the marsh, with jars of honey.
      for (const sd of [-1, 1]) {
        const x = sd * 0.62;
        add(cyl(0.02, 0.02, 0.22, matte(C.woodDark), x, Y, -0.08, 5), box(0.22, 0.03, 0.22, matte(C.wood), x, Y + 0.22, -0.08));
        add(skep(0.12, 0.22, straw, Y + 0.25, x, -0.08));
        add(cyl(0.025, 0.025, 0.05, glow("#f2a516", 0.8), x + 0.08 * sd, Y + 0.25, 0.0, 8));
      }
      const bees = new THREE.Group();
      for (let i = 0; i < 8; i++) bees.add(ball(0.025, glow("#ffd23f", 1.2), 0, 0, 0, 0));
      bees.position.set(0, Y + 0.95, 0);
      add(bees);
      ud.bees = bees;
      break;
    }
    case "fortress": {
      add(megaBase("#6b7a45"));
      const red = matte(C.red);
      const trim = matte(C.cream);
      add(box(1.0, 0.5, 0.56, red, 0, Y, 0));
      for (let i = 1; i < 10; i++) add(box(0.008, 0.5, 0.006, matte("#9a4230"), -0.5 + i * 0.1, Y, 0.281));
      for (const x of [-0.5, 0.5]) for (const z of [-0.28, 0.28]) add(box(0.035, 0.5, 0.035, trim, x, Y, z));
      add(pitchedRoof(1.0, 0.56, 0.3, matte(C.woodDark), Y + 0.5, red));
      add(box(1.04, 0.025, 0.02, trim, 0, Y + 0.49, 0.29));
      // Great doors with the white X; lanterns either side.
      add(box(0.32, 0.38, 0.012, trim, 0, Y, 0.285), box(0.005, 0.38, 0.014, matte(C.ink), 0, Y, 0.286));
      for (const sd of [-1, 1]) {
        const x1 = box(0.22, 0.025, 0.014, red, sd * 0.08, Y + 0.18, 0.29);
        x1.rotation.z = 1.05 * sd;
        const x2 = box(0.22, 0.025, 0.014, red, sd * 0.08, Y + 0.18, 0.29);
        x2.rotation.z = -1.05 * sd;
        add(x1, x2, lantern(sd * 0.22, Y + 0.3, 0.3));
      }
      for (const x of [-0.36, 0.36]) add(box(0.1, 0.1, 0.01, trim, x, Y + 0.24, 0.282), box(0.08, 0.08, 0.012, glow("#ffd98a", 1.1), x, Y + 0.25, 0.283));
      // The hayloft tower on the ridge, with a cupola and a gold cockerel.
      add(box(0.3, 0.38, 0.3, red, 0, Y + 0.6, 0), box(0.12, 0.14, 0.012, glow("#ffd98a", 1.3), 0, Y + 0.76, 0.152), ball(0.05, matte(C.straw), 0, Y + 0.72, 0.16, 0));
      add(pitchedRoof(0.3, 0.3, 0.16, matte(C.woodDark), Y + 0.98, red));
      add(box(0.12, 0.14, 0.12, trim, 0, Y + 1.12, 0), rot(cone(0.11, 0.16, matte("#5b5f66"), 0, Y + 1.26, 0, 4), 0, Math.PI / 4));
      add(cyl(0.006, 0.006, 0.18, iron(), 0, Y + 1.42, 0, 4), scaled(ball(0.035, metal(C.gold, 0.25), 0, Y + 1.6, 0, 0), 1.4, 1, 0.4), cone(0.014, 0.05, metal(C.gold, 0.25), 0.04, Y + 1.6, 0, 4));
      // Hedge walls front (broken by the doors) and back, thorned; two hedge towers at the ends.
      add(hedgeRun(-0.74, -0.24, 0.36, Y), hedgeRun(0.24, 0.74, 0.36, Y), hedgeRun(-0.74, 0.74, -0.36, Y));
      for (const sd of [-1, 1]) {
        const x = sd * 0.73;
        add(cyl(0.16, 0.19, 0.12, matte(C.stone, 0.95), x, Y, 0, 10));
        add(ball(0.19, matte(C.leafDark), x, Y + 0.28, 0, 1), ball(0.16, matte(C.leaf), x, Y + 0.56, 0, 1), ball(0.12, matte(C.leafLight), x, Y + 0.8, 0, 1));
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const yy = Y + 0.3 + (i % 3) * 0.22;
          const r = 0.19 - (i % 3) * 0.035;
          const t = cone(0.02, 0.09, matte("#e9e1cf"), x + Math.cos(a) * r, yy, Math.sin(a) * r, 4);
          t.rotation.set(Math.sin(a) * 1.4, 0, -Math.cos(a) * 1.4);
          add(t);
        }
        for (let i = 0; i < 6; i++) add(ball(0.025, matte("#e8748b", 0.6), x + Math.cos(i * 2.3) * 0.17, Y + 0.35 + (i % 3) * 0.2, Math.sin(i * 2.3) * 0.17, 0));
        const p = pennant(sd < 0 ? "#c4433a" : "#3f6fb5", x, Y + 0.9, 0, 0.36, 0.16);
        add(p);
        if (sd > 0) ud.flag = p.userData.flag as THREE.Object3D;
      }
      // Farmhands with shovels at the doors.
      for (const sd of [-1, 1]) {
        const f = person(sd < 0 ? "#5d7a3a" : "#7a5a3a", "#efd6c4", "#e2c06a", "#5a3a28");
        f.add(cyl(0.008, 0.008, 0.4, matte(C.wood), 0.05, 0, 0.13, 4), box(0.06, 0.08, 0.01, metal("#9aa0a6"), 0.05, 0, 0.13));
        f.scale.setScalar(0.55);
        f.rotation.y = -Math.PI / 2;
        add(at(f, sd * 0.3, Y, 0.36));
      }
      break;
    }
    case "grandmarket": {
      add(megaBase("#a89a7a"));
      const brick = matte("#b36a4a");
      const cream = matte(C.cream);
      // Arcaded ground floor: back wall with lit shop windows, a row of columns.
      add(box(1.2, 0.36, 0.36, brick, 0, Y, -0.1));
      for (let i = 0; i < 4; i++) add(box(0.18, 0.18, 0.01, glow("#ffe39a", 1), -0.45 + i * 0.3, Y + 0.08, 0.081));
      for (let i = 0; i < 6; i++) {
        const x = -0.55 + i * 0.22;
        add(cyl(0.035, 0.04, 0.36, cream, x, Y, 0.2, 8), box(0.08, 0.025, 0.08, cream, x, Y + 0.335, 0.2));
      }
      // Upper hall with a row of tall lit windows and flower boxes; cornice; slate roof.
      add(box(1.3, 0.36, 0.62, brick, 0, Y + 0.36, -0.02), box(1.34, 0.03, 0.66, cream, 0, Y + 0.36, -0.02), box(1.36, 0.03, 0.66, cream, 0, Y + 0.72, -0.02));
      for (let i = 0; i < 5; i++) {
        const x = -0.5 + i * 0.25;
        add(box(0.12, 0.2, 0.008, cream, x, Y + 0.44, 0.29), box(0.09, 0.17, 0.01, glow("#ffe39a", 1.1), x, Y + 0.455, 0.292), flowerBox(x, Y + 0.42, 0.31, 0.13));
      }
      add(at(pitchedRoof(1.3, 0.62, 0.22, matte("#5b5f66"), Y + 0.75, brick), 0, 0, -0.02));
      // The clock tower: two lit clock faces, an open belfry with a gold bell, a spire and the town banner.
      add(box(0.26, 0.5, 0.26, cream, 0, Y + 0.8, 0));
      for (const z of [-1, 1]) add(disc(0.08, 0.01, glow("#fff4d0", 1.4), 0, Y + 1.14, z * 0.132, 14), disc(0.09, 0.008, metal(C.gold, 0.3), 0, Y + 1.14, z * 0.128, 14));
      add(box(0.006, 0.06, 0.004, matte(C.ink), 0, Y + 1.16, 0.139), box(0.04, 0.006, 0.004, matte(C.ink), 0.02, Y + 1.14, 0.139));
      for (const x of [-0.11, 0.11]) for (const z of [-0.11, 0.11]) add(box(0.035, 0.18, 0.035, cream, x, Y + 1.3, z));
      add(ball(0.05, metal(C.gold, 0.25), 0, Y + 1.38, 0, 1), box(0.28, 0.03, 0.28, cream, 0, Y + 1.48, 0));
      add(rot(cone(0.2, 0.3, matte("#5b5f66"), 0, Y + 1.51, 0, 4), 0, Math.PI / 4), ball(0.025, metal(C.gold, 0.25), 0, Y + 1.83, 0, 0));
      const p = pennant("#3f6fb5", 0, Y + 1.83, 0, 0.24, 0.16);
      add(p);
      ud.flag = p.userData.flag as THREE.Object3D;
      // Market stalls at both ends; bunting along the arcade; crates of produce.
      for (const sd of [-1, 1]) {
        const x = sd * 0.8;
        const awn = sd < 0 ? "#c4433a" : "#3f6fb5";
        add(box(0.24, 0.14, 0.18, matte(C.wood), x, Y, 0.12));
        for (const [i, c] of ["#d4544a", "#f2c94c", "#5f8f3f"].entries()) add(ball(0.035, matte(c, 0.5), x - 0.07 + i * 0.07, Y + 0.17, 0.14, 0));
        for (const xx of [-0.11, 0.11]) add(box(0.02, 0.36, 0.02, matte(C.wood), x + xx, Y, 0.03));
        for (let i = 0; i < 4; i++) {
          const strip = box(0.07, 0.02, 0.26, matte(i % 2 ? C.cream : awn), x - 0.105 + i * 0.07, Y + 0.36, 0.1);
          strip.rotation.x = 0.35;
          add(strip, box(0.065, 0.04, 0.006, matte(i % 2 ? awn : C.cream), x - 0.105 + i * 0.07, Y + 0.27, 0.235));
        }
      }
      add(bunting(-0.6, 0.6, Y + 0.355, 0.25, 12, 0.05));
      add(onY(crate(-0.35, 0.36, 0.09, "#e98a2b", 0.2)), onY(crate(0.4, 0.37, 0.09, "#5f8f3f", -0.2)), lantern(0, Y + 0.25, 0.2));
      break;
    }
    case "tribunal": {
      add(megaBase("#9a9183"));
      const stone = matte("#ece6da", 0.7);
      const cx = -0.22;
      add(box(1.24, 0.06, 0.76, stone, cx, Y, 0), box(1.0, 0.03, 0.08, stone, cx, Y, 0.42));
      add(box(1.06, 0.5, 0.4, stone, cx, Y + 0.06, -0.12));
      add(box(0.14, 0.26, 0.01, matte("#5a3a28"), cx, Y + 0.06, 0.081), box(0.16, 0.03, 0.012, metal(C.gold, 0.3), cx, Y + 0.32, 0.082));
      for (const dx of [-0.3, 0.3]) add(box(0.1, 0.16, 0.01, glow("#ffe39a", 1), cx + dx, Y + 0.2, 0.081));
      for (let i = 0; i < 6; i++) {
        const x = cx - 0.5 + i * 0.2;
        add(cyl(0.04, 0.045, 0.48, stone, x, Y + 0.06, 0.26, 10), box(0.09, 0.03, 0.09, stone, x, Y + 0.06, 0.26), box(0.1, 0.03, 0.1, stone, x, Y + 0.51, 0.26));
      }
      add(box(1.24, 0.06, 0.72, stone, cx, Y + 0.54, 0), box(1.1, 0.02, 0.006, glow(C.gold, 1), cx, Y + 0.56, 0.362));
      add(at(pediment(1.26, 0.26, 0.72, stone, Y + 0.6, 0.36), cx, Y + 0.6, -0.36));
      add(disc(0.07, 0.01, glow(C.gold, 1.2), cx, Y + 0.7, 0.362, 12));
      // Justice on the apex: a robed figure, blindfolded, holding the scales.
      const j = group(
        cyl(0.03, 0.06, 0.16, stone, 0, 0, 0, 8),
        ball(0.035, stone, 0, 0.2, 0, 1),
        box(0.075, 0.012, 0.03, matte(C.ink), 0, 0.2, 0.012),
        box(0.18, 0.008, 0.008, metal(C.gold, 0.25), 0, 0.24, 0),
        cyl(0.03, 0.02, 0.012, metal(C.gold, 0.25), -0.09, 0.19, 0, 8),
        cyl(0.03, 0.02, 0.012, metal(C.gold, 0.25), 0.09, 0.19, 0, 8),
        cyl(0.005, 0.005, 0.24, metal(C.gold, 0.25), 0, 0.04, 0.03, 4),
      );
      add(at(j, cx, Y + 0.86, 0.1));
      // The broadcast mast behind: tapering lattice, painted bands, an ON AIR sign, the dish (aims) and a beacon.
      const mx = 0.66;
      const mz = -0.2;
      const top = Y + 1.78;
      const lattice = metal("#5a5e63", 0.5);
      const corner = (sx: number, sz: number, y: number): [number, number, number] => {
        const s = 0.15 - ((y - Y) / (top - Y)) * 0.11;
        return [mx + sx * s, y, mz + sz * s];
      };
      const cs: Array<[number, number]> = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ];
      for (const [sx, sz] of cs) add(strut(corner(sx, sz, Y), corner(sx, sz, top), 0.014, lattice));
      for (let k = 1; k <= 7; k++) {
        const y = Y + k * 0.25;
        const m = k >= 5 ? (k % 2 ? matte("#c4433a") : matte("#f4ede1")) : lattice;
        for (let e = 0; e < 4; e++) {
          const [ax, az] = cs[e]!;
          const [bx2, bz] = cs[(e + 1) % 4]!;
          add(strut(corner(ax, az, y), corner(bx2, bz, y), 0.008, m, 4));
          if (k < 7) add(strut(corner(ax, az, y), corner(bx2, bz, y + 0.25), 0.005, lattice, 4));
        }
      }
      add(box(0.24, 0.09, 0.02, matte(C.ink), mx, Y + 1.0, mz + 0.105), box(0.2, 0.06, 0.006, glow("#ff3b30", 2.2), mx, Y + 1.015, mz + 0.117));
      add(box(0.14, 0.14, 0.12, matte("#8f969d", 0.7), mx, Y, mz - 0.02), box(0.04, 0.03, 0.005, glow("#bfe8ff", 1.2), mx, Y + 0.08, mz + 0.042));
      add(strut([mx - 0.08, Y + 1.2, mz], [cx + 0.4, Y + 0.7, -0.1], 0.006, matte(C.ink), 4));
      const turret = new THREE.Group();
      turret.position.set(mx, top, mz);
      const dish = mesh(geo("megaDish", () => new THREE.SphereGeometry(0.2, 14, 4, 0, Math.PI * 2, 0, Math.PI / 3)), metal("#d9dde2", 0.3), 0, 0, 0);
      dish.rotation.x = -Math.PI / 2;
      dish.position.z = 0.06;
      turret.add(dish, at(rot(cyl(0.008, 0.008, 0.2, iron(), 0, -0.1, 0, 4), Math.PI / 2), 0, 0, 0.12), ball(0.025, metal("#5a5e63"), 0, 0, 0.22, 0));
      turret.add(cyl(0.005, 0.005, 0.3, lattice, 0, 0.05, -0.04, 4));
      const lamp = ball(0.045, glow("#ff3b30", 3), 0, 0.14, -0.04, 1);
      turret.add(lamp);
      ud.light = lamp;
      add(turret);
      ud.turret = turret;
      break;
    }
    case "stormhive": {
      add(megaBase("#7a8a4a"));
      const white = matte(C.cream, 0.8);
      const H = 1.22;
      for (const m of [cyl(0.36, 0.38, 0.12, matte(C.stone, 0.95), 0, Y, 0, 8), cyl(0.2, 0.33, H - 0.12, white, 0, Y + 0.12, 0, 8), cyl(0.33, 0.34, 0.05, matte("#3a3430"), 0, Y + 0.12, 0, 8)])
        add(rot(m, 0, Math.PI / 8));
      add(box(0.12, 0.2, 0.02, matte(C.woodDark), 0, Y + 0.12, 0.31), cone(0.07, 0.05, matte(C.woodDark), 0, Y + 0.32, 0.31, 4));
      const rAt = (h: number) => (0.33 - 0.13 * ((h - 0.12) / (H - 0.12))) * Math.cos(Math.PI / 8);
      for (const [a, h] of [
        [0, 0.62],
        [0, 0.92],
        [Math.PI / 2, 0.75],
        [-Math.PI / 2, 0.5],
      ] as const)
        add(rot(box(0.05, 0.07, 0.02, glow("#ffd98a", 1.2), Math.sin(a) * rAt(h + 0.035), Y + h, Math.cos(a) * rAt(h + 0.035)), 0, a));
      // The gallery, with lanterns.
      const gy = Y + 0.38;
      add(cyl(0.44, 0.44, 0.025, matte(C.wood), 0, gy, 0, 16), ring(0.43, 0.009, matte(C.woodDark), 0, gy + 0.1, 0, 20));
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        add(box(0.014, 0.1, 0.014, matte(C.woodDark), Math.cos(a) * 0.43, gy, Math.sin(a) * 0.43));
      }
      add(lantern(0.3, gy + 0.1, 0.3), lantern(-0.3, gy + 0.1, 0.3));
      // Hives on stands either side, honey jars, flowers.
      const straw = matte("#d9a649");
      for (const sd of [-1, 1]) {
        const x = sd * 0.7;
        for (const dx of [-0.1, 0.1]) for (const dz of [-0.1, 0.1]) add(box(0.03, 0.1, 0.03, matte(C.woodDark), x + dx, Y, dz));
        add(box(0.28, 0.03, 0.28, matte(C.wood), x, Y + 0.1, 0));
        add(skep(0.16, 0.3, straw, Y + 0.13, x, 0));
        add(cyl(0.025, 0.025, 0.05, glow("#f2a516", 0.9), x + 0.1, Y + 0.13, 0.1, 8));
        for (let i = 0; i < 4; i++) add(onY(flower(x - 0.12 + i * 0.08, 0.3, BUNTING[i % BUNTING.length]!, 0.07)));
      }
      // The cap turns to the lane, carrying the honey-canvas sails (named "sails", spinning about local Z).
      const turret = new THREE.Group();
      turret.position.y = Y + H;
      turret.add(cyl(0.23, 0.22, 0.07, matte(C.woodDark), 0, 0, 0, 10));
      turret.add(scaled(mesh(geo("megaMillCap", () => new THREE.SphereGeometry(0.23, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2)), matte("#e0a83a", 0.8), 0, 0.07, 0), 1, 0.9, 1.15));
      turret.add(ball(0.03, metal(C.gold, 0.3), 0, 0.29, 0, 0));
      const tail = group(box(0.016, 0.016, 0.24, matte(C.woodDark), 0, 0, -0.12));
      for (let i = 0; i < 6; i++) {
        const pivot = group(bx(0.008, 0.1, 0.03, matte(i % 2 ? C.cream : "#e0a83a"), 0, 0.055, 0));
        pivot.rotation.z = (i * Math.PI) / 3;
        tail.add(at(pivot, 0, 0.008, -0.24));
      }
      turret.add(at(tail, 0, 0.12, -0.18));
      const sails = new THREE.Group();
      sails.name = "sails";
      sails.position.set(0, 0.1, 0.3);
      sails.add(rot(cyl(0.03, 0.035, 0.14, matte(C.woodDark), 0, -0.07, 0, 8), Math.PI / 2), disc(0.07, 0.03, glow("#ffb829", 1.6), 0, 0, 0.07, 6));
      const L = 0.74;
      const sw = 0.19;
      const frame = matte(C.woodDark);
      const honey = matte("#f2d27a", 0.9, false);
      for (let i = 0; i < 4; i++) {
        const arm = new THREE.Group();
        arm.rotation.z = (i * Math.PI) / 2;
        arm.add(box(0.035, L + 0.06, 0.03, frame, 0, -0.03, 0.04), box(0.014, L - 0.08, 0.016, frame, sw, 0.08, 0.04));
        for (let k = 0; k < 6; k++) arm.add(box(sw, 0.01, 0.012, frame, sw / 2, 0.1 + (k * (L - 0.12)) / 5, 0.04));
        arm.add(box(sw + 0.02, L - 0.08, 0.004, honey, sw / 2 + 0.005, 0.08, 0.03));
        arm.add(box(sw + 0.022, 0.04, 0.005, matte("#2b2320"), sw / 2 + 0.005, 0.3, 0.03), box(sw + 0.022, 0.04, 0.005, matte("#2b2320"), sw / 2 + 0.005, 0.55, 0.03));
        sails.add(arm);
      }
      turret.add(sails);
      ud.sails = sails;
      add(turret);
      ud.turret = turret;
      const bees = new THREE.Group();
      for (let i = 0; i < 8; i++) bees.add(ball(0.025, glow("#ffd23f", 1.2), 0, 0, 0, 0));
      bees.position.set(0, Y + 0.8, 0.12);
      add(bees);
      ud.bees = bees;
      break;
    }
    case "barrage": {
      add(megaBase("#6b5a3a"));
      add(box(1.8, 0.06, 0.86, matte(C.wood), 0, Y, 0));
      for (let i = 1; i < 7; i++) add(box(1.8, 0.004, 0.006, matte(C.woodDark), 0, Y + 0.06, -0.43 + i * 0.123));
      // A palisade of sharpened logs along the back.
      for (let i = 0; i < 17; i++) {
        const x = -0.82 + i * 0.1025;
        const h = 0.28 + (i % 3) * 0.04;
        add(cyl(0.04, 0.042, h, matte(i % 2 ? C.wood : "#7a4e2c"), x, Y + 0.06, -0.41, 7), cone(0.04, 0.07, matte("#c9a274"), x, Y + 0.06 + h, -0.41, 7));
      }
      add(box(1.74, 0.03, 0.02, matte(C.woodDark), 0, Y + 0.2, -0.37));
      // The battery: three cannons on a turntable (aims), a scarecrow crew behind.
      const bx0 = -0.32;
      add(cyl(0.38, 0.4, 0.05, matte(C.woodDark), bx0, Y + 0.06, 0.02, 14), ring(0.39, 0.012, iron(), bx0, Y + 0.11, 0.02, 24));
      const turret = new THREE.Group();
      turret.position.set(bx0, Y + 0.11, 0.02);
      turret.add(box(0.52, 0.08, 0.36, matte(C.wood), 0, 0, 0), box(0.54, 0.015, 0.38, iron(), 0, 0.08, 0));
      for (const sd of [-1, 1]) turret.add(cartWheel(0.12, sd * 0.29, 0.1, 0.06, C.woodDark));
      const barrel = new THREE.Group();
      barrel.name = "barrel";
      barrel.position.set(0, 0.17, 0.02);
      barrel.rotation.x = -0.5;
      const iron2 = metal("#3b3f44", 0.5);
      const brass = metal("#c9a14a", 0.3);
      for (const x of [-0.16, 0, 0.16]) {
        const l = mesh(barrelGeo(0.06, 0.42, false), iron2, x, 0, 0);
        l.rotation.x = Math.PI / 2;
        barrel.add(l, disc(0.036, 0.004, matte(C.ink), x, 0, 0.13), ball(0.022, iron2, x, 0, -0.065, 0));
        for (const t of [0.1, 0.45, 0.72]) barrel.add(torus(0.06 * (1 - 0.18 * t) + 0.004, 0.01, brass, x, 0, t * 0.42, 12));
        barrel.add(ball(0.016, glow("#ff9a3a", 2.5), x, 0.065, -0.03, 0));
        turret.add(box(0.03, 0.12, 0.1, matte(C.wood), x - 0.065, 0.06, 0.02), box(0.03, 0.12, 0.1, matte(C.wood), x + 0.065, 0.06, 0.02));
      }
      barrel.add(rot(cyl(0.016, 0.016, 0.48, iron(), 0, -0.24, 0, 6), 0, 0, Math.PI / 2));
      turret.add(barrel);
      ud.barrel = barrel;
      for (const sd of [-1, 1]) turret.add(at(strawman(sd < 0 ? "#c4433a" : "#3f6fb5", C.straw, 0.62), sd * 0.16, 0.08, -0.24));
      add(turret);
      ud.turret = turret;
      // A watchtower with a scarecrow lookout, a lantern and the battery's flag.
      const tx = 0.62;
      const tz = -0.06;
      const pr = 0.15;
      for (const [sx, sz] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ] as const)
        add(box(0.045, 1.4, 0.045, matte(C.woodDark), tx + sx * pr, Y + 0.06, tz + sz * pr));
      for (const sz of [-1, 1]) {
        add(strut([tx - pr, Y + 0.1, tz + sz * pr], [tx + pr, Y + 0.6, tz + sz * pr], 0.012, matte(C.wood)));
        add(strut([tx + pr, Y + 0.6, tz + sz * pr], [tx - pr, Y + 1.05, tz + sz * pr], 0.012, matte(C.wood)));
      }
      add(box(0.42, 0.04, 0.42, matte(C.wood), tx, Y + 1.06, tz));
      for (const sz of [-1, 1]) add(box(0.42, 0.02, 0.02, matte(C.woodDark), tx, Y + 1.18, tz + sz * 0.2), box(0.02, 0.02, 0.42, matte(C.woodDark), tx + sz * 0.2, Y + 1.18, tz));
      add(rot(cone(0.32, 0.26, matte("#7a4e2c"), tx, Y + 1.46, tz, 4), 0, Math.PI / 4));
      // Ladder up the front.
      for (const dx of [-0.05, 0.05]) add(box(0.014, 1.06, 0.014, matte(C.wood), tx + dx, Y + 0.06, tz + pr + 0.03));
      for (let i = 0; i < 9; i++) add(box(0.1, 0.012, 0.012, matte(C.wood), tx, Y + 0.14 + i * 0.11, tz + pr + 0.03));
      const look = strawman("#5d7a3a", C.straw, 0.6);
      look.add(rot(cyl(0.014, 0.02, 0.12, metal("#c9a14a", 0.3), 0.06, 0.38, 0.0, 6), Math.PI / 2 - 0.2));
      add(at(look, tx - 0.06, Y + 1.1, tz));
      add(lantern(tx + 0.12, Y + 1.25, tz + 0.12, "#ffcf6a", 1.3));
      const p = pennant("#c4433a", tx, Y + 1.72, tz, 0.3, 0.16);
      add(p);
      ud.flag = p.userData.flag as THREE.Object3D;
      // Ammunition: sacks of seed potatoes, a heap of spuds, a crate of turnips.
      for (const sk of [sack(0.18, 0.3, 1.1, "#b89a6a", 0.1), sack(0.3, 0.33, 0.95, "#a88a5a", -0.15), sack(0.06, 0.34, 0.9)]) add(sk);
      root.children.slice(-3).forEach((c) => (c.position.y = Y + 0.06));
      const spud = matte("#b08a5a", 0.9);
      for (let i = 0; i < 9; i++) {
        const a = i * 1.7;
        const r = (i % 3) * 0.03;
        add(scaled(ball(0.026, spud, 0.25 + Math.cos(a) * r, Y + 0.085 + (i > 5 ? 0.035 : 0), 0.12 + Math.sin(a) * r, 0), 1.2, 0.9, 1));
      }
      add(at(crate(0, 0, 0.11, "#d8c8e8", 0.3), 0.82, Y + 0.06, 0.25));
      break;
    }
    case "sanctuary": {
      add(megaBase("#7a9a6a"));
      // The pond, on the +x side, with ducks, lilies and reeds.
      const px = 0.5;
      add(cyl(0.42, 0.44, 0.05, matte(C.stoneDark, 0.95), px, Y, 0, 18), cyl(0.37, 0.37, 0.02, gloss(C.water, 0.1), px, Y + 0.04, 0, 20));
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const s = mesh(geo("rock05", () => new THREE.DodecahedronGeometry(0.05, 0)), matte(i % 2 ? C.stone : "#b3aa97", 0.95), px + Math.cos(a) * 0.4, Y + 0.06, Math.sin(a) * 0.4);
        s.scale.set(1, 0.6, 1);
        s.rotation.y = i;
        add(s);
      }
      add(onY(reeds(px + 0.28, -0.22, 4)), onY(reeds(px + 0.3, 0.2, 3, 0.18)));
      add(lily(px - 0.1, Y + 0.062, 0.22, 0.06, true), lily(px + 0.18, Y + 0.062, -0.05, 0.05, true), lily(px - 0.05, Y + 0.062, -0.24, 0.055));
      const ducks = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const d = duck(i === 0);
        d.userData.phase = i * 2.1;
        ducks.add(d);
      }
      ducks.position.set(px, Y + 0.02, 0);
      add(ducks);
      ud.ducks = ducks;
      // A jetty from the hospital into the water.
      for (let i = 0; i < 4; i++) add(box(0.075, 0.016, 0.18, matte(i % 2 ? C.wood : "#9a6a40"), 0.02 + i * 0.08, Y + 0.07, 0.25));
      for (const x of [0.06, 0.26]) add(cyl(0.012, 0.012, 0.1, matte(C.woodDark), x, Y, 0.33, 5));
      // The field hospital marquee, on the -x side: walls, a pitched canvas roof, two peaks on poles.
      const tx = -0.45;
      const canvas = matte("#fffbe6");
      const canvas2 = matte("#f2e6c8");
      add(box(0.8, 0.3, 0.66, canvas, tx, Y, 0));
      add(at(pitchedRoof(0.8, 0.66, 0.26, canvas2, Y + 0.3, canvas, matte(C.woodDark)), tx, 0, 0));
      for (let i = 0; i < 8; i++) add(box(0.1, 0.05, 0.008, matte(i % 2 ? "#3fbf8a" : C.cream), tx - 0.35 + i * 0.1, Y + 0.25, 0.36));
      for (const dx of [-0.24, 0.24]) {
        add(cone(0.11, 0.24, canvas2, tx + dx, Y + 0.5, 0, 8), pennant(dx < 0 ? "#3fbf8a" : C.cream, tx + dx, Y + 0.72, 0, 0.45, 0.12));
      }
      add(box(0.18, 0.24, 0.01, matte("#4a3e2e"), tx, Y, 0.332));
      add(box(0.05, 0.16, 0.01, glow("#3fbf8a", 1.6), tx, Y + 0.32, 0.25), box(0.16, 0.05, 0.01, glow("#3fbf8a", 1.6), tx, Y + 0.375, 0.25));
      for (const dx of [-0.26, 0.26]) add(box(0.1, 0.08, 0.008, glow("#ffe6a0", 1), tx + dx, Y + 0.12, 0.332));
      add(onY(lampPost(tx - 0.15, 0.42, 0.3, "#ffe6a0")), onY(lampPost(tx + 0.15, 0.42, 0.3, "#ffe6a0")));
      // Supplies and a herb garden behind the tent.
      const aid = crate(-0.86, 0.15, 0.1, undefined, 0.2);
      aid.add(box(0.03, 0.06, 0.004, glow("#3fbf8a", 0.8), 0, 0.02, 0.052), box(0.06, 0.02, 0.004, glow("#3fbf8a", 0.8), 0, 0.04, 0.052));
      add(at(aid, -0.86, Y, 0.15));
      for (let i = 0; i < 6; i++) add(ball(0.035, matte(i % 2 ? C.leafLight : C.leaf), -0.75 + i * 0.12, Y + 0.03, -0.4, 0));
      // The flagpole with the green-cross banner.
      add(cyl(0.015, 0.02, 1.7, matte("#f4ede1"), 0.05, Y, -0.36, 6), ball(0.03, metal(C.gold, 0.25), 0.05, Y + 1.72, -0.36, 0));
      const flag = group(box(0.3, 0.2, 0.01, matte(C.cream, 0.8), 0.16, -0.1, 0), box(0.05, 0.14, 0.012, glow("#3fbf8a", 1.4), 0.16, -0.07, 0), box(0.14, 0.05, 0.012, glow("#3fbf8a", 1.4), 0.16, -0.025, 0));
      add(at(flag, 0.05, Y + 1.66, -0.36));
      ud.flag = flag;
      break;
    }
  }
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  bake(root);
  root.userData.mega = id;
  return root;
}
