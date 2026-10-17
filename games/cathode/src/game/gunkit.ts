// The weapon kit (S2.1): primitives (side-profile extrudes with cut-outs, lathes, rounded boxes), finishes,
// and a builder that merges every piece by (moving part x material layer) so a whole gun is a handful of draw
// calls. One shared opaque material reads colour, metalness, roughness, clearcoat and sheen per vertex, and
// samples the trim atlas (render/guntex.ts) for stipple, serrations, knurling, grain and the engraving, with
// edge wear on bevels. No CSG: cut-outs are `Shape.holes`.
//
// Geometry builds in Node (tests count triangles and draw calls); the atlas and the shader only matter in the
// browser.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries, toCreasedNormals } from "three/addons/utils/BufferGeometryUtils.js";
import { ATLAS_MM, BANDS, trimAtlas, type BandName } from "../render/guntex";

/** A surface: base colour (sRGB hex), PBR numbers, and which trim band it samples. */
export interface Finish {
  color: number;
  metal: number;
  rough: number;
  /** Clearcoat weight 0..1 (desktop only). */
  coat?: number;
  /** Sheen weight 0..1 (desktop only: leather, fabric). */
  sheen?: number;
  band?: BandName;
  /** Tiles per physical tile (2 = the pattern half size). */
  scale?: number;
  /** Edge-wear weight 0..1 (default 1 on metal, 0.4 otherwise). */
  wear?: number;
}

/** A self-lit surface (tritium, trim, the red dot): colour times intensity goes into the HDR buffer. */
export interface Emit {
  emit: number;
  intensity: number;
}

export type Surface = Finish | Emit | "glass";
export type Layer = "opaque" | "emissive" | "glass";

/** The S2.1 finishes, plus Cath's sleeve and gloves. */
export const FIN = {
  frame: { color: 0x1b1c1f, metal: 0, rough: 0.62, band: "grain", wear: 0.5 },
  grip: { color: 0x1b1c1f, metal: 0, rough: 0.7, band: "stipple", wear: 0.3 },
  slide: { color: 0x2a2c30, metal: 1, rough: 0.34, coat: 1, band: "peel" },
  serration: { color: 0x2a2c30, metal: 1, rough: 0.34, coat: 1, band: "serration" },
  /** Twice the slide's colour, halved by the band off the letters: the cuts show bare steel at up to 2x. */
  engraving: { color: 0x54585f, metal: 1, rough: 0.34, coat: 1, band: "engraving", wear: 0.2 },
  faction: { color: 0x1b1c1f, metal: 0, rough: 0.6, band: "faction", wear: 0 },
  bronze: { color: 0x8a6a3c, metal: 1, rough: 0.28, band: "brushed" },
  pins: { color: 0x9aa0a6, metal: 1, rough: 0.4, band: "brushed" },
  /** Small machined controls (hammer, trigger, slide stop): blued steel, a step brighter than the slide. */
  control: { color: 0x34373d, metal: 1, rough: 0.36, coat: 0.4, band: "brushed" },
  can: { color: 0x202226, metal: 0.85, rough: 0.46, coat: 0.5, band: "peel" },
  knurl: { color: 0x202226, metal: 0.85, rough: 0.5, band: "knurl" },
  bore: { color: 0x050506, metal: 0.6, rough: 0.6, wear: 0 },
  brass: { color: 0xb08d3c, metal: 1, rough: 0.3, band: "brushed" },
  housing: { color: 0x1f2125, metal: 0.9, rough: 0.38, coat: 0.6, band: "peel" },
  /** S2.1: black leather, #141214, roughness 0.45, sheen 0.4 (a thin clearcoat for the grain's sheen on desktop). */
  glove: { color: 0x141214, metal: 0, rough: 0.45, sheen: 0.4, coat: 0.12, band: "leather", scale: 3, wear: 0.2 },
  gloveSeam: { color: 0x070606, metal: 0, rough: 0.55, sheen: 0.2, band: "leather", wear: 0 },
  sleeve: { color: 0x1d1e22, metal: 0, rough: 0.86, sheen: 0.06, band: "nylon", wear: 0 },
  silk: { color: 0xe9e1d2, metal: 0, rough: 0.48, sheen: 0.4, band: "grain", wear: 0 },
  pearl: { color: 0xf4efe6, metal: 0.05, rough: 0.18, coat: 1, wear: 0 },
  gold: { color: 0xc9a25a, metal: 1, rough: 0.25, wear: 0 },
} satisfies Record<string, Finish>;

