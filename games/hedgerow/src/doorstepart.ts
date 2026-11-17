// Plan item 480: the farmhouse doorstep in 2D: Hollowell's glossy parcels piled by the door (a flying one arcs in from
// where the leak got through), the 'Sorry we missed you' card on the door and, under a quarter of the Goodwill,
// Hollowell's 'ACQUIRED' sale board at the gate. Drawn by render.ts from `doorstep.ts`'s state.

import { DOORSTEP_SHOWN } from "./doorstep";

type C = CanvasRenderingContext2D;
const INK = "#2b2320";
/** Hollowell's plastic: a glossy off-white box with its red tape and a grey H seal. */
const BOX = "#f1efe9";
const BOX_SIDE = "#cfcac0";
const TAPE = "#c8352b";

/** The step's slots: a pile beside the door, four on the ground, three on them, one on top. `side` 1 piles them right of the door, -1 left (a farmhouse at the field's right edge). */
export function parcelSlot(k: number, x: number, base: number, s: number, side: 1 | -1 = 1): [number, number] {
  const row = k < 4 ? 0 : k < 7 ? 1 : 2;
  const col = row === 0 ? k : row === 1 ? k - 4 : 0;
  return [x + side * (s * 0.17 + col * s * 0.16 + row * s * 0.08), base + s * 0.1 - row * s * 0.13];
}

export function drawParcel(ctx: C, x: number, y: number, s: number, tilt = 0): void {
  const w = s * 0.15;
  const h = s * 0.12;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.lineWidth = Math.max(1, s * 0.014);
  ctx.strokeStyle = INK;
  // top face
  ctx.fillStyle = BOX;
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h);
  ctx.lineTo(-w / 2 + w * 0.25, -h - h * 0.35);
  ctx.lineTo(w / 2 + w * 0.25, -h - h * 0.35);
  ctx.lineTo(w / 2, -h);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // side
  ctx.fillStyle = BOX_SIDE;
  ctx.beginPath();
  ctx.moveTo(w / 2, -h);
  ctx.lineTo(w / 2 + w * 0.25, -h - h * 0.35);
  ctx.lineTo(w / 2 + w * 0.25, -h * 0.35);
  ctx.lineTo(w / 2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // front
  ctx.fillStyle = BOX;
  ctx.fillRect(-w / 2, -h, w, h);
  ctx.strokeRect(-w / 2, -h, w, h);
  // the tape and the gloss
  ctx.fillStyle = TAPE;
  ctx.fillRect(-w * 0.07, -h, w * 0.14, h);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillRect(-w / 2 + w * 0.1, -h + h * 0.15, w * 0.22, h * 0.14);
  ctx.restore();
}

export interface DoorstepView {
  shown: number;
  extra: number;
  card: boolean;
  sale: boolean;
  /** Parcels the neighbours have carted back this level: each rise sends a handcart up the lane. */
  returned?: number;
  /** The level is won (its harvest sweeps the step). */
  won?: boolean;
}

/** How long the neighbours' handcart takes up the lane, and the win's sweep (seconds). */
export const CART_SECONDS = 3.2;
export const SWEEP_SECONDS = 0.9;

const SMOCKS = ["#5f7f4a", "#b5763a"];

/** One neighbour, walking: a smock, a cap, a round face, legs scissoring with `step`. Feet at (x, y). */
function drawNeighbour(ctx: C, x: number, y: number, s: number, step: number, smock: string, lean: number): void {
  const h = s * 0.42;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s * 0.014);
  ctx.lineCap = "round";
  const swing = Math.sin(step) * s * 0.05;
  // trousers: two thick legs scissoring, outlined, with boots
  for (const sw of [-swing, swing]) {
    ctx.lineWidth = Math.max(2, s * 0.05);
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.moveTo(sw * 0.2, -h * 0.4);
    ctx.lineTo(sw, -s * 0.012);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, s * 0.032);
    ctx.strokeStyle = "#4a5266";
    ctx.stroke();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s * 0.014);
  ctx.fillStyle = smock;
  ctx.beginPath();
  ctx.moveTo(-s * 0.06, -h * 0.35);
  ctx.lineTo(s * 0.06, -h * 0.35);
  ctx.lineTo(s * 0.045, -h * 0.78);
  ctx.lineTo(-s * 0.045, -h * 0.78);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#e9c3a0";
  ctx.beginPath();
  ctx.arc(0, -h * 0.9, s * 0.045, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.fillRect(-s * 0.05, -h * 0.98 - s * 0.03, s * 0.1, s * 0.025);
  ctx.restore();
}

