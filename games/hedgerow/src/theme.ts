// Hedgerow's battlefields: one painted look per act (grass, lane, flowers, scenery and light), drawn once
// per level and size into an offscreen canvas by `paintBackground`. Everything is procedural and seeded by
// the level id, so a level always looks the same and nothing needs downloading.

import { entrySide, nearSides, type Side } from "./depot";
import { laneCellsOf, plotKind, sceneryCells, type Level } from "./engine";
import { fieldAt, plotLooks, sameField, type PlotLook } from "./plotlook";
import { paintLandmarks, paintTwistDressing } from "./landmarkart";
import { DECOR_PIECES, MARGIN_SETS, paintBoardwalk, paintGround, paintPiece, placeMargin, recordMargin, seeded, type Placed, type Rect } from "./margins";

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
  water?: {
    color: string;
    foam: string;
    side: "left" | "right" | "top" | "bottom";
    /** Plan item 370: a sea with depth: sand at the tideline, a shallow teal shelf, then the deep colour, with crests. */
    shelf?: { sand: string; shallow: string; deep: string };
  };
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
    // Plan item 370: coastal daylight, not a grey wash: a cool, clean green (sat ~0.4, Rivermead's is 0.45).
    grass: ["#76ac58", "#5e9448"],
    blade: "#4f8a5a",
    dirt: ["#8a7454", "#e2d3a8", "#b9a77e"],
    flowers: ["#f4f1e8", "#b9d7e2", "#e9d27a"],
    decor: [
      ["reeds", 6],
      ["pool", 3],
      ["boat", 1],
      ["bush", 2],
    ],
    light: "#d9f0f4",
    lightAlpha: 0.07,
    vignette: "rgba(24,64,56,0.26)",
    water: { color: "#5fa9c2", foam: "#e3f2f2", side: "left", shelf: { sand: "#e8d9a6", shallow: "#7fd0c8", deep: "#3f8fb4" } },
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
  // Plan item 224: Bea's crayon on one advert of a level you've won (the first billboard painted; none if none is).
  crayonNextBillboard(isWonLevel(level.id));
  lastCrayon = null;
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

  // Tufts and flowers. Plan item 370: none out on a shelved sea (they speckled Saltmarsh's water like confetti);
  // the random draws are still taken, so everything painted after keeps its place.
  const sea = theme.water?.shelf ? theme.water.side : null;
  const onSea = (x: number, y: number): boolean =>
    sea === "left" ? x < L.offX - s * 0.45 : sea === "right" ? x > L.offX + level.cols * s + s * 0.45 : sea === "top" ? y < L.offY - s * 0.45 : sea === "bottom" ? y > L.offY + level.rows * s + s * 0.45 : false;
  const tufts = Math.round((W * H) / (s * s) * 10);
  ctx.lineCap = "round";
  for (let i = 0; i < tufts; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const h = s * (0.05 + rand() * 0.07);
    const alpha = 0.25 + rand() * 0.3;
    if (onSea(x, y)) continue;
    ctx.strokeStyle = theme.blade;
    ctx.globalAlpha = alpha;
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
    const petal = theme.flowers[Math.floor(rand() * theme.flowers.length)]!;
    if (onSea(x, y)) continue;
    ctx.fillStyle = petal;
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

  // Plan item 202: an act with a margin set paints its own land past the hedge; the rest keep the patchwork.
  const margin = paintMargins(ctx, level, L, theme);
  if (!margin) paintHinterland(ctx, level, L, theme);
  paintLane(ctx, level, L, theme, rand);
  paintPlots(ctx, level, L);
  paintLandmarks(ctx, level, L);
  paintDecor(ctx, level, L, theme, rand, margin ?? undefined);
  paintGate(ctx, level, L);
  paintTwistDressing(ctx, level, L);

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
  if (w.shelf && (w.side === "left" || w.side === "right")) paintShelf(ctx, w.shelf, w.foam, w.side, x0, x1, y0, y1, s);
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

/**
 * Plan item 370: the sea's depth across a side margin: sand at the tideline, a shallow teal shelf, then the deep
 * water out at the table's edge, with long crests running parallel to the shore. Painted inside the water's own path.
 */
function paintShelf(
  ctx: CanvasRenderingContext2D,
  shelf: { sand: string; shallow: string; deep: string },
  foam: string,
  side: "left" | "right",
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  s: number,
): void {
  // Its own seed, so the painting after it (decor, margins) draws the same random sequence as before.
  let seed = 370;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const shore = side === "left" ? x1 + s * 0.2 : x0 - s * 0.2;
  const out = side === "left" ? x0 : x1;
  const span = Math.abs(shore - out);
  const at = (d: number) => Math.min(1, Math.max(0, d / span));
  ctx.save();
  ctx.clip();
  const g = ctx.createLinearGradient(shore, 0, out, 0);
  g.addColorStop(0, shelf.sand);
  g.addColorStop(at(s * 0.32), shelf.sand);
  g.addColorStop(at(s * 0.5), shelf.shallow);
  g.addColorStop(at(s * 1.6), shelf.shallow);
  g.addColorStop(at(s * 3.2), shelf.deep);
  g.addColorStop(1, shelf.deep);
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = g;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Crests: long, gently curved lines parallel to the shore, closer together on the shelf.
  ctx.strokeStyle = foam;
  ctx.lineCap = "round";
  const dir = side === "left" ? -1 : 1;
  for (const [d, a, wdt] of [
    [0.62, 0.7, 0.045],
    [1.05, 0.5, 0.035],
    [1.7, 0.32, 0.03],
    [2.6, 0.22, 0.025],
  ] as const) {
    if (d * s > span) break;
    ctx.globalAlpha = a;
    ctx.lineWidth = Math.max(1, s * wdt);
    for (let y = y0 - s + rand() * s; y < y1; ) {
      const len = s * (1.2 + rand() * 1.8);
      const x = shore + dir * (d * s + Math.sin(y * 0.013) * s * 0.12);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + dir * s * 0.12, y + len / 2, x, y + len);
      ctx.stroke();
      y += len + s * (0.5 + rand() * 1.2);
    }
  }
  ctx.restore();
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
  // Plan item 19: a verge first, a band of longer, darker grass the wheels never reach.
  ctx.strokeStyle = "rgba(48,78,22,0.28)";
  ctx.lineWidth = s * 1.12;
  strokePath(ctx, pts);
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
  // Two wheel ruts worn into the track: a dark trough with a lit far edge, a grassy crown between them.
  ctx.strokeStyle = theme.dirt[2];
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = s * 0.54;
  strokePath(ctx, pts);
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = theme.dirt[0];
  ctx.lineWidth = s * 0.5;
  strokePath(ctx, pts);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = theme.dirt[1];
  ctx.lineWidth = s * 0.38;
  strokePath(ctx, pts);
  ctx.strokeStyle = "rgba(110,140,60,0.22)";
  ctx.lineWidth = s * 0.12;
  strokePath(ctx, pts);
  // Tufts along both verges.
  const along = (d0: number): [number, number, number, number] => {
    let d = d0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      if (d <= len || i === pts.length - 1) {
        const t = Math.min(1, d / len);
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, -(b[1] - a[1]) / len, (b[0] - a[0]) / len];
      }
      d -= len;
    }
    return [pts[0]![0], pts[0]![1], 0, 1];
  };
  let length = 0;
  for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  ctx.strokeStyle = theme.blade;
  ctx.lineWidth = Math.max(1, s * 0.022);
  const tufts = Math.round((length / s) * 7);
  for (let k = 0; k < tufts; k++) {
    const [x0, y0, nx, ny] = along(rand() * length);
    const side = rand() > 0.5 ? 1 : -1;
    const off = side * s * (0.42 + rand() * 0.08);
    const x = x0 + nx * off;
    const y = y0 + ny * off;
    const h = s * (0.07 + rand() * 0.07);
    ctx.globalAlpha = 0.55 + rand() * 0.35;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - h * 0.45, y - h);
    ctx.moveTo(x, y);
    ctx.lineTo(x + h * 0.1, y - h * 1.25);
    ctx.moveTo(x, y);
    ctx.lineTo(x + h * 0.5, y - h * 0.9);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
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
  // The lead-in from the depot gate to the field's edge is drawn as lane too, so no bed is tilled under it.
  const leadIn = new Set<string>();
  for (const path of [level.path, level.path2]) {
    if (!path || path.length < 2) continue;
    const [c, r] = path[0]!;
    const dx = Math.sign(c - path[1]![0]);
    const dy = Math.sign(r - path[1]![1]);
    for (let k = 1; k < Math.max(level.cols, level.rows); k++) leadIn.add(`${c + dx * k},${r + dy * k}`);
  }
  const scenery = sceneryCells(level);
  const looks = plotLooks(level);
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      if (lane.has(`${c},${r}`) || scenery.has(`${c},${r}`)) continue;
      const x = L.offX + c * s;
      const y = L.offY + r * s;
      const inset = s * 0.12;
      const ground = plotKind(level, c, r);
      if (ground !== "water" && ground !== "high") {
        // Plan item 345: a plot joins the plots of its field beside it (no gap, furrows running the run's length).
        // The field's first plot paints the whole run as one bed (no seam between its plots); a puddle is its own.
        // A field several rows deep is one block, painted by its top-left plot; a field the lead-in cuts through
        // falls back to its runs along each row.
        const join = (cc: number, dc: number) => !leadIn.has(`${cc + dc},${r}`) && sameField(level, cc, r, cc + dc, r);
        if (leadIn.has(`${c},${r}`)) continue;
        const look = looks.get(`${c},${r}`) ?? "earth";
        const f = fieldAt(level, c, r);
        let whole = !!f;
        if (f) for (let fr = f.r0; fr <= f.r1 && whole; fr++) for (let fc = f.c0; fc <= f.c1; fc++) if (leadIn.has(`${fc},${fr}`)) { whole = false; break; }
        if (f && whole) {
          if (c === f.c0 && r === f.r0) {
            const n = f.c1 - f.c0 + 1;
            const m = f.r1 - f.r0 + 1;
            // Furrows run the field's long way (a square field picks by seed).
            const across = n > m || (n === m && (c * 31 + r * 17 + level.id) % 2 === 0);
            paintPlot(ctx, x, y, s, look, across, c * 131 + r * 71 + level.id * 7, n, m);
          }
        } else if (!join(c, -1)) {
          let n = 1;
          while (join(c + n - 1, 1)) n++;
          paintPlot(ctx, x, y, s, look, n > 1 || (c * 31 + r * 17 + level.id) % 2 === 0, c * 131 + r * 71 + level.id * 7, n);
        }
        if (look === "puddle") paintPuddle(ctx, x, y, s, c * 131 + r * 71 + level.id * 7);
        // Item 345: where this field meets a different crop below, a low hedge runs along the grass between them.
        const below = leadIn.has(`${c},${r + 1}`) ? undefined : looks.get(`${c},${r + 1}`);
        const flat = (l: PlotLook | undefined) => (l === "puddle" ? "earth" : l);
        if (below && !sameField(level, c, r, c, r + 1) && flat(below) !== flat(look)) paintFieldHedge(ctx, x, y + s, s, c * 37 + r * 11 + level.id);
        continue;
      }
      ctx.fillStyle = "rgba(60,80,20,0.07)";
      ctx.beginPath();
      ctx.roundRect(x + inset, y + inset, s - inset * 2, s - inset * 2, s * 0.14);
      ctx.fill();
      if (ground === "water") {
        const g = ctx.createRadialGradient(x + s / 2, y + s / 2, s * 0.05, x + s / 2, y + s / 2, s * 0.5);
        // Plan item 330 made the 3D ponds deep water; the 2D pond follows a step deeper (item 94: the two read as one colour).
        g.addColorStop(0, "rgba(96,166,202,0.9)");
        g.addColorStop(1, "rgba(42,98,145,0.85)");
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
        // A grassy knoll, not a button: a mound in the field's own greens with contour lines round its
        // flank and a white trig pillar on top (high ground: +25% range). Critique 2026-11-03.
        const cx = x + s / 2;
        const base = y + s * 0.84;
        ctx.fillStyle = "rgba(40,30,10,0.2)";
        ctx.beginPath();
        ctx.ellipse(cx, base, s * 0.46, s * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        const mound = new Path2D();
        mound.moveTo(x + s * 0.04, base);
        mound.bezierCurveTo(x + s * 0.18, y + s * 0.44, x + s * 0.34, y + s * 0.26, cx, y + s * 0.26);
        mound.bezierCurveTo(x + s * 0.66, y + s * 0.26, x + s * 0.82, y + s * 0.44, x + s * 0.96, base);
        mound.closePath();
        const g = ctx.createLinearGradient(x + s * 0.2, y + s * 0.26, x + s * 0.8, base);
        g.addColorStop(0, "rgb(150,176,92)");
        g.addColorStop(1, "rgb(92,120,56)");
        ctx.fillStyle = g;
        ctx.fill(mound);
        ctx.save();
        ctx.clip(mound);
        ctx.strokeStyle = "rgba(60,80,30,0.45)";
        ctx.lineWidth = Math.max(1, s * 0.022);
        for (const k of [0.5, 0.66]) {
          ctx.beginPath();
          ctx.ellipse(cx, base + s * 0.02, s * 0.46 * k, s * 0.58 * k, 0, Math.PI, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = "rgba(255,255,220,0.22)";
        ctx.beginPath();
        ctx.ellipse(x + s * 0.4, y + s * 0.42, s * 0.16, s * 0.08, -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // the trig pillar
        ctx.fillStyle = "rgb(244,238,224)";
        ctx.strokeStyle = "rgba(60,50,40,0.7)";
        ctx.lineWidth = Math.max(1, s * 0.02);
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.06, y + s * 0.3);
        ctx.lineTo(cx - s * 0.045, y + s * 0.1);
        ctx.lineTo(cx + s * 0.045, y + s * 0.1);
        ctx.lineTo(cx + s * 0.06, y + s * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "rgba(60,50,40,0.75)";
        ctx.fillRect(cx - s * 0.02, y + s * 0.08, s * 0.04, s * 0.025);
        continue;
      }
    }
  }
}

/** Plan item 52: a plot drawn by what lies under it, so neighbouring beds differ. */
/** Plan item 345: a cell's length of low hedge along the grass between two fields, centred on `y`: a dark base
 *  line and a crown of leafy bumps, seeded so the run of hedge doesn't repeat. */
function paintFieldHedge(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, seed: number): void {
  const r01 = rng(seed);
  ctx.save();
  ctx.fillStyle = "rgba(40,30,10,0.2)";
  ctx.fillRect(x, y + s * 0.02, s, s * 0.06);
  ctx.fillStyle = "rgb(58,96,46)";
  ctx.fillRect(x, y - s * 0.03, s, s * 0.06);
  const bumps = 8;
  for (let k = 0; k <= bumps; k++) {
    const bx = x + (s * k) / bumps + (r01() - 0.5) * s * 0.03;
    const br = s * (0.045 + r01() * 0.02);
    ctx.fillStyle = "rgb(58,96,46)";
    ctx.beginPath();
    ctx.arc(bx, y, br, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(150,196,104,0.75)";
    ctx.beginPath();
    ctx.arc(bx - br * 0.25, y - br * 0.35, br * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A bed's box over `n` cells by `m` rows (inset on its outer sides), in a cell of side `s`. */
function bedBox(x: number, y: number, s: number, i: number, n: number, m = 1): { x: number; y: number; w: number; h: number } {
  return { x: x + i, y: y + i, w: n * s - i * 2, h: m * s - i * 2 };
}

/** A puddle in one corner of an earth bed, catching the sky. */
function paintPuddle(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, seed: number): void {
  const r01 = rng(seed);
  const px = x + s * (0.34 + r01() * 0.32);
  const py = y + s * (0.36 + r01() * 0.28);
  ctx.save();
  ctx.fillStyle = "rgba(60,40,18,0.3)";
  ctx.beginPath();
  ctx.ellipse(px, py + s * 0.015, s * 0.19, s * 0.11, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createLinearGradient(px, py - s * 0.1, px, py + s * 0.1);
  g.addColorStop(0, "rgba(196,226,240,0.92)");
  g.addColorStop(1, "rgba(104,150,182,0.9)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(px, py, s * 0.17, s * 0.095, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = Math.max(1, s * 0.022);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(px - s * 0.09, py - s * 0.03);
  ctx.lineTo(px - s * 0.02, py - s * 0.05);
  ctx.stroke();
  ctx.restore();
}

/** Plan item 52: a plot drawn by what lies under it; item 345: a field of `n` by `m` plots as one bed. */
function paintPlot(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, look: PlotLook, across: boolean, seed: number, n = 1, m = 1): void {
  if (look === "earth" || look === "puddle") {
    paintBed(ctx, x, y, s, across, n, m);
    return;
  }
  const i = s * 0.1;
  const w = s - i * 2;
  const rad = s * 0.18;
  const b = bedBox(x, y, s, i, n, m);
  ctx.save();
  ctx.fillStyle = "rgba(40,30,10,0.14)";
  ctx.beginPath();
  ctx.roundRect(b.x, b.y + s * 0.025, b.w, b.h, rad);
  ctx.fill();
  const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
  if (look === "stubble") {
    // Last year's stubble: a pale straw bed, cut stalks standing in rows.
    g.addColorStop(0, "rgba(232,204,130,0.62)");
    g.addColorStop(1, "rgba(196,160,86,0.66)");
  } else {
    // Clover: a low green ley, leaves in clumps with a few white heads.
    g.addColorStop(0, "rgba(98,150,66,0.55)");
    g.addColorStop(1, "rgba(70,120,50,0.6)");
  }
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, rad);
  ctx.fill();
  ctx.clip();
  ctx.lineCap = "round";
  // Each plot of the field gets its own scatter, from its own seed.
  const scatter = (x: number, y: number, r01: () => number): void => {
  if (look === "stubble") {
    const rows = 4;
    for (let k = 0; k < rows; k++) {
      const p = i + w * ((k + 0.5) / rows);
      for (let j = 0; j < 6; j++) {
        const q = i + w * ((j + 0.3 + r01() * 0.4) / 6);
        const [sx, sy] = across ? [x + q, y + p] : [x + p, y + q];
        const h = s * (0.05 + r01() * 0.03);
        ctx.strokeStyle = "rgba(120,86,34,0.5)";
        ctx.lineWidth = Math.max(1, s * 0.03);
        ctx.beginPath();
        ctx.moveTo(sx + s * 0.012, sy + s * 0.012);
        ctx.lineTo(sx + s * 0.012, sy - h + s * 0.012);
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,240,196,0.85)";
        ctx.lineWidth = Math.max(1, s * 0.02);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx, sy - h);
        ctx.stroke();
      }
    }
  } else {
    const leaf = (cx: number, cy: number, r: number) => {
      for (let a = 0; a < 3; a++) {
        const ang = (a / 3) * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(ang) * r * 0.9, cy + Math.sin(ang) * r * 0.9, r, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    for (let j = 0; j < 9; j++) {
      const cx = x + i + w * (0.12 + r01() * 0.76);
      const cy = y + i + w * (0.12 + r01() * 0.76);
      const r = s * (0.035 + r01() * 0.02);
      ctx.fillStyle = "rgba(40,80,30,0.35)";
      leaf(cx + s * 0.01, cy + s * 0.012, r);
      ctx.fillStyle = j % 2 ? "rgba(150,200,104,0.95)" : "rgba(122,178,86,0.95)";
      leaf(cx, cy, r);
    }
    for (let j = 0; j < 3; j++) {
      const cx = x + i + w * (0.15 + r01() * 0.7);
      const cy = y + i + w * (0.15 + r01() * 0.7);
      ctx.fillStyle = "rgba(255,252,240,0.95)";
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.03, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(236,170,200,0.9)";
      ctx.beginPath();
      ctx.arc(cx, cy + s * 0.008, s * 0.012, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  };
  for (let row = 0; row < m; row++) for (let cell = 0; cell < n; cell++) scatter(x + cell * s, y + row * s, rng(seed + cell * 131 + row * 977));
  ctx.restore();
  // Item 345: a lone bed keeps its pale rim; a field runs on with no seam between its plots.
  if (n === 1 && m === 1) {
    ctx.strokeStyle = "rgba(255,255,230,0.18)";
    ctx.lineWidth = Math.max(1, s * 0.02);
    ctx.beginPath();
    ctx.roundRect(x + i, y + i, w, w, rad);
    ctx.stroke();
  }
  // Plan item 78: about a third of the stubble beds have a stook or two of last year's sheaves standing in them,
  // so a block of plots reads as a farm at harvest's end, not a repeating tile.
  if (look === "stubble")
    for (let row = 0; row < m; row++)
    for (let cell = 0; cell < n; cell++) {
      const r01 = rng(seed + cell * 131 + row * 977 + 7);
      if (r01() >= 0.38) continue;
      const k2 = r01() < 0.4 ? 2 : 1;
      for (let k = 0; k < k2; k++) paintStook(ctx, x + cell * s + s * (0.3 + 0.4 * k + (r01() - 0.5) * 0.12), y + row * s + s * (0.7 + (r01() - 0.5) * 0.1), s * 0.3);
    }
}

/** A stook: four sheaves leant together, a cone of straw tied at the waist, its shadow falling right. */
function paintStook(ctx: CanvasRenderingContext2D, cx: number, base: number, h: number): void {
  ctx.save();
  ctx.fillStyle = "rgba(60,40,12,0.25)";
  ctx.beginPath();
  ctx.ellipse(cx + h * 0.28, base, h * 0.5, h * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createLinearGradient(cx - h * 0.4, 0, cx + h * 0.4, 0);
  g.addColorStop(0, "rgb(246,218,140)");
  g.addColorStop(1, "rgb(196,152,70)");
  ctx.fillStyle = g;
  ctx.strokeStyle = "rgba(110,76,26,0.85)";
  ctx.lineWidth = Math.max(1, h * 0.06);
  ctx.beginPath();
  ctx.moveTo(cx - h * 0.4, base);
  ctx.quadraticCurveTo(cx - h * 0.2, base - h * 0.55, cx - h * 0.06, base - h);
  ctx.lineTo(cx + h * 0.06, base - h);
  ctx.quadraticCurveTo(cx + h * 0.2, base - h * 0.55, cx + h * 0.4, base);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - h * 0.2, base - h * 0.5);
  ctx.lineTo(cx + h * 0.2, base - h * 0.5);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,244,200,0.7)";
  ctx.lineWidth = Math.max(1, h * 0.04);
  for (const dx of [-0.18, 0, 0.18]) {
    ctx.beginPath();
    ctx.moveTo(cx + h * dx, base - h * 0.08);
    ctx.lineTo(cx + h * dx * 0.3, base - h * 0.85);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Plan item 19: a plot is a tilled bed. A soft rim of turned earth, then furrows (a shadow under each ridge, a lit
 * crest on top), turned one way or the other so a block of plots reads as a patchwork, not a grid.
 */
function paintBed(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, across: boolean, n = 1, m = 1): void {
  const i = s * 0.1;
  const rad = s * 0.18;
  const b = bedBox(x, y, s, i, n, m);
  ctx.save();
  // Shadow where the bed sits a touch below the grass, then the soil.
  ctx.fillStyle = "rgba(40,30,10,0.16)";
  ctx.beginPath();
  ctx.roundRect(b.x, b.y + s * 0.025, b.w, b.h, rad);
  ctx.fill();
  const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
  g.addColorStop(0, "rgba(128,92,52,0.26)");
  g.addColorStop(1, "rgba(96,66,36,0.32)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, rad);
  ctx.fill();
  ctx.clip();
  // Three furrows a cell, running the field's whole length.
  const rows = 3 * (across ? m : n);
  const span = across ? b.h : b.w;
  ctx.lineCap = "round";
  for (let k = 0; k < rows; k++) {
    const p = i + span * ((k + 0.5) / rows);
    const seg = (dx: number, dy: number) => {
      ctx.beginPath();
      if (across) {
        ctx.moveTo(b.x + s * 0.06, y + p + dy);
        ctx.lineTo(b.x + b.w - s * 0.06, y + p + dy);
      } else {
        ctx.moveTo(x + p + dx, b.y + s * 0.06);
        ctx.lineTo(x + p + dx, b.y + b.h - s * 0.06);
      }
      ctx.stroke();
    };
    ctx.strokeStyle = "rgba(60,40,18,0.26)";
    ctx.lineWidth = Math.max(1.5, s * 0.06);
    seg(s * 0.02, s * 0.025);
    ctx.strokeStyle = "rgba(235,205,150,0.32)";
    ctx.lineWidth = Math.max(1, s * 0.028);
    seg(-s * 0.012, -s * 0.012);
  }
  ctx.restore();
  // A lip of grass round the bed (the whole field's).
  ctx.strokeStyle = "rgba(255,255,230,0.18)";
  ctx.lineWidth = Math.max(1, s * 0.02);
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, rad);
  ctx.stroke();
}

function paintGate(ctx: CanvasRenderingContext2D, level: Level, L: Layout): void {
  paintOneGate(ctx, level, level.path, L);
  if (level.path2) paintOneGate(ctx, level, level.path2, L);
}

/**
 * The gate's town sign in canvas CSS px (theme's paintOneGate draws it; plan item 160: Hollowell's depot keeps clear of
 * it). Plan item 74: the sign stays wholly on the canvas when the gate sits at its edge (a phone's narrow field).
 * Plan item 91: the town's name at 11 px or more (it was about 8 px at D); the plate grows to fit the word.
 */
export function gateSignRect(
  level: Level,
  path: Level["path"],
  L: Layout,
  ctx: CanvasRenderingContext2D,
): { label: string; fs: number; sx: number; sy: number; sw: number; sh: number } {
  const s = L.cell;
  const [c, r] = path[0]!;
  const [c2, r2] = path[1]!;
  const dx = Math.sign(c - c2);
  const dy = Math.sign(r - r2);
  const x = L.offX + (c + 0.5 + dx * 0.95) * s;
  const y = L.offY + (r + 0.5 + dy * 0.95) * s;
  const label = level.id >= 81 ? "HOLLOWCANDOR" : level.id >= 41 ? "CANDOR" : "HOLLOWELL";
  const fs = Math.max(12, Math.round(s * 0.17)); // plan item 211: 12 px or more (it read about 10)
  ctx.font = `700 ${fs}px 'Hedgerow UI', system-ui, sans-serif`;
  const sw = Math.max(s * 0.84, ctx.measureText(label).width + fs * 1.1);
  const sh = Math.max(s * 0.26, fs * 1.6);
  // Plan item 126: a gutter clear of the field's rounded frame (at 2 px it sat flush under the frame's edge).
  const pad = Math.max(8, s * 0.1);
  const clampX = (v: number) => Math.max(pad, Math.min(L.width - sw - pad, v));
  const clampY = (v: number) => Math.max(pad, Math.min(L.height - sh - pad, v));
  // Plan item 378: over the gate, unless that lays the plate across a lane (a gate mid-field on a lane that runs up or
  // down, as on a phone's level 21, put HOLLOWELL over the road); then beside the posts, else under them.
  const lanes = laneCellsOf(level);
  const onLane = (px: number, py: number) => {
    const c0 = Math.floor((px - L.offX) / s);
    const c1 = Math.floor((px + sw - 1 - L.offX) / s);
    const r0 = Math.floor((py - L.offY) / s);
    const r1 = Math.floor((py + sh - 1 - L.offY) / s);
    for (let cc = c0; cc <= c1; cc++) for (let rr = r0; rr <= r1; rr++) if (lanes.has(`${cc},${rr}`)) return true;
    return false;
  };
  const tries: Array<[number, number]> = [
    [clampX(x - sw / 2), clampY(y - s * 0.36 - sh)],
    ...(dy !== 0
      ? ([
          [clampX(x + s * 0.6), clampY(y - sh / 2 - s * 0.14)],
          [clampX(x - s * 0.6 - sw), clampY(y - sh / 2 - s * 0.14)],
        ] as Array<[number, number]>)
      : []),
  ];
  const [sx, sy] = tries.find(([px, py]) => !onLane(px, py)) ?? tries[0]!;
  return { label, fs, sx, sy, sw, sh };
}

/**
 * Plan item 380: the field edges beside a gate where Hollowell's depot can stand (main.ts syncDepots): the edge its
 * lane enters from, or one within two cells, with a margin that holds at least the small depot, and never the act's
 * water side (on Saltmarsh it stood half in the sea, a sailboat under its posts). Where one exists the depot's own
 * sign names the gate, so the painted town sign is left off (the gate read HOLLOWELL twice).
 */
export function depotSides(level: Level, path: Level["path"], L: Layout): Side[] {
  const s = L.cell;
  const start = path[0] as unknown as [number, number];
  const water = themeFor(level).water?.side;
  const dsz = Math.max(48, Math.round(s * 1.3));
  const fieldR = L.offX + level.cols * s;
  const fieldB = L.offY + level.rows * s;
  const room: Record<Side, number> = { left: L.offX, right: L.width - fieldR, top: L.offY, bottom: L.height - fieldB };
  return [...entrySide(start, level.cols, level.rows), ...nearSides(start, level.cols, level.rows)].filter((side) => side !== water && room[side] >= dsz + 12);
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
  // Plan item 380: a gate with a depot beside it is named by the depot's sign alone.
  if (depotSides(level, path, L).length) return;
  const { label, fs, sx, sy, sw, sh } = gateSignRect(level, path, L, ctx);
  ctx.font = `700 ${fs}px 'Hedgerow UI', system-ui, sans-serif`;
  ctx.fillStyle = "#1f8a8a";
  ctx.beginPath();
  ctx.roundRect(sx, sy, sw, sh, s * 0.05);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#f4fbfb";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, sx + sw / 2, sy + sh / 2 + fs * 0.05);
}

/**
 * Plan item 202: the act's own margins. Returns the margin rects it painted (decor keeps out of them), or null when
 * the act has no set yet. The land is the dry sides (and the bands above and below the field on a tall screen),
 * never the sea side; pieces keep clear of the lanes, and the placement is recorded for `margin2d()`.
 */
function paintMargins(ctx: CanvasRenderingContext2D, level: Level, L: Layout, theme: Theme): Rect[] | null {
  const act = Math.min(THEMES.length - 1, Math.floor((level.id - 1) / 10));
  const set = MARGIN_SETS[act];
  if (!set) {
    recordMargin({ act, set: "patchwork", pieces: [] });
    return null;
  }
  const s = L.cell;
  const gap = s * 0.9;
  const x0 = L.offX - gap;
  const x1 = L.offX + level.cols * s + gap;
  const y0 = L.offY - gap;
  const y1 = L.offY + level.rows * s + gap;
  const side = theme.water?.side;
  const rects: Rect[] = [];
  if (side !== "left" && x0 > s * 1.4) rects.push({ x: 0, y: 0, w: x0, h: L.height });
  if (side !== "right" && L.width - x1 > s * 1.4) rects.push({ x: x1, y: 0, w: L.width - x1, h: L.height });
  const bx0 = side === "left" ? Math.max(0, x0) : 0;
  const bx1 = side === "right" ? Math.min(L.width, x1) : L.width;
  if (side !== "top" && y0 > s * 1.4) rects.push({ x: bx0, y: 0, w: bx1 - bx0, h: y0 });
  if (side !== "bottom" && L.height - y1 > s * 1.4) rects.push({ x: bx0, y: y1, w: bx1 - bx0, h: L.height - y1 });
  const rand = seeded(level.id * 7727 + 11);
  for (const r of rects) paintGround(ctx, set.ground, r, s, rand);
  // The lanes run in from the edges: nothing stands on them.
  const keepOut: Rect[] = [];
  for (const lane of [lanePoints(level, L), ...(level.path2 ? [lanePoints(level, L, true)] : [])]) {
    // The depot and its queue stand at the lane's way in: a wide berth there.
    const fx1 = L.offX + level.cols * s;
    const fy1 = L.offY + level.rows * s;
    const entry = lane.find(([x, y]) => x >= L.offX - 1 && x <= fx1 + 1 && y >= L.offY - 1 && y <= fy1 + 1) ?? lane[0]!;
    keepOut.push({ x: entry[0] - s * 2.6, y: entry[1] - s * 2.6, w: s * 5.2, h: s * 5.2 });
    for (let i = 1; i < lane.length; i++) {
      const [ax, ay] = lane[i - 1]!;
      const [bx, by] = lane[i]!;
      keepOut.push({ x: Math.min(ax, bx) - s * 0.6, y: Math.min(ay, by) - s * 0.6, w: Math.abs(bx - ax) + s * 1.2, h: Math.abs(by - ay) + s * 1.2 });
    }
  }
  // A boardwalk down each side margin wide enough for it, toward its outer edge (the wider strip by the hedge
  // keeps room for the salt pans).
  if (set.boardwalk)
    for (const r of rects) {
      if (r.h < L.height * 0.9 || r.w < s * 2) continue;
      const w = s * 0.42;
      const out = r.x === 0 ? 0.28 : 0.72;
      const bw = { x: r.x + r.w * out - w / 2, y: r.y, w, h: r.h };
      paintBoardwalk(ctx, bw, s);
      keepOut.push(bw);
    }
  const pieces = placeMargin(set, rects, s, level.id * 131 + 7, keepOut);
  // The water margin's own pieces (punts on the river), wholly on the water.
  if (set.water && side) {
    const wx0 = side === "left" ? 0 : side === "right" ? x1 + s * 0.3 : 0;
    const wx1 = side === "left" ? x0 - s * 0.3 : L.width;
    const wy0 = side === "top" ? 0 : side === "bottom" ? y1 + s * 0.3 : 0;
    const wy1 = side === "top" ? y0 - s * 0.3 : L.height;
    const wr = { x: wx0, y: wy0, w: wx1 - wx0, h: wy1 - wy0 };
    if (wr.w > s * 1.3 && wr.h > s * 1.3) pieces.push(...placeMargin(set, [wr], s, level.id * 977 + 5, keepOut, set.water));
  }
  for (const p of [...pieces].sort((a, b) => a.y - b.y)) paintMarginPiece(ctx, p, s, rand);
  recordMargin({ act, set: set.name, pieces });
  return rects;
}

function paintMarginPiece(ctx: CanvasRenderingContext2D, p: Placed, s: number, rand: () => number): void {
  // Plan item 224: a billboard's piece is its panel's width (about 2.3 of its scale), its foot at the piece's base.
  if (p.kind === "billboard") drawDecor(ctx, "billboard", p.x, p.y + p.h / 2, p.w / 2.3, rand);
  else if (DECOR_PIECES.has(p.kind)) drawDecor(ctx, p.kind as Decor, p.x, p.y + p.h / 2, Math.min(p.w, p.h * 1.2), rand);
  else paintPiece(ctx, p, s, rand);
}

/**
 * Plan item 120: a wide side margin (a tall level on a wide screen) shows the countryside going on past the
 * field: a patchwork of neighbours' fields, wheat, pasture and plough, each edged by a hedge. Muted so the
 * field still leads; the sea side is left to the water. Its own seed, so the decor after it is unchanged.
 */
function paintHinterland(ctx: CanvasRenderingContext2D, level: Level, L: Layout, theme: Theme): void {
  const s = L.cell;
  const rand = rng(level.id * 104729 + 3);
  const gap = s * 1.1;
  const x0 = L.offX - gap;
  const x1 = L.offX + level.cols * s + gap;
  const sides: Array<[number, number]> = [];
  if (theme.water?.side !== "left" && x0 > s * 2.2) sides.push([0, x0]);
  if (theme.water?.side !== "right" && L.width - x1 > s * 2.2) sides.push([x1, L.width]);
  const fills = ["rgba(236,204,110,0.55)", "rgba(150,186,86,0.45)", "rgba(176,128,82,0.42)", "rgba(214,222,132,0.48)"];
  for (const [a, b] of sides) {
    const cols = b - a > s * 5 ? 2 : 1;
    const cw = (b - a) / cols;
    for (let c = 0; c < cols; c++) {
      let y = -s * 0.3;
      while (y < L.height) {
        const h = s * (2 + rand() * 2.5);
        const px = a + c * cw + s * 0.18;
        const pw = cw - s * 0.36;
        const ph = Math.min(h, L.height + s - y) - s * 0.36;
        const py = y + s * 0.18;
        const kind = Math.floor(rand() * fills.length);
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(px, py, pw, ph, s * 0.25);
        ctx.fillStyle = fills[kind]!;
        ctx.fill();
        ctx.clip();
        // Furrows or rows, at the field's own slant.
        const ang = (rand() - 0.5) * 0.6 + (kind % 2 ? Math.PI / 2 : 0);
        ctx.translate(px + pw / 2, py + ph / 2);
        ctx.rotate(ang);
        ctx.strokeStyle = kind === 2 ? "rgba(110,70,40,0.22)" : "rgba(255,250,220,0.22)";
        ctx.lineWidth = Math.max(1, s * 0.035);
        const R = Math.hypot(pw, ph);
        for (let k = -R; k < R; k += s * 0.22) {
          ctx.beginPath();
          ctx.moveTo(-R, k);
          ctx.lineTo(R, k);
          ctx.stroke();
        }
        ctx.restore();
        // The hedge round it: a dark line with a bumped top.
        ctx.strokeStyle = theme.blade;
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = Math.max(2, s * 0.11);
        ctx.beginPath();
        ctx.roundRect(px, py, pw, ph, s * 0.25);
        ctx.stroke();
        ctx.fillStyle = theme.blade;
        for (let t = px + s * 0.2; t < px + pw - s * 0.1; t += s * 0.22) {
          ctx.beginPath();
          ctx.arc(t, py, s * (0.08 + rand() * 0.05), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        y += h;
      }
    }
  }
}

function paintDecor(
  ctx: CanvasRenderingContext2D,
  level: Level,
  L: Layout,
  theme: Theme,
  rand: () => number,
  /** Plan item 202: the act's own margins, which the generic scatter keeps out of. */
  margins: Rect[] = [],
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
  // Plan item 202: the act's margins carry their own pieces, so the scatter's count leaves them out.
  const own = margins.reduce((a, r) => a + (r.w * r.h) / (s * s), 0);
  const count = Math.max(0, Math.round((outside - own) * 0.75));
  const weights = theme.decor;
  const totalW = weights.reduce((a, [, w]) => a + w, 0);
  const items: Array<{ kind: Decor; x: number; y: number; k: number }> = [];
  let guard = 0;
  while (items.length < count && guard++ < count * 30) {
    const x = rand() * L.width;
    const y = rand() * (L.height + s * 0.4);
    if (x > gx0 && x < gx1 && y > gy0 && y < gy1) continue;
    if (nearLane(x, y)) continue;
    const inMargin = margins.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
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
    // Plan item 224: a billboard is a wide panel standing above its foot: the whole panel keeps off the field.
    if (kind === "billboard") {
      const half = Math.max(s * 1.15, 80);
      const tall = Math.max(s * 1.4, 64);
      if (x + half > gx0 && x - half < gx1 && y > gy0 && y - tall < gy1) continue;
    }
    // Plan item 224: a billboard is a wide panel, so it keeps a wider berth.
    const berth = (k: Decor) => (k === "billboard" ? s * 1.2 : s * 0.55);
    // Plan item 326: reeds grow in beds. Two reeds may stand closer, and a reed out in the water mostly takes root near
    // another, so the water between beds stays open (an even spacing laid them on a visible grid).
    const reedPair = (k: Decor) => kind === "reeds" && k === "reeds";
    if (items.some((it) => Math.hypot(it.x - x, it.y - y) < (reedPair(it.kind) ? s * 0.3 : Math.max(berth(kind), berth(it.kind))))) continue;
    if (kind === "reeds" && inWater(x, y) && rand() < 0.75 && !items.some((it) => it.kind === "reeds" && Math.hypot(it.x - x, it.y - y) < s * 0.8)) continue;
    if (inMargin) continue;
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

/**
 * Plan item 224: on a level you've won, Bea has been at one of Hollowell's adverts with her crayons: the slogan
 * struck out in green wax, a sun in the corner and a flower drawn over the face. The next billboard drawn gets it
 * (paintBackground arms it for a won level; the 3D field arms it for its first board).
 */
let crayonNext = false;
/** The panel Bea last drew on (tests), cleared when a field is painted without one. */
export let lastCrayon: { x: number; y: number; w: number; h: number } | null = null;
export function crayonNextBillboard(on: boolean): void {
  crayonNext = on;
}
/** Which levels count as won (main.ts sets it from the save). */
let wonLevel: (id: number) => boolean = () => false;
export function setWonLevels(fn: (id: number) => boolean): void {
  wonLevel = fn;
}
export function isWonLevel(id: number): boolean {
  return wonLevel(id);
}
function beaCrayon(ctx: CanvasRenderingContext2D, left: number, top: number, pw: number, ph: number, fs: number): void {
  lastCrayon = { x: left, y: top, w: pw, h: ph };
  let seed = Math.floor(left * 13 + top * 7) | 1;
  const j = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed / 2147483647 - 0.5) * fs * 0.18;
  };
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // wax: each stroke twice, the second thinner and a touch off, so it reads as crayon, not a vector line
  const wax = (colour: string, w: number, pts: Array<[number, number]>) => {
    for (const [k, a] of [[1, 0.9], [0.55, 0.75]] as const) {
      ctx.strokeStyle = colour;
      ctx.globalAlpha = a;
      ctx.lineWidth = w * k;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x + j(), y + j()) : ctx.moveTo(x + j(), y + j())));
      ctx.stroke();
    }
  };
  const w = Math.max(2, fs * 0.22);
  const tx = left + fs * 0.55 + fs * 2.3;
  const tr = left + pw - fs * 0.3;
  // the slogan struck through, back and forth
  wax("#5fbf3a", w, [[tx - fs * 0.1, top + ph * 0.28], [tr, top + ph * 0.36], [tx, top + ph * 0.5], [tr + fs * 0.1, top + ph * 0.6]]);
  // a flower over the face: five petals and a middle
  const fx = left + fs * 0.35 + fs * 1.15;
  const fy = top + ph * 0.46;
  const pr = fs * 0.42;
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
    const cx = fx + Math.cos(a) * pr;
    const cy = fy + Math.sin(a) * pr;
    wax("#ff6fa8", w * 0.9, [[cx - pr * 0.35, cy], [cx, cy - pr * 0.35], [cx + pr * 0.35, cy], [cx, cy + pr * 0.35], [cx - pr * 0.35, cy]]);
  }
  wax("#ffd23a", w, [[fx - pr * 0.2, fy], [fx + pr * 0.2, fy + pr * 0.05]]);
  wax("#5fbf3a", w * 0.8, [[fx, fy + pr * 1.2], [fx + pr * 0.1, top + ph + fs * 0.2]]);
  // a sun peeping over the panel's top corner
  const sx = left + pw - fs * 0.2;
  const sy = top + fs * 0.1;
  wax("#ffb21a", w, Array.from({ length: 10 }, (_, k): [number, number] => [sx + Math.cos((k / 9) * Math.PI * 2) * fs * 0.33, sy + Math.sin((k / 9) * Math.PI * 2) * fs * 0.33]));
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    wax("#ffb21a", w * 0.7, [[sx + Math.cos(a) * fs * 0.55, sy + Math.sin(a) * fs * 0.55], [sx + Math.cos(a) * fs * 0.85, sy + Math.sin(a) * fs * 0.85]]);
  }
  ctx.restore();
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
      // Plan item 370: a wake trails from the stern and the hull sits in a soft darker patch of water.
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = "#1f4a5a";
      ctx.beginPath();
      ctx.ellipse(x - s * 0.02, y + s * 0.01, s * 0.32, s * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = "#eef7f6";
      ctx.lineWidth = Math.max(1, s * 0.03);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x - s * 0.24, y - s * 0.02);
      ctx.quadraticCurveTo(x - s * 0.5, y - s * 0.08, x - s * 0.8, y - s * 0.16);
      ctx.moveTo(x - s * 0.24, y + s * 0.02);
      ctx.quadraticCurveTo(x - s * 0.5, y + s * 0.06, x - s * 0.8, y + s * 0.12);
      ctx.globalAlpha = 0.4;
      ctx.stroke();
      ctx.restore();
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
      // Plan item 224: Hollowell's adverts: a glossy slate panel on two posts, an orange brand stripe, a face (Pell's
      // grin, a crate of 0.99 farm kit, a QR code or the ballot tick) and a slogan in bold at 12 px or more.
      const ads = [
        { face: "pell", lines: ["VOTE", "PELL"] },
        { face: "crate", lines: ["KIT", "0.99"] },
        { face: "qr", lines: ["SCAN", "& SAVE"] },
        { face: "tick", lines: ["FRESHER", "THAN FRESH™"] },
      ] as const;
      const ad = ads[Math.floor(rand() * ads.length)]!;
      const fs = Math.max(12, Math.round(s * 0.2));
      ctx.font = `800 ${fs}px 'Hedgerow UI', system-ui, sans-serif`;
      const tw = Math.max(...ad.lines.map((l) => ctx.measureText(l).width));
      const fw = fs * 2.3;
      const pw = fw + tw + fs * 1.1;
      const ph = fs * 2.9;
      const top = y - s * 0.42 - ph;
      const left = x - pw / 2;
      shadow(ctx, x, y, pw * 0.45, s * 0.07);
      ctx.fillStyle = "#5d6168";
      ctx.fillRect(left + pw * 0.18, top + ph, s * 0.05, y - top - ph);
      ctx.fillRect(left + pw * 0.78, top + ph, s * 0.05, y - top - ph);
      ctx.fillStyle = "#1e2b34";
      ctx.beginPath();
      ctx.roundRect(left, top, pw, ph, fs * 0.25);
      ctx.fill();
      ctx.stroke();
      // the brand stripe and the gloss
      ctx.fillStyle = "#ff7a1a";
      ctx.fillRect(left + fs * 0.15, top + ph - fs * 0.42, pw - fs * 0.3, fs * 0.22);
      const gl = ctx.createLinearGradient(left, top, left, top + ph * 0.5);
      gl.addColorStop(0, "rgba(255,255,255,0.22)");
      gl.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gl;
      ctx.beginPath();
      ctx.roundRect(left + 2, top + 2, pw - 4, ph * 0.45, fs * 0.2);
      ctx.fill();
      // the face
      const fx = left + fs * 0.35 + fw / 2;
      const fy = top + ph * 0.44;
      const r = fs * 0.95;
      if (ad.face === "pell") {
        ctx.fillStyle = "#f0c9a0";
        ctx.beginPath();
        ctx.arc(fx, fy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#2b2320";
        ctx.beginPath();
        ctx.ellipse(fx - r * 0.1, fy - r * 0.62, r * 0.95, r * 0.45, -0.2, Math.PI, 0);
        ctx.fill();
        ctx.fillRect(fx - r * 0.42, fy - r * 0.18, r * 0.2, r * 0.12);
        ctx.fillRect(fx + r * 0.22, fy - r * 0.18, r * 0.2, r * 0.12);
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.ellipse(fx, fy + r * 0.32, r * 0.55, r * 0.24, 0, 0, Math.PI);
        ctx.fill();
        ctx.strokeStyle = "#2b2320";
        ctx.lineWidth = Math.max(1, fs * 0.08);
        ctx.stroke();
      } else if (ad.face === "crate") {
        ctx.fillStyle = "#ff7a1a";
        ctx.fillRect(fx - r, fy - r * 0.6, r * 2, r * 1.3);
        ctx.strokeStyle = "#7a3a0e";
        ctx.lineWidth = Math.max(1, fs * 0.1);
        ctx.strokeRect(fx - r, fy - r * 0.6, r * 2, r * 1.3);
        ctx.beginPath();
        ctx.moveTo(fx - r, fy);
        ctx.lineTo(fx + r, fy);
        ctx.stroke();
        ctx.fillStyle = "#8fbf4a";
        for (const dx of [-0.5, 0, 0.5]) {
          ctx.beginPath();
          ctx.arc(fx + dx * r, fy - r * 0.75, r * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (ad.face === "qr") {
        ctx.fillStyle = "#fff";
        ctx.fillRect(fx - r, fy - r, r * 2, r * 2);
        ctx.fillStyle = "#1e2b34";
        const c = (r * 2) / 7;
        const bits = [0x7f, 0x41, 0x5d, 0x5d, 0x41, 0x7f, 0x14];
        for (let row = 0; row < 7; row++)
          for (let col = 0; col < 7; col++)
            if ((bits[row]! >> col) & 1 || (row > 3 && col > 3 && (row + col) % 2 === 0)) ctx.fillRect(fx - r + col * c, fy - r + row * c, c * 0.92, c * 0.92);
      } else {
        ctx.fillStyle = "#fff";
        ctx.fillRect(fx - r * 0.85, fy - r * 0.85, r * 1.7, r * 1.7);
        ctx.strokeStyle = "#ff7a1a";
        ctx.lineWidth = Math.max(1.5, fs * 0.2);
        ctx.beginPath();
        ctx.moveTo(fx - r * 0.5, fy);
        ctx.lineTo(fx - r * 0.1, fy + r * 0.4);
        ctx.lineTo(fx + r * 0.55, fy - r * 0.45);
        ctx.stroke();
      }
      // the slogan
      ctx.fillStyle = "#f4fbfb";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const tx = left + fs * 0.55 + fw;
      ctx.fillText(ad.lines[0], tx, top + ph * 0.3);
      ctx.fillText(ad.lines[1], tx, top + ph * 0.62);
      if (crayonNext) {
        crayonNext = false;
        beaCrayon(ctx, left, top, pw, ph, fs);
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = lw;
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