export const GLOW = {
  tritium: { emit: 0x7dffb2, intensity: 3 },
  trim: { emit: 0x3fe0ff, intensity: 1.2 },
  dot: { emit: 0xff2a47, intensity: 9 },
} satisfies Record<string, Emit>;

const isEmit = (s: Surface): s is Emit => typeof s === "object" && "emit" in s;
const layerOf = (s: Surface): Layer => (s === "glass" ? "glass" : isEmit(s) ? "emissive" : "opaque");

// ---- Primitives ---------------------------------------------------------------------------------------

export type P2 = [number, number];

/** Points on an arc (centre, radius, start and end angle in radians), for profiles. */
export function arc(cx: number, cy: number, r: number, a0: number, a1: number, n = 4): P2[] {
  const out: P2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

/** Per-vertex edge factor from normals in the primitive's own frame: 1 on a 45° bevel, 0 on a flat face. */
function edgeFromNormals(g: THREE.BufferGeometry, lathe = false): Float32Array {
  const n = g.getAttribute("normal") as THREE.BufferAttribute;
  const out = new Float32Array(n.count);
  for (let i = 0; i < n.count; i++) {
    const x = Math.abs(n.getX(i));
    const y = Math.abs(n.getY(i));
    const z = Math.abs(n.getZ(i));
    const m = lathe ? Math.max(y, Math.hypot(x, z)) : Math.max(x, y, z);
    out[i] = THREE.MathUtils.smoothstep(1 - m, 0.04, 0.22);
  }
  return out;
}

export interface KitGeo {
  geo: THREE.BufferGeometry;
}

/**
 * A side silhouette (points are [z, y] in gun space: -z is the muzzle), extruded `width` across X and centred,
 * with a `bevel` (m) on every edge. `holes` are cut-outs (the trigger guard's loop, lightening cuts).
 */
export function profile(pts: P2[], width: number, opts: { bevel?: number; holes?: P2[][]; phone?: boolean; curve?: number; lod?: boolean } = {}): THREE.BufferGeometry {
  // A distant (LOD1) world gun: no bevels, no cut-outs.
  const b = opts.lod ? 0 : Math.min(opts.bevel ?? 0.0008, width * 0.3);
  const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  if (!opts.lod) for (const h of opts.holes ?? []) shape.holes.push(new THREE.Path(h.map(([z, y]) => new THREE.Vector2(z, y))));
  const depth = Math.max(1e-4, width - 2 * b);
  let g: THREE.BufferGeometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b,
    bevelOffset: -b,
    bevelSegments: opts.phone ? 1 : 2,
    curveSegments: opts.curve ?? 4,
  });
  g.translate(0, 0, -depth / 2);
  g.rotateY(-Math.PI / 2);
  g.deleteAttribute("uv");
  g = toCreasedNormals(g, 0.9);
  g.userData.edge = edgeFromNormals(g);
  return g;
}

/**
 * A plan silhouette (points are [x, z] seen from above), extruded `height` up Y and centred on y = 0. Used for
 * slide serrations (teeth on the outline) and anything whose detail reads from above.
 */
export function plan(pts: P2[], height: number, opts: { bevel?: number; phone?: boolean; lod?: boolean } = {}): THREE.BufferGeometry {
  const b = opts.lod ? 0 : Math.min(opts.bevel ?? 0.0005, height * 0.3);
  const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z)));
  const depth = Math.max(1e-4, height - 2 * b);
  let g: THREE.BufferGeometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: opts.phone ? 1 : 2, curveSegments: 3 });
  // Shape (x, y) -> gun (x, z); extrusion -> +y.
  g.translate(0, 0, -depth / 2);
  g.rotateX(Math.PI / 2);
  g.scale(1, -1, 1);
  // The mirror flips the winding: put it back.
  flipWinding(g);
  g.deleteAttribute("uv");
  g = toCreasedNormals(g, 0.9);
  g.userData.edge = edgeFromNormals(g);
  return g;
}

