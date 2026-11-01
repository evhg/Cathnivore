// The Board Tower's surfaces (plan item 4), painted on canvas at load like the clinic's (clinictex.ts): polished
// white marble laid in large slabs with grey and gold veins (floors, walls, columns), a charcoal office carpet
// tile, and a dark linear slat ceiling. Each is a PBR set that tiles at the Builder's UV scale.

import type { PbrSet } from "./textures";
import { canvas, prng } from "./textures";
import { blotches, toSet, type Painted } from "./clinictex";

/** Tileable value noise on an `p` x `p` lattice, sampled at u, v in [0, 1). */
function lattice(p: number, seed: number): (u: number, v: number) => number {
  const rand = prng(seed);
  const g = new Float32Array(p * p).map(() => rand());
  const at = (x: number, y: number) => g[(((y % p) + p) % p) * p + (((x % p) + p) % p)]!;
  return (u, v) => {
    const x = u * p;
    const y = v * p;
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * sx;
    const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * sx;
    return a + (b - a) * sy;
  };
}

function fbm(seed: number, base: number, octaves: number): (u: number, v: number) => number {
  const ls = Array.from({ length: octaves }, (_, i) => lattice(base << i, seed + i * 17));
  return (u, v) => {
    let s = 0;
    let a = 0.5;
    for (const l of ls) {
      s += l(u, v) * a;
      a *= 0.5;
    }
    return s;
  };
}

/**
 * Polished marble in `slabs` x `slabs` panels per tile: a warm white ground, soft grey clouds, sharp grey veins
 * that run diagonally across the slabs and the odd gold one, hairline joints between slabs.
 */
function marble(n: number, slabs: number, seed: number, o: { ground: [number, number, number]; vein: [number, number, number]; gold: number; rough: number }): Painted {
  const c = canvas(n, n);
  const g = c.getContext("2d")!;
  const img = g.createImageData(n, n);
  const height = new Float32Array(n * n).fill(1);
  const rough = new Float32Array(n * n);
  const ao = new Float32Array(n * n).fill(1);
  const warp = fbm(seed, 3, 5);
  const cloud = fbm(seed + 5, 4, 4);
  const fine = fbm(seed + 9, 16, 3);
  const slab = n / slabs;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = x / n;
      const v = y / n;
      // Veins: thin where a warped diagonal sine crosses zero; a second, finer set at another angle.
      const w = warp(u, v);
      const t1 = Math.abs(Math.sin((u + v) * Math.PI * 3 + w * 9));
      const t2 = Math.abs(Math.sin((u * 2 - v) * Math.PI * 2 + w * 14 + 1.3));
      const vein = Math.pow(1 - t1, 18) * 0.85 + Math.pow(1 - t2, 40) * 0.5;
      const gold = Math.pow(1 - Math.abs(Math.sin((u - v * 0.5) * Math.PI * 2 + w * 7 + 0.6)), 60) * o.gold;
      const cl = cloud(u, v) * 0.18 + fine(u, v) * 0.06;
      const k = 1 - cl * 0.6;
      let r = o.ground[0] * k;
      let gg = o.ground[1] * k;
      let b = o.ground[2] * k;
      const vm = Math.min(1, vein);
      r += (o.vein[0] - r) * vm;
      gg += (o.vein[1] - gg) * vm;
      b += (o.vein[2] - b) * vm;
      r += (196 - r) * gold;
      gg += (150 - gg) * gold;
      b += (70 - b) * gold;
      // Slab joints: a hairline of darker grout, a touch rougher.
      const jx = x % slab;
      const jy = y % slab;
      const joint = jx < 1.5 || jy < 1.5 || jx > slab - 1.5 || jy > slab - 1.5;
      const i = y * n + x;
      if (joint) {
        r *= 0.62;
        gg *= 0.62;
        b *= 0.62;
        height[i] = 0.4;
        ao[i] = 0.7;
      }
      rough[i] = joint ? 0.5 : o.rough + vm * 0.08 + cl * 0.1;
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = gg;
      img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return { color: c, height, rough, ao, size: n };
}

