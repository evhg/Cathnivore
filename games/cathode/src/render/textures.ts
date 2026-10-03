// Texture sources for the Drowned Market: the CC0 Poly Haven PBR sets in public/tex/ (credited in
// games/cathode/CREDITS.md) and everything procedural, painted on canvas at load (noise, window atlas,
// posters, grime, decals). Canvas textures are CSP-safe: they never leave the page.

import * as THREE from "three";

/** The PBR sets shipped in public/tex/, each as `<id>_diff.jpg`, `<id>_nor.jpg` (OpenGL normals) and `<id>_arm.jpg`. */
export const PBR_SETS = [
  "asphalt_02",
  "concrete_pavement",
  "concrete_wall_006",
  "concrete_slab_wall",
  "dark_brick_wall",
  "brick_wall_02",
  "plastered_wall_04",
  "corrugated_iron_02",
  "rusty_metal_02",
  "rusty_metal_shutter",
  "metal_grate_rusty",
  "wood_planks_grey",
  "dirty_tiles",
] as const;
export type PbrId = (typeof PBR_SETS)[number];

export interface PbrSet {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  arm: THREE.Texture;
}

/** Loads every PBR set in parallel; a missing file falls back to a flat texture so the level still builds. */
export async function loadPbr(
  renderer: THREE.WebGLRenderer,
  onEach: (done: number, total: number) => void,
  maxSize = 1024,
): Promise<Record<PbrId, PbrSet>> {
  const base = `${import.meta.env.BASE_URL}tex/`;
  const loader = new THREE.TextureLoader();
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const total = PBR_SETS.length * 3;
  let done = 0;
  const one = (file: string, srgb: boolean, fallback: [number, number, number]) =>
    new Promise<THREE.Texture>((resolve) => {
      loader.load(
        base + file,
        (t) => {
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          t.anisotropy = aniso;
          t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          if (maxSize < 1024 && t.image) t.image = downscale(t.image as HTMLImageElement, maxSize);
          onEach(++done, total);
          resolve(t);
        },
        undefined,
        () => {
          onEach(++done, total);
          resolve(flat(fallback, srgb));
        },
      );
    });
  const out = {} as Record<PbrId, PbrSet>;
  await Promise.all(
    PBR_SETS.map(async (id) => {
      const [map, normalMap, arm] = await Promise.all([
        one(`${id}_diff.jpg`, true, [110, 110, 110]),
        one(`${id}_nor.jpg`, false, [128, 128, 255]),
        one(`${id}_arm.jpg`, false, [255, 160, 0]),
      ]);
      out[id] = { map, normalMap, arm };
    }),
  );
  return out;
}

function downscale(img: HTMLImageElement, size: number): HTMLCanvasElement {
  const c = canvas(size, size);
  c.getContext("2d")!.drawImage(img, 0, 0, size, size);
  return c;
}

function flat(rgb: [number, number, number], srgb: boolean): THREE.Texture {
  const t = new THREE.DataTexture(new Uint8Array([rgb[0], rgb[1], rgb[2], 255]), 1, 1);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

export function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export function canvasTexture(c: HTMLCanvasElement, srgb = true, repeat = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** A small deterministic PRNG (mulberry32), so the level and its textures are the same every load. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A tileable RGBA value-noise texture (each channel a different octave set), used by every shader for
 * puddles, streaks, clouds and steam. 256² is plenty: shaders combine channels at several scales.
 */
export function noiseTexture(size = 256): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const rand = prng(1337);
  const lattice = (n: number) => {
    const g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i++) g[i] = rand();
    return g;
  };
  const sample = (g: Float32Array, n: number, x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const i = (a: number, b: number) => g[(((b % n) + n) % n) * n + (((a % n) + n) % n)]!;
    const a = i(xi, yi) + (i(xi + 1, yi) - i(xi, yi)) * sx;
    const b = i(xi, yi + 1) + (i(xi + 1, yi + 1) - i(xi, yi + 1)) * sx;
    return a + (b - a) * sy;
  };
  const octaves = [4, 8, 16, 32, 64];
  const grids = octaves.map((n) => lattice(n));
  const fbm = (u: number, v: number, start: number, count: number) => {
    let s = 0;
    let amp = 0.5;
    let norm = 0;
    for (let o = start; o < start + count && o < octaves.length; o++) {
      const n = octaves[o]!;
      s += sample(grids[o]!, n, u * n, v * n) * amp;
      norm += amp;
      amp *= 0.5;
    }
    return s / norm;
  };
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const k = (y * size + x) * 4;
      data[k] = fbm(u, v, 0, 4) * 255; // broad
      data[k + 1] = fbm(u, v, 1, 4) * 255; // medium
      data[k + 2] = fbm(u, v, 3, 2) * 255; // fine
      data[k + 3] = rand() * 255; // white noise
    }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