function flipWinding(g: THREE.BufferGeometry): void {
  if (g.index) {
    const a = g.index.array as Uint16Array | Uint32Array;
    for (let i = 0; i < a.length; i += 3) {
      const t = a[i]!;
      a[i] = a[i + 2]!;
      a[i + 2] = t;
    }
    g.index.needsUpdate = true;
    return;
  }
  for (const name of Object.keys(g.attributes)) {
    const at = g.getAttribute(name) as THREE.BufferAttribute;
    const s = at.itemSize;
    const arr = at.array as Float32Array;
    for (let i = 0; i < at.count; i += 3) {
      for (let k = 0; k < s; k++) {
        const t = arr[i * s + k]!;
        arr[i * s + k] = arr[(i + 2) * s + k]!;
        arr[(i + 2) * s + k] = t;
      }
    }
    at.needsUpdate = true;
  }
}

/** A front silhouette (points are [x, y] seen from behind the gun), extruded `depth` along Z and centred. */
export function facade(pts: P2[], depth: number, opts: { bevel?: number; holes?: P2[][]; phone?: boolean; curve?: number; lod?: boolean } = {}): THREE.BufferGeometry {
  const b = opts.lod ? 0 : Math.min(opts.bevel ?? 0.0006, depth * 0.3);
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  if (!opts.lod) for (const h of opts.holes ?? []) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  const d = Math.max(1e-4, depth - 2 * b);
  let g: THREE.BufferGeometry = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: opts.phone ? 1 : 2, curveSegments: opts.curve ?? 5 });
  g.translate(0, 0, -d / 2);
  g.deleteAttribute("uv");
  g = toCreasedNormals(g, 0.9);
  g.userData.edge = edgeFromNormals(g);
  return g;
}

/**
 * A hand's grip frame (an empty whose frame is the wrist's: Y toward the knuckles, Z the back of the hand) for a
 * fist closed round a rod: `rod` a point on the rod's axis where the middle finger wraps, `toButt` the rod's
 * direction toward the little finger, `dorsal` roughly where the back of the hand faces, `rodR` the rod's
 * radius. `side` 1 right hand, -1 left.
 */
export function fistGrip(rod: THREE.Vector3, toButt: THREE.Vector3, dorsal: THREE.Vector3, rodR: number, side: 1 | -1, reach = 0.07): { pos: THREE.Vector3; quat: THREE.Quaternion } {
  const x = toButt.clone().normalize().multiplyScalar(side);
  const y = new THREE.Vector3().crossVectors(dorsal, x).normalize();
  const z = new THREE.Vector3().crossVectors(x, y).normalize();
  const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  const pos = rod.clone().addScaledVector(y, -reach).addScaledVector(z, 0.013 + rodR);
  return { pos, quat };
}

/** A wrist frame from the wrist's position, the direction to the knuckles and roughly where the back of the hand faces. */
export function gripFrame(wrist: THREE.Vector3, toKnuckles: THREE.Vector3, dorsal: THREE.Vector3): { pos: THREE.Vector3; quat: THREE.Quaternion } {
  const y = toKnuckles.clone().normalize();
  const z = dorsal.clone().addScaledVector(y, -dorsal.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  return { pos: wrist.clone(), quat: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)) };
}

