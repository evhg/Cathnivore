// The weapon trim atlas (S2.1): one texture, generated at load from procedural height fields, that every gun
// and Cath's gloves sample through `gunkit`'s material. Bands run across the full width (u tiles) and each
// band tiles vertically inside itself (the shader wraps v within the band), at 1 texel per 0.25 mm on desktop
// (1024²) and 0.5 mm on phone (512²).
//
// One RGBA8 texture packs everything: R,G = the tangent-space normal's x and y (Sobel of the height field),
// B = an albedo multiplier (0.5 = x1), A = a roughness offset (0.5 = 0). Text bands (the slide engraving and
// the faction mark) need a 2D canvas, so in Node they stay flat and the rest still builds (tests).

import * as THREE from "three";

export type BandName =
  | "flat"
  | "stipple"
  | "serration"
  | "knurl"
  | "grain"
  | "brushed"
  | "peel"
  | "nylon"
  | "leather"
  | "engraving"
  | "faction";

/** Rows of each band at 1024² (halved on phone). Ordered top to bottom. */
const ROWS: [BandName, number][] = [
  ["flat", 32],
  ["stipple", 96],
  ["serration", 96],
  ["knurl", 96],
  ["grain", 96],
  ["brushed", 96],
  ["peel", 96],
  ["nylon", 96],
  ["leather", 96],
  ["engraving", 112],
  ["faction", 112],
];

export interface Band {
  /** Start and height in atlas v (0..1, three's flipY=false: v=0 is the first row). */
  v0: number;
  vh: number;
  /** The band's physical size in mm (a tile is this tall; the atlas is 256 mm wide at 0.25 mm per texel). */
  mmH: number;
}

/** Atlas width in mm: u = 1 covers this much surface. */
export const ATLAS_MM = 256;

export const BANDS: Record<BandName, Band> = (() => {
  const out = {} as Record<BandName, Band>;
  let row = 0;
  for (const [name, n] of ROWS) {
    out[name] = { v0: row / 1024, vh: n / 1024, mmH: n * 0.25 };
    row += n;
  }
  return out;
})();

/** Engraved on the slide's left flank and the faction mark on the frame. */
export const ENGRAVING = "KESTREL 9  ·  HOLLOWELL ARMS  ·  9×21";
export const FACTION = "HOLLOWELL ARMS  ·  CATHODE CITY  ·  PROPERTY OF CATH HALE";

// ---- Periodic noise (tiles with the band) -------------------------------------------------------------

