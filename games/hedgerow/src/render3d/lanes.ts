// The lane's surface in each act: packed earth with ruts and a grass crown in Brindle Hills, a peaty track
// set with stones on Highmoor, a timber boardwalk over the Saltmarsh mud, a puddled track at Rivermead,
// a leaf-littered path through Oakvale, shingle at Shingle Bay, a tyre-marked haul road through the Rift,
// a village lane with a painted line for the Ballot, concrete slabs at the Merger and cobbles in
// Kingsmarket. Each is one ribbon mesh laid along the lane's centreline with a painted canvas texture
// (one draw call), plus at most one instanced mesh of edge detail (boardwalk posts, puddles).

import * as THREE from "three";
import type { Level } from "../engine";

/** Half the lane's width, and how much of each side fades into the verge (fractions of the half-width). */
interface LaneStyle {
  half: number;
  fade: number;
  rough: number;
  /** Path-ish acts let loose stones lie in the ruts; paved and boarded ones don't. */
  looseStones: boolean;
}

const STYLES: LaneStyle[] = [
  { half: 0.46, fade: 0.3, rough: 0.95, looseStones: true }, // Brindle Hills: packed earth
  { half: 0.46, fade: 0.3, rough: 0.95, looseStones: true }, // Highmoor: peat and stones
  { half: 0.4, fade: 0.06, rough: 0.85, looseStones: false }, // Saltmarsh: boardwalk
  { half: 0.47, fade: 0.32, rough: 0.6, looseStones: true }, // Rivermead: wet mud
  { half: 0.46, fade: 0.34, rough: 0.95, looseStones: true }, // Oakvale: leaf litter
  { half: 0.47, fade: 0.28, rough: 0.9, looseStones: true }, // Shingle Bay: shingle
  { half: 0.45, fade: 0.08, rough: 0.8, looseStones: false }, // the Rift: tarmac haul road
  { half: 0.43, fade: 0.12, rough: 0.8, looseStones: false }, // the Ballot: village lane
  { half: 0.44, fade: 0.06, rough: 0.85, looseStones: false }, // the Merger: concrete slabs
  { half: 0.44, fade: 0.08, rough: 0.75, looseStones: false }, // Kingsmarket: cobbles
];

export function laneStyle(act: number): LaneStyle {
  return STYLES[Math.max(0, Math.min(STYLES.length - 1, act))]!;
}

// ---- textures: u runs across the lane (0 = left edge), v along it; one texture covers TILE cells ----

const TILE = 2;
const TW = 128;
const TH = 256;
const texCache = new Map<number, THREE.Texture>();

type Paint = (ctx: CanvasRenderingContext2D, r: () => number) => void;

function speckle(ctx: CanvasRenderingContext2D, r: () => number, n: number, colors: string[], size: number, alpha = 0.5): void {
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = alpha * (0.4 + r() * 0.6);
    ctx.fillStyle = colors[Math.floor(r() * colors.length)]!;
    const s = size * (0.5 + r());
    ctx.fillRect(r() * TW, r() * TH, s, s);
  }
  ctx.globalAlpha = 1;
}

/** A soft streak along the lane at u (0..1) of the given width (px), drawn down the whole tile. */
function streak(ctx: CanvasRenderingContext2D, u: number, w: number, color: string, alpha: number): void {
  const x = u * TW;
  const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.5, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(x - w, 0, w * 2, TH);
  ctx.globalAlpha = 1;
}

