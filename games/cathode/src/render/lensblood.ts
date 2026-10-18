// The lens-blood mask (docs/design/cathode-combat.md S6.4, C7): a 512² procedural atlas of four splats, 2x2 cells
// of 256², each eight fBm-edged metaballs with drips running down. Built once, on the CPU, into a DataTexture:
//   R  film thickness 0..1 (0 = clean glass);
//   G  d(thickness)/dx and B d(thickness)/dy, biased to 0.5, so the grade refracts and lights the film from one
//      fetch per slot instead of three;
//   A  1.
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
}

/** One cell's metaballs: a heavy core, a crown of droplets thrown off it, and two or three drips. */
function cellBalls(seed: number): Ball[] {
  const rnd = (() => {
    let t = seed * 9301 + 49297;
    return () => {
      t = (t * 9301 + 49297) % 233280;
      return t / 233280;
    };
  })();
  const balls: Ball[] = [];
  const cx = 0.46 + rnd() * 0.08;
  const cy = 0.38 + rnd() * 0.08;
  // The impact: two or three overlapping lobes, never one round blob.
  const lobes = 2 + Math.floor(rnd() * 2);
  for (let i = 0; i < lobes; i++) balls.push({ x: cx + (rnd() - 0.5) * 0.12, y: cy + (rnd() - 0.5) * 0.1, r: 0.07 + rnd() * 0.05, drip: 0 });
  // Spray thrown off it: a fan of small droplets on one side, smaller the further they flew.
  const fan = rnd() * Math.PI * 2;
  for (let i = 0; i < 14; i++) {
    const a = fan + (rnd() - 0.5) * 2.4;
    const d = 0.12 + rnd() * 0.24;
    balls.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.85, r: (0.014 + rnd() * 0.026) * (1.25 - d), drip: 0 });
  }
  const drips = 1 + Math.floor(rnd() * 3);
  for (let i = 0; i < drips; i++) balls.push({ x: cx - 0.08 + rnd() * 0.16, y: cy + 0.04, r: 0.012 + rnd() * 0.014, drip: 0.18 + rnd() * 0.3 });
  return balls;
}

/** The thickness field in a cell at (u, v) in 0..1 (v down). */
function field(u: number, v: number, balls: Ball[], seed: number): number {
  let f = 0;
  for (const b of balls) {
    let dx = u - b.x;
    let dy = v - b.y;
    if (b.drip > 0) {
      // A drip: a narrow trail from the ball down to its tip, thinning as it goes, with a bead at the end.
      const t = Math.max(0, Math.min(1, dy / b.drip));
      const w = b.r * (1 - 0.65 * t);
      dx /= w / b.r;
      dy = dy < 0 ? dy : dy > b.drip ? dy - b.drip : 0;
      f += (b.r * b.r) / (dx * dx + dy * dy + 1e-4);
      continue;
    }
    f += (b.r * b.r) / (dx * dx + dy * dy + 1e-4);
  }
  // fBm breaks the edge up into a torn, wet rim instead of a clean blob.
  const n = fbm(u * 11, v * 11, seed) - 0.5;
  const e = f * (1 + n * 1.1) - 1;
  // Thickness: 0 outside, a soft rim (it's on the lens, out of focus), a slow dome inside, and fBm pooling in the
  // film so it reads as liquid, not a flat decal.
  const pool = 0.75 + 0.5 * fbm(u * 5 + 7, v * 5, seed + 3);
  return Math.max(0, Math.min(1, (e > 0 ? 0.18 + e * 0.35 : 0.18 * Math.max(0, 1 + e * 4)) * pool));
}

let cached: THREE.DataTexture | null = null;

/** The atlas (built once per page; four 256² cells). */
export function lensBloodTexture(): THREE.DataTexture {
  if (cached) return cached;
  const thick = new Float32Array(N * N);
  for (let cell = 0; cell < 4; cell++) {
    const ox = (cell % 2) * CELL;
    const oy = Math.floor(cell / 2) * CELL;
    const balls = cellBalls(cell * 7 + 3);
    for (let y = 0; y < CELL; y++)
      for (let x = 0; x < CELL; x++) {
        // A 6 px clean border so filtering never bleeds a neighbour's blood in.
        const u = x / CELL;
        const v = y / CELL;
        const edge = Math.min(x, y, CELL - 1 - x, CELL - 1 - y);
        thick[(oy + y) * N + ox + x] = edge < 6 ? 0 : field(u, v, balls, cell * 31 + 5);
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
      data[o + 3] = 255;
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
