// C19 "Gore and dismemberment" (docs/design/cathode-combat.md S4.5, "The stump"): the cap on a severed stump and on
// the piece that flew. A lathe disc facing +Y from y = 0: a domed flesh core, a 2 mm #C9A27A fat ring, the cut suit's
// lip, a #E6DCC8 bone standing 1.5 cm proud (its end split, the marrow showing) and three torn suit strands. Cyber
// limbs (Candor chrome) get the machine version: a steel collar, a cyan coolant ring that glows, a rod for the bone
// and three torn cables. One merged geometry per (radius, kind, quality), vertex-coloured on one shared material
// that lifts the colour out of the noir grade (S4.5: an emissive lift of 0.18 x base, ignoring local light), so a
// cap reads wet and red at 10 m in rain. No CSG (pillar 10): every part is a lathe, a cylinder or a strip.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** S4.5's cap colours (sRGB). Glow parts are written above 1 and the shader turns the excess into light. */
export const CAP = {
  core: "#7A0A0E",
  coreDeep: "#3A0306",
  fat: "#C9A27A",
  bone: "#E6DCC8",
  marrow: "#8A3A2C",
  suit: "#15171B",
  steel: "#4A525C",
  coolant: "#00E5C8",
  /** The bone stands this proud of the flesh (m); the fat ring is this thick (m). */
  boneProudM: 0.015,
  fatM: 0.002,
  /** The bone's radius as a share of the stump's (a thigh's femur is about a quarter of the thigh). */
  boneShare: 0.24,
  /** The emissive lift on every cap (x base colour) and the glow gain on the cyber ring. */
  lift: 0.18,
  glow: 2.2,
};

const col = (hex: string, mul = 1) => new THREE.Color(hex).convertSRGBToLinear().multiplyScalar(mul);

/** Gives every vertex of `g` one colour (optionally varied by a per-vertex function). */
function paint(g: THREE.BufferGeometry, c: THREE.Color | ((x: number, y: number, z: number) => THREE.Color)): THREE.BufferGeometry {
  const p = g.getAttribute("position");
  const out = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const v = typeof c === "function" ? c(p.getX(i), p.getY(i), p.getZ(i)) : c;
    out[i * 3] = v.r;
    out[i * 3 + 1] = v.g;
    out[i * 3 + 2] = v.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(out, 3));
  // Merging needs the same attributes everywhere: positions, normals, colours (no uvs).
  g.deleteAttribute("uv");
  return g.index ? g.toNonIndexed() : g;
}

/** A small seeded hash, so every cap of a kind is the same (screenshots stay stable). */
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** A torn strip hanging off the rim at angle `a`: `len` long, bent outward then down, ragged at the end. */
function strand(r: number, a: number, len: number, w: number, c: THREE.Color, seed: number): THREE.BufferGeometry {
  const segs = 3;
  const pos: number[] = [];
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const tx = -sa;
  const tz = ca;
  const rows: [number, number, number][] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    // Out from the rim and up past the cut, then curling over (a cut sleeve flares).
    const rr = r * (1.0 + 0.35 * t) + 0.004;
    const y = len * (0.55 * t - 0.25 * t * t) + 0.002;
    rows.push([ca * rr, y, sa * rr]);
  }
  for (let i = 0; i < segs; i++) {
    const [x0, y0, z0] = rows[i]!;
    const [x1, y1, z1] = rows[i + 1]!;
    // Narrowing to a torn point, jittered.
    const w0 = w * (1 - i / segs) * (0.8 + hash(seed + i) * 0.4);
    const w1 = w * (1 - (i + 1) / segs) * (0.6 + hash(seed + i + 7) * 0.6);
    const q = [
      [x0 - tx * w0, y0, z0 - tz * w0],
      [x0 + tx * w0, y0, z0 + tz * w0],
      [x1 + tx * w1, y1, z1 + tz * w1],
      [x1 - tx * w1, y1, z1 - tz * w1],
    ];
    // Both faces (a strip is seen from either side).
    for (const [a0, b0, c0] of [
      [0, 1, 2],
      [0, 2, 3],
      [0, 2, 1],
      [0, 3, 2],
    ] as const)
      pos.push(...q[a0]!, ...q[b0]!, ...q[c0]!);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return paint(g, c);
}