/** Wraps a draw at every vertical offset that keeps it seamless along the tile. */
function wrapY(y: number, h: number, draw: (y: number) => void): void {
  draw(y);
  if (y - h < 0) draw(y + TH);
  if (y + h > TH) draw(y - TH);
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot: number, fill: string): void {
  wrapY(y, Math.max(rx, ry), (yy) => {
    ctx.beginPath();
    ctx.ellipse(x, yy, rx, ry, rot, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  });
}

/** Small rounded stones, lit from the top left: a shadow, the stone, a highlight. */
function stones(ctx: CanvasRenderingContext2D, r: () => number, n: number, colors: string[], size: number, edgeBias = 0): void {
  for (let i = 0; i < n; i++) {
    let u = r();
    if (edgeBias > 0 && r() < edgeBias) u = r() < 0.5 ? r() * 0.22 : 1 - r() * 0.22;
    const x = u * TW;
    const y = r() * TH;
    const rx = size * (0.6 + r() * 0.8);
    const ry = rx * (0.6 + r() * 0.4);
    const rot = r() * Math.PI;
    ellipse(ctx, x + 0.8, y + 1, rx, ry, rot, "rgba(30,22,16,0.45)");
    ellipse(ctx, x, y, rx, ry, rot, colors[Math.floor(r() * colors.length)]!);
    ellipse(ctx, x - rx * 0.25, y - ry * 0.3, rx * 0.45, ry * 0.35, rot, "rgba(255,255,255,0.28)");
  }
}

const PAINT: Paint[] = [
  // Brindle Hills: packed earth, two wheel ruts and a grassy crown down the middle.
  (ctx, r) => {
    ctx.fillStyle = "#a9825a";
    ctx.fillRect(0, 0, TW, TH);
    speckle(ctx, r, 900, ["#8e6a43", "#c09a6c", "#7a5a3a"], 2.2, 0.5);
    for (const u of [0.3, 0.7]) {
      streak(ctx, u, 12, "#6e4f32", 0.75);
      streak(ctx, u - 0.08, 4, "#c8a275", 0.35);
      streak(ctx, u + 0.08, 4, "#c8a275", 0.35);
    }
    for (let i = 0; i < 220; i++) {
      const x = TW * (0.5 + (r() - 0.5) * 0.14);
      const y = r() * TH;
      ctx.strokeStyle = ["#7fa64a", "#6b9a3c", "#93b85a"][i % 3]!;
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r() - 0.5) * 4, y - 3 - r() * 4);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    stones(ctx, r, 18, ["#b9b0a0", "#9a9183"], 1.8);
  },
  // Highmoor: dark peat, wet patches, stones bedded in it (thicker at the edges) and heather at the verge.
  (ctx, r) => {
    ctx.fillStyle = "#7a5e40";
    ctx.fillRect(0, 0, TW, TH);
    for (let i = 0; i < 30; i++) ellipse(ctx, r() * TW, r() * TH, 6 + r() * 14, 4 + r() * 8, r() * 3, `rgba(${70 + r() * 20},${50 + r() * 14},${34 + r() * 10},0.45)`);
    speckle(ctx, r, 600, ["#5e4632", "#8a6c4a", "#4e3a28"], 2, 0.5);
    streak(ctx, 0.32, 10, "#4e3826", 0.45);
    streak(ctx, 0.68, 10, "#4e3826", 0.45);
    stones(ctx, r, 42, ["#b3aa9a", "#9e9688", "#c8bfb0", "#8c8478"], 4, 0.55);
    speckle(ctx, r, 60, ["#9a6aa0", "#b07ab0"], 2.5, 0.8);
  },
  // Saltmarsh: a timber boardwalk, planks across the way with dark gaps, weathered grey, nails at the ends.
  (ctx, r) => {
    ctx.fillStyle = "#2c241c";
    ctx.fillRect(0, 0, TW, TH);
    const plank = TH / 16;
    for (let i = 0; i < 16; i++) {
      const y = i * plank;
      const x0 = 3 + r() * 5;
      const x1 = TW - 3 - r() * 5;
      const tone = ["#9c8a6c", "#8c7a5e", "#a8977a", "#857358", "#958466"][Math.floor(r() * 5)]!;
      ctx.fillStyle = tone;
      ctx.fillRect(x0, y + 1.5, x1 - x0, plank - 3);
      // Grain and weathering.
      for (let k = 0; k < 7; k++) {
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = r() < 0.5 ? "#6c5c44" : "#bcae92";
        ctx.fillRect(x0 + r() * (x1 - x0) * 0.6, y + 2 + r() * (plank - 5), 15 + r() * 40, 1);
      }
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x0, y + 1.5, x1 - x0, 1);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#3a3632";
      for (const x of [x0 + 7, x1 - 7]) ctx.fillRect(x, y + plank / 2 - 1, 2, 2);
    }
    // Two runners show through the gaps.
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#4a3c2c";
    for (const u of [0.22, 0.78]) ctx.fillRect(u * TW - 4, 0, 8, TH);
    ctx.globalCompositeOperation = "source-over";
  },
  // Rivermead: churned wet mud, deep ruts holding water, darker damp patches.
  (ctx, r) => {
    ctx.fillStyle = "#6e5236";
    ctx.fillRect(0, 0, TW, TH);
    for (let i = 0; i < 30; i++) ellipse(ctx, r() * TW, r() * TH, 8 + r() * 16, 5 + r() * 10, r() * 3, "rgba(60,42,26,0.35)");
    speckle(ctx, r, 800, ["#5a422a", "#86664a", "#4a3420"], 2, 0.5);
    for (const u of [0.3, 0.7]) {
      streak(ctx, u, 12, "#3c2a1a", 0.6);
      streak(ctx, u - 0.1, 4, "#9a7a58", 0.3);
      streak(ctx, u + 0.1, 4, "#9a7a58", 0.3);
    }
    // Wet hoof and boot prints.
    for (let i = 0; i < 50; i++) ellipse(ctx, TW * (0.15 + r() * 0.7), r() * TH, 2 + r() * 1.5, 3 + r() * 1.5, r() * 0.6, "rgba(40,28,18,0.45)");
    stones(ctx, r, 10, ["#8e8678", "#a39a8a"], 2);
  },
  // Oakvale: a woodland path, soft brown soil under fallen leaves, thicker at the edges, a few twigs.
  (ctx, r) => {
    ctx.fillStyle = "#7c5c3c";
    ctx.fillRect(0, 0, TW, TH);
    speckle(ctx, r, 700, ["#6a4c30", "#94704a", "#5a3e26"], 2, 0.5);
    streak(ctx, 0.5, 26, "#9a7650", 0.35);
    const leafCols = ["#c0782a", "#d9a441", "#8a4a1e", "#a8a040", "#b5562a", "#e0b85a"];
    for (let i = 0; i < 260; i++) {
      let u = r();
      if (r() < 0.6) u = r() < 0.5 ? r() * 0.3 : 1 - r() * 0.3;
      const x = u * TW;
      const y = r() * TH;
      const s = 2.5 + r() * 2.5;
      const rot = r() * Math.PI;
      ellipse(ctx, x + 0.6, y + 0.8, s, s * 0.5, rot, "rgba(40,26,14,0.35)");
      ellipse(ctx, x, y, s, s * 0.5, rot, leafCols[Math.floor(r() * leafCols.length)]!);
    }
    ctx.strokeStyle = "#4a3420";
    ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      const x = r() * TW;
      const y = r() * TH;
      const a = r() * Math.PI;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12);
      ctx.stroke();
    }
  },
  // Shingle Bay: a bank of shingle, packed pebbles in greys, tans and white.
  (ctx, r) => {
    ctx.fillStyle = "#8c8476";
    ctx.fillRect(0, 0, TW, TH);
    stones(ctx, r, 700, ["#c8bfae", "#a39a8a", "#b9ae9a", "#e2dccf", "#8e8678", "#9c8c72", "#d4c7ac"], 2.6);
  },
  // The Rift: a tarmac haul road, aggregate, faded yellow edge lines and the heavy tyre tracks of the trucks.
  (ctx, r) => {
    ctx.fillStyle = "#62605c";
    ctx.fillRect(0, 0, TW, TH);
    speckle(ctx, r, 1600, ["#74716c", "#4a4846", "#827e78"], 1.5, 0.6);
    for (const u of [0.27, 0.73]) {
      streak(ctx, u, 14, "#2a2826", 0.55);
      // Tread: chevrons pressed into the track.
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "#1c1a18";
      for (let y = 0; y < TH; y += 6) ctx.fillRect(u * TW - 8, y, 16, 2);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = "#e0b840";
    for (const u of [0.07, 0.93]) {
      ctx.globalAlpha = 0.85;
      ctx.fillRect(u * TW - 2, 0, 4, TH);
    }
    ctx.globalAlpha = 1;
    // Patches and cracks.
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = "rgba(30,28,26,0.35)";
      ctx.fillRect(TW * (0.2 + r() * 0.5), r() * TH, 14 + r() * 20, 10 + r() * 16);
    }
    ctx.strokeStyle = "rgba(20,18,16,0.6)";
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 6; i++) {
      let x = r() * TW;
      let y = r() * TH;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 5; k++) ctx.lineTo((x += (r() - 0.5) * 10), (y += 3 + r() * 5));
      ctx.stroke();
    }
  },
  // The Ballot: a patched village lane, a dashed white line down the middle, grass creeping in at the edges.
  (ctx, r) => {
    ctx.fillStyle = "#6e6b66";
    ctx.fillRect(0, 0, TW, TH);
    speckle(ctx, r, 1300, ["#7e7a74", "#5a5752", "#8a867e"], 1.5, 0.55);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = `rgba(${70 + r() * 30},${68 + r() * 28},${64 + r() * 26},0.6)`;
      ctx.fillRect(TW * (0.1 + r() * 0.6), r() * TH, 18 + r() * 24, 14 + r() * 26);
    }
    ctx.fillStyle = "#f2efe6";
    ctx.globalAlpha = 0.85;
    for (let y = 0; y < TH; y += TH / 4) ctx.fillRect(TW / 2 - 1.8, y + TH / 16, 3.6, TH / 8);
    ctx.globalAlpha = 1;
    for (let i = 0; i < 160; i++) {
      const u = r() < 0.5 ? r() * 0.08 : 1 - r() * 0.08;
      ctx.fillStyle = ["#7fa64a", "#6b954a", "#8fb86a"][i % 3]!;
      ctx.fillRect(u * TW, r() * TH, 1.5, 3);
    }
  },
  // The Merger: poured concrete slabs with joints, a little stained, a darker kerb at each edge.
  (ctx, r) => {
    ctx.fillStyle = "#b4b2ac";
    ctx.fillRect(0, 0, TW, TH);
    const slab = TH / 4;
    for (let i = 0; i < 4; i++)
      for (const [x0, x1] of [
        [6, TW / 2],
        [TW / 2, TW - 6],
      ] as const) {
        const t = 0.9 + r() * 0.16;
        ctx.fillStyle = `rgb(${Math.round(180 * t)},${Math.round(178 * t)},${Math.round(172 * t)})`;
        ctx.fillRect(x0, i * slab, x1 - x0, slab);
      }
    speckle(ctx, r, 900, ["#9c9a94", "#c8c6c0", "#8a8882"], 1.4, 0.4);
    for (let i = 0; i < 5; i++) ellipse(ctx, r() * TW, r() * TH, 6 + r() * 12, 4 + r() * 8, r() * 3, "rgba(90,86,80,0.18)");
    ctx.fillStyle = "#6a6862";
    for (let i = 0; i <= 4; i++) ctx.fillRect(0, i * slab - 1, TW, 2);
    ctx.fillRect(TW / 2 - 0.75, 0, 1.5, TH);
    ctx.fillStyle = "#8a8882";
    ctx.fillRect(0, 0, 6, TH);
    ctx.fillRect(TW - 6, 0, 6, TH);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(5, 0, 1, TH);
    ctx.fillRect(TW - 6, 0, 1, TH);
  },
  // Kingsmarket: cobbled setts in staggered courses, dark mortar, a gutter of bigger stones each side.
  (ctx, r) => {
    ctx.fillStyle = "#34302b";
    ctx.fillRect(0, 0, TW, TH);
    const row = TH / 24;
    for (let i = 0; i < 24; i++) {
      const y = i * row;
      const off = (i % 2) * 6;
      for (let x = 10 - off; x < TW - 10; x += 12) {
        const w = 10 + r() * 1.5;
        const t = 0.85 + r() * 0.3;
        const base = [[140, 131, 120], [122, 114, 104], [154, 144, 132], [112, 108, 104]][Math.floor(r() * 4)]!;
        const c = `rgb(${Math.round(base[0]! * t)},${Math.round(base[1]! * t)},${Math.round(base[2]! * t)})`;
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.roundRect(Math.max(9, x), y + 1, Math.min(w, TW - 9 - Math.max(9, x)), row - 2, 3);
        ctx.fill();
        ctx.fillStyle = "rgba(255,240,220,0.22)";
        ctx.fillRect(Math.max(9, x) + 2, y + 2, w * 0.5, 2);
      }
    }
    for (const x0 of [0, TW - 9]) {
      for (let y = 0; y < TH; y += 8) {
        ctx.fillStyle = ["#6c665e", "#7a746a", "#625c54"][Math.floor(r() * 3)]!;
        ctx.beginPath();
        ctx.roundRect(x0 + 1, y + 1, 7, 6, 2);
        ctx.fill();
      }
    }
  },
];

