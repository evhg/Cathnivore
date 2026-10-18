// The lens-blood mask (docs/design/cathode-combat.md S6.4, C7): a 512² procedural atlas of four splats, 2x2 cells
// of 256², each a small impact with smears dragged out of it, streaked spatter and drips running down. Built once, on the CPU, into a DataTexture:
//   R  film thickness 0..1 (0 = clean glass);
//   G  d(thickness)/dx and B d(thickness)/dy, biased to 0.5, so the grade refracts and lights the film from one
//      fetch per slot instead of three;
//   A  a few tiny specular glints (the light catching the wet dome and the larger droplets), 0 elsewhere.
// The splats are seeded, so every run (and every screenshot) is the same blood.

import * as THREE from "three";

const N = 512;
const CELL = 256;

function hash(x: number, y: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function vnoise(x: number, y: number, s: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, s);
  const b = hash(xi + 1, yi, s);
  const c = hash(xi, yi + 1, s);
  const d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, y: number, s: number): number {
  let f = 0;
  let a = 0.5;
  for (let o = 0; o < 4; o++) {
    f += a * vnoise(x, y, s + o * 17);
    x *= 2.03;
    y *= 2.03;
    a *= 0.5;
  }
  return f;
}

interface Ball {
  x: number;
  y: number;
  r: number;
  /** A drip is a ball stretched downward (in cell space, y grows down here). */
  drip: number;
  /** Stretch along `ang` (1 = round): smears and streaked spatter, so nothing reads as a cluster of bubbles. */
  stretch: number;
  ang: number;
  /** How thick this piece of blood is (a smear is a thin film, the impact a pool). */
  thick: number;
}

/**
 * One cell's blood: a small impact, smears dragged out of it (long and thin, as if wiped or flung across the
 * glass), spatter streaked away from the impact, and one to three drips. C7 review: round metaballs read as a
 * gummy grape cluster, so only the impact's core is round and it is small.
 */
function cellBalls(seed: number): { balls: Ball[]; glints: [number, number][] } {
  const rnd = (() => {
    let t = seed * 9301 + 49297;
    return () => {
      t = (t * 9301 + 49297) % 233280;
      return t / 233280;
    };
  })();
  const balls: Ball[] = [];
  const glints: [number, number][] = [];
  const cx = 0.44 + rnd() * 0.1;
  const cy = 0.36 + rnd() * 0.08;
  balls.push({ x: cx, y: cy, r: 0.06 + rnd() * 0.02, drip: 0, stretch: 1.3, ang: rnd() * Math.PI, thick: 1 });
  // Smears: two to four long strokes out of the impact, thin and tapering.
  const throwA = rnd() * Math.PI * 2;
  const smears = 2 + Math.floor(rnd() * 3);
  for (let i = 0; i < smears; i++) {
    const a = throwA + (rnd() - 0.5) * 2.2;
    const len = 0.1 + rnd() * 0.14;
    balls.push({ x: cx + Math.cos(a) * len * 0.75, y: cy + Math.sin(a) * len * 0.75, r: 0.028 + rnd() * 0.018, drip: 0, stretch: 3 + rnd() * 2.5, ang: a, thick: 0.4 + rnd() * 0.2 });
  }
  // Spatter: droplets flung out along the throw, each streaked away from the impact (the faster, the longer).
  for (let i = 0; i < 22; i++) {
    const a = throwA + (rnd() - 0.5) * 2.8;
    const d = 0.13 + rnd() * 0.26;
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d * 0.85;
    const r = (0.008 + rnd() * 0.016) * (1.3 - d);
    balls.push({ x, y, r, drip: 0, stretch: 1.2 + rnd() * 2.4, ang: a, thick: 0.75 });
    if (r > 0.015 && glints.length < 3) glints.push([x - r * 0.3, y - r * 0.35]);
  }
  const drips = 1 + Math.floor(rnd() * 3);
  for (let i = 0; i < drips; i++) balls.push({ x: cx - 0.07 + rnd() * 0.14, y: cy + 0.03, r: 0.009 + rnd() * 0.01, drip: 0.18 + rnd() * 0.3, stretch: 1, ang: 0, thick: 0.8 });
  glints.push([cx - 0.02, cy - 0.025]);
  return { balls, glints };
}