/**
 * A stump cap of radius `r` (m) facing +Y. `cyber` builds the machine version. Phone halves the lathe's segments.
 */
export function buildCap(r: number, cyber: boolean, phone: boolean): THREE.BufferGeometry {
  const n = phone ? 9 : 16;
  const parts: THREE.BufferGeometry[] = [];
  const core = col(cyber ? "#20252B" : CAP.core);
  const deep = col(cyber ? "#0E1114" : CAP.coreDeep);
  const fat = col(cyber ? CAP.steel : CAP.fat);
  const suit = col(CAP.suit);
  // The disc: a domed core (raw muscle, darker at the middle where it is wettest), the fat (or steel) ring, the
  // suit's cut lip rolled back under it.
  const fr = r * 0.84;
  const prof = [
    new THREE.Vector2(0, 0.006),
    new THREE.Vector2(fr * 0.45, 0.0065),
    new THREE.Vector2(fr * 0.85, 0.0045),
    new THREE.Vector2(fr, 0.0025),
    new THREE.Vector2(fr, 0.0025 + CAP.fatM),
    new THREE.Vector2(r * 0.95, 0.0025 + CAP.fatM),
    new THREE.Vector2(r * 0.97, 0.001),
    new THREE.Vector2(r * 1.03, 0.0),
    new THREE.Vector2(r * 1.04, -0.008),
  ].reverse();
  const disc = new THREE.LatheGeometry(prof, n);
  parts.push(
    paint(disc, (x, y, z) => {
      const d = Math.hypot(x, z);
      if (d > r * 0.965) return suit;
      if (d > fr * 0.99 && y > 0.0024) return fat;
      // Muscle bundles: a ring pattern with seeded variation, deep at the centre.
      const t = d / fr;
      const a = Math.atan2(z, x);
      const fib = 0.75 + 0.25 * Math.sin(a * 5 + t * 9) * hash(Math.round(a * 3) + 11);
      return deep.clone().lerp(core, Math.min(1, t * 1.3) * fib);
    }),
  );
  // The bone (a femur, a humerus, the neck's spine), off centre, its end split and the marrow showing; cyber: a
  // steel rod with a glowing coolant ring round it.
  const br = r * CAP.boneShare;
  const ox = r * 0.12;
  const bone = new THREE.CylinderGeometry(br * 0.92, br, CAP.boneProudM + 0.004, phone ? 7 : 10, 1, false);
  // The split end: the top rim jagged.
  const bp = bone.getAttribute("position");
  for (let i = 0; i < bp.count; i++) {
    if (bp.getY(i) > 0) bp.setY(i, bp.getY(i) - hash(i * 3.1) * 0.006);
  }
  bone.translate(ox, (CAP.boneProudM + 0.004) / 2 + 0.002, 0);
  parts.push(paint(bone, (x, y, z) => (Math.hypot(x - ox, z) < br * 0.55 && y > CAP.boneProudM - 0.002 ? col(cyber ? "#0A0C0E" : CAP.marrow) : col(cyber ? "#8A949E" : CAP.bone))));
  if (cyber) {
    // The coolant ring: a thin lathe band at the core's edge, glowing cyan (above 1: the shader's glow).
    const ring = new THREE.LatheGeometry([new THREE.Vector2(fr * 0.8, 0.0072), new THREE.Vector2(fr * 0.9, 0.0072)].reverse(), n);
    parts.push(paint(ring, col(CAP.coolant, 1 + CAP.glow)));
  }
  // Three torn strands off the rim: the suit (or, on chrome, cables with a cyan core).
  const strandCol = cyber ? col("#2C3238") : suit;
  for (let k = 0; k < 3; k++) {
    const a = k * 2.2 + 0.4 + hash(k + 3) * 0.6;
    parts.push(strand(r, a, 0.028 + hash(k + 5) * 0.02, cyber ? 0.004 : r * 0.16, strandCol, k * 13));
  }
  const g = mergeGeometries(parts, false)!;
  for (const p of parts) p.dispose();
  g.computeBoundingSphere();
  return g;
}

