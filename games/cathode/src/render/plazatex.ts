// Hollowell Plaza's ground (plan item 4): granite setts in running bond, painted on canvas at load like the
// clinic's surfaces (clinictex.ts). Each sett is domed, its own grey (blue-grey, pink-grey, a few dark), the
// tops worn smoother than the faces, and the joints sunk, dark and wet. Tiles every 3 m (the ground's UV scale).

import type { PbrSet } from "./textures";
import { canvas, prng } from "./textures";
import { blotches, toSet, type Painted } from "./clinictex";

/** Granite setts: `rows` courses per tile, `cols` setts per course, each course offset by half a sett. */
function setts(n: number, rows: number, cols: number, seed: number): Painted {
  const rand = prng(seed);
  const c = canvas(n, n);
  const g = c.getContext("2d")!;
  const height = new Float32Array(n * n).fill(0.05);
  const rough = new Float32Array(n * n).fill(0.2); // water stands in the joints
  const ao = new Float32Array(n * n).fill(0.55);
  g.fillStyle = "rgb(26,26,26)";
  g.fillRect(0, 0, n, n);
  const sh = n / rows;
  const sw = n / cols;
  const joint = Math.max(2, n / 220);
  const tones: Array<[number, number, number]> = [
    [112, 114, 118],
    [104, 108, 116],
    [120, 110, 108],
    [96, 98, 100],
    [128, 126, 122],
    [72, 74, 78],
  ];
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * sw * 0.5;
    for (let k = -1; k < cols; k++) {
      // Setts are hand-cut: widths wander a little, edges are not quite straight.
      const x0 = off + k * sw + joint / 2 + (rand() - 0.5) * joint;
      const y0 = r * sh + joint / 2 + (rand() - 0.5) * joint * 0.6;
      const w = sw - joint - rand() * joint;
      const h = sh - joint - rand() * joint * 0.6;
      const t = tones[rand() < 0.08 ? 5 : Math.floor(rand() * 5)]!;
      const kk = 0.9 + rand() * 0.2;
      const worn = rand();
      const rr = Math.min(w, h) * 0.22;
      for (const ox of [-n, 0, n]) {
        if (x0 + ox > n || x0 + w + ox < 0) continue;
        const gx = x0 + ox;
        g.fillStyle = `rgb(${(t[0] * kk) | 0},${(t[1] * kk) | 0},${(t[2] * kk) | 0})`;
        g.beginPath();
        g.roundRect(gx, y0, w, h, rr);
        g.fill();
        // A polished, darker crown where boots have worn it; a lighter rim where they don't reach.
        const gr = g.createRadialGradient(gx + w / 2, y0 + h / 2, 0, gx + w / 2, y0 + h / 2, Math.max(w, h) * 0.6);
        gr.addColorStop(0, `rgba(20,22,26,${0.12 + worn * 0.14})`);
        gr.addColorStop(0.7, "rgba(0,0,0,0)");
        gr.addColorStop(1, "rgba(200,200,196,0.10)");
        g.fillStyle = gr;
        g.fill();
        for (let y = Math.max(0, Math.floor(y0)); y < Math.min(n, Math.ceil(y0 + h)); y++) {
          for (let x = Math.floor(gx); x < Math.ceil(gx + w); x++) {
            if (x < 0 || x >= n) continue;
            const xx = x;
            const ex = Math.min(x - gx, gx + w - x) / (w / 2);
            const ey = Math.min(y - y0, y0 + h - y) / (h / 2);
            if (ex <= 0 || ey <= 0) continue;
            const e = Math.min(ex, ey);
            const i = y * n + xx;
            const dome = Math.sqrt(Math.min(1, e * 2.4));
            height[i] = 0.25 + dome * 0.75;
            rough[i] = 0.58 - worn * 0.22 * dome + rand() * 0.06;
            ao[i] = 0.7 + 0.3 * Math.min(1, e * 3);
          }
        }
      }
      // Granite grain: tiny pale feldspar and dark mica flecks.
      for (let f = 0; f < (w * h) / 22; f++) {
        const fx = (x0 + rand() * w + n) % n;
        const fy = y0 + rand() * h;
        g.fillStyle = rand() < 0.5 ? `rgba(230,226,220,${0.18 + rand() * 0.2})` : `rgba(20,20,24,${0.2 + rand() * 0.3})`;
        g.fillRect(fx, fy, 1 + rand(), 1 + rand());
      }
    }
  }
  // Grime and moss in the low corners of the square, oil and gum on the stone.
  blotches(g, n, rand, 10, "rgba(30,36,24,0.22)", n * 0.04, n * 0.16);
  blotches(g, n, rand, 6, "rgba(10,10,12,0.28)", n * 0.01, n * 0.04);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(180,176,170,${0.12 + rand() * 0.12})`;
    g.beginPath();
    g.arc(rand() * n, rand() * n, 1 + rand() * 2.2, 0, Math.PI * 2);
    g.fill();
  }
  return { color: c, height, rough, ao, size: n };
}

/** Paints the plaza's ground. 512 px per 3 m on phones, 1024 elsewhere. */
export function plazaTextures(quality: "phone" | "high" | "ultra"): { plazaSetts: PbrSet } {
  const n = quality === "phone" ? 512 : 1024;
  return { plazaSetts: toSet(setts(n, 26, 16, 91), 2.6) };
}
