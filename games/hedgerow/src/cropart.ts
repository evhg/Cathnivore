// Plan item 59: the act's crop drawn on a plot in 2D, one picture per stage (sprout, leaf, ripe). Four plants in
// two rows, inset so a neighbour's crop never touches. Pure canvas; the renderer caches the whole field.

import type { Crop, CropStage } from "./growth";

const LEAF = "#5f9a3a";
const LEAF_DARK = "#3f7428";
const LEAF_PALE = "#8cbf5a";

function spot(i: number, seed: number): [number, number] {
  // Two rows of two, with a seeded nudge so the rows don't read as a grid.
  const col = i % 2;
  const row = Math.floor(i / 2);
  const n = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  const j = n - Math.floor(n);
  return [0.31 + col * 0.38 + (j - 0.5) * 0.06, 0.44 + row * 0.36 + (j - 0.5) * 0.04];
}

function sprout(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.strokeStyle = LEAF_DARK;
  ctx.lineWidth = Math.max(1, s * 0.022);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - s * 0.06);
  ctx.stroke();
  ctx.fillStyle = LEAF_PALE;
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + d * s * 0.035, y - s * 0.065, s * 0.035, s * 0.018, d * -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function wheat(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, ripe: boolean): void {
  const h = s * (ripe ? 0.2 : 0.14);
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(1, s * 0.02);
  for (let k = -2; k <= 2; k++) {
    const tx = x + k * s * 0.018;
    const top = y - h + Math.abs(k) * s * 0.02;
    ctx.strokeStyle = ripe ? "#b8902f" : k % 2 ? LEAF : LEAF_DARK;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(tx, y - h * 0.5, tx + k * s * 0.012, top);
    ctx.stroke();
    if (ripe) {
      ctx.fillStyle = k % 2 ? "#e7c25a" : "#d9ab3c";
      ctx.beginPath();
      ctx.ellipse(tx + k * s * 0.012, top - s * 0.02, s * 0.014, s * 0.034, k * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function cabbage(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, ripe: boolean): void {
  const r = s * (ripe ? 0.085 : 0.06);
  ctx.fillStyle = ripe ? "#4f8a5c" : LEAF;
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * r * 0.55, y - r * 0.6 + Math.sin(a) * r * 0.35, r * 0.6, r * 0.38, a, 0, Math.PI * 2);
    ctx.fill();
  }
  if (ripe) {
    const g = ctx.createRadialGradient(x - r * 0.2, y - r * 0.9, r * 0.1, x, y - r * 0.6, r * 0.7);
    g.addColorStop(0, "#c9e6b4");
    g.addColorStop(1, "#7fb07a");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.65, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(60,100,60,0.5)";
    ctx.lineWidth = Math.max(1, s * 0.012);
    ctx.beginPath();
    ctx.arc(x + r * 0.1, y - r * 0.65, r * 0.3, Math.PI * 0.8, Math.PI * 1.9);
    ctx.stroke();
  }
}

function sunflower(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, ripe: boolean): void {
  const h = s * (ripe ? 0.24 : 0.15);
  ctx.strokeStyle = LEAF_DARK;
  ctx.lineWidth = Math.max(1, s * 0.022);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - h);
  ctx.stroke();
  ctx.fillStyle = LEAF;
  for (const [d, f] of [[-1, 0.45], [1, 0.65]] as const) {
    ctx.beginPath();
    ctx.ellipse(x + d * s * 0.035, y - h * f, s * 0.038, s * 0.02, d * -0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (ripe) {
    const cy = y - h;
    ctx.fillStyle = "#f2c230";
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * s * 0.035, cy + Math.sin(a) * s * 0.035, s * 0.022, s * 0.01, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#6a4420";
    ctx.beginPath();
    ctx.arc(x, cy, s * 0.024, 0, Math.PI * 2);
    ctx.fill();
  }
}

function pumpkin(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, ripe: boolean): void {
  ctx.fillStyle = LEAF;
  for (const [dx, dy] of [[-0.05, -0.03], [0.05, -0.04], [0, -0.07]] as const) {
    ctx.beginPath();
    ctx.arc(x + dx * s, y + dy * s, s * 0.035, 0, Math.PI * 2);
    ctx.fill();
  }
  if (ripe) {
    const r = s * 0.055;
    const cy = y - r * 0.7;
    const g = ctx.createRadialGradient(x - r * 0.3, cy - r * 0.3, r * 0.1, x, cy, r * 1.1);
    g.addColorStop(0, "#f7a84a");
    g.addColorStop(1, "#c4621c");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, cy, r * 1.15, r * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(120,50,10,0.45)";
    ctx.lineWidth = Math.max(1, s * 0.01);
    for (const d of [-0.45, 0.45]) {
      ctx.beginPath();
      ctx.ellipse(x + d * r, cy, r * 0.35, r * 0.8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = "#5a6a24";
    ctx.lineWidth = Math.max(1, s * 0.016);
    ctx.beginPath();
    ctx.moveTo(x, cy - r * 0.8);
    ctx.lineTo(x + r * 0.2, cy - r * 1.15);
    ctx.stroke();
  }
}

function lavender(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, ripe: boolean): void {
  ctx.fillStyle = "#7f9a76";
  ctx.beginPath();
  ctx.ellipse(x, y - s * 0.03, s * 0.06, s * 0.035, 0, 0, Math.PI * 2);
  ctx.fill();
  if (!ripe) return;
  ctx.lineCap = "round";
  for (let k = -2; k <= 2; k++) {
    const tx = x + k * s * 0.022;
    const top = y - s * 0.15 + Math.abs(k) * s * 0.02;
    ctx.strokeStyle = "#6f8a64";
    ctx.lineWidth = Math.max(1, s * 0.012);
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.03);
    ctx.lineTo(tx, top + s * 0.03);
    ctx.stroke();
    ctx.strokeStyle = k % 2 ? "#9a7cc8" : "#7d5fb2";
    ctx.lineWidth = Math.max(1.5, s * 0.026);
    ctx.beginPath();
    ctx.moveTo(tx, top + s * 0.03);
    ctx.lineTo(tx, top - s * 0.01);
    ctx.stroke();
  }
}

const DRAW: Record<Crop, (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, ripe: boolean) => void> = {
  wheat,
  cabbage,
  sunflower,
  pumpkin,
  lavender,
};

/** The crop on one plot whose top-left corner is (x, y), `s` pixels a side. Bare draws nothing. */
export function drawCrop(ctx: CanvasRenderingContext2D, crop: Crop, stage: CropStage, x: number, y: number, s: number, seed: number): void {
  if (stage === 0) return;
  ctx.save();
  // Sown ground over the plot's look (stubble or clover is turned in): dark earth with furrows.
  const i = s * 0.13;
  const w = s - i * 2;
  ctx.fillStyle = stage === 3 ? "rgba(104,70,34,0.5)" : "rgba(92,60,28,0.55)";
  ctx.beginPath();
  ctx.roundRect(x + i, y + i, w, w, s * 0.16);
  ctx.fill();
  ctx.strokeStyle = "rgba(60,38,16,0.35)";
  ctx.lineWidth = Math.max(1, s * 0.02);
  ctx.lineCap = "round";
  for (const v of [0.44, 0.8]) {
    ctx.beginPath();
    ctx.moveTo(x + i * 1.6, y + v * s + s * 0.02);
    ctx.lineTo(x + s - i * 1.6, y + v * s + s * 0.02);
    ctx.stroke();
  }
  // A soft shadow per plant, then the plants back row first, drawn large enough to read at 40 px a cell.
  const k = stage === 1 ? s * 1.5 : s * 1.85;
  for (let n = 0; n < 4; n++) {
    const [u, v] = spot(n, seed);
    const px = x + u * s;
    const py = y + v * s;
    ctx.fillStyle = "rgba(40,28,10,0.25)";
    ctx.beginPath();
    ctx.ellipse(px, py + s * 0.01, k * (stage === 1 ? 0.03 : 0.06), k * 0.018, 0, 0, Math.PI * 2);
    ctx.fill();
    if (stage === 1) sprout(ctx, px, py, k);
    else DRAW[crop](ctx, px, py, k, stage === 3);
  }
  ctx.restore();
}
