// Hedgerow's battlefields: one painted look per act (grass, lane, flowers, scenery and light), drawn once
// per level and size into an offscreen canvas by `paintBackground`. Everything is procedural and seeded by
// the level id, so a level always looks the same and nothing needs downloading.

import { laneCellsOf, plotKind, type Level } from "./engine";

export type Decor =
  | "oak"
  | "pine"
  | "willow"
  | "bush"
  | "rock"
  | "sheep"
  | "reeds"
  | "pool"
  | "heather"
  | "hut"
  | "cone"
  | "billboard"
  | "tower"
  | "lamp"
  | "stall"
  | "deadtree"
  | "mushroom"
  | "boat";

export interface Theme {
  name: string;
  grass: [string, string];
  /** Darker grass for tufts and shading. */
  blade: string;
  dirt: [string, string, string];
  flowers: string[];
  decor: Array<[Decor, number]>;
  /** Wash over the whole field: the time of day. */
  light: string;
  lightAlpha: number;
  /** Wash at the edges. */
  vignette: string;
  /** Water along one edge of the field, if any. */
  water?: { color: string; foam: string; side: "left" | "right" | "top" | "bottom" };
}

export const THEMES: Theme[] = [
  {
    name: "Brindle Hills",
    grass: ["#a7c86f", "#8fb35c"],
    blade: "#6f9446",
    dirt: ["#9a7246", "#dcc08c", "#b8955f"],
    flowers: ["#f6f1e4", "#f2c94c", "#ef8fa6"],
    decor: [
      ["oak", 5],
      ["bush", 4],
      ["sheep", 2],
      ["rock", 1],
    ],
    light: "#fff1c9",
    lightAlpha: 0.12,
    vignette: "rgba(52,70,24,0.35)",
  },
  {
    name: "Highmoor",
    grass: ["#b9bf6c", "#9fa95a"],
    blade: "#7c8640",
    dirt: ["#8e6a42", "#d6b884", "#ae8c5a"],
    flowers: ["#9c6fb2", "#c48fd0", "#f2c94c"],
    decor: [
      ["heather", 5],
      ["rock", 4],
      ["pine", 3],
      ["sheep", 2],
    ],
    light: "#ffd98a",
    lightAlpha: 0.14,
    vignette: "rgba(80,60,30,0.35)",
  },
  {
    name: "Saltmarsh",
    grass: ["#9fbf88", "#86a978"],
    blade: "#5f8a6a",
    dirt: ["#8a7454", "#d3c39c", "#ad9b74"],
    flowers: ["#f4f1e8", "#b9d7e2", "#e9d27a"],
    decor: [
      ["reeds", 6],
      ["pool", 3],
      ["boat", 1],
      ["bush", 2],
    ],
    light: "#d9f0f4",
    lightAlpha: 0.14,
    vignette: "rgba(30,60,70,0.33)",
    water: { color: "#7fb3c4", foam: "#e3f2f2", side: "left" },
  },
  {
    name: "Rivermead",
    grass: ["#94c46c", "#7db15a"],
    blade: "#5a8a3e",
    dirt: ["#8a6740", "#d2b47e", "#a9875a"],
    flowers: ["#f6f1e4", "#7fb3e6", "#f2c94c"],
    decor: [
      ["willow", 4],
      ["oak", 2],
      ["reeds", 3],
      ["pool", 2],
    ],
    light: "#eaf7d0",
    lightAlpha: 0.1,
    vignette: "rgba(30,60,30,0.35)",
    water: { color: "#6ea6c2", foam: "#d9eef2", side: "right" },
  },
  {
    name: "Oakvale",
    grass: ["#7fa95a", "#6c974b"],
    blade: "#4e7535",
    dirt: ["#7a5a38", "#c8a874", "#9e7d52"],
    flowers: ["#f6f1e4", "#d4544a", "#f2c94c"],
    decor: [
      ["oak", 7],
      ["pine", 3],
      ["mushroom", 3],
      ["bush", 3],
    ],
    light: "#f8e7b0",
    lightAlpha: 0.1,
    vignette: "rgba(20,40,15,0.45)",
  },
  {
    name: "Shingle Bay",
    grass: ["#bfc98a", "#a9b676"],
    blade: "#8a9a58",
    dirt: ["#9c8160", "#e3d2ad", "#c2ad86"],
    flowers: ["#f6f1e4", "#f2a9b8", "#9cc7e0"],
    decor: [
      ["hut", 3],
      ["rock", 4],
      ["boat", 2],
      ["reeds", 2],
    ],
    light: "#fff6dc",
    lightAlpha: 0.16,
    vignette: "rgba(60,70,60,0.3)",
    water: { color: "#5d9cbf", foam: "#eef6f6", side: "bottom" },
  },
  {
    name: "The Rift",
    grass: ["#a9a46c", "#928f5c"],
    blade: "#6e6b43",
    dirt: ["#6e5038", "#bf9d70", "#93734c"],
    flowers: ["#e9b06a", "#d47a54", "#f6f1e4"],
    decor: [
      ["deadtree", 4],
      ["rock", 4],
      ["cone", 3],
      ["bush", 2],
    ],
    light: "#ff9e6a",
    lightAlpha: 0.16,
    vignette: "rgba(70,30,40,0.45)",
  },
  {
    name: "The Ballot",
    grass: ["#a3c47a", "#8db268"],
    blade: "#678f4a",
    dirt: ["#8d7051", "#d9c39a", "#b39d77"],
    flowers: ["#f6f1e4", "#d9534f", "#5b8fd1"],
    decor: [
      ["billboard", 3],
      ["lamp", 3],
      ["oak", 3],
      ["stall", 2],
    ],
    light: "#fff0d2",
    lightAlpha: 0.12,
    vignette: "rgba(40,50,40,0.35)",
  },
  {
    name: "The Merger",
    grass: ["#98ad80", "#849b6e"],
    blade: "#5f7552",
    dirt: ["#6f675c", "#bdb3a0", "#978d7b"],
    flowers: ["#e8eef2", "#b8c4cc", "#f2c94c"],
    decor: [
      ["tower", 5],
      ["cone", 3],
      ["lamp", 2],
      ["bush", 2],
    ],
    light: "#d6e2ea",
    lightAlpha: 0.18,
    vignette: "rgba(30,40,55,0.45)",
  },
  {
    name: "Kingsmarket",
    grass: ["#9aa86a", "#83925a"],
    blade: "#5e6c3e",
    dirt: ["#7a5a3a", "#d0ad78", "#a5845a"],
    flowers: ["#f2c94c", "#e8748b", "#f6f1e4"],
    decor: [
      ["stall", 4],
      ["lamp", 3],
      ["oak", 2],
      ["billboard", 2],
    ],
    light: "#ff8a5c",
    lightAlpha: 0.2,
    vignette: "rgba(50,20,40,0.55)",
  },
];

