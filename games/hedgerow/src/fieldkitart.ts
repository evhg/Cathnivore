// Plan item 399: the 2D art for each act's field kit (fieldkit.ts): Saltmarsh's samphire, sea-lavender and salt
// grazing with its sheep, its tarred net shed and salt pans; Rivermead's water-meadow drains, mown swathes and
// watercress, its mill house on the leat and willow-ringed ponds. Brindle's farm kit stays in theme.ts/render.ts.

import { castShadow } from "./sprites";
import type { BarnLook, BedLook, WaterLook } from "./fieldkit";

type C = CanvasRenderingContext2D;

/** mulberry32, as theme.ts's (kept local: theme.ts imports this module). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The bed fills: each act's own ground colour (top, foot). */
const FILL: Partial<Record<BedLook, [string, string]>> = {
  // Glassy samphire: a bright yellow-green flush, reddening toward the foot.
  samphire: ["rgba(118,178,128,0.74)", "rgba(104,152,116,0.78)"],
  // Sea-lavender: grey-green rosettes under a haze of mauve.
  lavender: ["rgba(166,154,194,0.72)", "rgba(140,134,170,0.76)"],
  // Salt grazing: a short, blue-grey sward.
  saltgrass: ["rgba(136,198,176,0.72)", "rgba(108,174,156,0.76)"],
  // Water meadow: lush green ridges between drains.
  meadow: ["rgba(132,186,64,0.68)", "rgba(110,164,54,0.72)"],
  // Mown swathes: fresh pale green, the cut rows darker.
  swathe: ["rgba(200,206,108,0.68)", "rgba(178,186,88,0.72)"],
  // Watercress: dark green in clear running water.
  cress: ["rgba(100,150,66,0.76)", "rgba(82,130,56,0.8)"],
};

export function isKitBed(look: string): boolean {
  return look in FILL;
}

/**
 * One bed (or a field of n by m plots) in the act's kit: the fill, then each plot's scatter from its own seed, then
 * what stands on it (sheep on the salt grazing). `across` runs rows the field's long way.
 */
export function paintKitBed(ctx: C, x: number, y: number, s: number, look: BedLook, across: boolean, seed: number, n = 1, m = 1): void {
  const fill = FILL[look];
  if (!fill) return;
  const i = s * 0.1;
  const rad = s * 0.18;
  const bx = x + i, by = y + i, bw = n * s - i * 2, bh = m * s - i * 2;
  ctx.save();
  ctx.fillStyle = "rgba(30,34,20,0.16)";
  ctx.beginPath();
  ctx.roundRect(bx, by + s * 0.025, bw, bh, rad);
  ctx.fill();
  const g = ctx.createLinearGradient(0, by, 0, by + bh);
  g.addColorStop(0, fill[0]);
  g.addColorStop(1, fill[1]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, rad);
  ctx.fill();
  ctx.clip();
  ctx.lineCap = "round";
  // Long-way rows (drains, swathes, cress channels) run the whole field, not plot by plot.
  if (look === "meadow" || look === "swathe" || look === "cress") rows(ctx, look, bx, by, bw, bh, s, across, rng(seed + 5));
  for (let row = 0; row < m; row++) for (let cell = 0; cell < n; cell++) scatter(ctx, look, x + cell * s, y + row * s, s, rng(seed + cell * 131 + row * 977));
  ctx.restore();
  if (n === 1 && m === 1) {
    ctx.strokeStyle = "rgba(255,255,236,0.2)";
    ctx.lineWidth = Math.max(1, s * 0.02);
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, rad);
    ctx.stroke();
  }
  // About a third of the salt grazing's plots have a ewe on them (Brindle's stubble has stooks).
  if (look === "saltgrass")
    for (let row = 0; row < m; row++)
      for (let cell = 0; cell < n; cell++) {
        const r01 = rng(seed + cell * 131 + row * 977 + 7);
        if (r01() >= 0.36) continue;
        paintEwe(ctx, x + cell * s + s * (0.34 + r01() * 0.32), y + row * s + s * (0.62 + r01() * 0.14), s * 0.4, r01() < 0.5);
      }
}