/**
 * The neighbours carting one of Hollowell's parcels back: a wooden handcart with the parcel aboard, one neighbour at
 * the shafts, one pushing behind. (x, y) is the cart's foot, `dir` the way it faces (1 right, -1 left), `t` seconds.
 */
export function drawCart(ctx: C, x: number, y: number, s0: number, t: number, dir: 1 | -1, alpha = 1): void {
  // drawn a size up from the step's parcels, so the neighbours stand as tall as the farm's own folk
  const s = s0 * 1.6;
  ctx.save();
  ctx.globalAlpha *= alpha;
  const step = t * 9;
  drawNeighbour(ctx, x + dir * s * 0.32, y, s, step, SMOCKS[0]!, dir * 0.12);
  drawNeighbour(ctx, x - dir * s * 0.3, y, s, step + Math.PI, SMOCKS[1]!, dir * 0.18);
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s * 0.014);
  // the shafts, the bed and a wheel
  ctx.beginPath();
  ctx.moveTo(x + dir * s * 0.12, y - s * 0.11);
  ctx.lineTo(x + dir * s * 0.3, y - s * 0.17);
  ctx.stroke();
  ctx.fillStyle = "#8a5a32";
  ctx.fillRect(x - s * 0.15, y - s * 0.14, s * 0.3, s * 0.05);
  ctx.strokeRect(x - s * 0.15, y - s * 0.14, s * 0.3, s * 0.05);
  ctx.fillStyle = "#6b4a2b";
  ctx.beginPath();
  ctx.arc(x, y - s * 0.055, s * 0.055, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  const a = t * 6 * dir;
  ctx.moveTo(x + Math.cos(a) * s * 0.05, y - s * 0.055 + Math.sin(a) * s * 0.05);
  ctx.lineTo(x - Math.cos(a) * s * 0.05, y - s * 0.055 - Math.sin(a) * s * 0.05);
  ctx.stroke();
  drawParcel(ctx, x, y - s * 0.135, s0 * 1.05, dir * -0.05);
  ctx.restore();
}

/**
 * The win's harvest sweeping the step: the parcels that were there skid off away from the door, tumble and fade,
 * chased by a gust of straw. `p` runs 0 to 1 over SWEEP_SECONDS.
 */
export function drawSweep(ctx: C, n: number, x: number, y: number, s: number, p: number, side: 1 | -1 = 1): void {
  const base = y + s * 0.34;
  const e = 1 - (1 - p) * (1 - p);
  ctx.save();
  for (let k = 0; k < Math.min(n, DOORSTEP_SHOWN); k++) {
    const [px, py] = parcelSlot(k, x, base, s, side);
    const kick = 0.6 + ((k * 53) % 5) * 0.18;
    ctx.globalAlpha = Math.max(0, 1 - p * 1.1);
    const hop = Math.sin(Math.PI * Math.min(1, p * 1.6)) * s * 0.18 * kick;
    drawParcel(ctx, px + side * e * s * 1.1 * kick, py + e * s * 0.12 - hop, s, side * e * 3 * kick);
  }
  // the gust: straw strokes sweeping out from the door
  ctx.globalAlpha = Math.max(0, Math.sin(Math.PI * p)) * 0.9;
  ctx.strokeStyle = "#e3c46a";
  ctx.lineWidth = Math.max(1, s * 0.02);
  ctx.lineCap = "round";
  for (let k = 0; k < 7; k++) {
    const r = s * (0.25 + k * 0.1) + e * s * 0.5;
    const a0 = -0.5 + k * 0.17;
    ctx.beginPath();
    ctx.arc(x, base, r, side === 1 ? a0 : Math.PI - a0 - 0.5, side === 1 ? a0 + 0.5 : Math.PI - a0);
    ctx.stroke();
  }
  ctx.restore();
}