export function themeFor(level: Level): Theme {
  const i = Math.min(THEMES.length - 1, Math.floor((level.id - 1) / 10));
  return THEMES[i]!;
}

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Layout {
  /** CSS pixels. */
  width: number;
  height: number;
  cell: number;
  offX: number;
  offY: number;
}

const INK = "#2b2320";

/** The lane in canvas pixels, extended off the field at the start so the convoys drive in from the edge. */
export function lanePoints(level: Level, L: Layout, second = false): Array<[number, number]> {
  const pts = (second && level.path2 ? level.path2 : level.path).map(
    ([c, r]) =>
      [L.offX + (c + 0.5) * L.cell, L.offY + (r + 0.5) * L.cell] as [number, number],
  );
  const [a, b] = [pts[0]!, pts[1]!];
  const dx = Math.sign(a[0] - b[0]);
  const dy = Math.sign(a[1] - b[1]);
  const far = Math.max(L.width, L.height);
  return [[a[0] + dx * far, a[1] + dy * far], ...pts];
}

function strokePath(ctx: CanvasRenderingContext2D, pts: Array<[number, number]>): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.stroke();
}

export function paintBackground(
  ctx: CanvasRenderingContext2D,
  level: Level,
  L: Layout,
): void {
  const theme = themeFor(level);
  const rand = rng(level.id * 7919 + 17);
  const s = L.cell;
  const W = L.width;
  const H = L.height;

  // Ground.
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, theme.grass[0]);
  g.addColorStop(1, theme.grass[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Soft patches of lighter and darker meadow.
  const patches = Math.round((W * H) / (s * s) * 0.9);
  for (let i = 0; i < patches; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const r = s * (0.8 + rand() * 2.2);
    const pg = ctx.createRadialGradient(x, y, 0, x, y, r);
    const light = rand() > 0.5;
    pg.addColorStop(0, light ? "rgba(255,255,230,0.10)" : "rgba(40,60,20,0.08)");
    pg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = pg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Mown stripes across the field itself.
  ctx.save();
  ctx.beginPath();
  ctx.rect(L.offX, L.offY, level.cols * s, level.rows * s);
  ctx.clip();
  ctx.fillStyle = "rgba(255,255,240,0.05)";
  for (let c = 0; c < level.cols; c += 2)
    ctx.fillRect(L.offX + c * s, L.offY, s, level.rows * s);
  ctx.restore();

  if (theme.water) paintWater(ctx, theme, L, level, rand);

  // Tufts and flowers.
  const tufts = Math.round((W * H) / (s * s) * 10);
  ctx.lineCap = "round";
  for (let i = 0; i < tufts; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const h = s * (0.05 + rand() * 0.07);
    ctx.strokeStyle = theme.blade;
    ctx.globalAlpha = 0.25 + rand() * 0.3;
    ctx.lineWidth = Math.max(1, s * 0.018);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - h * 0.5, y - h);
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - h * 1.2);
    ctx.moveTo(x, y);
    ctx.lineTo(x + h * 0.5, y - h);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const flowers = Math.round((W * H) / (s * s) * 2.2);
  for (let i = 0; i < flowers; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const r = s * (0.025 + rand() * 0.02);
    ctx.fillStyle = theme.flowers[Math.floor(rand() * theme.flowers.length)]!;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#f2c94c";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  paintLane(ctx, level, L, theme, rand);
  paintPlots(ctx, level, L);
  paintDecor(ctx, level, L, theme, rand);
  paintGate(ctx, level, L);

  // Light and vignette.
  ctx.globalAlpha = theme.lightAlpha;
  const lg = ctx.createLinearGradient(0, 0, W, H);
  lg.addColorStop(0, theme.light);
  lg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = lg;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
  const vg = ctx.createRadialGradient(
    W / 2,
    H / 2,
    Math.min(W, H) * 0.35,
    W / 2,
    H / 2,
    Math.hypot(W, H) * 0.6,
  );
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, theme.vignette);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

function paintWater(
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  L: Layout,
  level: Level,
  rand: () => number,
): void {
  const w = theme.water!;
  const s = L.cell;
  const gridL = L.offX;
  const gridR = L.offX + level.cols * s;
  const gridT = L.offY;
  const gridB = L.offY + level.rows * s;
  // Water only where there is room outside the field.
  let x0 = 0;
  let x1 = L.width;
  let y0 = 0;
  let y1 = L.height;
  if (w.side === "left") x1 = gridL - s * 0.5;
  if (w.side === "right") x0 = gridR + s * 0.5;
  if (w.side === "top") y1 = gridT - s * 0.5;
  if (w.side === "bottom") y0 = gridB + s * 0.5;
  if (x1 - x0 < s * 0.6 || y1 - y0 < s * 0.6) return;
  ctx.save();
  ctx.beginPath();
  const wob = (n: number) => Math.sin(n * 0.9) * s * 0.18 + (rand() - 0.5) * s * 0.06;
  if (w.side === "left" || w.side === "right") {
    const edge = w.side === "left" ? x1 : x0;
    const out = w.side === "left" ? x0 : x1;
    ctx.moveTo(out, y0);
    for (let y = y0, n = 0; y <= y1 + s; y += s * 0.5, n++) ctx.lineTo(edge + wob(n), y);
    ctx.lineTo(out, y1);
  } else {
    const edge = w.side === "top" ? y1 : y0;
    const out = w.side === "top" ? y0 : y1;
    ctx.moveTo(x0, out);
    for (let x = x0, n = 0; x <= x1 + s; x += s * 0.5, n++) ctx.lineTo(x, edge + wob(n));
    ctx.lineTo(x1, out);
  }
  ctx.closePath();
  ctx.fillStyle = w.color;
  ctx.fill();
  ctx.strokeStyle = w.foam;
  ctx.lineWidth = Math.max(2, s * 0.06);
  ctx.globalAlpha = 0.8;
  ctx.stroke();
  ctx.clip();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = w.foam;
  ctx.lineWidth = Math.max(1, s * 0.025);
  for (let i = 0; i < 40; i++) {
    const x = x0 + rand() * (x1 - x0);
    const y = y0 + rand() * (y1 - y0);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + s * 0.15, y - s * 0.06, x + s * 0.3, y);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function paintLane(
  ctx: CanvasRenderingContext2D,
  level: Level,
  L: Layout,
  theme: Theme,
  rand: () => number,
): void {
  paintOneLane(ctx, lanePoints(level, L), L, theme, rand);
  if (level.path2) paintOneLane(ctx, lanePoints(level, L, true), L, theme, rand);
}

function paintOneLane(
  ctx: CanvasRenderingContext2D,
  pts: Array<[number, number]>,
  L: Layout,
  theme: Theme,
  rand: () => number,
): void {
  const s = L.cell;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  // Shadowed verge, rim, then the track itself.
  ctx.save();
  ctx.translate(0, s * 0.04);
  ctx.strokeStyle = "rgba(30,40,10,0.22)";
  ctx.lineWidth = s * 0.96;
  strokePath(ctx, pts);
  ctx.restore();
  ctx.strokeStyle = theme.dirt[0];
  ctx.lineWidth = s * 0.86;
  strokePath(ctx, pts);
  ctx.strokeStyle = theme.dirt[1];
  ctx.lineWidth = s * 0.76;
  strokePath(ctx, pts);
  // Two wheel ruts: a darker stroke, overpainted down the middle.
  ctx.strokeStyle = theme.dirt[2];
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = s * 0.5;
  strokePath(ctx, pts);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = theme.dirt[1];
  ctx.lineWidth = s * 0.4;
  strokePath(ctx, pts);
  // Pebbles.
  let total = 0;
  for (let i = 1; i < pts.length; i++)
    total += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  const n = Math.round(total / s * 9);
  for (let k = 0; k < n; k++) {
    let d = rand() * total;
    let i = 1;
    for (; i < pts.length; i++) {
      const len = Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
      if (d <= len) break;
      d -= len;
    }
    const a = pts[Math.min(i, pts.length - 1) - 1]!;
    const b = pts[Math.min(i, pts.length - 1)]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const t = d / len;
    const nx = -(b[1] - a[1]) / len;
    const ny = (b[0] - a[0]) / len;
    const off = (rand() - 0.5) * s * 0.66;
    const x = a[0] + (b[0] - a[0]) * t + nx * off;
    const y = a[1] + (b[1] - a[1]) * t + ny * off;
    ctx.fillStyle = rand() > 0.5 ? theme.dirt[0] : "rgba(255,255,255,0.5)";
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.ellipse(x, y, s * (0.015 + rand() * 0.02), s * (0.01 + rand() * 0.015), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function paintPlots(ctx: CanvasRenderingContext2D, level: Level, L: Layout): void {
  const s = L.cell;
  const lane = laneCellsOf(level);
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      if (lane.has(`${c},${r}`)) continue;
      const x = L.offX + c * s;
      const y = L.offY + r * s;
      const inset = s * 0.12;
      ctx.fillStyle = "rgba(60,80,20,0.07)";
      ctx.beginPath();
      ctx.roundRect(x + inset, y + inset, s - inset * 2, s - inset * 2, s * 0.14);
      ctx.fill();
      const ground = plotKind(level, c, r);
      if (ground === "water") {
        const g = ctx.createRadialGradient(x + s / 2, y + s / 2, s * 0.05, x + s / 2, y + s / 2, s * 0.5);
        g.addColorStop(0, "rgba(120,190,225,0.9)");
        g.addColorStop(1, "rgba(50,110,160,0.85)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x + s / 2, y + s / 2, s * 0.42, s * 0.36, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = Math.max(1, s * 0.03);
        ctx.beginPath();
        ctx.arc(x + s * 0.4, y + s * 0.45, s * 0.12, Math.PI * 1.1, Math.PI * 1.8);
        ctx.moveTo(x + s * 0.72, y + s * 0.6);
        ctx.arc(x + s * 0.62, y + s * 0.6, s * 0.1, 0, Math.PI * 0.8);
        ctx.stroke();
        continue;
      }
      if (ground === "high") {
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.beginPath();
        ctx.ellipse(x + s / 2, y + s * 0.78, s * 0.42, s * 0.14, 0, 0, Math.PI * 2);
        ctx.fill();
        const g = ctx.createLinearGradient(0, y + s * 0.2, 0, y + s * 0.8);
        g.addColorStop(0, "rgba(190,220,120,0.95)");
        g.addColorStop(1, "rgba(120,150,70,0.95)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(x + s * 0.1, y + s * 0.18, s * 0.8, s * 0.6, s * 0.2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,230,0.75)";
        ctx.lineWidth = Math.max(1.5, s * 0.04);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(x + s * 0.38, y + s * 0.5);
        ctx.lineTo(x + s * 0.5, y + s * 0.36);
        ctx.lineTo(x + s * 0.62, y + s * 0.5);
        ctx.stroke();
        continue;
      }
      // Corner pegs: a quiet hint that this is a plot.
      ctx.strokeStyle = "rgba(255,255,240,0.32)";
      ctx.lineWidth = Math.max(1.2, s * 0.025);
      ctx.lineCap = "round";
      const k = s * 0.12;
      const a = x + inset;
      const b = y + inset;
      const e = x + s - inset;
      const f = y + s - inset;
      ctx.beginPath();
      ctx.moveTo(a, b + k);
      ctx.lineTo(a, b);
      ctx.lineTo(a + k, b);
      ctx.moveTo(e - k, b);
      ctx.lineTo(e, b);
      ctx.lineTo(e, b + k);
      ctx.moveTo(e, f - k);
      ctx.lineTo(e, f);
      ctx.lineTo(e - k, f);
      ctx.moveTo(a + k, f);
      ctx.lineTo(a, f);
      ctx.lineTo(a, f - k);
      ctx.stroke();
    }
  }
}

function paintGate(ctx: CanvasRenderingContext2D, level: Level, L: Layout): void {
  paintOneGate(ctx, level, level.path, L);
  if (level.path2) paintOneGate(ctx, level, level.path2, L);
}

function paintOneGate(ctx: CanvasRenderingContext2D, level: Level, path: Level["path"], L: Layout): void {
  // Where they come from: a glossy depot sign just off the field.
  const s = L.cell;
  const [c, r] = path[0]!;
  const [c2, r2] = path[1]!;
  const dx = Math.sign(c - c2);
  const dy = Math.sign(r - r2);
  const x = L.offX + (c + 0.5 + dx * 0.95) * s;
  const y = L.offY + (r + 0.5 + dy * 0.95) * s;
  if (x < -s || y < -s || x > L.width + s || y > L.height + s) return;
  const lw = Math.max(1.5, s * 0.03);
  // Posts either side of the lane, a barrier and a sign.
  const px = dy !== 0 ? s * 0.48 : 0;
  const py = dx !== 0 ? s * 0.48 : 0;
  ctx.lineWidth = lw;
  ctx.strokeStyle = INK;
  for (const sgn of [-1, 1]) {
    ctx.fillStyle = "#cfd6dc";
    ctx.beginPath();
    ctx.roundRect(x + sgn * px - s * 0.05, y + sgn * py - s * 0.32, s * 0.1, s * 0.36, s * 0.02);
    ctx.fill();
    ctx.stroke();
  }
  const sx = x + (dx !== 0 ? 0 : 0) - s * 0.42;
  const sy = y - s * 0.62;
  ctx.fillStyle = "#1f8a8a";
  ctx.beginPath();
  ctx.roundRect(sx, sy, s * 0.84, s * 0.26, s * 0.05);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#f4fbfb";
  ctx.font = `700 ${Math.max(7, Math.round(s * 0.12))}px 'Atkinson Hyperlegible', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(level.id >= 81 ? "HOLLOWCANDOR" : level.id >= 41 ? "CANDOR" : "HOLLOWELL", sx + s * 0.42, sy + s * 0.135);
}

function paintDecor(
  ctx: CanvasRenderingContext2D,
  level: Level,
  L: Layout,
  theme: Theme,
  rand: () => number,
): void {
  const s = L.cell;
  const gx0 = L.offX - s * 0.25;
  const gy0 = L.offY - s * 0.25;
  const gx1 = L.offX + level.cols * s + s * 0.25;
  const gy1 = L.offY + level.rows * s + s * 0.25;
  const lanes = [lanePoints(level, L), ...(level.path2 ? [lanePoints(level, L, true)] : [])];
  const nearLane = (x: number, y: number) => {
    for (const lane of lanes)
    for (let i = 1; i < lane.length; i++) {
      const [ax, ay] = lane[i - 1]!;
      const [bx, by] = lane[i]!;
      const len2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / len2));
      if (Math.hypot(x - (ax + (bx - ax) * t), y - (ay + (by - ay) * t)) < s * 0.75) return true;
    }
    return false;
  };
  const water = theme.water;
  const inWater = (x: number, y: number) => {
    if (!water) return false;
    if (water.side === "left") return x < gx0 - s * 0.2;
    if (water.side === "right") return x > gx1 + s * 0.2;
    if (water.side === "top") return y < gy0 - s * 0.2;
    return y > gy1 + s * 0.2;
  };
  const outside = (L.width * L.height - (gx1 - gx0) * (gy1 - gy0)) / (s * s);
  const count = Math.max(0, Math.round(outside * 0.75));
  const weights = theme.decor;
  const totalW = weights.reduce((a, [, w]) => a + w, 0);
  const items: Array<{ kind: Decor; x: number; y: number; k: number }> = [];
  let guard = 0;
  while (items.length < count && guard++ < count * 30) {
    const x = rand() * L.width;
    const y = rand() * (L.height + s * 0.4);
    if (x > gx0 && x < gx1 && y > gy0 && y < gy1) continue;
    if (nearLane(x, y)) continue;
    let pick = rand() * totalW;
    let kind: Decor = weights[0]![0];
    for (const [d, w] of weights) {
      pick -= w;
      if (pick <= 0) {
        kind = d;
        break;
      }
    }
    if (inWater(x, y) && kind !== "boat" && kind !== "reeds") continue;
    if (!inWater(x, y) && kind === "boat" && water) continue;
    if (items.some((it) => Math.hypot(it.x - x, it.y - y) < s * 0.55)) continue;
    items.push({ kind, x, y, k: 0.75 + rand() * 0.5 });
  }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) drawDecor(ctx, it.kind, it.x, it.y, s * it.k, rand);
}

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = "rgba(20,30,10,0.22)";
  ctx.beginPath();
  ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawDecor(
  ctx: CanvasRenderingContext2D,
  kind: Decor,
  x: number,
  y: number,
  s: number,
  rand: () => number,
): void {
  const lw = Math.max(1.2, s * 0.03);
  ctx.lineWidth = lw;
  ctx.strokeStyle = INK;
  ctx.lineJoin = "round";
  switch (kind) {
    case "oak": {
      shadow(ctx, x + s * 0.08, y, s * 0.42, s * 0.14);
      ctx.fillStyle = "#7a5634";
      ctx.beginPath();
      ctx.roundRect(x - s * 0.06, y - s * 0.35, s * 0.12, s * 0.35, s * 0.03);
      ctx.fill();
      ctx.stroke();
      const greens = ["#4f7f37", "#5e8f41", "#6ea04c"];
      const blobs: Array<[number, number, number]> = [
        [-0.2, -0.55, 0.24],
        [0.2, -0.55, 0.24],
        [0, -0.75, 0.28],
        [-0.05, -0.5, 0.26],
      ];
      for (const [bx, by, br] of blobs) {
        ctx.fillStyle = greens[Math.floor(rand() * 3)]!;
        ctx.beginPath();
        ctx.arc(x + bx * s, y + by * s, br * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,255,220,0.18)";
      ctx.beginPath();
      ctx.arc(x - s * 0.08, y - s * 0.82, s * 0.12, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "willow": {
      shadow(ctx, x, y, s * 0.42, s * 0.13);
      ctx.fillStyle = "#7a5634";
      ctx.fillRect(x - s * 0.05, y - s * 0.4, s * 0.1, s * 0.4);
      ctx.strokeRect(x - s * 0.05, y - s * 0.4, s * 0.1, s * 0.4);
      ctx.fillStyle = "#86a94a";
      ctx.beginPath();
      ctx.moveTo(x - s * 0.42, y - s * 0.1);
      ctx.quadraticCurveTo(x - s * 0.45, y - s * 0.85, x, y - s * 0.85);
      ctx.quadraticCurveTo(x + s * 0.45, y - s * 0.85, x + s * 0.42, y - s * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "#6a8c38";
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x + i * s * 0.1, y - s * 0.6);
        ctx.lineTo(x + i * s * 0.11, y - s * 0.15);
        ctx.stroke();
      }
      break;
    }
    case "pine": {
      shadow(ctx, x, y, s * 0.3, s * 0.1);
      ctx.fillStyle = "#6b4a2b";
      ctx.fillRect(x - s * 0.04, y - s * 0.2, s * 0.08, s * 0.2);
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i % 2 ? "#3f6a3a" : "#467548";
        ctx.beginPath();
        const top = y - s * (0.95 - i * 0.22);
        const w = s * (0.18 + i * 0.08);
        ctx.moveTo(x, top);
        ctx.lineTo(x + w, top + s * 0.38);
        ctx.lineTo(x - w, top + s * 0.38);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case "deadtree": {
      ctx.strokeStyle = "#5b4636";
      ctx.lineWidth = s * 0.07;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - s * 0.6);
      ctx.lineTo(x - s * 0.2, y - s * 0.85);
      ctx.moveTo(x, y - s * 0.45);
      ctx.lineTo(x + s * 0.22, y - s * 0.7);
      ctx.stroke();
      break;
    }
    case "bush": {
      shadow(ctx, x, y, s * 0.3, s * 0.09);
      ctx.fillStyle = "#5c8a3e";
      for (const [bx, br] of [
        [-0.14, 0.16],
        [0.12, 0.17],
        [0, 0.2],
      ] as const) {
        ctx.beginPath();
        ctx.arc(x + bx * s, y - s * 0.14, br * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = "#f2c94c";
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(x + (rand() - 0.5) * s * 0.3, y - s * (0.1 + rand() * 0.2), s * 0.025, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "rock": {
      shadow(ctx, x, y, s * 0.22, s * 0.07);
      ctx.fillStyle = "#a9a296";
      ctx.beginPath();
      ctx.moveTo(x - s * 0.2, y);
      ctx.lineTo(x - s * 0.14, y - s * 0.16);
      ctx.lineTo(x + s * 0.02, y - s * 0.22);
      ctx.lineTo(x + s * 0.18, y - s * 0.1);
      ctx.lineTo(x + s * 0.2, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.beginPath();
      ctx.moveTo(x - s * 0.12, y - s * 0.14);
      ctx.lineTo(x + s * 0.02, y - s * 0.19);
      ctx.lineTo(x - s * 0.02, y - s * 0.1);
      ctx.fill();
      break;
    }
    case "sheep": {
      shadow(ctx, x, y, s * 0.2, s * 0.06);
      ctx.fillStyle = "#3a302a";
      ctx.fillRect(x - s * 0.1, y - s * 0.1, s * 0.03, s * 0.1);
      ctx.fillRect(x + s * 0.07, y - s * 0.1, s * 0.03, s * 0.1);
      ctx.fillStyle = "#f7f3ea";
      for (const [bx, by] of [
        [-0.08, -0.16],
        [0.06, -0.17],
        [0, -0.22],
        [-0.02, -0.12],
      ] as const) {
        ctx.beginPath();
        ctx.arc(x + bx * s, y + by * s, s * 0.09, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.ellipse(x - s * 0.01, y - s * 0.17, s * 0.17, s * 0.1, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#3a302a";
      ctx.beginPath();
      ctx.ellipse(x + s * 0.16, y - s * 0.2, s * 0.05, s * 0.06, 0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "reeds": {
      ctx.lineCap = "round";
      for (let i = 0; i < 6; i++) {
        const ox = (i - 2.5) * s * 0.05;
        ctx.strokeStyle = "#6b7f3a";
        ctx.lineWidth = Math.max(1, s * 0.025);
        ctx.beginPath();
        ctx.moveTo(x + ox, y);
        ctx.quadraticCurveTo(x + ox + s * 0.04, y - s * 0.3, x + ox + (i % 2 ? 0.06 : -0.04) * s, y - s * (0.45 + (i % 3) * 0.06));
        ctx.stroke();
        if (i % 2 === 0) {
          ctx.fillStyle = "#7a5634";
          ctx.beginPath();
          ctx.ellipse(x + ox - s * 0.02, y - s * (0.42 + (i % 3) * 0.06), s * 0.025, s * 0.07, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case "pool": {
      ctx.fillStyle = "#7fb3c4";
      ctx.beginPath();
      ctx.ellipse(x, y - s * 0.05, s * 0.36, s * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.beginPath();
      ctx.ellipse(x - s * 0.08, y - s * 0.09, s * 0.12, s * 0.04, 0, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#6ea04c";
      ctx.beginPath();
      ctx.arc(x + s * 0.15, y - s * 0.04, s * 0.05, 0.4, Math.PI * 2);
      ctx.lineTo(x + s * 0.15, y - s * 0.04);
      ctx.fill();
      break;
    }
    case "heather": {
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = i % 2 ? "#9c6fb2" : "#b583c6";
        ctx.beginPath();
        ctx.arc(x + (rand() - 0.5) * s * 0.4, y - s * (0.04 + rand() * 0.1), s * 0.06, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "hut": {
      shadow(ctx, x, y, s * 0.28, s * 0.07);
      const cols = ["#e46a5a", "#5b8fd1", "#f2c94c", "#7fbf9a"];
      ctx.fillStyle = cols[Math.floor(rand() * cols.length)]!;
      ctx.beginPath();
      ctx.rect(x - s * 0.2, y - s * 0.4, s * 0.4, s * 0.4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#f6f1e4";
      for (let i = 0; i < 4; i++) ctx.fillRect(x - s * 0.2 + i * s * 0.1, y - s * 0.4, s * 0.05, s * 0.4);
      ctx.fillStyle = "#6b4a2b";
      ctx.beginPath();
      ctx.moveTo(x - s * 0.26, y - s * 0.4);
      ctx.lineTo(x, y - s * 0.6);
      ctx.lineTo(x + s * 0.26, y - s * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "boat": {
      ctx.fillStyle = "#c4433a";
      ctx.beginPath();
      ctx.moveTo(x - s * 0.3, y - s * 0.12);
      ctx.lineTo(x + s * 0.3, y - s * 0.12);
      ctx.lineTo(x + s * 0.2, y);
      ctx.lineTo(x - s * 0.22, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.12);
      ctx.lineTo(x, y - s * 0.6);
      ctx.stroke();
      ctx.fillStyle = "#f6f1e4";
      ctx.beginPath();
      ctx.moveTo(x + s * 0.02, y - s * 0.58);
      ctx.lineTo(x + s * 0.24, y - s * 0.18);
      ctx.lineTo(x + s * 0.02, y - s * 0.18);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "cone": {
      ctx.fillStyle = "#f08a3c";
      ctx.beginPath();
      ctx.moveTo(x - s * 0.1, y);
      ctx.lineTo(x, y - s * 0.28);
      ctx.lineTo(x + s * 0.1, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.fillRect(x - s * 0.055, y - s * 0.13, s * 0.11, s * 0.04);
      break;
    }
    case "billboard": {
      shadow(ctx, x, y, s * 0.35, s * 0.07);
      ctx.fillStyle = "#6b6f75";
      ctx.fillRect(x - s * 0.24, y - s * 0.4, s * 0.04, s * 0.4);
      ctx.fillRect(x + s * 0.2, y - s * 0.4, s * 0.04, s * 0.4);
      ctx.fillStyle = "#1f8a8a";
      ctx.beginPath();
      ctx.roundRect(x - s * 0.36, y - s * 0.78, s * 0.72, s * 0.4, s * 0.04);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#f4fbfb";
      ctx.font = `700 ${Math.max(6, Math.round(s * 0.11))}px 'Atkinson Hyperlegible', sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const lines = [
        ["CONVENIENCE,", "DELIVERED"],
        ["VOTE PELL", "for less"],
        ["NOW 0.99", "at Hollowell"],
      ][Math.floor(rand() * 3)]!;
      ctx.fillText(lines[0]!, x, y - s * 0.64);
      ctx.fillText(lines[1]!, x, y - s * 0.5);
      break;
    }
    case "tower": {
      shadow(ctx, x, y, s * 0.3, s * 0.07);
      const h = s * (0.9 + rand() * 0.6);
      ctx.fillStyle = "#8fa3b4";
      ctx.beginPath();
      ctx.rect(x - s * 0.22, y - h, s * 0.44, h);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(220,240,250,0.75)";
      for (let fy = y - h + s * 0.08; fy < y - s * 0.1; fy += s * 0.14)
        for (let fx = x - s * 0.16; fx < x + s * 0.16; fx += s * 0.12)
          ctx.fillRect(fx, fy, s * 0.07, s * 0.08);
      break;
    }
    case "lamp": {
      ctx.strokeStyle = "#3a3a3a";
      ctx.lineWidth = Math.max(1.5, s * 0.04);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - s * 0.6);
      ctx.stroke();
      ctx.fillStyle = "#ffe9a8";
      ctx.strokeStyle = INK;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.roundRect(x - s * 0.07, y - s * 0.74, s * 0.14, s * 0.16, s * 0.03);
      ctx.fill();
      ctx.stroke();
      const gl = ctx.createRadialGradient(x, y - s * 0.66, 0, x, y - s * 0.66, s * 0.5);
      gl.addColorStop(0, "rgba(255,230,160,0.35)");
      gl.addColorStop(1, "rgba(255,230,160,0)");
      ctx.fillStyle = gl;
      ctx.fillRect(x - s * 0.5, y - s * 1.16, s, s);
      break;
    }
    case "stall": {
      shadow(ctx, x, y, s * 0.32, s * 0.08);
      ctx.fillStyle = "#8a5a35";
      ctx.fillRect(x - s * 0.26, y - s * 0.22, s * 0.52, s * 0.22);
      ctx.strokeRect(x - s * 0.26, y - s * 0.22, s * 0.52, s * 0.22);
      const c = ["#c4433a", "#5b8fd1", "#4f8a3d", "#d9a13a"][Math.floor(rand() * 4)]!;
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? "#fffbe6" : c;
        ctx.beginPath();
        ctx.rect(x - s * 0.3 + i * s * 0.15, y - s * 0.5, s * 0.15, s * 0.2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case "mushroom": {
      ctx.fillStyle = "#f6f1e4";
      ctx.fillRect(x - s * 0.03, y - s * 0.1, s * 0.06, s * 0.1);
      ctx.fillStyle = "#d4544a";
      ctx.beginPath();
      ctx.arc(x, y - s * 0.1, s * 0.1, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(x - s * 0.03, y - s * 0.15, s * 0.018, 0, Math.PI * 2);
      ctx.arc(x + s * 0.04, y - s * 0.13, s * 0.015, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
}