function rows(ctx: C, look: BedLook, bx: number, by: number, bw: number, bh: number, s: number, across: boolean, r01: () => number): void {
  const len = across ? bw : bh;
  const span = across ? bh : bw;
  const count = Math.max(2, Math.round(span / (s * (look === "meadow" ? 0.34 : 0.26))));
  for (let k = 0; k < count; k++) {
    const p = (span * (k + 0.5)) / count;
    const at = (q: number, off = 0): [number, number] => (across ? [bx + q, by + p + off] : [bx + p + off, by + q]);
    if (look === "meadow") {
      // A drain between two ridges: a dark cut, then the water's glint along it.
      ctx.strokeStyle = "rgba(40,80,44,0.42)";
      ctx.lineWidth = Math.max(1.5, s * 0.07);
      line(ctx, at(s * 0.04), at(len - s * 0.04));
      ctx.strokeStyle = "rgba(170,214,226,0.85)";
      ctx.lineWidth = Math.max(1, s * 0.024);
      line(ctx, at(s * 0.06), at(len - s * 0.06));
    } else if (look === "swathe") {
      // A cut row lying in a soft wave, its shadow under it.
      const wob = s * 0.035;
      for (const [col, w, d] of [["rgba(96,122,52,0.45)", 0.07, s * 0.015], ["rgba(214,226,150,0.85)", 0.04, 0]] as const) {
        ctx.strokeStyle = col;
        ctx.lineWidth = Math.max(1, s * w);
        ctx.beginPath();
        const steps = Math.max(4, Math.round(len / (s * 0.25)));
        for (let j = 0; j <= steps; j++) {
          const q = s * 0.05 + ((len - s * 0.1) * j) / steps;
          const [xx, yy] = at(q, Math.sin(j * 1.7 + k + r01() * 0.3) * wob + d);
          if (j === 0) ctx.moveTo(xx, yy);
          else ctx.lineTo(xx, yy);
        }
        ctx.stroke();
      }
    } else {
      // Cress: clear water running between the rows, catching the light.
      ctx.strokeStyle = "rgba(120,190,200,0.4)";
      ctx.lineWidth = Math.max(1, s * 0.045);
      line(ctx, at(s * 0.02), at(len - s * 0.02));
      ctx.strokeStyle = "rgba(230,248,250,0.75)";
      ctx.lineWidth = Math.max(1, s * 0.018);
      for (let q = s * 0.1 + r01() * s * 0.2; q < len - s * 0.15; q += s * (0.35 + r01() * 0.25)) line(ctx, at(q, -s * 0.012), at(q + s * 0.1, -s * 0.012));
    }
  }
}