/** The pile and the card by the farmhouse at (x, y) (the house's cell centre), at cell size s. */
export function drawDoorstep(ctx: C, view: DoorstepView, x: number, y: number, s: number, flying: { from: [number, number]; p: number }[], side: 1 | -1 = 1): void {
  const base = y + s * 0.34;
  if (view.card) {
    // the 'Sorry we missed you' card, tucked in the door
    ctx.save();
    ctx.translate(x + s * 0.02, base - s * 0.15);
    ctx.rotate(-0.12);
    ctx.fillStyle = "#fffdf6";
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, s * 0.008);
    ctx.fillRect(-s * 0.06, -s * 0.04, s * 0.12, s * 0.08);
    ctx.strokeRect(-s * 0.06, -s * 0.04, s * 0.12, s * 0.08);
    ctx.fillStyle = TAPE;
    ctx.fillRect(-s * 0.06, -s * 0.04, s * 0.12, s * 0.022);
    ctx.restore();
  }
  const landed = view.shown - flying.length;
  for (let k = 0; k < Math.min(view.shown, DOORSTEP_SHOWN); k++) {
    const [px, py] = parcelSlot(k, x, base, s, side);
    const f = k >= landed ? flying[k - landed] : undefined;
    if (!f) {
      drawParcel(ctx, px, py, s, ((k * 37) % 7) * 0.02 - 0.06);
      continue;
    }
    // a 400 ms toss from where the leak got through, over the hedge in an arc
    const [fx, fy] = f.from;
    const ax = fx + (px - fx) * f.p;
    const ay = fy + (py - fy) * f.p - Math.sin(Math.PI * f.p) * s * 1.2;
    drawParcel(ctx, ax, ay, s, f.p * 6);
  }
  if (view.extra > 0) {
    const [px, py] = parcelSlot(3, x, base, s, side);
    ctx.save();
    ctx.font = `800 ${Math.round(s * 0.2)}px system-ui, sans-serif`;
    ctx.textAlign = side === 1 ? "left" : "right";
    ctx.lineWidth = Math.max(2, s * 0.03);
    ctx.strokeStyle = "#fffdf6";
    ctx.strokeText(`+${view.extra}`, px + side * s * 0.1, py - s * 0.04);
    ctx.fillStyle = TAPE;
    ctx.fillText(`+${view.extra}`, px + side * s * 0.1, py - s * 0.04);
    ctx.restore();
  }
}

/** Hollowell's 'ACQUIRED' board on two posts at (x, y), the gate's cell centre. */
export function drawSaleBoard(ctx: C, x: number, y: number, s: number): void {
  const w = s * 0.95;
  const h = s * 0.4;
  const top = y - s * 0.95;
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s * 0.012);
  ctx.fillStyle = "#6b4a2b";
  for (const dx of [-w * 0.36, w * 0.36]) {
    ctx.fillRect(x + dx - s * 0.03, top, s * 0.06, s * 0.95);
    ctx.strokeRect(x + dx - s * 0.03, top, s * 0.06, s * 0.95);
  }
  ctx.fillStyle = "#f1efe9";
  ctx.fillRect(x - w / 2, top, w, h);
  ctx.strokeRect(x - w / 2, top, w, h);
  ctx.fillStyle = TAPE;
  ctx.fillRect(x - w / 2, top + h * 0.62, w, h * 0.38);
  ctx.fillStyle = "#3b3f44";
  ctx.font = `800 ${Math.round(h * 0.42)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("ACQUIRED", x, top + h * 0.5);
  ctx.fillStyle = "#fffdf6";
  ctx.font = `700 ${Math.round(h * 0.26)}px system-ui, sans-serif`;
  ctx.fillText("HOLLOWELL", x, top + h * 0.93);
  ctx.restore();
}