/** A turned part along the gun's Z axis: `rz` is [radius, z] from the back (larger z) to the front. */
export function lathe(rz: P2[], opts: { seg?: number; phone?: boolean } = {}): THREE.BufferGeometry {
  const seg = opts.seg ?? (opts.phone ? 12 : 24);
  // Lathe revolves (r, h) around Y; h = -z, so after turning Y onto -Z... rotateX(-90°) maps y -> z' = -y.
  const pts = rz.map(([r, z]) => new THREE.Vector2(Math.max(0, r), -z));
  let g: THREE.BufferGeometry = new THREE.LatheGeometry(pts, seg);
  g.deleteAttribute("uv");
  g = toCreasedNormals(g, 0.75);
  g.userData.edge = edgeFromNormals(g, true);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** A rounded box. */
export function rounded(w: number, h: number, d: number, r: number, phone = false): THREE.BufferGeometry {
  let g: THREE.BufferGeometry = new RoundedBoxGeometry(w, h, d, phone ? 1 : 2, Math.min(r, w / 2, h / 2, d / 2));
  g.deleteAttribute("uv");
  if (g.index) g = g.toNonIndexed();
  g.userData.edge = edgeFromNormals(g);
  return g;
}

/** A capsule-ish tapered tube along +Y from 0 to `len` (fingers, forearms): r0 at the base, r1 at the tip. */
export function tube(len: number, r0: number, r1: number, opts: { seg?: number; caps?: boolean; phone?: boolean } = {}): THREE.BufferGeometry {
  const seg = opts.seg ?? (opts.phone ? 8 : 14);
  const pts: THREE.Vector2[] = [];
  const caps = opts.caps ?? true;
  const cs = opts.phone ? 2 : 4;
  if (caps) for (let i = 0; i <= cs; i++) {
    const a = -Math.PI / 2 + (i / cs) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.cos(a) * r0, Math.sin(a) * r0 + r0 * 0.6));
  }
  else pts.push(new THREE.Vector2(r0, 0));
  pts.push(new THREE.Vector2(r1, len - (caps ? r1 * 0.6 : 0)));
  if (caps) for (let i = 1; i <= cs; i++) {
    const a = (i / cs) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.cos(a) * r1, len - r1 * 0.6 + Math.sin(a) * r1));
  }
  let g: THREE.BufferGeometry = new THREE.LatheGeometry(pts, seg);
  g.deleteAttribute("uv");
  g = toCreasedNormals(g, 1.3);
  g.userData.edge = new Float32Array(g.getAttribute("position").count);
  return g;
}

export function sphere(r: number, phone = false): THREE.BufferGeometry {
  let g: THREE.BufferGeometry = new THREE.SphereGeometry(r, phone ? 8 : 12, phone ? 6 : 8);
  g.deleteAttribute("uv");
  if (g.index) g = g.toNonIndexed();
  g.userData.edge = new Float32Array(g.getAttribute("position").count);
  return g;
}

/** A flat quad facing +X (a decal on a flank): `len` along Z, `h` along Y, UVs 0..1 once (the engraving). */
export function decal(len: number, h: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(len, h).toNonIndexed();
  g.rotateY(Math.PI / 2);
  // Inset from the band's edges: v = 1 would wrap to the band's first row.
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), 0.004 + uv.getY(i) * 0.992);
  g.userData.edge = new Float32Array(g.getAttribute("position").count);
  // Keep its own UVs: u runs muzzle-ward (-Z) so the text reads from the left flank when mirrored.
  g.userData.ownUv = true;
  return g;
}

// ---- Preparing and merging ----------------------------------------------------------------------------

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3(1, 1, 1);
const _c = new THREE.Color();

/** A transform for `add`: position and XYZ rotation (radians), optional scale. */
export interface Place {
  p?: [number, number, number];
  r?: [number, number, number];
  s?: [number, number, number];
}

export function placeMatrix(pl: Place | undefined, out = new THREE.Matrix4()): THREE.Matrix4 {
  if (!pl) return out.identity();
  _e.set(pl.r?.[0] ?? 0, pl.r?.[1] ?? 0, pl.r?.[2] ?? 0);
  _q.setFromEuler(_e);
  _s.set(pl.s?.[0] ?? 1, pl.s?.[1] ?? 1, pl.s?.[2] ?? 1);
  return out.compose(new THREE.Vector3(pl.p?.[0] ?? 0, pl.p?.[1] ?? 0, pl.p?.[2] ?? 0), _q, _s);
}

/**
 * Bakes a piece for merging: transforms it into its part's space, then writes the attributes every kit mesh
 * shares (colour, aMR = metal/rough/coat/sheen, aEdge, aBand, aUvT box-projected in atlas tiles).
 */