function laneTexture(act: number): THREE.Texture {
  let t = texCache.get(act);
  if (t) return t;
  const c = document.createElement("canvas");
  c.width = TW;
  c.height = TH;
  const ctx = c.getContext("2d")!;
  let seed = 9001 + act * 31;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  PAINT[Math.max(0, Math.min(PAINT.length - 1, act))]!(ctx, r);
  // Fade the sides into the verge: an alpha ramp across the lane.
  const st = laneStyle(act);
  ctx.globalCompositeOperation = "destination-in";
  const g = ctx.createLinearGradient(0, 0, TW, 0);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(st.fade / 2, "rgba(0,0,0,1)");
  g.addColorStop(1 - st.fade / 2, "rgba(0,0,0,1)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, TW, TH);
  t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(act, t);
  return t;
}

// ---- the centreline ----

interface Sample {
  x: number;
  z: number;
  /** Unit normal (to the lane's left). */
  nx: number;
  nz: number;
  /** Distance along the lane. */
  s: number;
}

/** The lane's centreline, extended off the field where the convoys come in, its corners rounded. */
function centreline(path: Level["path"], extend: number, step: number): Sample[] {
  const raw = path.map(([c, r]) => [c + 0.5, r + 0.5] as [number, number]);
  // Drop the cells in the middle of straight runs: only the corners matter.
  const pts: Array<[number, number]> = [raw[0]!];
  for (let i = 1; i < raw.length - 1; i++) {
    const [ax, ay] = pts[pts.length - 1]!;
    const [bx, by] = raw[i]!;
    const [cx, cy] = raw[i + 1]!;
    if (Math.abs((bx - ax) * (cy - by) - (by - ay) * (cx - bx)) > 1e-6) pts.push(raw[i]!);
  }
  if (raw.length > 1) pts.push(raw[raw.length - 1]!);
  if (pts.length < 2) return [];
  const [a, b] = [pts[0]!, pts[1]!];
  const len0 = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
  pts.unshift([a[0] + ((a[0] - b[0]) / len0) * extend, a[1] + ((a[1] - b[1]) / len0) * extend]);
  // Walk the polyline, swapping each corner for a quadratic curve.
  const out: Array<[number, number]> = [];
  const line = (p: [number, number], q: [number, number]) => {
    const n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / step));
    for (let i = 0; i < n; i++) out.push([p[0] + ((q[0] - p[0]) * i) / n, p[1] + ((q[1] - p[1]) * i) / n]);
  };
  let from = pts[0]!;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i - 1]!;
    const q = pts[i]!;
    const n = pts[i + 1]!;
    const l1 = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const l2 = Math.hypot(n[0] - q[0], n[1] - q[1]);
    const rad = Math.min(0.45, l1 / 2, l2 / 2);
    const p1: [number, number] = [q[0] - ((q[0] - p[0]) / l1) * rad, q[1] - ((q[1] - p[1]) / l1) * rad];
    const p2: [number, number] = [q[0] + ((n[0] - q[0]) / l2) * rad, q[1] + ((n[1] - q[1]) / l2) * rad];
    line(from, p1);
    const m = 8;
    for (let k = 0; k < m; k++) {
      const t = k / m;
      const u = 1 - t;
      out.push([u * u * p1[0] + 2 * u * t * q[0] + t * t * p2[0], u * u * p1[1] + 2 * u * t * q[1] + t * t * p2[1]]);
    }
    from = p2;
  }
  line(from, pts[pts.length - 1]!);
  out.push(pts[pts.length - 1]!);
  const samples: Sample[] = [];
  let s = 0;
  for (let i = 0; i < out.length; i++) {
    const [x, z] = out[i]!;
    if (i > 0) s += Math.hypot(x - out[i - 1]![0], z - out[i - 1]![1]);
    const [px, pz] = out[Math.max(0, i - 1)]!;
    const [qx, qz] = out[Math.min(out.length - 1, i + 1)]!;
    const tl = Math.hypot(qx - px, qz - pz) || 1;
    samples.push({ x, z, nx: -(qz - pz) / tl, nz: (qx - px) / tl, s });
  }
  return samples;
}

