// Plan item 399: the 2D art for each act's field kit (fieldkit.ts): Saltmarsh's samphire, sea-lavender and salt
// grazing with its sheep, its tarred net shed and salt pans; Rivermead's water-meadow drains, mown swathes and
// watercress, its mill house on the leat and willow-ringed ponds. Brindle's farm kit stays in theme.ts/render.ts.

import { castShadow } from "./sprites";
import type { BarnLook, BedLook, KnollDress, WaterLook } from "./fieldkit";

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
  // Plan item 688: Saltmarsh's beds and margins are deep and near-opaque, so the pale sand lane reads 3:1 against them
  // (the old 0.72-alpha pale fills sat at 1.35-1.9:1 and read as a tinted grid).
  // Glassy samphire: a deep green flush, darker toward the foot.
  samphire: ["rgba(78,120,70,0.95)", "rgba(66,104,62,0.96)"],
  // Sea-lavender: grey-green rosettes under a haze of mauve. Plan item 440: the bed itself is the rosettes' grey-green
  // (a mauve fill read as purple board tiles); the mauve is only the flower sprays, a step down in value and chroma.
  lavender: ["rgba(100,106,96,0.95)", "rgba(86,92,84,0.96)"],
  // Salt grazing: a short, deep sea-green sward.
  saltgrass: ["rgba(62,114,94,0.95)", "rgba(52,98,82,0.96)"],
  // Hill oats: a green-gold crop in ear.
  oats: ["rgba(206,200,120,0.7)", "rgba(178,172,96,0.74)"],
  // Turnips: dark leafy rows on red-brown hill soil.
  turnips: ["rgba(132,96,70,0.8)", "rgba(110,80,58,0.84)"],
  // In-bye: short sheep-bitten turf inside a dry-stone wall.
  inbye: ["rgba(132,170,88,0.66)", "rgba(112,150,74,0.7)"],
  // Wild garlic: deep green, starred white.
  garlic: ["rgba(70,132,66,0.74)", "rgba(56,112,56,0.78)"],
  // Leaf litter: last autumn's oak leaves, russet and brown.
  litter: ["rgba(168,110,62,0.74)", "rgba(138,90,52,0.78)"],
  // A bluebell bank: a blue haze over green.
  // (green ground: a blue fill read as water, which can't be built on)
  bluebell: ["rgba(104,146,96,0.72)", "rgba(88,128,84,0.76)"],
  // Sea kale: wet grey shingle with big glaucous leaves.
  seakale: ["rgba(112,116,110,0.94)", "rgba(96,100,96,0.95)"],
  // Lazybeds: dark ridges of soil mulched with wrack.
  lazybed: ["rgba(104,84,62,0.82)", "rgba(86,70,52,0.86)"],
  // Thrift: short cliff turf studded with pink cushions.
  thrift: ["rgba(84,120,70,0.94)", "rgba(72,104,62,0.95)"],
  // Oilseed rape in flower: a hard chemical yellow.
  rape: ["rgba(238,214,58,0.82)", "rgba(220,192,40,0.86)"],
  // Sugar beet: glossy leaf rows on grey-brown soil.
  beet: ["rgba(122,110,92,0.82)", "rgba(104,94,80,0.86)"],
  // Fallow: rough grass gone to ragwort and dock.
  fallow: ["rgba(150,158,104,0.7)", "rgba(130,138,90,0.74)"],
  // Allotments: dug earth in strips, canes and greens.
  allotment: ["rgba(124,92,62,0.82)", "rgba(106,78,54,0.86)"],
  // Sweet peas: green with pink and purple flowers on pea sticks.
  sweetpea: ["rgba(116,162,94,0.72)", "rgba(98,144,80,0.76)"],
  // Show marrows: big green leaves over pale straw.
  marrow: ["rgba(196,176,112,0.76)", "rgba(172,154,96,0.8)"],
  // Polytunnels: white film over green.
  polytunnel: ["rgba(120,160,104,0.7)", "rgba(102,140,90,0.74)"],
  // A lettuce grid: bright heads in exact rows on grey soil.
  lettuce: ["rgba(118,108,96,0.82)", "rgba(100,92,82,0.86)"],
  // A turf farm: mown stripes.
  turf: ["rgba(104,176,84,0.76)", "rgba(88,158,72,0.8)"],
  // Market salad: alternate red and green lettuce rows.
  salad: ["rgba(110,84,60,0.8)", "rgba(94,72,52,0.84)"],
  // Rhubarb: dark soil, huge leaves, terracotta forcers.
  rhubarb: ["rgba(92,70,52,0.84)", "rgba(78,60,46,0.88)"],
  // Strawberries in straw.
  strawberry: ["rgba(214,190,118,0.78)", "rgba(190,166,98,0.82)"],
  // Water meadow: lush green ridges between drains.
  meadow: ["rgba(132,186,64,0.68)", "rgba(110,164,54,0.72)"],
  // Mown swathes: fresh pale green, the cut rows darker.
  swathe: ["rgba(200,206,108,0.68)", "rgba(178,186,88,0.72)"],
  // Watercress: dark green in clear running water.
  cress: ["rgba(100,150,66,0.76)", "rgba(82,130,56,0.8)"],
};