export function bake(src: THREE.BufferGeometry, surf: Surface, m: THREE.Matrix4): THREE.BufferGeometry {
  const g = src.index ? src.toNonIndexed() : src.clone();
  const edge0 = (src.userData.edge as Float32Array | undefined) ?? null;
  const ownUv = !!src.userData.ownUv && g.getAttribute("uv");
  const uv0 = ownUv ? (g.getAttribute("uv") as THREE.BufferAttribute).clone() : null;
  if (src.index && edge0) {
    // toNonIndexed expands vertices: expand the edge list the same way.
    const idx = src.index.array;
    const e = new Float32Array(idx.length);
    for (let i = 0; i < idx.length; i++) e[i] = edge0[idx[i]!]!;
    g.userData.edge = e;
  } else g.userData.edge = edge0;
  for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal") g.deleteAttribute(name);
  g.morphAttributes = {};
  if (!g.getAttribute("normal")) g.computeVertexNormals();
  g.applyMatrix4(m);
  if (m.determinant() < 0) flipWinding(g);
  const n = g.getAttribute("position").count;
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const nor = g.getAttribute("normal") as THREE.BufferAttribute;
  const col = new Float32Array(n * 3);
  const mr = new Float32Array(n * 4);
  const edge = new Float32Array(n);
  const band = new Float32Array(n * 2);
  const uvt = new Float32Array(n * 2);
  const layer = layerOf(surf);
  const fin = layer === "opaque" ? (surf as Finish) : null;
  if (layer === "emissive") {
    const em = surf as Emit;
    _c.set(em.emit).multiplyScalar(em.intensity);
  } else if (fin) _c.set(fin.color);
  else _c.set(0xffffff);
  const wear = fin ? (fin.wear ?? (fin.metal > 0.5 ? 1 : 0.4)) : 0;
  const b = BANDS[fin?.band ?? "flat"];
  const sc = fin?.scale ?? 1;
  const e0 = g.userData.edge as Float32Array | null;
  for (let i = 0; i < n; i++) {
    col[i * 3] = _c.r;
    col[i * 3 + 1] = _c.g;
    col[i * 3 + 2] = _c.b;
    if (fin) {
      mr[i * 4] = fin.metal;
      mr[i * 4 + 1] = fin.rough;
      mr[i * 4 + 2] = fin.coat ?? 0;
      mr[i * 4 + 3] = fin.sheen ?? 0;
    }
    edge[i] = (e0?.[i] ?? 0) * wear;
    band[i * 2] = b.v0;
    band[i * 2 + 1] = b.vh;
    if (uv0) {
      uvt[i * 2] = uv0.getX(i);
      uvt[i * 2 + 1] = uv0.getY(i);
      continue;
    }
    // Box projection in mm: the dominant normal axis picks the plane.
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    const x = pos.getX(i) * 1000;
    const y = pos.getY(i) * 1000;
    const z = pos.getZ(i) * 1000;
    let u: number;
    let v: number;
    if (ax >= ay && ax >= az) {
      u = z;
      v = y;
    } else if (ay >= az) {
      u = z;
      v = x;
    } else {
      u = x;
      v = y;
    }
    uvt[i * 2] = (u / ATLAS_MM) * sc;
    uvt[i * 2 + 1] = (v / b.mmH) * sc;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("aMR", new THREE.BufferAttribute(mr, 4));
  g.setAttribute("aEdge", new THREE.BufferAttribute(edge, 1));
  g.setAttribute("aBand", new THREE.BufferAttribute(band, 2));
  g.setAttribute("aUvT", new THREE.BufferAttribute(uvt, 2));
  g.userData = {};
  return g;
}

// ---- Materials ----------------------------------------------------------------------------------------

export interface KitMaterials {
  opaque: THREE.MeshStandardMaterial;
  emissive: THREE.MeshBasicMaterial;
  glass: THREE.MeshPhysicalMaterial | null;
}

const MATS: Partial<Record<"desktop" | "phone", KitMaterials>> = {};

/** The kit's three materials for a profile, built once. */
export function kitMaterials(phone = false): KitMaterials {
  const key = phone ? "phone" : "desktop";
  const have = MATS[key];
  if (have) return have;
  const opaque = phone
    ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1 })
    : new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 1, metalness: 1, clearcoat: 0.3, clearcoatRoughness: 0.22, sheen: 0.25, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xd8d0cc) });
  patchKitMaterial(opaque, phone);
  // Phone grades 1.26x brighter and blooms at half resolution: its self-lit parts (tritium, trim, the dot) run
  // at 60% so the rear sight reads as two dots, not a glowing green block.
  const emissive = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: true, color: new THREE.Color().setScalar(phone ? 0.6 : 1) });
  const glass = phone ? null : new THREE.MeshPhysicalMaterial({ color: 0x9fd8ff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.25, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.03 });
  const m: KitMaterials = { opaque, emissive, glass };
  MATS[key] = m;
  return m;
}