export interface LaneSurface {
  meshes: THREE.Object3D[];
}

/**
 * Lays each lane's surface for the act. `heightAt` is the ground's height; `finish` gives the material the
 * ground's own treatment (cloud shadows), so the lane darkens under the clouds with the grass.
 */
export function buildLanes(
  level: Level,
  act: number,
  heightAt: (x: number, z: number) => number,
  finish: (m: THREE.MeshStandardMaterial) => THREE.MeshStandardMaterial,
  rand: () => number,
): LaneSurface {
  const st = laneStyle(act);
  const across = 5;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const posts: THREE.Matrix4[] = [];
  const puddles: THREE.Matrix4[] = [];
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const paths = [level.path, level.path2].filter(Boolean) as Array<Level["path"]>;
  paths.forEach((path, pi) => {
    const line = centreline(path, 14, 0.12);
    if (line.length < 2) return;
    const lift = 0.008 + pi * 0.003;
    const base = pos.length / 3;
    for (const p of line) {
      for (let j = 0; j < across; j++) {
        const f = j / (across - 1);
        const off = (f * 2 - 1) * st.half;
        const x = p.x + p.nx * off;
        const z = p.z + p.nz * off;
        pos.push(x, heightAt(x, z) + lift, z);
        uv.push(f, p.s / TILE);
      }
    }
    for (let i = 0; i < line.length - 1; i++)
      for (let j = 0; j < across - 1; j++) {
        const a = base + i * across + j;
        const b = a + across;
        idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    // Edge detail along the lane (on the field and a little beyond it).
    const onField = (x: number, z: number) => x > -1.5 && z > -1.5 && x < level.cols + 1.5 && z < level.rows + 1.5;
    let next = 0;
    for (const p of line) {
      if (!onField(p.x, p.z) || p.s < next) continue;
      if (act === 2) {
        // Boardwalk posts, a pair every half cell.
        next = p.s + 0.5;
        for (const side of [-1, 1]) {
          const x = p.x + p.nx * side * (st.half + 0.015);
          const z = p.z + p.nz * side * (st.half + 0.015);
          const h = heightAt(x, z);
          posts.push(new THREE.Matrix4().compose(v.set(x, h + 0.02, z), q.setFromEuler(e.set((rand() - 0.5) * 0.12, rand() * 3, (rand() - 0.5) * 0.12)), sc.set(1, 0.8 + rand() * 0.5, 1)));
        }
      } else if (act === 3) {
        // Puddles in the ruts.
        next = p.s + 0.35 + rand() * 0.6;
        if (rand() < 0.45) continue;
        const side = rand() < 0.5 ? -1 : 1;
        const off = side * st.half * (0.3 + rand() * 0.25);
        const x = p.x + p.nx * off;
        const z = p.z + p.nz * off;
        // Long along the lane: local Z turned onto the direction of travel.
        const ang = Math.atan2(p.nz, -p.nx);
        puddles.push(new THREE.Matrix4().compose(v.set(x, heightAt(x, z) + lift + 0.004, z), q.setFromEuler(e.set(0, ang + (rand() - 0.5) * 0.3, 0)), sc.set(0.045 + rand() * 0.035, 1, 0.09 + rand() * 0.1)));
      } else break;
    }
  });
  const meshes: THREE.Object3D[] = [];
  if (!idx.length) return { meshes };
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mat = finish(
    new THREE.MeshStandardMaterial({
      map: laneTexture(act),
      transparent: true,
      depthWrite: false,
      roughness: st.rough,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  const ribbon = new THREE.Mesh(g, mat);
  ribbon.receiveShadow = true;
  // First of the see-through things, so splats and scorch marks always land on top of it.
  ribbon.renderOrder = -1;
  meshes.push(ribbon);
  if (posts.length) {
    const m = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.022, 0.026, 0.09, 6).translate(0, 0.02, 0),
      new THREE.MeshStandardMaterial({ color: "#5a4a38", roughness: 0.9, flatShading: true }),
      posts.length,
    );
    posts.forEach((mx, i) => m.setMatrixAt(i, mx));
    m.castShadow = true;
    m.receiveShadow = true;
    meshes.push(m);
  }
  if (puddles.length) {
    const m = new THREE.InstancedMesh(
      new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: "#8aa2b0", roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.7, depthWrite: false }),
      puddles.length,
    );
    puddles.forEach((mx, i) => m.setMatrixAt(i, mx));
    m.receiveShadow = true;
    meshes.push(m);
  }
  return { meshes };
}