/** The thickness field in a cell at (u, v) in 0..1 (v down). */
function field(u: number, v: number, balls: Ball[], seed: number): number {
  let f = 0;
  let tw = 0;
  for (const b of balls) {
    let dx = u - b.x;
    let dy = v - b.y;
    let g: number;
    if (b.drip > 0) {
      // A drip: a narrow trail from the ball down to its tip, thinning as it goes, with a bead at the end.
      const t = Math.max(0, Math.min(1, dy / b.drip));
      const w = b.r * (1 - 0.65 * t);
      dx /= w / b.r;
      dy = dy < 0 ? dy : dy > b.drip ? dy - b.drip : 0;
      g = (b.r * b.r) / (dx * dx + dy * dy + 1e-4);
    } else {
      // Into the piece's own frame: along its stretch, and across it.
      const ca = Math.cos(b.ang);
      const sa = Math.sin(b.ang);
      const al = (dx * ca + dy * sa) / b.stretch;
      const ac = -dx * sa + dy * ca;
      g = (b.r * b.r) / (al * al + ac * ac + 1e-4);
    }
    f += g;
    tw += g * b.thick;
  }
  const thick = tw / Math.max(1e-6, f);
  // fBm breaks the edge up into a torn, wet rim instead of a clean blob.
  const n = fbm(u * 13, v * 13, seed) - 0.5;
  const e = f * (1 + n * 1.2) - 1;
  // Thickness: 0 outside, a soft rim (it's on the lens, out of focus), a slow dome inside, and fBm pooling in the
  // film so it reads as liquid, not a flat decal.
  const pool = 0.7 + 0.6 * fbm(u * 6 + 7, v * 6, seed + 3);
  return Math.max(0, Math.min(1, (e > 0 ? 0.14 + e * 0.3 : 0.14 * Math.max(0, 1 + e * 4)) * pool * thick));
}

let cached: THREE.DataTexture | null = null;

/** The atlas (built once per page; four 256² cells). */
export function lensBloodTexture(): THREE.DataTexture {
  if (cached) return cached;
  const thick = new Float32Array(N * N);
  const glint = new Float32Array(N * N);
  for (let cell = 0; cell < 4; cell++) {
    const ox = (cell % 2) * CELL;
    const oy = Math.floor(cell / 2) * CELL;
    const { balls, glints } = cellBalls(cell * 7 + 3);
    for (let y = 0; y < CELL; y++)
      for (let x = 0; x < CELL; x++) {
        // A 6 px clean border so filtering never bleeds a neighbour's blood in.
        const u = x / CELL;
        const v = y / CELL;
        const edge = Math.min(x, y, CELL - 1 - x, CELL - 1 - y);
        thick[(oy + y) * N + ox + x] = edge < 6 ? 0 : field(u, v, balls, cell * 31 + 5);
        // A few tiny glints (A): the light catching the impact's dome and the biggest droplets, never rim arcs.
        let gl = 0;
        for (const [gx, gy] of glints) {
          const dd = ((u - gx) ** 2 + (v - gy) ** 2) * CELL * CELL;
          gl = Math.max(gl, Math.exp(-dd / 0.7));
        }
        glint[(oy + y) * N + ox + x] = edge < 6 ? 0 : gl;
      }
  }
  // Out of focus: two box blurs (3 px) soften the rim the way a lens-borne smear never has a crisp edge.
  const tmp = new Float32Array(N * N);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        let a = 0;
        for (let k = -3; k <= 3; k++) a += thick[y * N + Math.max(0, Math.min(N - 1, x + k))]!;
        tmp[y * N + x] = a / 7;
      }
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        let a = 0;
        for (let k = -3; k <= 3; k++) a += tmp[Math.max(0, Math.min(N - 1, y + k)) * N + x]!;
        thick[y * N + x] = a / 7;
      }
  }
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const t = thick[i]!;
      const gx = (thick[y * N + Math.min(N - 1, x + 1)]! - thick[y * N + Math.max(0, x - 1)]!) * 0.5;
      const gy = (thick[Math.min(N - 1, y + 1) * N + x]! - thick[Math.max(0, y - 1) * N + x]!) * 0.5;
      // Rows are stored bottom-up for WebGL, so +y in texture space is up on screen: flip the row and gy.
      const o = ((N - 1 - y) * N + x) * 4;
      data[o] = Math.round(t * 255);
      data[o + 1] = Math.round(Math.max(0, Math.min(1, 0.5 + gx * 8)) * 255);
      data[o + 2] = Math.round(Math.max(0, Math.min(1, 0.5 - gy * 8)) * 255);
      data[o + 3] = Math.round(Math.min(1, glint[i]! * (t > 0.05 ? 1 : 0)) * 255);
    }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  cached = tex;
  return tex;
}
