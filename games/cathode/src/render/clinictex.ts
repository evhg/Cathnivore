// The Candor Clinic's surfaces (two-week plan item 1), painted on canvas at load so they cost no download:
// glazed wall tile with grout and grime, a green dado tile, sheet-vinyl floor tiles with scuffs, and a
// suspended acoustic ceiling grid. Each is a full PBR set (colour, OpenGL normal from a height field, and
// AO/roughness/metal in R/G/B) that tiles every 2 m, matching the Builder's default UV scale.

import * as THREE from "three";
import type { PbrSet } from "./textures";
import { canvas, prng } from "./textures";

export type ClinicTexId = "clinicWall" | "clinicDado" | "clinicFloor" | "clinicCeiling" | "clinicSteel";

interface Painted {
  color: HTMLCanvasElement;
  height: Float32Array;
  rough: Float32Array;
  ao: Float32Array;
  size: number;
}

function tex(c: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** Packs a painted surface into a PBR set: a wrapped Sobel normal from the height, AO and roughness into ARM. */
function toSet(p: Painted, strength: number): PbrSet {
  const n = p.size;
  const nc = canvas(n, n);
  const ac = canvas(n, n);
  const nd = nc.getContext("2d")!.createImageData(n, n);
  const ad = ac.getContext("2d")!.createImageData(n, n);
  const h = (x: number, y: number) => p.height[((y + n) % n) * n + ((x + n) % n)] ?? 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = (h(x + 1, y - 1) + 2 * h(x + 1, y) + h(x + 1, y + 1) - h(x - 1, y - 1) - 2 * h(x - 1, y) - h(x - 1, y + 1)) * strength;
      const dy = (h(x - 1, y + 1) + 2 * h(x, y + 1) + h(x + 1, y + 1) - h(x - 1, y - 1) - 2 * h(x, y - 1) - h(x + 1, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * n + x) * 4;
      // Canvas y runs down, texture v runs up: flip the green channel's slope for OpenGL normals.
      nd.data[i] = Math.round((-dx / l) * 127.5 + 127.5);
      nd.data[i + 1] = Math.round((dy / l) * 127.5 + 127.5);
      nd.data[i + 2] = Math.round((1 / l) * 127.5 + 127.5);
      nd.data[i + 3] = 255;
      ad.data[i] = Math.round(255 * (p.ao[y * n + x] ?? 1));
      ad.data[i + 1] = Math.round(255 * (p.rough[y * n + x] ?? 1));
      ad.data[i + 2] = 0;
      ad.data[i + 3] = 255;
    }
  }
  nc.getContext("2d")!.putImageData(nd, 0, 0);
  ac.getContext("2d")!.putImageData(ad, 0, 0);
  return { map: tex(p.color, true), normalMap: tex(nc, false), arm: tex(ac, false) };
}