/**
 * Injects the per-vertex PBR, the trim atlas and edge wear into a standard/physical material. Shared by the
 * guns and Cath's arms (skinning comes from three's own chunks).
 */
export function patchKitMaterial(mat: THREE.MeshStandardMaterial, phone: boolean): void {
  const uniforms = { uTrim: { value: typeof document === "undefined" ? null : trimAtlas(phone ? 512 : 1024) } };
  mat.userData.kit = true;
  mat.customProgramCacheKey = () => `gunkit-${phone ? "p" : "d"}`;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTrim = uniforms.uTrim;
    sh.uniforms.gkSize = { value: phone ? 512 : 1024 };
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute vec4 aMR; attribute float aEdge; attribute vec2 aBand; attribute vec2 aUvT;
varying vec4 vMR; varying float vEdge; varying vec2 vBand; varying vec2 vUvT; varying vec3 vLocal;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vMR = aMR; vEdge = aEdge; vBand = aBand; vUvT = aUvT; vLocal = position;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform sampler2D uTrim;
uniform float gkSize;
varying vec4 vMR; varying float vEdge; varying vec2 vBand; varying vec2 vUvT; varying vec3 vLocal;
float gkHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float gkNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(gkHash(i), gkHash(i + vec3(1,0,0)), f.x), mix(gkHash(i + vec3(0,1,0)), gkHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(gkHash(i + vec3(0,0,1)), gkHash(i + vec3(1,0,1)), f.x), mix(gkHash(i + vec3(0,1,1)), gkHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
vec2 gkUv = vec2(vUvT.x, vBand.x + fract(vUvT.y) * vBand.y);
// Mip selection from the unwrapped coordinates, so the band seam doesn't pick the smallest mip.
vec4 gkT = textureGrad(uTrim, gkUv, dFdx(vec2(vUvT.x, vUvT.y * vBand.y)), dFdy(vec2(vUvT.x, vUvT.y * vBand.y)));
diffuseColor.rgb *= gkT.b * 2.0;
float gkN = gkNoise(vLocal * 260.0) * 0.6 + gkNoise(vLocal * 900.0) * 0.4;
float gkWear = smoothstep(0.5, 0.6, vEdge * (0.55 + gkN * 0.75));
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.25 + vec3(0.035), gkWear * step(0.5, vMR.x));
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.25, gkWear * (1.0 - step(0.5, vMR.x)));`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `float gkF2 = max(length(dFdx(vUvT)), length(dFdy(vUvT))) * 1024.0;
float roughnessFactor = clamp(vMR.y + (gkT.a - 0.5) - gkWear * 0.2 + clamp((gkF2 - 2.0) * 0.02, 0.0, 0.15), 0.04, 1.0);`,
      )
      .replace("#include <metalnessmap_fragment>", "float metalnessFactor = vMR.x;")
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
{
  vec3 q0 = dFdx(-vViewPosition); vec3 q1 = dFdy(-vViewPosition);
  vec2 st = vec2(vUvT.x, vUvT.y * vBand.y);
  vec2 st0 = dFdx(st); vec2 st1 = dFdy(st);
  vec3 N = normal;
  vec3 q1perp = cross(q1, N); vec3 q0perp = cross(N, q0);
  vec3 T = q1perp * st0.x + q0perp * st1.x;
  vec3 B = q1perp * st0.y + q0perp * st1.y;
  float det = max(dot(T, T), dot(B, B));
  float sc = det == 0.0 ? 0.0 : inversesqrt(det);
  // Specular anti-aliasing: when a pixel covers several atlas texels the detail flattens out instead of
  // sparkling (small phone render targets, a gun seen from afar).
  float gkFoot = max(length(st0), length(st1)) * gkSize;
  float gkFade = clamp(1.6 / max(gkFoot, 1.0), 0.0, 1.0);
  vec3 mapN = vec3((gkT.rg * 2.0 - 1.0) * gkFade, 0.0);
  mapN.z = sqrt(max(0.0, 1.0 - dot(mapN.xy, mapN.xy)));
  normal = normalize(T * (mapN.x * sc) + B * (mapN.y * sc) + N * mapN.z);
}`,
      )
      .replace(
        "#include <lights_physical_fragment>",
        `#include <lights_physical_fragment>
${phone ? `// Phone: the frame is graded 1.26x brighter and has no sheen or clearcoat lobes, so a dielectric's broad
// specular (leather, gabardine, polymer) would wash grey; damp it so black gloves stay black (C4).
material.specularColor *= mix(0.45, 1.0, step(0.5, vMR.x));
material.specularF90 *= mix(0.45, 1.0, step(0.5, vMR.x));` : ""}
#ifdef USE_CLEARCOAT
material.clearcoat *= vMR.z;
#endif
#ifdef USE_SHEEN
// Sheen is a fuzz lobe tinted by the cloth: on black leather a full-strength pale sheen washes the glove grey
// (C4 review), so dark finishes keep a tenth of it.
material.sheenColor *= vMR.w * mix(0.1, 1.0, clamp(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)) * 8.0, 0.0, 1.0));
#endif`,
      );
  };
}

