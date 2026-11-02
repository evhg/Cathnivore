// The 2D field's landmarks (plan item 43), painted once into the cached background: a village green with
// its well, orchard rows, a quarry pit, a farmyard, a churchyard, a market square, reeds, a windmill, a canal
// lock, a silo and the ford's footbridge. A raised bank is high ground and paints as that (theme.ts).
// Drawn from above at a slight tilt, in the field's own flat-with-ink style: soft shadow, fill, dark edge.

import { enemyPoint, landmarks, type LandmarkKind, type Level } from "./engine";
import { fordMiddle } from "./landmarks";

type Ctx = CanvasRenderingContext2D;
const INK = "#2b2320";

function rng(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

function shadow(ctx: Ctx, x: number, y: number, rx: number, ry: number, a = 0.22): void {
  ctx.fillStyle = `rgba(30,24,10,${a})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function inked(ctx: Ctx, fill: string, s: number, path: () => void, line = 0.03): void {
  ctx.fillStyle = fill;
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s * line);
  ctx.lineJoin = "round";
  ctx.beginPath();
  path();
  ctx.fill();
  ctx.stroke();
}

function tree(ctx: Ctx, x: number, y: number, r: number, s: number, leaf: string, fruit?: string, rand?: () => number): void {
  shadow(ctx, x + r * 0.25, y + r * 0.9, r * 0.95, r * 0.4);
  ctx.fillStyle = "#6b4a2c";
  ctx.fillRect(x - r * 0.12, y, r * 0.24, r * 0.8);
  inked(ctx, leaf, s, () => ctx.arc(x, y - r * 0.1, r, 0, Math.PI * 2), 0.025);
  ctx.fillStyle = "rgba(255,255,220,0.25)";
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.4, r * 0.4, 0, Math.PI * 2);
  ctx.fill();
  if (fruit && rand) {
    ctx.fillStyle = fruit;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(x + (rand() - 0.5) * r * 1.3, y - r * 0.1 + (rand() - 0.5) * r * 1.2, Math.max(1.2, r * 0.13), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Paints every landmark on the level. `offX`, `offY` and `cell` are the field's layout in CSS pixels. */
export function paintLandmarks(ctx: Ctx, level: Level, L: { offX: number; offY: number; cell: number }): void {
  const s = L.cell;
  for (const [n, m] of landmarks(level).entries()) {
    if (m.type === "bank") continue;
    const cs = m.cells.map(([c]) => c);
    const rs = m.cells.map(([, r]) => r);
    const c0 = Math.min(...cs);
    const r0 = Math.min(...rs);
    const w = (Math.max(...cs) - c0 + 1) * s;
    const h = (Math.max(...rs) - r0 + 1) * s;
    const x = L.offX + c0 * s;
    const y = L.offY + r0 * s;
    ctx.save();
    PAINT[m.type](ctx, x, y, w, h, s, rng(level.id * 97 + n * 13 + 5));
    ctx.restore();
  }
  // The ford's footbridge crosses the lane where vehicles wade.
  if (landmarks(level).some((m) => m.type === "ford")) {
    const d = fordMiddle(level);
    if (d !== null) {
      const p = enemyPoint(level, { dist: d });
      const q = enemyPoint(level, { dist: d + 0.2 });
      const ang = Math.atan2(q.y - p.y, q.x - p.x) + Math.PI / 2;
      ctx.save();
      ctx.translate(L.offX + p.x * s, L.offY + p.y * s);
      ctx.rotate(ang);
      shadow(ctx, s * 0.05, s * 0.1, s * 0.6, s * 0.16, 0.2);
      inked(ctx, "#9a6a3e", s, () => ctx.roundRect(-s * 0.62, -s * 0.12, s * 1.24, s * 0.24, s * 0.04));
      ctx.strokeStyle = "rgba(43,35,32,0.55)";
      ctx.lineWidth = Math.max(1, s * 0.015);
      for (let i = -5; i <= 5; i++) {
        ctx.beginPath();
        ctx.moveTo(i * s * 0.11, -s * 0.11);
        ctx.lineTo(i * s * 0.11, s * 0.11);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

type Painter = (ctx: Ctx, x: number, y: number, w: number, h: number, s: number, rand: () => number) => void;

const PAINT: Record<LandmarkKind, Painter> = {
  green(ctx, x, y, w, h, s, rand) {
    const i = s * 0.06;
    inked(ctx, "#93c86a", s, () => ctx.roundRect(x + i, y + i, w - i * 2, h - i * 2, s * 0.3), 0.02);
    // Mown stripes.
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x + i, y + i, w - i * 2, h - i * 2, s * 0.3);
    ctx.clip();
    ctx.fillStyle = "rgba(255,255,230,0.14)";
    for (let k = 0; k < w; k += s * 0.4) ctx.fillRect(x + k, y, s * 0.2, h);
    ctx.restore();
    // The well in the middle: a stone ring, dark water, a little tiled roof on two posts.
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = Math.min(w, h) * 0.17;
    shadow(ctx, cx + r * 0.3, cy + r * 0.9, r * 1.2, r * 0.45);
    inked(ctx, "#bdb3a2", s, () => ctx.ellipse(cx, cy + r * 0.3, r, r * 0.75, 0, 0, Math.PI * 2));
    ctx.fillStyle = "#24343c";
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.25, r * 0.6, r * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5b4330";
    ctx.fillRect(cx - r * 0.95, cy - r * 1.1, r * 0.14, r * 1.4);
    ctx.fillRect(cx + r * 0.81, cy - r * 1.1, r * 0.14, r * 1.4);
    inked(ctx, "#a8402f", s, () => {
      ctx.moveTo(cx - r * 1.25, cy - r * 0.95);
      ctx.lineTo(cx, cy - r * 1.75);
      ctx.lineTo(cx + r * 1.25, cy - r * 0.95);
      ctx.closePath();
    });
    // A bench and a few daisies.
    ctx.fillStyle = "#7a5534";
    ctx.fillRect(x + w * 0.16, y + h * 0.78, w * 0.2, s * 0.06);
    for (let k = 0; k < 10; k++) {
      ctx.fillStyle = k % 3 ? "#fffbe9" : "#f2c94c";
      ctx.beginPath();
      ctx.arc(x + i * 2 + rand() * (w - i * 4), y + i * 2 + rand() * (h - i * 4), Math.max(1, s * 0.025), 0, Math.PI * 2);
      ctx.fill();
    }
  },
  orchard(ctx, x, y, w, h, s, rand) {
    const i = s * 0.08;
    ctx.fillStyle = "rgba(110,150,70,0.55)";
    ctx.beginPath();
    ctx.roundRect(x + i, y + i, w - i * 2, h - i * 2, s * 0.2);
    ctx.fill();
    const across = w >= h;
    const n = Math.round((across ? w : h) / s) * 2;
    for (let k = 0; k < n; k++) {
      for (const lane of [0.3, 0.72]) {
        const t = (k + 0.5) / n;
        const tx = across ? x + w * t : x + w * lane;
        const ty = across ? y + h * lane : y + h * t;
        tree(ctx, tx, ty, s * 0.17, s, k % 2 ? "#4f8a3a" : "#5c9a42", "#d0442f", rand);
      }
    }
  },
  quarry(ctx, x, y, w, h, s, rand) {
    const i = s * 0.05;
    inked(ctx, "#d8ccb0", s, () => ctx.roundRect(x + i, y + i, w - i * 2, h - i * 2, s * 0.12));
    // Stepped benches down into the pit.
    const steps = ["#c6b893", "#b3a37c", "#9c8c67"];
    steps.forEach((col, k) => {
      const d = s * (0.18 + k * 0.16);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.roundRect(x + d, y + d * 1.1, w - d * 2, h - d * 2, s * 0.08);
      ctx.fill();
      ctx.strokeStyle = "rgba(60,48,30,0.4)";
      ctx.lineWidth = Math.max(1, s * 0.015);
      ctx.stroke();
    });
    // A pool of rainwater at the bottom, a few blocks and a hut on the rim.
    ctx.fillStyle = "rgba(90,150,170,0.8)";
    ctx.beginPath();
    ctx.ellipse(x + w * 0.55, y + h * 0.6, w * 0.12, h * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let k = 0; k < 5; k++) {
      const bx = x + s * 0.3 + rand() * (w - s * 0.6);
      const by = y + s * 0.3 + rand() * (h - s * 0.6);
      inked(ctx, "#e6dcc4", s, () => ctx.rect(bx, by, s * 0.12, s * 0.08), 0.015);
    }
    inked(ctx, "#6d6a5f", s, () => ctx.rect(x + w - s * 0.36, y + s * 0.08, s * 0.24, s * 0.16));
  },
  bank() {
    // High ground: painted by theme.ts's plots.
  },
  farmyard(ctx, x, y, w, h, s, rand) {
    const i = s * 0.06;
    inked(ctx, "#c7a979", s, () => ctx.roundRect(x + i, y + i, w - i * 2, h - i * 2, s * 0.12), 0.02);
    // A post-and-rail fence round the yard.
    ctx.strokeStyle = "#7a5534";
    ctx.lineWidth = Math.max(1.5, s * 0.035);
    ctx.strokeRect(x + i * 2, y + i * 2, w - i * 4, h - i * 4);
    ctx.fillStyle = "#5b4330";
    for (let k = 0; k <= 4; k++) {
      ctx.fillRect(x + i * 2 + ((w - i * 4) * k) / 4 - s * 0.025, y + i * 2 - s * 0.025, s * 0.05, s * 0.05);
      ctx.fillRect(x + i * 2 + ((w - i * 4) * k) / 4 - s * 0.025, y + h - i * 2 - s * 0.025, s * 0.05, s * 0.05);
    }
    // Round hay bales, a cart, hens.
    for (let k = 0; k < 3; k++) {
      const bx = x + w * (0.25 + k * 0.17);
      const by = y + h * 0.3;
      shadow(ctx, bx + s * 0.03, by + s * 0.1, s * 0.13, s * 0.05);
      inked(ctx, "#e2bf5f", s, () => ctx.arc(bx, by, s * 0.11, 0, Math.PI * 2), 0.02);
      ctx.strokeStyle = "rgba(140,100,30,0.6)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(bx, by, s * 0.06, 0, Math.PI * 2);
      ctx.stroke();
    }
    const cx = x + w * 0.62;
    const cy = y + h * 0.66;
    inked(ctx, "#a8402f", s, () => ctx.rect(cx - s * 0.22, cy - s * 0.12, s * 0.44, s * 0.24));
    inked(ctx, "#3b3029", s, () => ctx.arc(cx - s * 0.12, cy + s * 0.14, s * 0.08, 0, Math.PI * 2), 0.02);
    inked(ctx, "#3b3029", s, () => ctx.arc(cx + s * 0.12, cy + s * 0.14, s * 0.08, 0, Math.PI * 2), 0.02);
    ctx.strokeStyle = "#5b4330";
    ctx.lineWidth = Math.max(1, s * 0.025);
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.22, cy);
    ctx.lineTo(cx - s * 0.45, cy - s * 0.05);
    ctx.stroke();
    for (let k = 0; k < 4; k++) {
      const hx = x + s * 0.3 + rand() * w * 0.4;
      const hy = y + h * 0.55 + rand() * h * 0.3;
      ctx.fillStyle = "#fbf6ea";
      ctx.beginPath();
      ctx.ellipse(hx, hy, s * 0.05, s * 0.035, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#d0442f";
      ctx.fillRect(hx + s * 0.03, hy - s * 0.04, s * 0.02, s * 0.02);
    }
  },
  churchyard(ctx, x, y, w, h, s, rand) {
    const i = s * 0.06;
    ctx.fillStyle = "#86b860";
    ctx.beginPath();
    ctx.rect(x + i, y + i, w - i * 2, h - i * 2);
    ctx.fill();
    // A drystone wall with a lychgate gap.
    ctx.strokeStyle = "#a59c8b";
    ctx.lineWidth = Math.max(2, s * 0.07);
    ctx.strokeRect(x + i, y + i, w - i * 2, h - i * 2);
    ctx.strokeStyle = "rgba(43,35,32,0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + i - s * 0.035, y + i - s * 0.035, w - i * 2 + s * 0.07, h - i * 2 + s * 0.07);
    ctx.fillStyle = "#86b860";
    ctx.fillRect(x + w / 2 - s * 0.14, y + h - i - s * 0.06, s * 0.28, s * 0.12);
    // The yew, dark and round.
    tree(ctx, x + w * 0.74, y + h * 0.3, Math.min(w, h) * 0.17, s, "#2f5a33");
    // Headstones in rows.
    const cols = Math.max(2, Math.round(w / s) * 2);
    for (let row = 0; row < 2; row++)
      for (let k = 0; k < cols; k++) {
        if (row === 0 && k >= cols - Math.ceil(cols / 3)) continue;
        const gx = x + s * 0.25 + (k * (w - s * 0.5)) / Math.max(1, cols - 1);
        const gy = y + h * (0.32 + row * 0.3) + (rand() - 0.5) * s * 0.04;
        shadow(ctx, gx + s * 0.02, gy + s * 0.07, s * 0.06, s * 0.025, 0.25);
        inked(ctx, "#cfc8ba", s, () => ctx.roundRect(gx - s * 0.045, gy - s * 0.09, s * 0.09, s * 0.14, [s * 0.04, s * 0.04, 0, 0]), 0.015);
      }
  },
  market(ctx, x, y, w, h, s, rand) {
    const i = s * 0.05;
    // Cobbles.
    inked(ctx, "#c9bda5", s, () => ctx.roundRect(x + i, y + i, w - i * 2, h - i * 2, s * 0.08), 0.02);
    ctx.fillStyle = "rgba(90,74,54,0.25)";
    for (let k = 0; k < (w * h) / (s * s) * 26; k++) {
      ctx.beginPath();
      ctx.arc(x + i * 2 + rand() * (w - i * 4), y + i * 2 + rand() * (h - i * 4), Math.max(1, s * 0.022), 0, Math.PI * 2);
      ctx.fill();
    }
    // Stalls under striped awnings, and a market cross in the middle.
    const stripes: Array<[string, string]> = [["#d93a2f", "#fff6e3"], ["#3c7fb1", "#fff6e3"], ["#3f8a52", "#fff6e3"], ["#e0a32e", "#fff6e3"]];
    const spots: Array<[number, number]> = [[0.27, 0.28], [0.73, 0.28], [0.27, 0.72], [0.73, 0.72]];
    spots.forEach(([fx, fy], k) => {
      if ((w < s * 1.5 || h < s * 1.5) && k % 2) return;
      const sx = x + w * fx;
      const sy = y + h * fy;
      const aw = Math.min(w, h) * 0.3;
      shadow(ctx, sx + aw * 0.15, sy + aw * 0.5, aw * 0.6, aw * 0.2);
      const [a, b] = stripes[k % stripes.length]!;
      ctx.save();
      ctx.beginPath();
      ctx.rect(sx - aw / 2, sy - aw * 0.35, aw, aw * 0.6);
      ctx.clip();
      for (let j = 0; j < 6; j++) {
        ctx.fillStyle = j % 2 ? b : a;
        ctx.fillRect(sx - aw / 2 + (j * aw) / 6, sy - aw * 0.35, aw / 6 + 0.5, aw * 0.6);
      }
      ctx.restore();
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1, s * 0.02);
      ctx.strokeRect(sx - aw / 2, sy - aw * 0.35, aw, aw * 0.6);
      ctx.fillStyle = ["#e5533b", "#f2c94c", "#7fb35a"][k % 3]!;
      for (let j = 0; j < 3; j++) {
        ctx.beginPath();
        ctx.arc(sx - aw * 0.25 + j * aw * 0.25, sy + aw * 0.33, aw * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    const mx = x + w / 2;
    const my = y + h / 2;
    shadow(ctx, mx + s * 0.04, my + s * 0.1, s * 0.12, s * 0.05);
    inked(ctx, "#bdb3a2", s, () => {
      ctx.rect(mx - s * 0.03, my - s * 0.16, s * 0.06, s * 0.24);
      ctx.rect(mx - s * 0.09, my - s * 0.1, s * 0.18, s * 0.05);
    }, 0.015);
  },
  reeds(ctx, x, y, w, h, s, rand) {
    const i = s * 0.06;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "rgba(110,165,180,0.85)");
    g.addColorStop(1, "rgba(70,125,145,0.85)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(x + i, y + i, w - i * 2, h - i * 2, s * 0.35);
    ctx.fill();
    ctx.strokeStyle = "rgba(43,35,32,0.45)";
    ctx.lineWidth = Math.max(1, s * 0.02);
    ctx.stroke();
    // Clumps of reeds with brown bulrush heads, and a heron.
    for (let k = 0; k < (w * h) / (s * s) * 7; k++) {
      const rx = x + s * 0.15 + rand() * (w - s * 0.3);
      const ry = y + s * 0.2 + rand() * (h - s * 0.3);
      ctx.strokeStyle = k % 2 ? "#5d8a3a" : "#7aa84a";
      ctx.lineWidth = Math.max(1, s * 0.02);
      for (let j = -2; j <= 2; j++) {
        ctx.beginPath();
        ctx.moveTo(rx + j * s * 0.02, ry);
        ctx.lineTo(rx + j * s * 0.045, ry - s * (0.14 + rand() * 0.08));
        ctx.stroke();
      }
      if (k % 3 === 0) {
        ctx.fillStyle = "#6b4227";
        ctx.fillRect(rx - s * 0.012, ry - s * 0.22, s * 0.024, s * 0.07);
      }
    }
    const hx = x + w * 0.7;
    const hy = y + h * 0.5;
    ctx.strokeStyle = "#e9e6dc";
    ctx.lineWidth = Math.max(1.5, s * 0.03);
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.quadraticCurveTo(hx + s * 0.04, hy - s * 0.12, hx - s * 0.02, hy - s * 0.18);
    ctx.lineTo(hx + s * 0.08, hy - s * 0.17);
    ctx.stroke();
  },
  windmill(ctx, x, y, w, h, s) {
    // A grassy rise, the tower, and four sails.
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rr = Math.min(w, h) * 0.46;
    ctx.fillStyle = "rgba(140,180,90,0.75)";
    ctx.beginPath();
    ctx.ellipse(cx, cy + rr * 0.15, w * 0.48, h * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();
    shadow(ctx, cx + s * 0.08, cy + s * 0.28, s * 0.3, s * 0.1);
    inked(ctx, "#efe6d2", s, () => {
      ctx.moveTo(cx - s * 0.18, cy + s * 0.28);
      ctx.lineTo(cx - s * 0.11, cy - s * 0.22);
      ctx.lineTo(cx + s * 0.11, cy - s * 0.22);
      ctx.lineTo(cx + s * 0.18, cy + s * 0.28);
      ctx.closePath();
    });
    inked(ctx, "#4a4540", s, () => ctx.ellipse(cx, cy - s * 0.22, s * 0.13, s * 0.08, 0, Math.PI, 0));
    ctx.fillStyle = "#5b4330";
    ctx.fillRect(cx - s * 0.04, cy + s * 0.12, s * 0.08, s * 0.16);
    const hub = { x: cx, y: cy - s * 0.24 };
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      ctx.save();
      ctx.translate(hub.x, hub.y);
      ctx.rotate(a);
      inked(ctx, "rgba(240,232,214,0.95)", s, () => ctx.rect(s * 0.05, -s * 0.05, rr * 0.9, s * 0.1), 0.018);
      ctx.strokeStyle = "rgba(43,35,32,0.5)";
      ctx.lineWidth = 1;
      for (let j = 1; j < 4; j++) {
        ctx.beginPath();
        ctx.moveTo(s * 0.05 + (rr * 0.9 * j) / 4, -s * 0.05);
        ctx.lineTo(s * 0.05 + (rr * 0.9 * j) / 4, s * 0.05);
        ctx.stroke();
      }
      ctx.restore();
    }
    inked(ctx, "#3b3029", s, () => ctx.arc(hub.x, hub.y, s * 0.04, 0, Math.PI * 2), 0.015);
  },
  lock(ctx, x, y, w, h, s) {
    const across = w >= h;
    const i = s * 0.08;
    // Towpaths, then the stone-lined channel, the water, and black-and-white gates at both ends.
    ctx.fillStyle = "#cbbf9f";
    ctx.beginPath();
    ctx.roundRect(x + i, y + i, w - i * 2, h - i * 2, s * 0.08);
    ctx.fill();
    const cw = across ? w - i * 2 : (w - i * 2) * 0.55;
    const ch = across ? (h - i * 2) * 0.55 : h - i * 2;
    const cx = x + (w - cw) / 2;
    const cy = y + (h - ch) / 2;
    inked(ctx, "#8d8473", s, () => ctx.rect(cx, cy, cw, ch), 0.02);
    const g = ctx.createLinearGradient(cx, cy, across ? cx : cx + cw, across ? cy + ch : cy);
    g.addColorStop(0, "#3f7f9c");
    g.addColorStop(1, "#5a9db5");
    ctx.fillStyle = g;
    ctx.fillRect(cx + s * 0.05, cy + s * 0.05, cw - s * 0.1, ch - s * 0.1);
    for (const f of [0.18, 0.82]) {
      ctx.save();
      if (across) ctx.translate(x + w * f, cy + ch / 2);
      else ctx.translate(cx + cw / 2, y + h * f);
      if (!across) ctx.rotate(Math.PI / 2);
      inked(ctx, "#1f1b19", s, () => ctx.rect(-s * 0.04, -ch / 2 - s * 0.02, s * 0.08, (across ? ch : cw) + s * 0.04), 0.01);
      ctx.fillStyle = "#f4efe2";
      ctx.fillRect(-s * 0.3, -ch / 2 - s * 0.12, s * 0.3, s * 0.05);
      ctx.fillRect(0, (across ? ch : cw) / 2 + s * 0.07, s * 0.3, s * 0.05);
      ctx.restore();
    }
  },
  silo(ctx, x, y, w, h, s) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    ctx.fillStyle = "rgba(120,110,95,0.35)";
    ctx.beginPath();
    ctx.roundRect(x + s * 0.08, y + s * 0.08, w - s * 0.16, h - s * 0.16, s * 0.1);
    ctx.fill();
    const r = Math.min(w, h) * 0.32;
    shadow(ctx, cx + r * 0.45, cy + r * 0.55, r * 1.25, r * 0.6, 0.28);
    const g = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
    g.addColorStop(0, "#c4cbd0");
    g.addColorStop(0.45, "#eef1f2");
    g.addColorStop(1, "#8f989e");
    inked(ctx, g as unknown as string, s, () => ctx.arc(cx, cy, r, 0, Math.PI * 2));
    ctx.strokeStyle = "rgba(43,35,32,0.35)";
    ctx.lineWidth = 1;
    for (const k of [0.45, 0.75]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * k, 0, Math.PI * 2);
      ctx.stroke();
    }
    // The cap and a ladder down the side; Hollowell's orange band.
    inked(ctx, "#6c7378", s, () => ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2), 0.015);
    ctx.strokeStyle = "#d9772f";
    ctx.lineWidth = Math.max(2, s * 0.05);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.88, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    ctx.strokeStyle = "#3b3029";
    ctx.lineWidth = Math.max(1, s * 0.015);
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.9, cy - s * 0.04);
    ctx.lineTo(cx + r * 1.35, cy - s * 0.04);
    ctx.moveTo(cx + r * 0.9, cy + s * 0.04);
    ctx.lineTo(cx + r * 1.35, cy + s * 0.04);
    ctx.stroke();
  },
  ford(ctx, x, y, w, h, s, rand) {
    // The bank by the crossing: a willow or two and stepping stones (the footbridge is drawn over the lane).
    ctx.fillStyle = "rgba(95,150,170,0.55)";
    ctx.beginPath();
    ctx.roundRect(x + s * 0.1, y + s * 0.1, w - s * 0.2, h - s * 0.2, s * 0.35);
    ctx.fill();
    const n = Math.max(1, Math.round((w * h) / (s * s)));
    for (let k = 0; k < n; k++) {
      const tx = x + (w * (k + 0.5)) / n;
      const ty = y + h * 0.45;
      shadow(ctx, tx + s * 0.06, ty + s * 0.25, s * 0.3, s * 0.1);
      ctx.fillStyle = "#6b4a2c";
      ctx.fillRect(tx - s * 0.03, ty, s * 0.06, s * 0.22);
      // Drooping willow fronds.
      ctx.strokeStyle = "#7ea84e";
      ctx.lineWidth = Math.max(1, s * 0.025);
      for (let j = 0; j < 12; j++) {
        const a = (j / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(tx, ty - s * 0.05);
        ctx.quadraticCurveTo(tx + Math.cos(a) * s * 0.25, ty - s * 0.2, tx + Math.cos(a) * s * 0.3, ty + s * 0.12 + rand() * s * 0.06);
        ctx.stroke();
      }
    }
  },
};