function hash(i: number, j: number, seed: number): number {
  let h = (i * 374761393 + j * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Value noise with `cx` x `cy` lattice cells over a `w` x `h` tile, wrapping at both edges. */
function pnoise(x: number, y: number, w: number, h: number, cx: number, cy: number, seed: number): number {
  const fx = (x / w) * cx;
  const fy = (y / h) * cy;
  const i0 = Math.floor(fx);
  const j0 = Math.floor(fy);
  const u = fx - i0;
  const v = fy - j0;
  const su = u * u * (3 - 2 * u);
  const sv = v * v * (3 - 2 * v);
  const m = (a: number, n: number) => ((a % n) + n) % n;
  const a = hash(m(i0, cx), m(j0, cy), seed);
  const b = hash(m(i0 + 1, cx), m(j0, cy), seed);
  const c = hash(m(i0, cx), m(j0 + 1, cy), seed);
  const d = hash(m(i0 + 1, cx), m(j0 + 1, cy), seed);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
}

const tri = (x: number) => Math.abs(((x % 1) + 1) % 1 - 0.5) * 2; // 1 at integers, 0 at halves

interface Field {
  /** Height 0..1. */
  h: Float32Array;
  /** Albedo multiplier (1 = none) and roughness offset per texel. */
  alb: Float32Array;
  rough: Float32Array;
  /** Normal strength for the Sobel. */
  strength: number;
}

/** A band's fields at `S` texels per 0.25 mm-texel (1 on desktop, 0.5 on phone). */
function bandField(name: BandName, w: number, h: number, k: number, text: ((name: BandName, w: number, h: number) => Float32Array | null) | null): Field {
  const n = w * h;
  const f: Field = { h: new Float32Array(n), alb: new Float32Array(n).fill(1), rough: new Float32Array(n), strength: 2 };
  // `X`, `Y` are in desktop texels (0.25 mm), so features keep their physical size on phone.
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const X = x / k;
      const Y = y / k;
      const W = w / k;
      const H = h / k;
      let v = 0;
      switch (name) {
        case "stipple": {
          // Raised bumps on a 2 mm jittered grid, plus fine noise: a laser-stippled polymer grip.
          const cell = 8;
          const ci = Math.floor(X / cell);
          const cj = Math.floor(Y / cell);
          let best = 9;
          for (let dj = -1; dj <= 1; dj++)
            for (let di = -1; di <= 1; di++) {
              const ii = ci + di;
              const jj = cj + dj;
              const nx = W / cell;
              const ny = H / cell;
              const wi = ((ii % nx) + nx) % nx;
              const wj = ((jj % ny) + ny) % ny;
              const px = (ii + 0.2 + hash(wi, wj, 3) * 0.6) * cell;
              const py = (jj + 0.2 + hash(wi, wj, 7) * 0.6) * cell;
              best = Math.min(best, Math.hypot(X - px, Y - py) / cell);
            }
          v = Math.max(0, 1 - best / 0.42) ** 0.7 + pnoise(X, Y, W, H, 64, 12, 5) * 0.15;
          f.rough[i] = 0.12 - v * 0.08;
          f.alb[i] = 0.92 + v * 0.12;
          f.strength = 3;
          break;
        }
        case "serration":
          // Sharp vertical cuts every 1.5 mm.
          v = Math.min(1, tri(X / 6) * 1.6);
          f.alb[i] = 0.8 + v * 0.25;
          f.strength = 4;
          break;
        case "knurl":
          // A diamond knurl at 1.25 mm pitch (the suppressor's grip band).
          v = Math.min(tri((X + Y) / 5), tri((X - Y) / 5));
          f.alb[i] = 0.85 + v * 0.2;
          f.rough[i] = 0.06 - v * 0.08;
          f.strength = 3.5;
          break;
        case "grain":
          v = pnoise(X, Y, W, H, 128, 24, 11) * 0.6 + pnoise(X, Y, W, H, 512, 96, 12) * 0.4;
          f.alb[i] = 0.95 + v * 0.08;
          f.rough[i] = (v - 0.5) * 0.08;
          f.strength = 0.7;
          break;
        case "brushed":
          // Long streaks along u.
          v = pnoise(X, Y, W, H, 4, 96, 21) * 0.5 + pnoise(X, Y, W, H, 16, 192, 22) * 0.5;
          f.alb[i] = 0.9 + v * 0.2;
          f.rough[i] = (v - 0.5) * 0.16;
          f.strength = 0.8;
          break;
        case "peel":
          // Cerakote's orange-peel: soft low bumps, faintly rough.
          v = pnoise(X, Y, W, H, 128, 12, 31) * 0.7 + pnoise(X, Y, W, H, 256, 24, 32) * 0.3;
          f.alb[i] = 0.96 + v * 0.06;
          f.rough[i] = (v - 0.5) * 0.06;
          f.strength = 0.9;
          break;
        case "nylon": {
          // A tight gabardine twill: diagonal ribs every 1 mm.
          const rib = tri((X + Y * 0.6) / 4);
          v = rib * 0.8 + pnoise(X, Y, W, H, 256, 24, 41) * 0.2;
          f.alb[i] = 0.88 + v * 0.18;
          f.rough[i] = 0.05;
          f.strength = 1.6;
          break;
        }
        case "leather": {
          // Pebbled leather: cells with soft creases between them.
          const a = pnoise(X, Y, W, H, 128, 12, 51);
          const b = pnoise(X, Y, W, H, 256, 24, 52);
          v = 1 - Math.abs(a - 0.5) * 2;
          v = v * 0.6 + b * 0.4;
          f.alb[i] = 0.9 + v * 0.16;
          f.rough[i] = (0.5 - v) * 0.14;
          f.strength = 0.55;
          break;
        }
        default:
          v = 0;
      }
      f.h[i] = v;
    }
  if (name === "engraving" || name === "faction") {
    const t = text?.(name, w, h) ?? null;
    if (t) {
      // Letters are cut in: lower, darker and rougher, with a bright worn lip.
      for (let i = 0; i < n; i++) {
        const c = t[i]!;
        f.h[i] = 1 - c;
        f.alb[i] = 1 - c * 0.45 + 0;
        f.rough[i] = c * 0.18;
      }
      f.strength = 3;
    }
  }
  return f;
}

/** Renders a text band with a 2D canvas (null in Node). Coverage 0..1 per texel. */
function canvasText(name: BandName, w: number, h: number): Float32Array | null {
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const g = cv.getContext("2d", { willReadFrequently: true });
  if (!g) return null;
  g.fillStyle = "#000";
  g.fillRect(0, 0, w, h);
  g.fillStyle = "#fff";
  g.textBaseline = "middle";
  const engr = name === "engraving";
  const size = Math.round(h * (engr ? 0.5 : 0.36));
  g.font = `600 ${size}px "Cathode UI", "Cathode UI Fallback", sans-serif`;
  const label = engr ? ENGRAVING : FACTION;
  // Letter-spaced, fitted to the width.
  const spacing = engr ? size * 0.18 : size * 0.3;
  const chars = [...label];
  const widths = chars.map((c) => g.measureText(c).width + spacing);
  const total = widths.reduce((a, b) => a + b, 0);
  const sx = Math.min(1, (w * 0.94) / total);
  let x = (w - total * sx) / 2;
  g.save();
  g.scale(sx, 1);
  x /= sx;
  for (let i = 0; i < chars.length; i++) {
    g.fillText(chars[i]!, x, h / 2);
    x += widths[i]!;
  }
  g.restore();
  if (!engr) {
    // The faction mark: a thin rule above and below.
    g.fillRect(w * 0.03, h * 0.12, w * 0.94, Math.max(1, h * 0.03));
    g.fillRect(w * 0.03, h * 0.85, w * 0.94, Math.max(1, h * 0.03));
  }
  const px = g.getImageData(0, 0, w, h).data;
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = px[i * 4]! / 255;
  return out;
}

let cached: { size: number; tex: THREE.DataTexture } | null = null;

/** The atlas at `size` (1024 desktop, 512 phone), built once and shared. */
export function trimAtlas(size: 1024 | 512 = 1024): THREE.DataTexture {
  if (cached && cached.size === size) return cached.tex;
  const k = size / 1024;
  const data = new Uint8Array(size * size * 4);
  let row = 0;
  for (const [name, n] of ROWS) {
    const h = Math.max(2, Math.round(n * k));
    const f = bandField(name, size, h, k, canvasText);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        // Sobel on the wrapped band.
        const H = (xx: number, yy: number) => f.h[((yy + h) % h) * size + ((xx + size) % size)]!;
        const gx = H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x - 1, y) - H(x - 1, y + 1);
        const gy = H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x, y - 1) - H(x + 1, y - 1);
        // The normal tilts away from rising height; scale by texel size so phone keeps the same slope.
        const s = (f.strength * k) / 4;
        let nx = -gx * s;
        let ny = -gy * s;
        const l = Math.hypot(nx, ny, 1);
        nx /= l;
        ny /= l;
        const o = ((row + y) * size + x) * 4;
        data[o] = Math.round((nx * 0.5 + 0.5) * 255);
        data[o + 1] = Math.round((ny * 0.5 + 0.5) * 255);
        data[o + 2] = Math.round(THREE.MathUtils.clamp(f.alb[i]! * 0.5, 0, 1) * 255);
        data[o + 3] = Math.round(THREE.MathUtils.clamp(f.rough[i]! + 0.5, 0, 1) * 255);
      }
    row += h;
  }
  // Rounding can leave a row or two at the bottom on phone: flat.
  for (let y = row; y < size; y++)
    for (let x = 0; x < size; x++) {
      const o = (y * size + x) * 4;
      data[o] = data[o + 1] = 128;
      data[o + 2] = 128;
      data[o + 3] = 128;
    }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  cached = { size, tex };
  return tex;
}