/** The shared cap material: vertex colours, wet, lifted out of the grade; colour above 1 glows. */
export function capMaterial(phone: boolean): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: phone ? 0.3 : 0.22, metalness: 0.05, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
      totalEmissiveRadiance += min(vColor.rgb, vec3(1.0)) * ${CAP.lift.toFixed(3)} + max(vColor.rgb - vec3(1.0), vec3(0.0));`,
    );
  };
  m.name = "goreCap";
  return m;
}

const caps = new Map<string, THREE.BufferGeometry>();
const mats = new Map<boolean, THREE.MeshStandardMaterial>();

/** A cached cap geometry (radius to the millimetre). */
export function capGeometry(r: number, cyber: boolean, phone: boolean): THREE.BufferGeometry {
  const key = `${Math.round(r * 1000)}:${cyber ? 1 : 0}:${phone ? 1 : 0}`;
  let g = caps.get(key);
  if (!g) {
    g = buildCap(r, cyber, phone);
    caps.set(key, g);
  }
  return g;
}

export function sharedCapMaterial(phone: boolean): THREE.MeshStandardMaterial {
  let m = mats.get(phone);
  if (!m) {
    m = capMaterial(phone);
    mats.set(phone, m);
  }
  return m;
}

// ------------------------------------------------------------------ chrome limbs (Candor augments)

const sleeves = new Map<string, THREE.BufferGeometry>();
const chromeMats = new Map<boolean, THREE.MeshStandardMaterial>();

/**
 * A chrome sleeve over a segment `len` long (bone units, +Y from the "from" joint): a tapered, ribbed steel
 * forearm over the suit with two cyan coolant seams that glow (the read that says "this one bleeds coolant").
 */
export function chromeSleeve(len: number, r: number, hand: boolean, phone: boolean): THREE.BufferGeometry {
  const key = `${Math.round(len * 1000)}:${Math.round(r * 1000)}:${hand ? 1 : 0}:${phone ? 1 : 0}`;
  const hit = sleeves.get(key);
  if (hit) return hit;
  const R = r * (hand ? 1.18 : 1.16);
  const pts: THREE.Vector2[] = [];
  const rings = hand ? 3 : 6;
  for (let i = 0; i <= rings * 2; i++) {
    const t = i / (rings * 2);
    // Ribs: every other ring a little proud; a taper toward the wrist.
    const rib = i % 2 ? 1 : 0.94;
    pts.push(new THREE.Vector2(R * (1 - 0.18 * t) * rib, len * (0.04 + 0.92 * t)));
  }
  const tube = new THREE.LatheGeometry(pts, phone ? 8 : 14);
  const steel = col("#9AA4AE");
  const dark = col("#3A4048");
  const seam = col(CAP.coolant, 1 + CAP.glow);
  const g = paint(tube, (x, y, z) => {
    const t = y / len;
    if (Math.abs(t - 0.2) < 0.025 || Math.abs(t - 0.8) < 0.025) return seam;
    const a = Math.atan2(z, x);
    // A dark panel line down the back of the arm.
    return Math.abs(Math.sin(a * 2)) < 0.12 ? dark : steel;
  });
  g.computeVertexNormals();
  g.computeBoundingSphere();
  sleeves.set(key, g);
  return g;
}

/** Polished chrome on vertex colours; colour above 1 glows (the seams). */
export function chromeMaterial(phone: boolean): THREE.MeshStandardMaterial {
  let m = chromeMats.get(phone);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.9, roughness: phone ? 0.34 : 0.24 });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
      totalEmissiveRadiance += max(vColor.rgb - vec3(1.0), vec3(0.0)) + min(vColor.rgb, vec3(1.0)) * 0.05;`,
    );
  };
  m.name = "chromeLimb";
  chromeMats.set(phone, m);
  return m;
}
