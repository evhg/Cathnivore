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