/** Office carpet tiles: charcoal loop pile, quarter-turned tiles, a faint teal fleck, wear along the aisles. */
function carpet(n: number, seed: number): Painted {
  const rand = prng(seed);
  const c = canvas(n, n);
  const g = c.getContext("2d")!;
  const height = new Float32Array(n * n);
  const rough = new Float32Array(n * n).fill(0.95);
  const ao = new Float32Array(n * n).fill(1);
  const tiles = 4;
  const t = n / tiles;
  for (let ty = 0; ty < tiles; ty++) {
    for (let tx = 0; tx < tiles; tx++) {
      const turned = (tx + ty) % 2 === 1;
      const base = 40 + rand() * 6;
      g.fillStyle = `rgb(${base},${base + 2},${base + 6})`;
      g.fillRect(tx * t, ty * t, t, t);
      // Rows of loops: stripes across the tile, turned 90 degrees on alternate tiles.
      for (let k = 0; k < t; k += 3) {
        g.fillStyle = `rgba(${k % 6 ? 70 : 24},${k % 6 ? 74 : 26},${k % 6 ? 82 : 30},0.5)`;
        if (turned) g.fillRect(tx * t + k, ty * t, 1.5, t);
        else g.fillRect(tx * t, ty * t + k, t, 1.5);
        for (let j = 0; j < t; j++) {
          const x = turned ? tx * t + k : tx * t + j;
          const y = turned ? ty * t + j : ty * t + k;
          if (x < n && y < n) height[(y | 0) * n + (x | 0)] = 0.6;
        }
      }
      g.strokeStyle = "rgba(10,10,12,0.5)";
      g.lineWidth = 1;
      g.strokeRect(tx * t + 0.5, ty * t + 0.5, t - 1, t - 1);
    }
  }
  for (let i = 0; i < n * n * 0.004; i++) {
    g.fillStyle = rand() < 0.5 ? "rgba(60,150,150,0.35)" : "rgba(150,150,160,0.25)";
    g.fillRect(rand() * n, rand() * n, 1.5, 1.5);
  }
  blotches(g, n, rand, 6, "rgba(0,0,0,0.12)", n * 0.05, n * 0.15);
  for (let i = 0; i < n * n; i++) height[i] = (height[i] ?? 0) + rand() * 0.3;
  return { color: c, height, rough, ao, size: n };
}

/** A linear slat ceiling: dark bronze slats with black gaps between, slightly satin. */
function slats(n: number, seed: number): Painted {
  const rand = prng(seed);
  const c = canvas(n, n);
  const g = c.getContext("2d")!;
  const height = new Float32Array(n * n);
  const rough = new Float32Array(n * n);
  const ao = new Float32Array(n * n).fill(1);
  g.fillStyle = "#050506";
  g.fillRect(0, 0, n, n);
  const count = 8;
  const p = n / count;
  for (let k = 0; k < count; k++) {
    const x0 = k * p + p * 0.18;
    const w = p * 0.64;
    const tone = 70 + rand() * 10;
    const gr = g.createLinearGradient(x0, 0, x0 + w, 0);
    gr.addColorStop(0, `rgb(${tone * 0.7},${tone * 0.58},${tone * 0.45})`);
    gr.addColorStop(0.5, `rgb(${tone},${tone * 0.82},${tone * 0.62})`);
    gr.addColorStop(1, `rgb(${tone * 0.6},${tone * 0.5},${tone * 0.4})`);
    g.fillStyle = gr;
    g.fillRect(x0, 0, w, n);
    for (let y = 0; y < n; y++) {
      for (let x = Math.floor(x0); x < Math.ceil(x0 + w); x++) {
        const e = Math.min(x - x0, x0 + w - x) / (w / 2);
        height[y * n + x] = Math.sqrt(Math.max(0, e));
        rough[y * n + x] = 0.38;
      }
    }
  }
  for (let i = 0; i < n * n; i++) if (!rough[i]) {
    rough[i] = 0.9;
    ao[i] = 0.4;
  }
  return { color: c, height, rough, ao, size: n };
}

export type TowerTexId = "towerMarble" | "towerMarbleWall" | "towerCarpet" | "towerCeiling";

/** Paints every tower surface. 512 px per tile on phones, 1024 elsewhere. */
export function towerTextures(quality: "phone" | "high" | "ultra"): Record<TowerTexId, PbrSet> {
  const n = quality === "phone" ? 512 : 1024;
  return {
    // Floor: 1.5 m slabs (2 per 3 m tile), Calacatta white with grey veins and the odd gold one.
    towerMarble: toSet(marble(n, 2, 301, { ground: [236, 232, 224], vein: [96, 98, 104], gold: 0.9, rough: 0.12 }), 1.2),
    // Walls and columns: a warmer, cloudier stone in 1 m panels.
    towerMarbleWall: toSet(marble(n, 2, 311, { ground: [222, 214, 200], vein: [120, 112, 100], gold: 0.5, rough: 0.2 }), 1.0),
    towerCarpet: toSet(carpet(n / 2, 321), 0.8),
    towerCeiling: toSet(slats(n / 2, 331), 1.5),
  };
}