/** Soft blotches (grime, water stains), drawn wrapped so the texture still tiles. */
function blotches(g: CanvasRenderingContext2D, n: number, rand: () => number, count: number, rgba: string, rMin: number, rMax: number): void {
  for (let i = 0; i < count; i++) {
    const x = rand() * n;
    const y = rand() * n;
    const r = rMin + rand() * (rMax - rMin);
    for (const ox of [-n, 0, n]) {
      for (const oy of [-n, 0, n]) {
        const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        gr.addColorStop(0, rgba);
        gr.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = gr;
        g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
  }
}

/**
 * A grid of glazed tiles: `cells` per side, grout `grout` px wide. Each tile gets its own shade, a glaze
 * highlight and a bevel; a few are cracked or stained. `tone` is the base glaze colour (0..255 RGB).
 */
function tiles(n: number, cells: number, grout: number, tone: [number, number, number], groutRgb: [number, number, number], seed: number, o: { grime: number; cracks: number; jitter: number; glossy: number; rows?: number }): Painted {
  const rand = prng(seed);
  const c = canvas(n, n);
  const g = c.getContext("2d")!;
  const rows = o.rows ?? cells;
  const tw = n / cells;
  const th = n / rows;
  const height = new Float32Array(n * n);
  const rough = new Float32Array(n * n).fill(0.9);
  const ao = new Float32Array(n * n).fill(1);
  g.fillStyle = `rgb(${groutRgb.join(",")})`;
  g.fillRect(0, 0, n, n);
  const bevel = Math.max(2, grout);
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cells; tx++) {
      const k = 1 + (rand() - 0.5) * o.jitter;
      const r = Math.min(255, tone[0] * k);
      const gg = Math.min(255, tone[1] * k);
      const b = Math.min(255, tone[2] * k);
      const x0 = tx * tw + grout / 2;
      const y0 = ty * th + grout / 2;
      const w = tw - grout;
      const hgt = th - grout;
      g.fillStyle = `rgb(${r | 0},${gg | 0},${b | 0})`;
      g.fillRect(x0, y0, w, hgt);
      // Glaze: a soft highlight at the top-left of each tile, a darker lip at the bottom-right.
      const gl = g.createLinearGradient(x0, y0, x0 + w, y0 + hgt);
      gl.addColorStop(0, "rgba(255,255,255,0.10)");
      gl.addColorStop(0.5, "rgba(255,255,255,0)");
      gl.addColorStop(1, "rgba(0,0,0,0.08)");
      g.fillStyle = gl;
      g.fillRect(x0, y0, w, hgt);
      const cracked = rand() < o.cracks;
      for (let y = Math.floor(y0); y < Math.ceil(y0 + hgt); y++) {
        for (let x = Math.floor(x0); x < Math.ceil(x0 + w); x++) {
          if (x < 0 || y < 0 || x >= n || y >= n) continue;
          const e = Math.min(x - x0, y - y0, x0 + w - x, y0 + hgt - y);
          const i = y * n + x;
          height[i] = Math.min(1, e / bevel) * 0.85 + 0.15;
          rough[i] = 0.18 + (1 - o.glossy) * 0.5 + rand() * 0.04;
          ao[i] = 0.75 + 0.25 * Math.min(1, e / (bevel * 2));
        }
      }
      if (cracked) {
        g.strokeStyle = "rgba(30,34,30,0.55)";
        g.lineWidth = 1;
        g.beginPath();
        let cx = x0 + rand() * w;
        let cy = y0;
        g.moveTo(cx, cy);
        for (let s = 0; s < 6; s++) {
          cx += (rand() - 0.5) * w * 0.4;
          cy += hgt / 6;
          g.lineTo(Math.max(x0, Math.min(x0 + w, cx)), cy);
          const i = Math.min(n - 1, Math.max(0, Math.round(cy))) * n + Math.min(n - 1, Math.max(0, Math.round(cx)));
          height[i] = 0.2;
        }
        g.stroke();
      }
    }
  }
  // Grout reads dirtier than the glaze: grime collects in it and in the blotches.
  blotches(g, n, rand, Math.round(14 * o.grime), "rgba(70,62,40,0.16)", n * 0.05, n * 0.22);
  blotches(g, n, rand, Math.round(8 * o.grime), "rgba(40,48,36,0.14)", n * 0.02, n * 0.08);
  // Drip streaks running down from the odd grout joint (wrapped vertically).
  g.strokeStyle = "rgba(90,78,52,0.12)";
  for (let i = 0; i < Math.round(10 * o.grime); i++) {
    const x = rand() * n;
    const y = rand() * n;
    const l = n * (0.1 + rand() * 0.3);
    g.lineWidth = 1 + rand() * 2.5;
    for (const oy of [-n, 0]) {
      g.beginPath();
      g.moveTo(x, y + oy);
      g.lineTo(x + (rand() - 0.5) * 3, y + oy + l);
      g.stroke();
    }
  }
  return { color: c, height, rough, ao, size: n };
}

/** A suspended ceiling: mineral-fibre panels (pitted, a few water-stained) in a pale T-bar grid. */
function ceiling(n: number, seed: number): Painted {
  const rand = prng(seed);
  const p = tiles(n, 4, 8, [196, 200, 192], [168, 172, 168], seed, { grime: 0, cracks: 0, jitter: 0.05, glossy: 0 });
  const g = p.color.getContext("2d")!;
  // Fissured mineral fibre: dark pits all over.
  for (let i = 0; i < n * n * 0.02; i++) {
    const x = (rand() * n) | 0;
    const y = (rand() * n) | 0;
    g.fillStyle = `rgba(60,60,56,${0.15 + rand() * 0.25})`;
    g.fillRect(x, y, 1 + (rand() * 2) | 0, 1);
    p.height[y * n + x]! *= 0.7;
  }
  // Leak stains: brown rings on a couple of panels.
  for (let i = 0; i < 3; i++) {
    const x = rand() * n;
    const y = rand() * n;
    const r = n * (0.04 + rand() * 0.06);
    const gr = g.createRadialGradient(x, y, r * 0.3, x, y, r);
    gr.addColorStop(0, "rgba(150,120,70,0.25)");
    gr.addColorStop(0.8, "rgba(120,90,40,0.4)");
    gr.addColorStop(1, "rgba(120,90,40,0)");
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // The T-bar grid itself is painted metal: smoother than the panels.
  for (let i = 0; i < n * n; i++) if ((p.height[i] ?? 1) < 0.2) p.rough[i] = 0.45;
  return p;
}

/** Sheet vinyl laid as large tiles: speckled, two tones checkered, with scuffs and a dull sheen. */
function floor(n: number, seed: number): Painted {
  const rand = prng(seed);
  const p = tiles(n, 4, 3, [176, 184, 176], [96, 104, 98], seed, { grime: 1.4, cracks: 0, jitter: 0.04, glossy: 0.55 });
  const g = p.color.getContext("2d")!;
  const tw = n / 4;
  for (let ty = 0; ty < 4; ty++) {
    for (let tx = 0; tx < 4; tx++) {
      if ((tx + ty) % 2) {
        g.fillStyle = "rgba(60,96,84,0.22)";
        g.fillRect(tx * tw + 1.5, ty * tw + 1.5, tw - 3, tw - 3);
      }
    }
  }
  // Terrazzo-style speckle.
  for (let i = 0; i < n * n * 0.03; i++) {
    const x = rand() * n;
    const y = rand() * n;
    const v = rand();
    g.fillStyle = v < 0.5 ? `rgba(40,50,46,${0.2 + rand() * 0.3})` : `rgba(240,244,236,${0.2 + rand() * 0.3})`;
    g.fillRect(x, y, 1 + rand() * 1.5, 1 + rand() * 1.5);
  }
  // Black heel and gurney-wheel scuffs: short arcs, rougher than the polished vinyl.
  for (let i = 0; i < 26; i++) {
    const x = rand() * n;
    const y = rand() * n;
    const r = 6 + rand() * 30;
    const a0 = rand() * Math.PI * 2;
    g.strokeStyle = `rgba(20,22,22,${0.15 + rand() * 0.3})`;
    g.lineWidth = 0.8 + rand() * 1.6;
    g.beginPath();
    g.arc(x, y, r, a0, a0 + 0.3 + rand() * 0.9);
    g.stroke();
  }
  // Polish wears off in patches.
  const k = new Float32Array(n * n);
  for (let i = 0; i < 6; i++) {
    const cx = rand() * n;
    const cy = rand() * n;
    const r = n * (0.1 + rand() * 0.2);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const dx = Math.min(Math.abs(x - cx), n - Math.abs(x - cx));
        const dy = Math.min(Math.abs(y - cy), n - Math.abs(y - cy));
        k[y * n + x] = Math.max(k[y * n + x] ?? 0, 1 - Math.hypot(dx, dy) / r);
      }
    }
  }
  for (let i = 0; i < n * n; i++) p.rough[i] = Math.min(0.95, (p.rough[i] ?? 1) + (k[i] ?? 0) * 0.35);
  return p;
}