function line(ctx: C, a: [number, number], b: [number, number]): void {
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

function scatter(ctx: C, look: BedLook, x: number, y: number, s: number, r01: () => number): void {
  const i = s * 0.1;
  const w = s - i * 2;
  const px = () => x + i + w * (0.1 + r01() * 0.8);
  const py = () => y + i + w * (0.12 + r01() * 0.78);
  if (look === "samphire") {
    // Jointed glassy stems standing up, a few gone red at the tips.
    for (let j = 0; j < 14; j++) {
      const sx = px(), sy = py();
      const h = s * (0.07 + r01() * 0.05);
      const red = r01() < 0.3;
      ctx.strokeStyle = "rgba(60,84,30,0.45)";
      ctx.lineWidth = Math.max(1, s * 0.035);
      line(ctx, [sx + s * 0.012, sy + s * 0.01], [sx + s * 0.012, sy - h + s * 0.01]);
      ctx.strokeStyle = red ? "rgba(196,92,76,0.95)" : "rgba(190,222,104,0.95)";
      ctx.lineWidth = Math.max(1, s * 0.028);
      line(ctx, [sx, sy], [sx, sy - h]);
      ctx.fillStyle = red ? "rgba(226,130,108,0.95)" : "rgba(220,240,150,0.95)";
      ctx.beginPath();
      ctx.arc(sx, sy - h * 0.55, s * 0.018, 0, Math.PI * 2);
      ctx.arc(sx, sy - h, s * 0.016, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (look === "lavender") {
    // Low grey-green rosettes, each with a branched spray of mauve flowers over it.
    for (let j = 0; j < 8; j++) {
      const cx = px(), cy = py();
      ctx.fillStyle = "rgba(70,86,72,0.35)";
      ctx.beginPath();
      ctx.ellipse(cx + s * 0.01, cy + s * 0.012, s * 0.07, s * 0.035, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(120,146,120,0.95)";
      ctx.beginPath();
      ctx.ellipse(cx, cy, s * 0.065, s * 0.03, 0, 0, Math.PI * 2);
      ctx.fill();
      for (let k = 0; k < 7; k++) {
        const a = -Math.PI / 2 + (r01() - 0.5) * 1.8;
        const d = s * (0.03 + r01() * 0.06);
        ctx.fillStyle = k % 3 ? "rgba(168,128,206,0.95)" : "rgba(206,178,232,0.95)";
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * d, cy - s * 0.03 + Math.sin(a) * d * 0.8, s * 0.022, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (look === "saltgrass") {
    // Short tufts and the odd white crust of dried salt.
    for (let j = 0; j < 10; j++) {
      const tx = px(), ty = py();
      ctx.strokeStyle = j % 2 ? "rgba(96,138,116,0.8)" : "rgba(190,214,196,0.85)";
      ctx.lineWidth = Math.max(1, s * 0.02);
      for (const dx of [-0.02, 0, 0.02]) line(ctx, [tx, ty], [tx + s * dx * 1.6, ty - s * 0.05]);
    }
    for (let j = 0; j < 2; j++) {
      ctx.fillStyle = "rgba(248,250,246,0.7)";
      ctx.beginPath();
      ctx.ellipse(px(), py(), s * 0.05, s * 0.022, r01(), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (look === "meadow") {
    // Buttercups and lady's smock in the ridges.
    for (let j = 0; j < 8; j++) {
      ctx.fillStyle = j % 3 ? "rgba(246,212,64,0.95)" : "rgba(236,214,240,0.95)";
      ctx.beginPath();
      ctx.arc(px(), py(), s * 0.02, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (look === "swathe") {
    // Clover and moon daisies left among the cut.
    for (let j = 0; j < 5; j++) {
      ctx.fillStyle = "rgba(255,252,240,0.95)";
      const fx = px(), fy = py();
      ctx.beginPath();
      ctx.arc(fx, fy, s * 0.022, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(240,196,60,0.95)";
      ctx.beginPath();
      ctx.arc(fx, fy, s * 0.009, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (look === "cress") {
    // Cress in clumps of small round leaves, with a few white flower heads.
    for (let j = 0; j < 9; j++) {
      const cx = px(), cy = py();
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + r01();
        ctx.fillStyle = k % 2 ? "rgba(104,170,92,0.95)" : "rgba(80,150,78,0.95)";
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * s * 0.025, cy + Math.sin(a) * s * 0.02, s * 0.022, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (let j = 0; j < 3; j++) {
      ctx.fillStyle = "rgba(252,252,244,0.95)";
      ctx.beginPath();
      ctx.arc(px(), py(), s * 0.015, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** A ewe grazing: a cloud of wool, a dark face and legs, its shadow to the right. */
function paintEwe(ctx: C, cx: number, base: number, h: number, flip: boolean): void {
  const d = flip ? -1 : 1;
  ctx.save();
  ctx.fillStyle = "rgba(40,48,40,0.25)";
  ctx.beginPath();
  ctx.ellipse(cx + h * 0.15, base + h * 0.02, h * 0.55, h * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#3a3632";
  ctx.lineWidth = Math.max(1, h * 0.09);
  ctx.lineCap = "round";
  for (const lx of [-0.24, -0.1, 0.12, 0.26]) line(ctx, [cx + h * lx, base - h * 0.2], [cx + h * lx, base]);
  ctx.fillStyle = "#f4efe2";
  ctx.strokeStyle = "rgba(120,110,92,0.8)";
  ctx.lineWidth = Math.max(1, h * 0.05);
  ctx.beginPath();
  for (const [ox, oy, r] of [[-0.2, -0.36, 0.18], [0, -0.42, 0.2], [0.2, -0.36, 0.18], [-0.08, -0.26, 0.2], [0.12, -0.26, 0.18]] as const) {
    ctx.moveTo(cx + h * ox + h * r, base + h * oy);
    ctx.arc(cx + h * ox, base + h * oy, h * r, 0, Math.PI * 2);
  }
  ctx.stroke();
  ctx.fill();
  // The head, down to graze.
  ctx.fillStyle = "#2f2b28";
  ctx.beginPath();
  ctx.ellipse(cx + d * h * 0.42, base - h * 0.22, h * 0.11, h * 0.15, d * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A water plot in the act's kit (the farm's round pond is theme.ts's). */
export function paintKitWater(ctx: C, x: number, y: number, s: number, look: WaterLook, seed: number): void {
  const r01 = rng(seed);
  ctx.save();
  if (look === "saltpan") {
    // A square pan cut into the marsh: a clay bank, still brine going pink, a white crust at its edges.
    const i = s * 0.1;
    ctx.fillStyle = "rgba(122,104,78,0.9)";
    ctx.beginPath();
    ctx.roundRect(x + i, y + i, s - i * 2, s - i * 2, s * 0.06);
    ctx.fill();
    const g = ctx.createLinearGradient(x, y + i, x + s, y + s - i);
    g.addColorStop(0, "rgba(176,206,214,0.95)");
    g.addColorStop(0.6, "rgba(196,178,196,0.95)");
    g.addColorStop(1, "rgba(214,170,170,0.95)");
    ctx.fillStyle = g;
    const j = s * 0.17;
    ctx.beginPath();
    ctx.roundRect(x + j, y + j, s - j * 2, s - j * 2, s * 0.04);
    ctx.fill();
    ctx.strokeStyle = "rgba(252,252,248,0.9)";
    ctx.lineWidth = Math.max(1, s * 0.035);
    // A solid crust, not dashes: a dashed pale edge reads as the build stitch (item 345).
    ctx.stroke();
    // Crystals drifting on the brine, and the sky's glint.
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      ctx.rect(x + j + (s - j * 2) * (0.15 + r01() * 0.7), y + j + (s - j * 2) * (0.15 + r01() * 0.7), s * 0.03, s * 0.03);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = Math.max(1, s * 0.025);
    line(ctx, [x + s * 0.3, y + s * 0.34], [x + s * 0.48, y + s * 0.3]);
  } else if (look === "willowpond") {
    // A pond with soft banks, a pollard willow leaning over one side and kingcups at the edge.
    const cx = x + s * 0.5, cy = y + s * 0.54;
    ctx.fillStyle = "rgba(84,110,60,0.5)";
    ctx.beginPath();
    ctx.ellipse(cx, cy, s * 0.44, s * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(cx, cy, s * 0.05, cx, cy, s * 0.4);
    g.addColorStop(0, "rgba(108,170,186,0.95)");
    g.addColorStop(1, "rgba(52,108,124,0.92)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, s * 0.37, s * 0.29, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(246,206,48,0.95)";
    for (let k = 0; k < 4; k++) {
      const a = Math.PI * (0.15 + k * 0.22);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * s * 0.38, cy + Math.sin(a) * s * 0.31, s * 0.025, 0, Math.PI * 2);
      ctx.fill();
    }
    // The willow on the far bank: a stub of trunk and a fall of fronds over the water.
    const flip = r01() < 0.5;
    const tx = flip ? x + s * 0.24 : x + s * 0.76;
    const ty = y + s * 0.3;
    castShadow(ctx, tx, ty + s * 0.06, s * 0.08, s * 0.05, s * 0.25, 0.18);
    ctx.fillStyle = "#6b5236";
    ctx.fillRect(tx - s * 0.03, ty - s * 0.08, s * 0.06, s * 0.16);
    for (let k = 0; k < 9; k++) {
      const a = Math.PI * (0.05 + k * 0.1) + (r01() - 0.5) * 0.2;
      const fx = tx + Math.cos(a + Math.PI) * s * 0.18 * (flip ? -1 : 1);
      ctx.strokeStyle = k % 2 ? "rgba(132,176,84,0.95)" : "rgba(104,152,70,0.95)";
      ctx.lineWidth = Math.max(1.5, s * 0.04);
      ctx.beginPath();
      ctx.moveTo(tx, ty - s * 0.1);
      ctx.quadraticCurveTo(fx, ty - s * 0.16, fx, ty + s * (0.08 + r01() * 0.08));
      ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * A barn's cell in the act's kit (the farm's red barn and yard is render.ts's drawFarmyard): Saltmarsh's tarred net
 * shed with nets drying on poles and lobster pots stacked by it; Rivermead's white mill house on its leat, the wheel
 * turning the water.
 */
export function drawKitBarn(ctx: C, x: number, y: number, w: number, look: BarnLook, seed: number, t = 0): void {
  const r01 = rng(seed);
  const flip = r01() < 0.5;
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (look === "netshed") {
    // The hard: shingle and sand under the shed.
    ctx.fillStyle = "rgba(40,36,24,0.16)";
    ctx.beginPath();
    ctx.roundRect(x + w * 0.02, y + w * 0.06, w * 0.96, w * 0.96, w * 0.2);
    ctx.fill();
    ctx.fillStyle = "rgb(206,192,156)";
    ctx.beginPath();
    ctx.roundRect(x + w * 0.02, y + w * 0.04, w * 0.96, w * 0.94, w * 0.2);
    ctx.fill();
    ctx.fillStyle = "rgba(130,120,104,0.55)";
    for (let k = 0; k < 14; k++) {
      ctx.beginPath();
      ctx.ellipse(x + w * (0.08 + r01() * 0.84), y + w * (0.7 + r01() * 0.24), w * 0.02, w * 0.013, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // A net hung to dry between two poles.
    const nx = flip ? x + w * 0.08 : x + w * 0.62;
    ctx.strokeStyle = "#5a4630";
    ctx.lineWidth = Math.max(1.5, w * 0.03);
    line(ctx, [nx, y + w * 0.86], [nx, y + w * 0.5]);
    line(ctx, [nx + w * 0.3, y + w * 0.86], [nx + w * 0.3, y + w * 0.5]);
    ctx.strokeStyle = "rgba(70,96,110,0.8)";
    ctx.lineWidth = Math.max(1, w * 0.012);
    for (let k = 0; k <= 5; k++) {
      line(ctx, [nx + w * 0.3 * (k / 5), y + w * (0.52 + Math.sin((k / 5) * Math.PI) * 0.05)], [nx + w * 0.3 * (k / 5), y + w * 0.78]);
      line(ctx, [nx, y + w * (0.56 + k * 0.045)], [nx + w * 0.3, y + w * (0.56 + k * 0.045)]);
    }
    // Lobster pots stacked in the open corner.
    const px = flip ? x + w * 0.76 : x + w * 0.18;
    for (const [dx, dy] of [[-0.06, 0], [0.06, 0], [0, -0.07]] as const) {
      const cx = px + w * dx, cy = y + w * (0.86 + dy);
      ctx.fillStyle = "#7a4a2c";
      ctx.strokeStyle = "#e6d6b0";
      ctx.lineWidth = Math.max(1, w * 0.012);
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.06, cy);
      ctx.lineTo(cx - w * 0.06, cy - w * 0.04);
      ctx.quadraticCurveTo(cx, cy - w * 0.1, cx + w * 0.06, cy - w * 0.04);
      ctx.lineTo(cx + w * 0.06, cy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      line(ctx, [cx - w * 0.02, cy], [cx - w * 0.02, cy - w * 0.065]);
      line(ctx, [cx + w * 0.02, cy], [cx + w * 0.02, cy - w * 0.065]);
    }
    // The shed: tall, narrow and tarred black, a pitched roof, a cream door and a window.
    const bw = w * 0.42;
    const left = flip ? x + w * 0.46 : x + w * 0.12;
    const top = y + w * 0.04;
    const eave = top + w * 0.16;
    const base = y + w * 0.66;
    castShadow(ctx, left + bw / 2, base, bw / 2, w * 0.14, w * 0.6, 0.2);
    ctx.fillStyle = "#23262a";
    ctx.strokeStyle = "#0f1114";
    ctx.lineWidth = Math.max(1, w * 0.022);
    ctx.beginPath();
    ctx.moveTo(left, base);
    ctx.lineTo(left, eave);
    ctx.lineTo(left + bw / 2, top);
    ctx.lineTo(left + bw, eave);
    ctx.lineTo(left + bw, base);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Weatherboards catching the light.
    ctx.strokeStyle = "rgba(150,160,170,0.35)";
    ctx.lineWidth = Math.max(1, w * 0.01);
    for (let k = 1; k < 7; k++) line(ctx, [left + w * 0.01, eave + ((base - eave) * k) / 7], [left + bw - w * 0.01, eave + ((base - eave) * k) / 7]);
    // A red pantile roof edge.
    ctx.strokeStyle = "#b4573a";
    ctx.lineWidth = Math.max(1.5, w * 0.045);
    ctx.beginPath();
    ctx.moveTo(left - w * 0.03, eave + w * 0.02);
    ctx.lineTo(left + bw / 2, top - w * 0.01);
    ctx.lineTo(left + bw + w * 0.03, eave + w * 0.02);
    ctx.stroke();
    ctx.fillStyle = "#efe6cf";
    ctx.fillRect(left + bw * 0.34, base - w * 0.22, bw * 0.32, w * 0.22);
    ctx.fillStyle = "#f2d27a";
    ctx.fillRect(left + bw * 0.38, eave + w * 0.03, bw * 0.24, w * 0.08);
    ctx.strokeStyle = "#efe6cf";
    ctx.lineWidth = Math.max(1, w * 0.014);
    ctx.strokeRect(left + bw * 0.38, eave + w * 0.03, bw * 0.24, w * 0.08);
  } else {
    // The leat: a channel of water across the cell's foot, the wheel's tail race.
    ctx.fillStyle = "rgba(40,30,10,0.16)";
    ctx.beginPath();
    ctx.roundRect(x + w * 0.02, y + w * 0.06, w * 0.96, w * 0.96, w * 0.2);
    ctx.fill();
    ctx.fillStyle = "rgb(150,176,104)";
    ctx.beginPath();
    ctx.roundRect(x + w * 0.02, y + w * 0.04, w * 0.96, w * 0.94, w * 0.2);
    ctx.fill();
    ctx.fillStyle = "rgb(120,104,80)";
    ctx.fillRect(x + w * 0.02, y + w * 0.7, w * 0.96, w * 0.2);
    const g = ctx.createLinearGradient(0, y + w * 0.72, 0, y + w * 0.88);
    g.addColorStop(0, "rgb(120,184,204)");
    g.addColorStop(1, "rgb(70,130,156)");
    ctx.fillStyle = g;
    ctx.fillRect(x + w * 0.02, y + w * 0.72, w * 0.96, w * 0.15);
    ctx.strokeStyle = "rgba(236,248,250,0.8)";
    ctx.lineWidth = Math.max(1, w * 0.015);
    for (let k = 0; k < 3; k++) {
      const q = ((t * 0.25 + k / 3) % 1) * 0.9;
      line(ctx, [x + w * (0.04 + q), y + w * 0.79], [x + w * (0.1 + q), y + w * 0.79]);
    }
    // The mill house: limewashed walls, a thatched roof, a dark door.
    const bw = w * 0.56;
    const left = flip ? x + w * 0.36 : x + w * 0.08;
    const top = y + w * 0.08;
    const eave = top + w * 0.2;
    const base = y + w * 0.66;
    castShadow(ctx, left + bw / 2, base, bw / 2, w * 0.14, w * 0.5, 0.2);
    ctx.fillStyle = "#f3ecdc";
    ctx.strokeStyle = "#6e6150";
    ctx.lineWidth = Math.max(1, w * 0.02);
    ctx.beginPath();
    ctx.rect(left, eave, bw, base - eave);
    ctx.fill();
    ctx.stroke();
    // Thatch: a deep, rounded roof hanging over the eaves.
    ctx.fillStyle = "#b99a5c";
    ctx.strokeStyle = "#7a6236";
    ctx.beginPath();
    ctx.moveTo(left - w * 0.05, eave + w * 0.05);
    ctx.quadraticCurveTo(left + bw * 0.1, top - w * 0.02, left + bw / 2, top - w * 0.03);
    ctx.quadraticCurveTo(left + bw * 0.9, top - w * 0.02, left + bw + w * 0.05, eave + w * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(240,220,160,0.6)";
    ctx.lineWidth = Math.max(1, w * 0.012);
    for (let k = 1; k < 5; k++) line(ctx, [left + bw * (k / 5), top + w * 0.03], [left + bw * (k / 5) - w * 0.02, eave + w * 0.03]);
    ctx.fillStyle = "#3e5a4a";
    ctx.fillRect(left + bw * 0.4, base - w * 0.2, bw * 0.2, w * 0.2);
    ctx.fillStyle = "#4a5a6a";
    for (const k of [0.14, 0.72]) ctx.fillRect(left + bw * k, eave + w * 0.1, bw * 0.14, w * 0.09);
    // The wheel at the gable end, dipping into the leat, turning.
    const wx = flip ? left - w * 0.06 : left + bw + w * 0.06;
    const wy = y + w * 0.6;
    const wr = w * 0.17;
    ctx.strokeStyle = "#5c4126";
    ctx.lineWidth = Math.max(1.5, w * 0.03);
    ctx.beginPath();
    ctx.arc(wx, wy, wr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, w * 0.018);
    for (let k = 0; k < 8; k++) {
      const a = t * 0.8 + (k / 8) * Math.PI * 2;
      line(ctx, [wx, wy], [wx + Math.cos(a) * wr, wy + Math.sin(a) * wr]);
    }
  }
  ctx.restore();
}