// ---- The builder --------------------------------------------------------------------------------------

/**
 * Collects pieces per moving part, then merges each part's pieces by layer. `parts` are the named nodes
 * (moving parts and empties) tests and animation look up.
 */
export class GunKit {
  readonly parts: Record<string, THREE.Object3D> = {};
  private readonly buckets = new Map<THREE.Object3D, Record<Layer, THREE.BufferGeometry[]>>();
  private readonly pm = new THREE.Matrix4();

  constructor(
    readonly root: THREE.Object3D,
    readonly phone = false,
  ) {}

  /** A moving part (its own merged meshes), at `p` inside `parent` (default the root). */
  part(name: string, p: [number, number, number] = [0, 0, 0], parent: THREE.Object3D = this.root): THREE.Group {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(...p);
    parent.add(g);
    this.parts[name] = g;
    return g;
  }

  /** A named empty (muzzle, port, gripR...). */
  empty(name: string, p: [number, number, number], parent: THREE.Object3D = this.root, q?: THREE.Quaternion): THREE.Object3D {
    const o = new THREE.Object3D();
    o.name = name;
    o.position.set(...p);
    if (q) o.quaternion.copy(q);
    parent.add(o);
    this.parts[name] = o;
    return o;
  }

  /** Adds a piece to `part` (a node or a part name; default the root). Phone skips glass. */
  add(geo: THREE.BufferGeometry, surf: Surface, pl?: Place, part: THREE.Object3D | string = this.root): void {
    const node = typeof part === "string" ? this.parts[part] ?? this.part(part) : part;
    const layer = layerOf(surf);
    if (layer === "glass" && this.phone) return;
    let b = this.buckets.get(node);
    if (!b) {
      b = { opaque: [], emissive: [], glass: [] };
      this.buckets.set(node, b);
    }
    b[layer].push(bake(geo, surf, placeMatrix(pl, this.pm)));
  }

  /** Adds a geometry already in `node`'s space with a matrix (the old-builder adapter). */
  addBaked(node: THREE.Object3D, geo: THREE.BufferGeometry, surf: Surface, m: THREE.Matrix4): void {
    const layer = layerOf(surf);
    if (layer === "glass" && this.phone) return;
    let b = this.buckets.get(node);
    if (!b) {
      b = { opaque: [], emissive: [], glass: [] };
      this.buckets.set(node, b);
    }
    b[layer].push(bake(geo, surf, m));
  }