/** Brushed stainless (the morgue's drawers, cabinets): fine horizontal grain, smudged prints, tea-stain rust. */
function steel(n: number, seed: number): Painted {
  const rand = prng(seed);
  const color = canvas(n, n);
  const g = color.getContext("2d")!;
  const height = new Float32Array(n * n).fill(0.5);
  const rough = new Float32Array(n * n);
  const ao = new Float32Array(n * n).fill(1);
  g.fillStyle = "rgb(150,156,156)";
  g.fillRect(0, 0, n, n);
  // The grain: one streak per row, each its own brightness and roughness, broken into runs.
  for (let y = 0; y < n; y++) {
    let x = 0;
    while (x < n) {
      const run = 8 + rand() * n * 0.4;
      const v = (rand() - 0.5) * 34;
      g.fillStyle = v > 0 ? `rgba(255,255,255,${v / 255})` : `rgba(0,0,0,${-v / 255})`;
      g.fillRect(x, y, run, 1);
      const r = 0.26 + rand() * 0.14;
      for (let i = x | 0; i < Math.min(n, x + run); i++) {
        rough[y * n + i] = r;
        height[y * n + i] = 0.5 + v / 400;
      }
      x += run;
    }
  }
  // Hand smudges and prints: duller, rougher patches.
  const before = g.getImageData(0, 0, n, n).data;
  blotches(g, n, rand, 22, "rgba(90,96,92,0.22)", n * 0.02, n * 0.07);
  blotches(g, n, rand, 5, "rgba(140,96,50,0.18)", n * 0.03, n * 0.09);
  const after = g.getImageData(0, 0, n, n).data;
  for (let i = 0; i < n * n; i++) {
    const d = Math.abs((before[i * 4] ?? 0) - (after[i * 4] ?? 0)) / 40;
    rough[i] = Math.min(0.85, (rough[i] ?? 0.3) + d);
  }
  return { color, height, rough, ao, size: n };
}

/** Paints every clinic surface. 512 px per 2 m on phones, 1024 elsewhere. */
export function clinicTextures(quality: "phone" | "high" | "ultra"): Record<ClinicTexId, PbrSet> {
  const n = quality === "phone" ? 512 : 1024;
  // Wall: 10 x 10 white tiles per 2 m (20 cm glazed squares), slightly green-grey, pale grout.
  const wall = tiles(n, 10, n / 160, [214, 226, 218], [150, 156, 146], 71, { grime: 1, cracks: 0.04, jitter: 0.06, glossy: 0.9 });
  // Dado: 20 x 10 cm green brick-bond rows read as an older hospital band.
  const dado = tiles(n, 10, n / 160, [74, 140, 118], [120, 130, 118], 72, { grime: 1.2, cracks: 0.05, jitter: 0.12, glossy: 0.9, rows: 20 });
  return {
    clinicWall: toSet(wall, 2.2),
    clinicDado: toSet(dado, 2.2),
    clinicFloor: toSet(floor(n, 73), 1.2),
    clinicCeiling: toSet(ceiling(n, 74), 1.5),
    clinicSteel: toSet(steel(n / 2, 75), 0.6),
  };
}