// ---------------------------------------------------------------------------------------------------
// Windows: an atlas of 8×4 window cells (diffuse glass and an emissive interior), so every window in the
// district is one instanced draw. Columns 0–1 are dark, the rest lit in different moods.
// ---------------------------------------------------------------------------------------------------
export const WIN_COLS = 8;
export const WIN_ROWS = 4;

export function windowAtlas(): { map: THREE.CanvasTexture; emissive: THREE.CanvasTexture } {
  const cw = 128;
  const ch = 192;
  const W = cw * WIN_COLS;
  const H = ch * WIN_ROWS;
  const dc = canvas(W, H);
  const ec = canvas(W, H);
  const d = dc.getContext("2d")!;
  const e = ec.getContext("2d")!;
  e.fillStyle = "#000";
  e.fillRect(0, 0, W, H);
  const rand = prng(77);
  const moods = [
    ["#ffb46b", "#7a3c1a"], // tungsten
    ["#ffd9a0", "#6b4a2a"], // warm
    ["#bfe6ff", "#20384a"], // fluorescent
    ["#7fb2ff", "#0d1e44"], // tv blue
    ["#ff5fbf", "#3a0c33"], // neon interior
    ["#9dffcf", "#0e3a2a"], // green clinic
  ];
  for (let row = 0; row < WIN_ROWS; row++)
    for (let col = 0; col < WIN_COLS; col++) {
      const x0 = col * cw;
      const y0 = row * ch;
      const lit = col >= 2;
      // Frame and glass.
      d.fillStyle = "#1a1b1e";
      d.fillRect(x0, y0, cw, ch);
      const gx = x0 + 10;
      const gy = y0 + 10;
      const gw = cw - 20;
      const gh = ch - 26;
      const glass = d.createLinearGradient(gx, gy, gx + gw, gy + gh);
      glass.addColorStop(0, "#2b3240");
      glass.addColorStop(0.5, "#11151c");
      glass.addColorStop(1, "#1d222b");
      d.fillStyle = glass;
      d.fillRect(gx, gy, gw, gh);
      // Mullion and transom.
      d.fillStyle = "#24262b";
      if (row % 2 === 0) d.fillRect(x0 + cw / 2 - 3, gy, 6, gh);
      d.fillRect(gx, gy + gh * 0.32, gw, 5);
      // Sill.
      d.fillStyle = "#3a3b3e";
      d.fillRect(x0 + 4, y0 + ch - 16, cw - 8, 10);
      if (!lit) {
        // Dark: blinds or a reflection streak.
        if (row % 2 === 1) {
          d.fillStyle = "rgba(60,62,68,0.55)";
          for (let s = 0; s < gh * 0.7; s += 7) d.fillRect(gx, gy + s, gw, 3);
        }
        d.fillStyle = "rgba(160,190,230,0.07)";
        d.beginPath();
        d.moveTo(gx + gw * 0.2, gy);
        d.lineTo(gx + gw * 0.45, gy);
        d.lineTo(gx + gw * 0.1, gy + gh);
        d.lineTo(gx - 10, gy + gh);
        d.fill();
        continue;
      }
      const [c1, c2] = moods[(col - 2 + row * 3) % moods.length]!;
      const g = e.createRadialGradient(gx + gw * (0.3 + rand() * 0.4), gy + gh * 0.35, 4, gx + gw / 2, gy + gh / 2, gh * 0.8);
      g.addColorStop(0, c1!);
      g.addColorStop(1, c2!);
      e.fillStyle = g;
      e.fillRect(gx, gy, gw, gh);
      // Interior detail: blinds, curtains, a silhouette, a plant.
      e.fillStyle = "rgba(0,0,0,0.75)";
      const kind = (row * WIN_COLS + col) % 5;
      if (kind === 0) for (let s = 0; s < gh; s += 9) e.fillRect(gx, gy + s, gw, 3 + (s % 27 === 0 ? 2 : 0));
      else if (kind === 1) {
        e.fillRect(gx, gy, gw * 0.28, gh);
        e.fillRect(gx + gw * 0.78, gy, gw * 0.22, gh);
      } else if (kind === 2) {
        // A figure at the window.
        e.beginPath();
        e.ellipse(gx + gw * 0.55, gy + gh * 0.42, 11, 14, 0, 0, Math.PI * 2);
        e.fill();
        e.fillRect(gx + gw * 0.55 - 22, gy + gh * 0.55, 44, gh * 0.45);
      } else if (kind === 3) {
        e.beginPath();
        e.ellipse(gx + gw * 0.25, gy + gh * 0.8, 16, 22, 0, 0, Math.PI * 2);
        e.fill();
        e.fillRect(gx, gy + gh * 0.88, gw, gh * 0.12);
      } else {
        // Shelves and boxes.
        for (let s = 1; s < 4; s++) e.fillRect(gx, gy + (gh * s) / 4, gw, 4);
        for (let b = 0; b < 6; b++) e.fillRect(gx + rand() * gw, gy + (gh * (1 + (b % 3))) / 4 - 14, 10 + rand() * 12, 14);
      }
      // Mullions cast over the light.
      e.fillStyle = "#000";
      if (row % 2 === 0) e.fillRect(x0 + cw / 2 - 3, gy, 6, gh);
      e.fillRect(gx, gy + gh * 0.32, gw, 5);
      // The glass itself picks up a little of the interior colour.
      d.globalAlpha = 0.35;
      d.fillStyle = c2!;
      d.fillRect(gx, gy, gw, gh);
      d.globalAlpha = 1;
    }
  const map = canvasTexture(dc);
  const emissive = canvasTexture(ec);
  for (const t of [map, emissive]) {
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
  }
  return { map, emissive };
}