/** A kit bed's fill (top, foot), for tests that measure it against the lane. */
export function kitBedFill(look: BedLook): [string, string] | undefined {
  return FILL[look];
}

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
  if (look === "meadow" || look === "swathe" || look === "cress" || look === "turnips" || look === "lazybed" || look === "beet" || look === "lettuce" || look === "turf" || look === "salad" || look === "polytunnel" || look === "allotment") rows(ctx, look, bx, by, bw, bh, s, across, rng(seed + 5));
  for (let row = 0; row < m; row++) for (let cell = 0; cell < n; cell++) scatter(ctx, look, x + cell * s, y + row * s, s, rng(seed + cell * 131 + row * 977));
  ctx.restore();
  if (n === 1 && m === 1) {
    ctx.strokeStyle = "rgba(255,255,236,0.2)";
    ctx.lineWidth = Math.max(1, s * 0.02);
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, rad);
    ctx.stroke();
  }
  // In-bye: a dry-stone wall along the field's top edge.
  if (look === "inbye") paintDryWall(ctx, bx + s * 0.02, by + s * 0.01, bw - s * 0.04, s, rng(seed + 11));
  // About a third of the salt grazing's (and in-bye's) plots have a ewe on them (Brindle's stubble has stooks).
  if (look === "saltgrass" || look === "inbye")
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
    } else if (look === "lazybed") {
      // A ridge of earth with brown wrack laid along it and potato haulm on top.
      ctx.strokeStyle = "rgba(60,46,34,0.5)";
      ctx.lineWidth = Math.max(1.5, s * 0.08);
      line(ctx, at(s * 0.04, s * 0.02), at(len - s * 0.04, s * 0.02));
      ctx.strokeStyle = "rgba(122,104,48,0.9)";
      ctx.lineWidth = Math.max(1, s * 0.03);
      line(ctx, at(s * 0.05), at(len - s * 0.05));
      for (let q = s * 0.1 + r01() * s * 0.1; q < len - s * 0.1; q += s * 0.17) {
        const [tx, ty] = at(q, -s * 0.02);
        ctx.fillStyle = "rgba(92,150,70,0.95)";
        ctx.beginPath();
        ctx.arc(tx, ty, s * 0.03, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(240,236,250,0.95)";
        ctx.beginPath();
        ctx.arc(tx + s * 0.012, ty - s * 0.012, s * 0.009, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (look === "lettuce" || look === "salad") {
      // Heads in an exact row (salad alternates red and green rows).
      const red = look === "salad" && k % 2 === 1;
      for (let q = s * 0.1; q < len - s * 0.08; q += s * 0.14) {
        const [tx, ty] = at(q);
        ctx.fillStyle = red ? "rgba(140,52,72,0.97)" : "rgba(118,186,74,0.97)";
        ctx.beginPath();
        ctx.arc(tx, ty, s * 0.045, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = red ? "rgba(190,90,110,0.97)" : "rgba(170,222,110,0.97)";
        ctx.beginPath();
        ctx.arc(tx - s * 0.008, ty - s * 0.008, s * 0.022, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (look === "turf") {
      // Mown stripes: alternate light and dark the long way.
      if (k % 2 === 0) {
        const w = span / count;
        ctx.fillStyle = "rgba(196,236,150,0.35)";
        if (across) ctx.fillRect(bx, by + p - w / 2, len, w);
        else ctx.fillRect(bx + p - w / 2, by, w, len);
      }
    } else if (look === "polytunnel") {
      // A tunnel of white film on hoops, its ribs and a sheen down the crown.
      if (k % 2 === 1) continue;
      const w = (span / count) * 1.6;
      const [x0, y0] = at(s * 0.04, -w / 2);
      const tw = across ? len - s * 0.08 : w, th = across ? w : len - s * 0.08;
      const g = across ? ctx.createLinearGradient(0, y0, 0, y0 + th) : ctx.createLinearGradient(x0, 0, x0 + tw, 0);
      g.addColorStop(0, "rgba(206,214,214,0.95)");
      g.addColorStop(0.45, "rgba(252,252,250,0.97)");
      g.addColorStop(1, "rgba(178,188,190,0.95)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(x0, y0, tw, th, s * 0.05);
      ctx.fill();
      ctx.strokeStyle = "rgba(120,130,134,0.7)";
      ctx.lineWidth = Math.max(0.75, s * 0.012);
      for (let q = s * 0.12; q < len - s * 0.1; q += s * 0.18) {
        const [a0, a1] = at(q, -w / 2), [b0, b1] = at(q, w / 2);
        line(ctx, [a0, a1], [b0, b1]);
      }
    } else if (look === "allotment") {
      // Strips: a row of bean canes in a wigwam, then a row of cabbages.
      for (let q = s * 0.12 + r01() * s * 0.05; q < len - s * 0.1; q += s * 0.19) {
        const [tx, ty] = at(q);
        if (k % 2 === 0) {
          ctx.strokeStyle = "rgba(196,170,110,0.97)";
          ctx.lineWidth = Math.max(1, s * 0.012);
          line(ctx, [tx - s * 0.03, ty + s * 0.03], [tx, ty - s * 0.06]);
          line(ctx, [tx + s * 0.03, ty + s * 0.03], [tx, ty - s * 0.06]);
          ctx.fillStyle = "rgba(84,146,62,0.95)";
          ctx.beginPath();
          ctx.arc(tx - s * 0.012, ty - s * 0.01, s * 0.016, 0, Math.PI * 2);
          ctx.arc(tx + s * 0.014, ty + s * 0.008, s * 0.014, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(220,70,52,0.95)";
          ctx.beginPath();
          ctx.arc(tx + s * 0.004, ty - s * 0.03, s * 0.008, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = "rgba(108,150,140,0.97)";
          ctx.beginPath();
          ctx.arc(tx, ty, s * 0.038, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(160,196,180,0.97)";
          ctx.beginPath();
          ctx.arc(tx, ty, s * 0.018, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (look === "beet") {
      // Beet in drilled rows: glossy dark leaves with red stalks.
      for (let q = s * 0.1 + r01() * s * 0.06; q < len - s * 0.1; q += s * 0.16) {
        const [tx, ty] = at(q);
        for (const a of [-0.7, 0, 0.7]) {
          ctx.fillStyle = a ? "rgba(60,110,52,0.97)" : "rgba(80,134,62,0.97)";
          ctx.beginPath();
          ctx.ellipse(tx + Math.sin(a) * s * 0.03, ty - s * 0.02, s * 0.022, s * 0.04, a, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = "rgba(170,60,70,0.9)";
        ctx.beginPath();
        ctx.arc(tx, ty + s * 0.012, s * 0.012, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (look === "turnips") {
      // A drill of turnips: leafy tops in a row, a purple-white shoulder showing at each.
      for (let q = s * 0.12 + r01() * s * 0.08; q < len - s * 0.1; q += s * 0.2) {
        const [tx, ty] = at(q);
        ctx.fillStyle = "rgba(232,224,240,0.95)";
        ctx.beginPath();
        ctx.arc(tx, ty + s * 0.02, s * 0.03, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(150,96,160,0.9)";
        ctx.beginPath();
        ctx.arc(tx, ty + s * 0.008, s * 0.02, Math.PI, 0);
        ctx.fill();
        for (const [dx, col] of [[-0.035, "rgba(70,126,58,0.95)"], [0.035, "rgba(70,126,58,0.95)"], [0, "rgba(98,154,70,0.95)"]] as const) {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.ellipse(tx + s * dx, ty - s * 0.025, s * 0.026, s * 0.04, dx * 12, 0, Math.PI * 2);
          ctx.fill();
        }
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
        ctx.fillStyle = k % 3 ? "rgba(150,122,178,0.92)" : "rgba(186,168,206,0.92)";
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
  } else if (look === "oats") {
    // Oats in ear: slim stems, each with a drooping spray of pale spikelets.
    for (let j = 0; j < 12; j++) {
      const sx = px(), sy = py();
      const h = s * (0.09 + r01() * 0.04);
      ctx.strokeStyle = "rgba(120,124,60,0.8)";
      ctx.lineWidth = Math.max(1, s * 0.016);
      line(ctx, [sx, sy], [sx, sy - h]);
      ctx.fillStyle = "rgba(246,236,176,0.95)";
      for (const [dx, dy] of [[-0.025, 0.02], [0.025, 0.03], [-0.02, 0.05], [0.02, 0.06]] as const) {
        ctx.beginPath();
        ctx.ellipse(sx + s * dx, sy - h + s * dy, s * 0.012, s * 0.02, dx * 20, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (look === "inbye") {
    // Sheep-bitten turf, a few thistles, and a bit of stone wall drawn after the clip.
    for (let j = 0; j < 8; j++) {
      const tx = px(), ty = py();
      ctx.strokeStyle = "rgba(84,124,56,0.75)";
      ctx.lineWidth = Math.max(1, s * 0.018);
      for (const dx of [-0.015, 0.015]) line(ctx, [tx, ty], [tx + s * dx, ty - s * 0.04]);
    }
    for (let j = 0; j < 2; j++) {
      const tx = px(), ty = py();
      ctx.fillStyle = "rgba(178,112,196,0.95)";
      ctx.beginPath();
      ctx.arc(tx, ty - s * 0.03, s * 0.018, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(84,124,56,0.9)";
      ctx.lineWidth = Math.max(1, s * 0.014);
      line(ctx, [tx, ty], [tx, ty - s * 0.02]);
    }
  } else if (look === "seakale") {
    // Pebbles, then sea kale: crinkled blue-grey leaves round a head of white flowers.
    for (let j = 0; j < 12; j++) {
      const g = 150 + Math.floor(r01() * 60);
      ctx.fillStyle = `rgba(${g},${g - 4},${g - 12},0.9)`;
      ctx.beginPath();
      ctx.ellipse(px(), py(), s * 0.02, s * 0.014, r01() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let j = 0; j < 3; j++) {
      const cx = px(), cy = py();
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + r01() * 0.4;
        ctx.fillStyle = k % 2 ? "rgba(120,160,164,0.97)" : "rgba(96,140,150,0.97)";
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * s * 0.04, cy + Math.sin(a) * s * 0.03, s * 0.04, s * 0.025, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(252,250,240,0.97)";
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.arc(cx + (r01() - 0.5) * s * 0.04, cy - s * 0.01 + (r01() - 0.5) * s * 0.03, s * 0.012, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (look === "thrift") {
    // Cushions of thrift: a dark green tuft carrying pink pom-poms.
    for (let j = 0; j < 7; j++) {
      const cx = px(), cy = py();
      ctx.fillStyle = "rgba(72,112,62,0.95)";
      ctx.beginPath();
      ctx.ellipse(cx, cy, s * 0.05, s * 0.028, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = j % 2 ? "rgba(236,138,176,0.97)" : "rgba(246,176,204,0.97)";
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.arc(cx + (k - 1.5) * s * 0.022, cy - s * (0.025 + (k % 2) * 0.012), s * 0.016, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (look === "sweetpea") {
    // Pea sticks with sweet peas in pink, purple and white.
    for (let j = 0; j < 4; j++) {
      const sx = px(), sy = py();
      ctx.strokeStyle = "rgba(140,112,74,0.9)";
      ctx.lineWidth = Math.max(1, s * 0.012);
      for (const dx of [-0.02, 0.02]) line(ctx, [sx + s * dx, sy], [sx + s * dx * 0.4, sy - s * 0.1]);
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = ["rgba(236,120,170,0.97)", "rgba(150,96,196,0.97)", "rgba(252,240,246,0.97)"][(j + k) % 3]!;
        ctx.beginPath();
        ctx.arc(sx + (r01() - 0.5) * s * 0.06, sy - s * (0.02 + r01() * 0.08), s * 0.016, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (look === "marrow") {
    // A show marrow (and a pumpkin) under broad leaves.
    for (let j = 0; j < 3; j++) {
      const cx = px(), cy = py();
      ctx.fillStyle = "rgba(84,140,62,0.95)";
      for (const a of [0, 2.1, 4.2]) {
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * s * 0.04, cy + Math.sin(a) * s * 0.03, s * 0.04, 0, Math.PI * 2);
        ctx.fill();
      }
      if (j === 0) {
        ctx.fillStyle = "rgba(228,128,40,0.97)";
        ctx.beginPath();
        ctx.ellipse(cx + s * 0.05, cy + s * 0.03, s * 0.045, s * 0.035, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = "rgba(70,110,52,0.97)";
        ctx.beginPath();
        ctx.ellipse(cx + s * 0.04, cy + s * 0.035, s * 0.06, s * 0.022, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(200,220,140,0.8)";
        ctx.lineWidth = Math.max(0.75, s * 0.008);
        line(ctx, [cx - s * 0.01, cy + s * 0.025], [cx + s * 0.09, cy + s * 0.045]);
      }
    }
  } else if (look === "rhubarb") {
    // Big leaves on red stalks, and a terracotta forcing pot or two.
    for (let j = 0; j < 3; j++) {
      const cx = px(), cy = py();
      ctx.strokeStyle = "rgba(196,54,66,0.97)";
      ctx.lineWidth = Math.max(1, s * 0.016);
      for (const a of [-0.6, 0.1, 0.8]) line(ctx, [cx, cy], [cx + Math.sin(a) * s * 0.05, cy - s * 0.04]);
      ctx.fillStyle = "rgba(78,140,60,0.95)";
      for (const a of [-0.6, 0.1, 0.8]) {
        ctx.beginPath();
        ctx.ellipse(cx + Math.sin(a) * s * 0.06, cy - s * 0.06, s * 0.045, s * 0.035, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const fx = px(), fy = py();
    ctx.fillStyle = "rgba(196,104,62,0.97)";
    ctx.strokeStyle = "rgba(110,54,30,0.9)";
    ctx.lineWidth = Math.max(0.75, s * 0.01);
    ctx.beginPath();
    ctx.moveTo(fx - s * 0.04, fy);
    ctx.lineTo(fx - s * 0.03, fy - s * 0.08);
    ctx.lineTo(fx + s * 0.03, fy - s * 0.08);
    ctx.lineTo(fx + s * 0.04, fy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (look === "strawberry") {
    // Trefoil leaves on straw, red berries showing.
    for (let j = 0; j < 8; j++) {
      const cx = px(), cy = py();
      ctx.fillStyle = "rgba(72,132,58,0.95)";
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * s * 0.018, cy + Math.sin(a) * s * 0.018, s * 0.018, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(222,40,52,0.97)";
      ctx.beginPath();
      ctx.ellipse(cx + s * 0.03, cy + s * 0.02, s * 0.013, s * 0.017, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (look === "rape") {
    // A sea of small yellow heads over green stems.
    for (let j = 0; j < 22; j++) {
      ctx.fillStyle = j % 4 ? "rgba(250,232,80,0.97)" : "rgba(120,150,60,0.8)";
      ctx.beginPath();
      ctx.arc(px(), py(), s * 0.018, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (look === "fallow") {
    // Rough tussocks, ragwort's flat yellow heads and rusty dock spikes.
    for (let j = 0; j < 8; j++) {
      const tx = px(), ty = py();
      ctx.strokeStyle = "rgba(110,120,64,0.85)";
      ctx.lineWidth = Math.max(1, s * 0.018);
      for (const dx of [-0.025, 0, 0.025]) line(ctx, [tx, ty], [tx + s * dx, ty - s * 0.05]);
    }
    for (let j = 0; j < 3; j++) {
      const tx = px(), ty = py();
      ctx.fillStyle = "rgba(236,190,40,0.97)";
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.arc(tx + (k - 1) * s * 0.02, ty - s * 0.05, s * 0.014, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(150,74,44,0.95)";
      ctx.lineWidth = Math.max(1, s * 0.02);
      const dx = px();
      line(ctx, [dx, ty], [dx, ty - s * 0.08]);
    }
  } else if (look === "garlic") {
    // Broad leaves in clumps and white star-heads held over them.
    for (let j = 0; j < 7; j++) {
      const cx = px(), cy = py();
      ctx.fillStyle = "rgba(96,164,80,0.95)";
      for (const a of [-0.6, 0, 0.6]) {
        ctx.beginPath();
        ctx.ellipse(cx + Math.sin(a) * s * 0.03, cy, s * 0.018, s * 0.045, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(255,255,250,0.97)";
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.arc(cx + (r01() - 0.5) * s * 0.05, cy - s * (0.05 + r01() * 0.02), s * 0.012, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (look === "litter") {
    // Fallen leaves lying every which way, and a ring of toadstools.
    for (let j = 0; j < 14; j++) {
      ctx.fillStyle = ["rgba(206,132,60,0.95)", "rgba(176,92,46,0.95)", "rgba(222,176,84,0.95)"][j % 3]!;
      ctx.beginPath();
      ctx.ellipse(px(), py(), s * 0.03, s * 0.016, r01() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    if (r01() < 0.5) {
      const cx = px(), cy = py();
      for (let k = 0; k < 3; k++) {
        const tx = cx + (k - 1) * s * 0.05, ty = cy + (k % 2) * s * 0.02;
        ctx.fillStyle = "rgba(240,232,214,0.95)";
        ctx.fillRect(tx - s * 0.006, ty - s * 0.03, s * 0.012, s * 0.03);
        ctx.fillStyle = "rgba(204,58,46,0.97)";
        ctx.beginPath();
        ctx.arc(tx, ty - s * 0.03, s * 0.022, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.beginPath();
        ctx.arc(tx - s * 0.008, ty - s * 0.04, s * 0.005, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (look === "bluebell") {
    // Strap leaves, then nodding blue bells down one side of each arching stem.
    for (let j = 0; j < 16; j++) {
      const sx = px(), sy = py();
      ctx.strokeStyle = "rgba(74,120,64,0.9)";
      ctx.lineWidth = Math.max(1, s * 0.014);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx, sy - s * 0.08, sx + s * 0.035, sy - s * 0.08);
      ctx.stroke();
      ctx.fillStyle = j % 3 ? "rgba(96,104,214,0.97)" : "rgba(140,140,232,0.97)";
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.ellipse(sx + s * (0.008 + k * 0.012), sy - s * (0.065 - k * 0.012), s * 0.011, s * 0.016, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
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

/** A dry-stone wall: grey stones laid in two courses with a coping row, along `w` px. */
function paintDryWall(ctx: C, x: number, y: number, w: number, s: number, r01: () => number): void {
  const h = s * 0.055;
  ctx.save();
  ctx.fillStyle = "rgba(40,40,36,0.25)";
  ctx.fillRect(x, y + h * 1.6, w, h * 0.6);
  for (let k = 0; k < 2; k++)
    for (let q = (k ? -h * 0.6 : 0); q < w; q += h * (1.4 + r01() * 0.6)) {
      const sw = Math.min(h * (1.3 + r01() * 0.6), w - Math.max(0, q));
      if (sw <= 0) continue;
      const g = 150 + Math.floor(r01() * 40);
      ctx.fillStyle = `rgb(${g},${g - 2},${g - 10})`;
      ctx.strokeStyle = "rgba(70,68,62,0.8)";
      ctx.lineWidth = Math.max(0.75, s * 0.008);
      ctx.beginPath();
      ctx.roundRect(x + Math.max(0, q), y + k * h * 0.8, sw, h * 0.85, h * 0.25);
      ctx.fill();
      ctx.stroke();
    }
  ctx.restore();
}

/** The Ballot's fête marquee, The Merger's steel warehouse, Kingsmarket's granary on staddle stones. */
function paintTownBarn(ctx: C, x: number, y: number, w: number, look: "marquee" | "warehouse" | "granary", flip: boolean, r01: () => number): void {
  ctx.fillStyle = "rgba(40,36,24,0.16)";
  ctx.beginPath();
  ctx.roundRect(x + w * 0.02, y + w * 0.06, w * 0.96, w * 0.96, w * 0.14);
  ctx.fill();
  ctx.fillStyle = look === "warehouse" ? "rgb(150,152,150)" : look === "granary" ? "rgb(184,164,124)" : "rgb(140,184,104)";
  ctx.beginPath();
  ctx.roundRect(x + w * 0.02, y + w * 0.04, w * 0.96, w * 0.94, w * 0.14);
  ctx.fill();
  const left = flip ? x + w * 0.3 : x + w * 0.1, bw = w * 0.6, top = y + w * 0.12, base = y + w * 0.66;
  castShadow(ctx, left + bw / 2, base, bw / 2, w * 0.14, w * 0.5, 0.2);
  ctx.lineWidth = Math.max(1, w * 0.02);
  if (look === "marquee") {
    // Red-and-white striped walls, a peaked white top and its bunting.
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = k % 2 ? "#fbf6ea" : "#cf4a3c";
      ctx.fillRect(left + (bw * k) / 6, top + w * 0.2, bw / 6, base - top - w * 0.2);
    }
    ctx.strokeStyle = "#5a2a20";
    ctx.strokeRect(left, top + w * 0.2, bw, base - top - w * 0.2);
    ctx.fillStyle = "#fbf6ea";
    ctx.beginPath();
    ctx.moveTo(left - w * 0.04, top + w * 0.22);
    ctx.lineTo(left + bw * 0.25, top);
    ctx.lineTo(left + bw * 0.75, top);
    ctx.lineTo(left + bw + w * 0.04, top + w * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    const flags = ["#cf4a3c", "#2f6c9a", "#e8c22e"];
    for (let k = 0; k < 7; k++) {
      ctx.fillStyle = flags[k % 3]!;
      const fx = x + w * (0.08 + k * 0.12);
      ctx.beginPath();
      ctx.moveTo(fx, y + w * 0.82);
      ctx.lineTo(fx + w * 0.08, y + w * 0.82);
      ctx.lineTo(fx + w * 0.04, y + w * 0.9);
      ctx.closePath();
      ctx.fill();
    }
  } else if (look === "warehouse") {
    // A grey cladded shed, a low-pitched roof, a roller door and yellow bollards.
    ctx.fillStyle = "#c9ccce";
    ctx.strokeStyle = "#4a4e52";
    ctx.fillRect(left, top + w * 0.1, bw, base - top - w * 0.1);
    ctx.strokeRect(left, top + w * 0.1, bw, base - top - w * 0.1);
    ctx.strokeStyle = "rgba(90,96,100,0.45)";
    ctx.lineWidth = Math.max(0.75, w * 0.008);
    for (let k = 1; k < 10; k++) line(ctx, [left + (bw * k) / 10, top + w * 0.1], [left + (bw * k) / 10, base]);
    ctx.fillStyle = "#6f777e";
    ctx.strokeStyle = "#3a3e42";
    ctx.lineWidth = Math.max(1, w * 0.02);
    ctx.beginPath();
    ctx.moveTo(left - w * 0.03, top + w * 0.12);
    ctx.lineTo(left + bw / 2, top);
    ctx.lineTo(left + bw + w * 0.03, top + w * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#8a9096";
    ctx.fillRect(left + bw * 0.3, base - w * 0.26, bw * 0.4, w * 0.26);
    ctx.strokeStyle = "rgba(50,54,58,0.6)";
    ctx.lineWidth = Math.max(0.75, w * 0.008);
    for (let k = 1; k < 6; k++) line(ctx, [left + bw * 0.3, base - (w * 0.26 * k) / 6], [left + bw * 0.7, base - (w * 0.26 * k) / 6]);
    ctx.fillStyle = "#e8c22e";
    for (const k of [0.15, 0.85]) ctx.fillRect(x + w * k, y + w * 0.76, w * 0.04, w * 0.12);
  } else {
    // A weatherboarded granary up on mushroom-shaped staddle stones, steps to its door.
    ctx.fillStyle = "#8e8a80";
    for (const k of [0.1, 0.5, 0.9]) {
      const sx = left + bw * k;
      ctx.fillRect(sx - w * 0.015, base - w * 0.1, w * 0.03, w * 0.1);
      ctx.beginPath();
      ctx.ellipse(sx, base - w * 0.1, w * 0.04, w * 0.015, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const gb = base - w * 0.11;
    ctx.fillStyle = "#a8763e";
    ctx.strokeStyle = "#4e3418";
    ctx.fillRect(left, top + w * 0.16, bw, gb - top - w * 0.16);
    ctx.strokeRect(left, top + w * 0.16, bw, gb - top - w * 0.16);
    ctx.strokeStyle = "rgba(78,52,24,0.45)";
    ctx.lineWidth = Math.max(0.75, w * 0.008);
    for (let k = 1; k < 5; k++) line(ctx, [left, top + w * 0.16 + ((gb - top - w * 0.16) * k) / 5], [left + bw, top + w * 0.16 + ((gb - top - w * 0.16) * k) / 5]);
    ctx.fillStyle = "#9a5a3c";
    ctx.strokeStyle = "#4e2a1a";
    ctx.lineWidth = Math.max(1, w * 0.02);
    ctx.beginPath();
    ctx.moveTo(left - w * 0.04, top + w * 0.18);
    ctx.lineTo(left + bw / 2, top - w * 0.02);
    ctx.lineTo(left + bw + w * 0.04, top + w * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#3c2a1c";
    ctx.fillRect(left + bw * 0.4, gb - w * 0.16, bw * 0.2, w * 0.16);
    ctx.fillStyle = "#e0bd68";
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.arc(x + w * (0.2 + r01() * 0.6), y + w * (0.8 + r01() * 0.1), w * 0.035, 0, Math.PI * 2);
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
    // Plan item 416: a brine pan dug into the marsh, not a square tile: an uneven clay bank, deep teal brine going pink
    // at its shallow edges, crusted salt crystals along the shore, a ripple, and the raker's wooden rake laid by it.
    const cx = x + s * 0.5, cy = y + s * 0.52;
    const blob = (rx: number, ry: number, wob: number) => {
      ctx.beginPath();
      for (let k = 0; k <= 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const w = 1 + Math.sin(a * 3 + seed) * wob + Math.cos(a * 5 + seed * 0.7) * wob * 0.6;
        const px = cx + Math.cos(a) * rx * w, py = cy + Math.sin(a) * ry * w;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    };
    ctx.fillStyle = "rgba(108,88,64,0.92)";
    blob(s * 0.43, s * 0.37, 0.05);
    ctx.fill();
    const g = ctx.createRadialGradient(cx - s * 0.06, cy - s * 0.05, s * 0.04, cx, cy, s * 0.38);
    g.addColorStop(0, "rgba(64,136,150,0.97)");
    g.addColorStop(0.7, "rgba(92,150,160,0.96)");
    g.addColorStop(1, "rgba(196,150,162,0.95)");
    ctx.fillStyle = g;
    blob(s * 0.35, s * 0.29, 0.06);
    ctx.fill();
    // Salt crusted along the shore: small white crystals, thicker on the sunny side.
    for (let k = 0; k < 22; k++) {
      const a = r01() * Math.PI * 2;
      const d = 0.9 + r01() * 0.14;
      const px = cx + Math.cos(a) * s * 0.35 * d, py = cy + Math.sin(a) * s * 0.29 * d;
      ctx.fillStyle = `rgba(252,252,248,${0.75 + r01() * 0.25})`;
      ctx.beginPath();
      ctx.rect(px - s * 0.012, py - s * 0.012, s * (0.02 + r01() * 0.015), s * (0.02 + r01() * 0.015));
      ctx.fill();
    }
    // A ripple catching the sky.
    ctx.strokeStyle = "rgba(226,244,246,0.7)";
    ctx.lineWidth = Math.max(1, s * 0.02);
    ctx.beginPath();
    ctx.arc(cx - s * 0.05, cy - s * 0.02, s * 0.1, Math.PI * 1.15, Math.PI * 1.7);
    ctx.stroke();
    // The rake, laid on the bank.
    ctx.strokeStyle = "#7a5634";
    ctx.lineWidth = Math.max(1, s * 0.022);
    line(ctx, [x + s * 0.62, y + s * 0.9], [x + s * 0.92, y + s * 0.74]);
    line(ctx, [x + s * 0.88, y + s * 0.68], [x + s * 0.96, y + s * 0.82]);
  } else if (look === "peatpool") {
    // A peat pool: a black-brown hag of a bank, dark still water, cotton-grass nodding white along its edge.
    const cx = x + s * 0.5, cy = y + s * 0.52;
    ctx.fillStyle = "rgba(92,66,44,0.9)";
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.4, cy);
    ctx.bezierCurveTo(cx - s * 0.42, cy - s * 0.34, cx + s * 0.2, cy - s * 0.4, cx + s * 0.4, cy - s * 0.12);
    ctx.bezierCurveTo(cx + s * 0.46, cy + s * 0.2, cx + s * 0.1, cy + s * 0.38, cx - s * 0.2, cy + s * 0.32);
    ctx.closePath();
    ctx.fill();
    const g = ctx.createLinearGradient(cx, cy - s * 0.3, cx, cy + s * 0.3);
    g.addColorStop(0, "rgba(120,124,128,0.95)");
    g.addColorStop(1, "rgba(44,40,40,0.95)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.32, cy);
    ctx.bezierCurveTo(cx - s * 0.34, cy - s * 0.26, cx + s * 0.16, cy - s * 0.32, cx + s * 0.32, cy - s * 0.1);
    ctx.bezierCurveTo(cx + s * 0.36, cy + s * 0.14, cx + s * 0.08, cy + s * 0.3, cx - s * 0.16, cy + s * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(220,226,232,0.6)";
    ctx.lineWidth = Math.max(1, s * 0.022);
    line(ctx, [cx - s * 0.14, cy - s * 0.12], [cx + s * 0.06, cy - s * 0.16]);
    for (let k = 0; k < 6; k++) {
      const a = Math.PI * (0.1 + k * 0.32) + r01() * 0.3;
      const fx = cx + Math.cos(a) * s * 0.36, fy = cy + Math.sin(a) * s * 0.3;
      ctx.strokeStyle = "rgba(96,112,60,0.9)";
      ctx.lineWidth = Math.max(1, s * 0.014);
      line(ctx, [fx, fy], [fx, fy - s * 0.07]);
      ctx.fillStyle = "rgba(252,252,248,0.95)";
      ctx.beginPath();
      ctx.arc(fx, fy - s * 0.08, s * 0.025, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (look === "duckpond" || look === "lagoon" || look === "basin") {
    // The village duck pond (with its duck house), the agri-tech lined lagoon, the town's stone basin.
    const i = s * 0.12;
    if (look === "duckpond") {
      ctx.fillStyle = "rgba(70,130,160,0.95)";
      ctx.beginPath();
      ctx.ellipse(x + s / 2, y + s * 0.54, s * 0.4, s * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#b5523b";
      ctx.fillRect(x + s * 0.44, y + s * 0.36, s * 0.14, s * 0.1);
      ctx.fillStyle = "#f2e6c8";
      ctx.beginPath();
      ctx.arc(x + s * 0.32, y + s * 0.62, s * 0.03, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = look === "lagoon" ? "rgba(40,44,48,0.95)" : "rgba(200,190,170,0.95)";
      ctx.beginPath();
      ctx.roundRect(x + i, y + i, s - i * 2, s - i * 2, s * 0.04);
      ctx.fill();
      ctx.fillStyle = look === "lagoon" ? "rgba(70,96,110,0.95)" : "rgba(96,160,190,0.95)";
      ctx.beginPath();
      ctx.roundRect(x + i * 1.7, y + i * 1.7, s - i * 3.4, s - i * 3.4, s * 0.03);
      ctx.fill();
    }
  } else if (look === "gravelpit") {
    // A flooded gravel pit: a hard-edged grey bank, cold blue water, a warning sign on a post.
    const i = s * 0.1;
    ctx.fillStyle = "rgba(170,166,156,0.95)";
    ctx.beginPath();
    ctx.roundRect(x + i, y + i, s - i * 2, s - i * 2, s * 0.08);
    ctx.fill();
    ctx.fillStyle = "rgba(60,112,150,0.97)";
    ctx.beginPath();
    ctx.roundRect(x + s * 0.18, y + s * 0.2, s * 0.64, s * 0.6, s * 0.05);
    ctx.fill();
    ctx.strokeStyle = "rgba(220,236,246,0.6)";
    ctx.lineWidth = Math.max(1, s * 0.022);
    line(ctx, [x + s * 0.3, y + s * 0.36], [x + s * 0.5, y + s * 0.33]);
    const sx = x + s * (0.72 + r01() * 0.06);
    ctx.strokeStyle = "#5c4126";
    ctx.lineWidth = Math.max(1, s * 0.02);
    line(ctx, [sx, y + s * 0.3], [sx, y + s * 0.14]);
    ctx.fillStyle = "#e8c22e";
    ctx.strokeStyle = "#2a2420";
    ctx.lineWidth = Math.max(0.75, s * 0.01);
    ctx.beginPath();
    ctx.moveTo(sx, y + s * 0.06);
    ctx.lineTo(sx + s * 0.06, y + s * 0.16);
    ctx.lineTo(sx - s * 0.06, y + s * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (look === "rockpool") {
    // A rock pool: grey boulders round clear green-blue water, weed and an anemone.
    const cx = x + s * 0.5, cy = y + s * 0.52;
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + r01() * 0.3;
      const g = 140 + Math.floor(r01() * 40);
      ctx.fillStyle = `rgb(${g},${g - 2},${g - 8})`;
      ctx.strokeStyle = "rgba(70,68,62,0.7)";
      ctx.lineWidth = Math.max(0.75, s * 0.01);
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * s * 0.34, cy + Math.sin(a) * s * 0.28, s * 0.09, s * 0.07, a, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(cx, cy, s * 0.03, cx, cy, s * 0.3);
    g.addColorStop(0, "rgba(150,214,206,0.97)");
    g.addColorStop(1, "rgba(62,140,150,0.97)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, s * 0.28, s * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(96,130,60,0.9)";
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.12, cy + s * 0.06, s * 0.06, s * 0.03, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(208,62,70,0.97)";
    ctx.beginPath();
    ctx.arc(cx + s * 0.1, cy + s * 0.05, s * 0.025, 0, Math.PI * 2);
    ctx.fill();
  } else if (look === "lilypool") {
    // A woodland pool: mossy banks, dark green water, lily pads with one white flower.
    const cx = x + s * 0.5, cy = y + s * 0.52;
    ctx.fillStyle = "rgba(76,110,58,0.75)";
    ctx.beginPath();
    ctx.ellipse(cx, cy, s * 0.43, s * 0.37, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(48,92,82,0.95)";
    ctx.beginPath();
    ctx.ellipse(cx, cy, s * 0.36, s * 0.3, 0.2, 0, Math.PI * 2);
    ctx.fill();
    for (let k = 0; k < 4; k++) {
      const a = r01() * Math.PI * 2, d = s * (0.08 + r01() * 0.16);
      const lx = cx + Math.cos(a) * d, ly = cy + Math.sin(a) * d * 0.8;
      ctx.fillStyle = "rgba(110,170,86,0.97)";
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.arc(lx, ly, s * 0.06, a + 0.3, a + Math.PI * 2 - 0.3);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,250,246,0.97)";
    ctx.beginPath();
    ctx.arc(cx + s * 0.06, cy - s * 0.04, s * 0.03, 0, Math.PI * 2);
    ctx.fill();
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
  } else if (look === "marquee" || look === "warehouse" || look === "granary") {
    paintTownBarn(ctx, x, y, w, look, flip, r01);
  } else if (look === "dutchbarn") {
    // A steel Dutch barn on concrete: a green hooped roof on girders, round bales wrapped in black plastic.
    ctx.fillStyle = "rgba(40,36,24,0.16)";
    ctx.beginPath();
    ctx.roundRect(x + w * 0.02, y + w * 0.06, w * 0.96, w * 0.96, w * 0.1);
    ctx.fill();
    ctx.fillStyle = "rgb(184,182,174)";
    ctx.beginPath();
    ctx.roundRect(x + w * 0.02, y + w * 0.04, w * 0.96, w * 0.94, w * 0.1);
    ctx.fill();
    const left = x + w * 0.1, bw = w * 0.8, top = y + w * 0.14, base = y + w * 0.64;
    castShadow(ctx, left + bw / 2, base, bw / 2, w * 0.14, w * 0.5, 0.2);
    // Bales under the roof.
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = "#26282a";
      ctx.beginPath();
      ctx.arc(left + bw * (0.15 + k * 0.23), base - w * 0.09, w * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.beginPath();
      ctx.arc(left + bw * (0.13 + k * 0.23), base - w * 0.12, w * 0.025, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "#4a4e52";
    ctx.lineWidth = Math.max(1.5, w * 0.03);
    for (const k of [0, 0.5, 1]) line(ctx, [left + bw * k, base], [left + bw * k, top + w * 0.1]);
    ctx.fillStyle = "#4f7d5a";
    ctx.strokeStyle = "#2a3e30";
    ctx.lineWidth = Math.max(1, w * 0.02);
    ctx.beginPath();
    ctx.moveTo(left - w * 0.04, top + w * 0.14);
    ctx.quadraticCurveTo(left + bw / 2, top - w * 0.1, left + bw + w * 0.04, top + w * 0.14);
    ctx.lineTo(left + bw + w * 0.04, top + w * 0.2);
    ctx.quadraticCurveTo(left + bw / 2, top - w * 0.04, left - w * 0.04, top + w * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(200,220,200,0.35)";
    ctx.lineWidth = Math.max(0.75, w * 0.008);
    for (let k = 1; k < 8; k++) line(ctx, [left + (bw * k) / 8, top + w * 0.02], [left + (bw * k) / 8, top + w * 0.12]);
  } else if (look === "boathut") {
    // An old boat turned keel-up for a store, a door cut in its stern, on the shingle, with a capstan by it.
    ctx.fillStyle = "rgba(40,36,24,0.16)";
    ctx.beginPath();
    ctx.roundRect(x + w * 0.02, y + w * 0.06, w * 0.96, w * 0.96, w * 0.2);
    ctx.fill();
    ctx.fillStyle = "rgb(198,190,170)";
    ctx.beginPath();
    ctx.roundRect(x + w * 0.02, y + w * 0.04, w * 0.96, w * 0.94, w * 0.2);
    ctx.fill();
    ctx.fillStyle = "rgba(120,114,100,0.55)";
    for (let k = 0; k < 16; k++) {
      ctx.beginPath();
      ctx.ellipse(x + w * (0.08 + r01() * 0.84), y + w * (0.62 + r01() * 0.32), w * 0.02, w * 0.014, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const cxp = flip ? x + w * 0.2 : x + w * 0.8;
    ctx.fillStyle = "#5c4126";
    ctx.beginPath();
    ctx.arc(cxp, y + w * 0.82, w * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#e6d6b0";
    ctx.lineWidth = Math.max(1, w * 0.012);
    line(ctx, [cxp - w * 0.07, y + w * 0.82], [cxp + w * 0.07, y + w * 0.82]);
    // The hull: a tarred arch from the side, its planks, a blue door at the stern.
    const left = flip ? x + w * 0.34 : x + w * 0.08;
    const bw = w * 0.58;
    const base = y + w * 0.66;
    castShadow(ctx, left + bw / 2, base, bw / 2, w * 0.14, w * 0.4, 0.2);
    ctx.fillStyle = "#3a3430";
    ctx.strokeStyle = "#141210";
    ctx.lineWidth = Math.max(1, w * 0.022);
    ctx.beginPath();
    ctx.moveTo(left, base);
    ctx.quadraticCurveTo(left + bw * 0.05, y + w * 0.12, left + bw * 0.6, y + w * 0.14);
    ctx.quadraticCurveTo(left + bw * 1.02, y + w * 0.2, left + bw, base);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(170,160,150,0.4)";
    ctx.lineWidth = Math.max(0.75, w * 0.01);
    for (let k = 1; k < 5; k++) {
      ctx.beginPath();
      ctx.moveTo(left + bw * k * 0.04, base);
      ctx.quadraticCurveTo(left + bw * (0.05 + k * 0.04), y + w * (0.12 + k * 0.1), left + bw * 0.6, y + w * (0.14 + k * 0.1));
      ctx.stroke();
    }
    ctx.fillStyle = "#2f6c9a";
    ctx.fillRect(left + bw * 0.6, base - w * 0.22, bw * 0.2, w * 0.22);
    ctx.fillStyle = "#c44a36";
    ctx.fillRect(left, base - w * 0.04, bw, w * 0.035);
  } else if (look === "timberbarn") {
    // A black-and-white timber-framed barn on a cobbled yard, a stack of cordwood by it.
    ctx.fillStyle = "rgba(40,30,10,0.16)";
    ctx.beginPath();
    ctx.roundRect(x + w * 0.02, y + w * 0.06, w * 0.96, w * 0.96, w * 0.2);
    ctx.fill();
    ctx.fillStyle = "rgb(150,140,120)";
    ctx.beginPath();
    ctx.roundRect(x + w * 0.02, y + w * 0.04, w * 0.96, w * 0.94, w * 0.2);
    ctx.fill();
    ctx.fillStyle = "rgba(110,100,84,0.6)";
    for (let k = 0; k < 18; k++) {
      ctx.beginPath();
      ctx.arc(x + w * (0.08 + r01() * 0.84), y + w * (0.66 + r01() * 0.28), w * 0.018, 0, Math.PI * 2);
      ctx.fill();
    }
    // Cordwood: log ends in a stack.
    const sx = flip ? x + w * 0.12 : x + w * 0.72;
    for (let row = 0; row < 3; row++)
      for (let k = 0; k < 4 - row; k++) {
        const lx = sx + w * (k * 0.05 + row * 0.025), ly = y + w * (0.88 - row * 0.045);
        ctx.fillStyle = "#c9a26a";
        ctx.strokeStyle = "#6b4a2a";
        ctx.lineWidth = Math.max(0.75, w * 0.01);
        ctx.beginPath();
        ctx.arc(lx, ly, w * 0.024, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    const bw = w * 0.56;
    const left = flip ? x + w * 0.36 : x + w * 0.08;
    const top = y + w * 0.08;
    const eave = top + w * 0.2;
    const base = y + w * 0.62;
    castShadow(ctx, left + bw / 2, base, bw / 2, w * 0.14, w * 0.5, 0.2);
    ctx.fillStyle = "#f2ead6";
    ctx.strokeStyle = "#2a2420";
    ctx.lineWidth = Math.max(1, w * 0.02);
    ctx.fillRect(left, eave, bw, base - eave);
    ctx.strokeRect(left, eave, bw, base - eave);
    // The frame: posts, a rail and the braces, in black oak.
    ctx.lineWidth = Math.max(1, w * 0.022);
    for (let k = 1; k < 4; k++) line(ctx, [left + (bw * k) / 4, eave], [left + (bw * k) / 4, base]);
    line(ctx, [left, (eave + base) / 2], [left + bw, (eave + base) / 2]);
    line(ctx, [left, eave], [left + bw / 4, (eave + base) / 2]);
    line(ctx, [left + bw, eave], [left + (bw * 3) / 4, (eave + base) / 2]);
    // A steep clay-tile roof.
    ctx.fillStyle = "#9a5a3c";
    ctx.beginPath();
    ctx.moveTo(left - w * 0.04, eave + w * 0.02);
    ctx.lineTo(left + bw * 0.5, top - w * 0.04);
    ctx.lineTo(left + bw + w * 0.04, eave + w * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#3a2c22";
    ctx.fillRect(left + bw * 0.36, base - w * 0.2, bw * 0.28, w * 0.2);
  } else if (look === "fold") {
    // A dry-stone sheepfold: a ring of wall round trodden turf, a stone field barn under slate at its back.
    ctx.fillStyle = "rgba(40,36,24,0.16)";
    ctx.beginPath();
    ctx.roundRect(x + w * 0.02, y + w * 0.06, w * 0.96, w * 0.96, w * 0.3);
    ctx.fill();
    ctx.fillStyle = "rgb(150,160,104)";
    ctx.beginPath();
    ctx.roundRect(x + w * 0.04, y + w * 0.06, w * 0.92, w * 0.9, w * 0.3);
    ctx.fill();
    const wall = rng(seed + 3);
    paintDryWall(ctx, x + w * 0.06, y + w * 0.88, w * 0.88, w, wall);
    // The barn: grey stone courses, a slate roof, a dark door.
    const bw = w * 0.5;
    const left = flip ? x + w * 0.42 : x + w * 0.08;
    const top = y + w * 0.1;
    const eave = top + w * 0.16;
    const base = y + w * 0.58;
    castShadow(ctx, left + bw / 2, base, bw / 2, w * 0.14, w * 0.5, 0.2);
    ctx.fillStyle = "#a9a497";
    ctx.strokeStyle = "#4e4a42";
    ctx.lineWidth = Math.max(1, w * 0.02);
    ctx.fillRect(left, eave, bw, base - eave);
    ctx.strokeRect(left, eave, bw, base - eave);
    ctx.strokeStyle = "rgba(78,74,66,0.5)";
    ctx.lineWidth = Math.max(0.75, w * 0.01);
    for (let k = 1; k < 5; k++) line(ctx, [left, eave + ((base - eave) * k) / 5], [left + bw, eave + ((base - eave) * k) / 5]);
    ctx.fillStyle = "#4f5660";
    ctx.strokeStyle = "#2c3036";
    ctx.lineWidth = Math.max(1, w * 0.02);
    ctx.beginPath();
    ctx.moveTo(left - w * 0.04, eave + w * 0.02);
    ctx.lineTo(left + bw * 0.5, top - w * 0.02);
    ctx.lineTo(left + bw + w * 0.04, eave + w * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#3c3226";
    ctx.fillRect(left + bw * 0.38, base - w * 0.2, bw * 0.24, w * 0.2);
    // Two ewes in the fold.
    const ex = flip ? x + w * 0.22 : x + w * 0.74;
    paintEwe(ctx, ex, y + w * 0.8, w * 0.22, flip);
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

/**
 * What lies on an act's high ground (drawn clipped to the mound, under the trig pillar): granite on Highmoor's tor,
 * marram on Saltmarsh's dune, a pollard willow on Rivermead's bank, bracken in Oakvale, a pebble ridge at Shingle
 * Bay, The Rift's spoil heap, daisies on The Ballot's barrow, a sprinkler on The Merger's berm, a worn path up
 * Kingsmarket's motte.
 */
export function paintKnollDress(ctx: C, x: number, y: number, s: number, dress: KnollDress, seed: number): void {
  const r01 = rng(seed);
  const cx = x + s / 2;
  const on = (): [number, number] => {
    const t = r01();
    const u = 0.3 + r01() * 0.5;
    return [x + s * (0.18 + t * 0.64), y + s * u];
  };
  ctx.save();
  ctx.lineCap = "round";
  switch (dress) {
    case "rocks":
      for (let k = 0; k < 4; k++) {
        const [px, py] = on();
        const g = 120 + Math.floor(r01() * 40);
        ctx.fillStyle = `rgb(${g},${g - 2},${g - 6})`;
        ctx.strokeStyle = "rgba(60,58,54,0.8)";
        ctx.lineWidth = Math.max(0.75, s * 0.01);
        ctx.beginPath();
        ctx.roundRect(px - s * 0.06, py - s * 0.035, s * 0.12, s * 0.07, s * 0.02);
        ctx.fill();
        ctx.stroke();
      }
      break;
    case "marram":
    case "bracken":
      for (let k = 0; k < (dress === "marram" ? 14 : 10); k++) {
        const [px, py] = on();
        ctx.strokeStyle = dress === "marram" ? "rgba(96,140,70,0.97)" : k % 2 ? "rgba(176,110,50,0.95)" : "rgba(96,140,60,0.95)";
        ctx.lineWidth = Math.max(1, s * 0.016);
        for (const dx of [-0.03, 0, 0.03]) {
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.quadraticCurveTo(px + s * dx, py - s * 0.04, px + s * dx * 1.8, py - s * 0.07);
          ctx.stroke();
        }
      }
      break;
    case "willow": {
      const tx = cx + s * 0.12, ty = y + s * 0.46;
      ctx.fillStyle = "#6b5236";
      ctx.fillRect(tx - s * 0.025, ty - s * 0.1, s * 0.05, s * 0.12);
      ctx.strokeStyle = "rgba(122,170,80,0.95)";
      ctx.lineWidth = Math.max(1, s * 0.03);
      for (let k = 0; k < 7; k++) {
        const fx = tx + (k - 3) * s * 0.035;
        ctx.beginPath();
        ctx.moveTo(tx, ty - s * 0.1);
        ctx.quadraticCurveTo(fx, ty - s * 0.16, fx, ty);
        ctx.stroke();
      }
      break;
    }
    case "pebbles":
    case "spoil":
      for (let k = 0; k < 18; k++) {
        const [px, py] = on();
        const g = dress === "pebbles" ? 150 + Math.floor(r01() * 70) : 90 + Math.floor(r01() * 40);
        ctx.fillStyle = dress === "pebbles" ? `rgb(${g},${g - 4},${g - 12})` : `rgb(${g + 10},${g},${g - 14})`;
        ctx.beginPath();
        ctx.ellipse(px, py, s * 0.025, s * 0.017, r01() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      if (dress === "spoil") {
        ctx.fillStyle = "rgba(200,60,40,0.9)";
        ctx.fillRect(cx - s * 0.2, y + s * 0.62, s * 0.06, s * 0.015);
      }
      break;
    case "daisies":
      for (let k = 0; k < 10; k++) {
        const [px, py] = on();
        ctx.fillStyle = "rgba(255,255,250,0.97)";
        ctx.beginPath();
        ctx.arc(px, py, s * 0.016, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(240,196,60,0.97)";
        ctx.beginPath();
        ctx.arc(px, py, s * 0.007, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case "sprinkler": {
      // Mown stripes across the berm and a sprinkler's arc of spray.
      ctx.fillStyle = "rgba(200,240,160,0.25)";
      for (let k = 0; k < 4; k++) ctx.fillRect(x, y + s * (0.3 + k * 0.14), s, s * 0.07);
      const sx = cx - s * 0.18, sy = y + s * 0.62;
      ctx.fillStyle = "#3a3e42";
      ctx.fillRect(sx - s * 0.01, sy - s * 0.04, s * 0.02, s * 0.04);
      ctx.fillStyle = "rgba(220,240,252,0.85)";
      for (let k = 0; k < 8; k++) {
        const a = -Math.PI * (0.15 + k * 0.09);
        ctx.beginPath();
        ctx.arc(sx + Math.cos(a) * s * 0.1, sy - s * 0.04 + Math.sin(a) * s * 0.07, s * 0.01, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "path":
      // A worn path zig-zagging up to the top.
      ctx.strokeStyle = "rgba(220,196,140,0.9)";
      ctx.lineWidth = Math.max(1.5, s * 0.03);
      ctx.beginPath();
      ctx.moveTo(x + s * 0.3, y + s * 0.84);
      ctx.lineTo(x + s * 0.62, y + s * 0.62);
      ctx.lineTo(x + s * 0.4, y + s * 0.46);
      ctx.lineTo(cx, y + s * 0.3);
      ctx.stroke();
      break;
  }
  ctx.restore();
}