  /** Merges every part's pieces: one mesh per (part x layer). */
  finish(): void {
    const mats = kitMaterials(this.phone);
    for (const [node, b] of this.buckets) {
      for (const layer of ["opaque", "emissive", "glass"] as Layer[]) {
        const list = b[layer];
        if (!list.length) continue;
        const merged = mergeGeometries(list, false);
        if (!merged) continue;
        merged.computeBoundingSphere();
        const mat = layer === "opaque" ? mats.opaque : layer === "emissive" ? mats.emissive : mats.glass!;
        const mesh = new THREE.Mesh(merged, mat);
        mesh.name = `${node.name || "root"}:${layer}`;
        mesh.userData.kit = layer;
        if (layer === "glass") mesh.renderOrder = 2;
        node.add(mesh);
      }
    }
    this.buckets.clear();
  }
}

/**
 * Folds an older hand-built rig (meshes with their own standard materials) into kit meshes: every mesh is
 * baked into its nearest moving-part ancestor (`movers`, or the root) with a finish read off its material, so
 * the rig drops to a few draw calls and shares the kit's lighting and wear. Basic-material meshes (flashes)
 * are left alone.
 */
export function adoptMeshes(root: THREE.Object3D, movers: THREE.Object3D[], phone = false): void {
  root.updateMatrixWorld(true);
  const kit = new GunKit(root, phone);
  const set = new Set(movers);
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !m.userData.kit && (m.material as THREE.Material).type !== "MeshBasicMaterial") meshes.push(m);
  });
  const inv = new THREE.Matrix4();
  for (const mesh of meshes) {
    let anc: THREE.Object3D = mesh.parent ?? root;
    while (anc !== root && !set.has(anc)) anc = anc.parent ?? root;
    inv.copy(anc.matrixWorld).invert();
    const m = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld);
    const mat = mesh.material as THREE.MeshStandardMaterial;
    const ei = (mat.emissiveIntensity ?? 0) * Math.max(mat.emissive?.r ?? 0, mat.emissive?.g ?? 0, mat.emissive?.b ?? 0);
    let surf: Surface;
    if (ei > 0.5) surf = { emit: mat.emissive.getHex(), intensity: mat.emissiveIntensity };
    else {
      const metal = mat.metalness ?? 0;
      surf = { color: mat.color.getHex(), metal, rough: mat.roughness ?? 0.6, coat: metal > 0.5 ? 0.6 : 0, band: metal > 0.5 ? "brushed" : mat.roughness > 0.8 ? "nylon" : "grain" };
    }
    const geo = mesh.geometry.clone();
    geo.userData.edge = edgeFromNormals(geo.index ? geo : geo);
    kit.addBaked(anc, geo, surf, m);
    mesh.removeFromParent();
  }
  kit.finish();
}

/**
 * Collapses a built gun into ONE opaque mesh (LOD1 of a world gun, S2.1): every kit opaque mesh, carried by its
 * transform relative to `root`; self-lit and glass pieces are dropped.
 */
export function collapse(root: THREE.Object3D): THREE.Mesh | null {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const list: THREE.BufferGeometry[] = [];
  let mat: THREE.Material | null = null;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData.kit !== "opaque") return;
    mat = m.material as THREE.Material;
    list.push(m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)));
  });
  if (!list.length || !mat) return null;
  const g = mergeGeometries(list, false);
  if (!g) return null;
  g.computeBoundingSphere();
  const out = new THREE.Mesh(g, mat);
  out.userData.kit = "opaque";
  return out;
}

/** Draw calls and triangles under a node at rest (what the viewmodel budget counts): hidden meshes (the one-frame flash) don't draw. */
export function meshStats(root: THREE.Object3D): { calls: number; tris: number } {
  let calls = 0;
  let tris = 0;
  root.traverseVisible((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    calls++;
    const g = m.geometry;
    tris += (g.index ? g.index.count : g.getAttribute("position").count) / 3;
  });
  return { calls, tris: Math.round(tris) };
}