// ---------------------------------------------------------------------------------------------------
// Decal atlas (4×4 cells of 128²): blood splats, bullet holes, scorch, chips. Alpha carries the shape.
// ---------------------------------------------------------------------------------------------------
export const DECAL = {
  blood: [0, 1, 2, 3, 4, 5],
  hole: [8, 9],
  holeMetal: [10],
  scorch: [11],
  puff: [12],
  crack: [13],
} as const;

export function decalAtlas(): THREE.CanvasTexture {
  const S = 128;
  const c = canvas(S * 4, S * 4);
  const g = c.getContext("2d")!;
  const rand = prng(4242);
  const cell = (i: number) => [(i % 4) * S, Math.floor(i / 4) * S] as const;
  // Blood: a dense core, satellite drops and directional streaks.
  for (const i of DECAL.blood) {
    const [x0, y0] = cell(i);
    const cx = x0 + S / 2;
    const cy = y0 + S / 2;
    g.save();
    g.beginPath();
    g.rect(x0, y0, S, S);
    g.clip();
    const red = (a: number) => `rgba(${70 + rand() * 30},${2 + rand() * 6},${4 + rand() * 6},${a})`;
    const core = 14 + rand() * 18;
    g.fillStyle = red(0.95);
    g.beginPath();
    for (let k = 0; k <= 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      const r = core * (0.7 + rand() * 0.5);
      g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.fill();
    const dir = rand() * Math.PI * 2;
    for (let k = 0; k < 40; k++) {
      const a = dir + (rand() - 0.5) * (i > 2 ? 1.2 : 6.2);
      const r = core + rand() * (S * 0.42 - core);
      const s = (1 - r / (S * 0.5)) * 6 + rand() * 2;
      g.fillStyle = red(0.9);
      g.beginPath();
      g.ellipse(cx + Math.cos(a) * r, cy + Math.sin(a) * r, s * (i > 2 ? 2 : 1), s, a, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
  // Bullet holes in concrete/plaster.
  for (const i of DECAL.hole) {
    const [x0, y0] = cell(i);
    const cx = x0 + S / 2;
    const cy = y0 + S / 2;
    const rg = g.createRadialGradient(cx, cy, 2, cx, cy, S * 0.36);
    rg.addColorStop(0, "rgba(0,0,0,1)");
    rg.addColorStop(0.18, "rgba(15,14,13,0.95)");
    rg.addColorStop(0.3, "rgba(70,66,60,0.6)");
    rg.addColorStop(1, "rgba(40,38,35,0)");
    g.fillStyle = rg;
    g.beginPath();
    for (let k = 0; k <= 18; k++) {
      const a = (k / 18) * Math.PI * 2;
      const r = S * (0.22 + rand() * 0.14);
      g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.fill();
    g.strokeStyle = "rgba(10,10,10,0.6)";
    g.lineWidth = 1.5;
    for (let k = 0; k < 6; k++) {
      const a = rand() * Math.PI * 2;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a) * S * 0.4, cy + Math.sin(a) * S * 0.4);
      g.stroke();
    }
  }
  {
    const [x0, y0] = cell(DECAL.holeMetal[0]);
    const cx = x0 + S / 2;
    const cy = y0 + S / 2;
    const rg = g.createRadialGradient(cx, cy, 3, cx, cy, S * 0.25);
    rg.addColorStop(0, "rgba(0,0,0,1)");
    rg.addColorStop(0.35, "rgba(30,30,32,1)");
    rg.addColorStop(0.5, "rgba(170,170,175,0.7)");
    rg.addColorStop(1, "rgba(120,120,125,0)");
    g.fillStyle = rg;
    g.fillRect(x0, y0, S, S);
  }
  {
    const [x0, y0] = cell(DECAL.scorch[0]);
    const cx = x0 + S / 2;
    const cy = y0 + S / 2;
    const rg = g.createRadialGradient(cx, cy, 4, cx, cy, S * 0.5);
    rg.addColorStop(0, "rgba(5,5,5,0.95)");
    rg.addColorStop(0.6, "rgba(15,12,10,0.6)");
    rg.addColorStop(1, "rgba(20,18,15,0)");
    g.fillStyle = rg;
    g.fillRect(x0, y0, S, S);
  }
  {
    const [x0, y0] = cell(DECAL.puff[0]);
    const cx = x0 + S / 2;
    const cy = y0 + S / 2;
    const rg = g.createRadialGradient(cx, cy, 2, cx, cy, S * 0.48);
    rg.addColorStop(0, "rgba(255,255,255,1)");
    rg.addColorStop(0.5, "rgba(255,255,255,0.45)");
    rg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = rg;
    g.fillRect(x0, y0, S, S);
  }
  {
    const [x0, y0] = cell(DECAL.crack[0]);
    g.strokeStyle = "rgba(0,0,0,0.8)";
    for (let k = 0; k < 9; k++) {
      let x = x0 + S / 2;
      let y = y0 + S / 2;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x, y);
      const a = rand() * Math.PI * 2;
      for (let s = 0; s < 6; s++) {
        x += Math.cos(a + (rand() - 0.5)) * 9;
        y += Math.sin(a + (rand() - 0.5)) * 9;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  }
  const t = canvasTexture(c);
  t.generateMipmaps = true;
  return t;
}

/** Cell offset and size in the 4×4 decal atlas. */
export function decalCell(i: number): [number, number] {
  return [(i % 4) * 0.25, 1 - (Math.floor(i / 4) + 1) * 0.25];
}

// ---------------------------------------------------------------------------------------------------
// Posters and graffiti (4×2 cells, 256×384 each): the city talking to itself.
// ---------------------------------------------------------------------------------------------------
export const POSTER_COUNT = 8;

export function posterAtlas(): THREE.CanvasTexture {
  const pw = 256;
  const ph = 384;
  const c = canvas(pw * 4, ph * 2);
  const g = c.getContext("2d")!;
  const rand = prng(99);
  const sans = "'Helvetica Neue', 'Arial Narrow', Arial, 'Liberation Sans', sans-serif";
  const cjk = "'Hiragino Sans', 'PingFang SC', 'Apple SD Gothic Neo', 'Noto Sans CJK JP', 'WenQuanYi Zen Hei', sans-serif";
  const posters: Array<(x: number, y: number) => void> = [
    (x, y) => {
      bg(x, y, "#c9b48a", "#8d7a55");
      g.fillStyle = "#1b1b1b";
      g.font = `bold 34px ${sans}`;
      g.fillText("HAVE YOU", x + 20, y + 52);
      g.fillText("SEEN HIM?", x + 20, y + 88);
      g.fillStyle = "#3b352b";
      g.fillRect(x + 48, y + 110, 160, 170);
      g.fillStyle = "#6f6455";
      g.beginPath();
      g.ellipse(x + 128, y + 175, 40, 50, 0, 0, Math.PI * 2);
      g.fill();
      g.fillRect(x + 70, y + 225, 116, 55);
      g.fillStyle = "#1b1b1b";
      g.font = `bold 26px ${sans}`;
      g.fillText("TOMAS REED", x + 46, y + 318);
      g.font = `16px ${sans}`;
      g.fillText("Eggs, stall 14. Call anyone.", x + 30, y + 346);
    },
    (x, y) => {
      bg(x, y, "#0f2a3d", "#081520");
      g.fillStyle = "#e9f4ff";
      g.font = `bold 46px ${sans}`;
      g.fillText("DEBT", x + 24, y + 80);
      g.fillText("IS", x + 24, y + 128);
      g.fillStyle = "#58d1ff";
      g.fillText("FREEDOM", x + 24, y + 176);
      g.fillStyle = "#e9f4ff";
      g.font = `18px ${sans}`;
      g.fillText("HOLLOWELL CREDIT · 0% FOR LIFE*", x + 22, y + 330);
      g.font = `11px ${sans}`;
      g.fillText("*life terms apply", x + 22, y + 352);
    },
    (x, y) => {
      bg(x, y, "#e8e3da", "#b9b1a4");
      g.fillStyle = "#c2183c";
      g.beginPath();
      g.arc(x + 128, y + 140, 70, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#fff";
      g.font = `bold 40px ${sans}`;
      g.fillText("BE MORE", x + 46, y + 152);
      g.fillStyle = "#222";
      g.font = `bold 30px ${sans}`;
      g.fillText("CANDOR CLINIC", x + 18, y + 270);
      g.font = `16px ${sans}`;
      g.fillText("New eyes. New you. Same debt.", x + 20, y + 300);
    },
    (x, y) => {
      bg(x, y, "#1d1d1d", "#0b0b0b");
      g.fillStyle = "#ffcc00";
      g.font = `bold 60px ${cjk}`;
      g.fillText("鮮魚", x + 64, y + 110);
      g.fillStyle = "#ffffff";
      g.font = `bold 30px ${cjk}`;
      g.fillText("생선 시장", x + 54, y + 170);
      g.font = `bold 28px ${sans}`;
      g.fillText("FRESH TODAY", x + 30, y + 250);
      g.fillStyle = "#ffcc00";
      g.fillText("AFLOAT SINCE '61", x + 18, y + 290);
    },
    (x, y) => {
      bg(x, y, "#8a1010", "#3d0505");
      g.fillStyle = "#fff";
      g.font = `bold 38px ${sans}`;
      g.fillText("CURFEW", x + 40, y + 70);
      g.font = `bold 66px ${sans}`;
      g.fillText("23:00", x + 34, y + 160);
      g.font = `18px ${sans}`;
      g.fillText("ENFORCERS ARE HERE", x + 30, y + 230);
      g.fillText("FOR YOUR SAFETY", x + 50, y + 256);
      g.font = `bold 22px ${sans}`;
      g.fillText("HOLLOWELL", x + 64, y + 330);
    },
    (x, y) => {
      bg(x, y, "#222b22", "#121612");
      g.fillStyle = "#9dff6a";
      g.font = `bold 44px ${sans}`;
      g.fillText("0.99", x + 60, y + 90);
      g.font = `bold 34px ${sans}`;
      g.fillText("NOODLE", x + 58, y + 132);
      g.fillStyle = "#fff";
      g.font = `bold 54px ${cjk}`;
      g.fillText("拉麺", x + 74, y + 230);
      g.font = `16px ${sans}`;
      g.fillText("Now with real protein", x + 44, y + 320);
    },
    (x, y) => {
      // Graffiti wall tag.
      g.clearRect(x, y, pw, ph);
      g.lineCap = "round";
      g.lineJoin = "round";
      g.strokeStyle = "#ff3a7a";
      g.lineWidth = 16;
      g.font = `bold italic 70px ${sans}`;
      g.strokeText("PIN", x + 50, y + 170);
      g.fillStyle = "#1a1a1a";
      g.fillText("PIN", x + 50, y + 170);
      g.strokeStyle = "#5ef0ff";
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(x + 30, y + 200);
      g.bezierCurveTo(x + 90, y + 240, x + 160, y + 180, x + 230, y + 220);
      g.stroke();
      g.fillStyle = "#fff";
      g.font = `bold 24px ${sans}`;
      g.fillText("WHO SIGNED IT?", x + 30, y + 280);
    },
    (x, y) => {
      bg(x, y, "#d8d0c0", "#a39983");
      g.fillStyle = "#222";
      g.font = `bold 30px ${sans}`;
      g.fillText("HOLLOWELL", x + 36, y + 60);
      g.font = `bold 52px ${sans}`;
      g.fillText("CARES", x + 50, y + 116);
      g.fillStyle = "#555";
      g.fillRect(x + 30, y + 140, 196, 120);
      g.fillStyle = "#c33";
      g.beginPath();
      g.moveTo(x + 128, y + 250);
      g.bezierCurveTo(x + 50, y + 190, x + 90, y + 140, x + 128, y + 180);
      g.bezierCurveTo(x + 166, y + 140, x + 206, y + 190, x + 128, y + 250);
      g.fill();
      g.fillStyle = "#222";
      g.font = `15px ${sans}`;
      g.fillText("Report unlicensed trading.", x + 34, y + 300);
    },
  ];
  function bg(x: number, y: number, a: string, b: string) {
    const gr = g.createLinearGradient(x, y, x, y + ph);
    gr.addColorStop(0, a);
    gr.addColorStop(1, b);
    g.fillStyle = gr;
    g.fillRect(x, y, pw, ph);
  }
  posters.forEach((draw, i) => {
    const x = (i % 4) * pw;
    const y = Math.floor(i / 4) * ph;
    g.save();
    g.beginPath();
    g.rect(x, y, pw, ph);
    g.clip();
    draw(x, y);
    if (i !== 6) {
      // Weathering: water stains, a torn corner, rain streaks.
      for (let k = 0; k < 30; k++) {
        g.fillStyle = `rgba(30,25,15,${0.05 + rand() * 0.1})`;
        g.fillRect(x + rand() * pw, y + rand() * ph * 0.5, 2 + rand() * 4, ph * (0.2 + rand() * 0.6));
      }
      g.globalCompositeOperation = "destination-out";
      g.beginPath();
      const corner = rand();
      if (corner < 0.5) {
        g.moveTo(x + pw, y + ph);
        g.lineTo(x + pw - 40 - rand() * 60, y + ph);
        g.lineTo(x + pw - 10, y + ph - 50 - rand() * 70);
      } else {
        g.moveTo(x, y);
        g.lineTo(x + 30 + rand() * 50, y);
        g.lineTo(x, y + 40 + rand() * 50);
      }
      g.fill();
      g.globalCompositeOperation = "source-over";
    }
    g.restore();
  });
  const t = canvasTexture(c);
  t.generateMipmaps = true;
  return t;
}

/** A stripy tarp canvas (repeating), for market stall roofs. */
export function tarpTexture(): THREE.CanvasTexture {
  const c = canvas(256, 256);
  const g = c.getContext("2d")!;
  const stripes = ["#1f4d8a", "#d7d2c8", "#a8232c", "#d7d2c8", "#1d6b4a", "#d7d2c8"];
  const rand = prng(5);
  for (let i = 0; i < stripes.length; i++) {
    g.fillStyle = stripes[i]!;
    g.fillRect(0, (i * 256) / stripes.length, 256, 256 / stripes.length);
  }
  for (let k = 0; k < 400; k++) {
    g.fillStyle = `rgba(0,0,0,${rand() * 0.12})`;
    g.fillRect(rand() * 256, rand() * 256, 2 + rand() * 20, 1 + rand() * 3);
  }
  return canvasTexture(c, true, true);
}

/** The inside of a lit shop, seen through glass: shelves, a counter, a fridge glow. */
export function shopInterior(seed: number, tint: string): THREE.CanvasTexture {
  const c = canvas(256, 128);
  const g = c.getContext("2d")!;
  const rand = prng(seed);
  const gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, tint);
  gr.addColorStop(1, "#140d08");
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 128);
  for (let s = 0; s < 4; s++) {
    g.fillStyle = "rgba(0,0,0,0.6)";
    g.fillRect(0, 20 + s * 24, 256, 4);
    for (let k = 0; k < 18; k++) {
      g.fillStyle = `hsla(${rand() * 360},60%,${30 + rand() * 30}%,0.85)`;
      g.fillRect(rand() * 250, 8 + s * 24, 6 + rand() * 10, 12);
    }
  }
  g.fillStyle = "rgba(0,0,0,0.8)";
  g.fillRect(150, 80, 106, 48);
  g.beginPath();
  g.ellipse(120, 92, 9, 11, 0, 0, Math.PI * 2);
  g.fill();
  g.fillRect(108, 102, 24, 26);
  return canvasTexture(c);
}

/** A vending machine front: a lit product grid with a header. */
export function vendingFront(title: string, hue: number): THREE.CanvasTexture {
  const c = canvas(128, 256);
  const g = c.getContext("2d")!;
  g.fillStyle = `hsl(${hue},70%,12%)`;
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = `hsl(${hue},90%,60%)`;
  g.fillRect(6, 6, 116, 40);
  g.fillStyle = "#111";
  g.font = "bold 22px 'Arial Narrow', Arial, 'Liberation Sans', sans-serif";
  g.textAlign = "center";
  g.fillText(title, 64, 34);
  const rand = prng(hue);
  for (let r = 0; r < 5; r++)
    for (let k = 0; k < 4; k++) {
      g.fillStyle = `hsl(${(hue + rand() * 120) % 360},80%,${45 + rand() * 25}%)`;
      g.fillRect(12 + k * 28, 58 + r * 30, 18, 22);
      g.fillStyle = "rgba(255,255,255,0.8)";
      g.fillRect(12 + k * 28, 82 + r * 30, 18, 3);
    }
  g.fillStyle = "#050505";
  g.fillRect(14, 214, 100, 30);
  return canvasTexture(c);
}

/** The giant billboard screen on the Hollowell tower: three slides stacked vertically, cycled by UV. */
export function billboardTexture(): THREE.CanvasTexture {
  const W = 512;
  const H = 288;
  const c = canvas(W, H * 3);
  const g = c.getContext("2d")!;
  const sans = "'Helvetica Neue', Arial, 'Liberation Sans', sans-serif";
  const cjk = "'Hiragino Sans', 'PingFang SC', 'Noto Sans CJK JP', 'WenQuanYi Zen Hei', sans-serif";
  // Slide 1: HOLLOWELL — WE DELIVER.
  let gr = g.createLinearGradient(0, 0, W, H);
  gr.addColorStop(0, "#00131f");
  gr.addColorStop(1, "#004a6e");
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#7ff3ff";
  g.font = `bold 86px ${sans}`;
  g.textAlign = "center";
  g.fillText("HOLLOWELL", W / 2, 130);
  g.fillStyle = "#ffffff";
  g.font = `bold 40px ${sans}`;
  g.fillText("— WE DELIVER —", W / 2, 190);
  g.fillStyle = "#7ff3ff";
  g.font = `bold 30px ${cjk}`;
  g.fillText("配達します  ·  배달합니다", W / 2, 245);
  // Slide 2: a red-lipped face silhouette for Candor.
  gr = g.createLinearGradient(0, H, 0, 2 * H);
  gr.addColorStop(0, "#2a0010");
  gr.addColorStop(1, "#7a0030");
  g.fillStyle = gr;
  g.fillRect(0, H, W, H);
  g.fillStyle = "#ff3f7f";
  g.beginPath();
  g.ellipse(150, H + 150, 90, 120, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#1a0008";
  g.beginPath();
  g.ellipse(130, H + 120, 22, 10, 0, 0, Math.PI * 2);
  g.ellipse(185, H + 120, 22, 10, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#ffffff";
  g.font = `bold 64px ${sans}`;
  g.textAlign = "left";
  g.fillText("BE MORE.", 270, H + 140);
  g.font = `28px ${sans}`;
  g.fillText("CANDOR CLINIC", 274, H + 190);
  // Slide 3: Wholesome Hollow Fresh.
  gr = g.createLinearGradient(0, 2 * H, W, 3 * H);
  gr.addColorStop(0, "#2b1600");
  gr.addColorStop(1, "#ff8a00");
  g.fillStyle = gr;
  g.fillRect(0, 2 * H, W, H);
  g.fillStyle = "#fff6d8";
  g.textAlign = "center";
  g.font = `bold 58px ${sans}`;
  g.fillText("WHOLESOME", W / 2, 2 * H + 110);
  g.fillText("HOLLOW FRESH", W / 2, 2 * H + 175);
  g.font = `26px ${sans}`;
  g.fillText("Farm taste. Factory price.", W / 2, 2 * H + 235);
  // Scanlines over everything.
  g.fillStyle = "rgba(0,0,0,0.25)";
  for (let y = 0; y < 3 * H; y += 3) g.fillRect(0, y, W, 1);
  return canvasTexture(c);
}
