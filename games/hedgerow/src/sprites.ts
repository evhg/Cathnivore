// Hedgerow's sprites, drawn with Canvas 2D paths: towers (with their tiers and tier-4 specialisations),
// every enemy, Cath herself and the farmhouse. Each function draws centred on (x, y) at the bottom of the
// sprite (where it meets the ground), scaled to the cell size `s`, and animates from the clock `t` (seconds).
// Friendly things are warm, hand-made and outlined in ink; the corporations are glossy, cold and plastic
// (STYLE.md 2).

import type { EnemyKind, TowerKind } from "./engine";
import { PROPERTIES, propsOf, type Property } from "./fleet";
import { wornOutfit } from "./wardrobe";

export const INK = "#2b2320";

type C = CanvasRenderingContext2D;

function lw(s: number): number {
  return Math.max(1.4, s * 0.032);
}

export function groundShadow(ctx: C, x: number, y: number, w: number, h = w * 0.32, a = 0.25): void {
  ctx.fillStyle = `rgba(20,25,10,${a})`;
  ctx.beginPath();
  ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
  ctx.fill();
}

function blob(ctx: C, x: number, y: number, r: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function rr(ctx: C, x: number, y: number, w: number, h: number, r: number, fill: string, stroke = true): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  if (stroke) ctx.stroke();
}

function shine(ctx: C, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(x, y, w, h, -0.3, 0, Math.PI * 2);
  ctx.fill();
}

// ---- towers ----

export interface TowerLook {
  kind: TowerKind;
  tier: number;
  spec: 0 | 1 | null;
  /** Seconds since it last fired (for recoil and throw poses). */
  fired: number;
  /** Charmed or jammed: it droops. */
  dazed: boolean;
  /** A path tower's build (Hedgerow 2 M4): per-tier parts, and a tier 3's own silhouette. */
  path?: readonly number[];
}

const SPEC_COLOURS: [string, string] = ["#c4433a", "#3f6fb5"];

export function drawTower(ctx: C, look: TowerLook, x: number, y: number, s: number, t: number): void {
  const { kind, tier, fired } = look;
  // A path tower's tier 3 borrows the old specialisation's body where it is the same idea (Crow Caller's dark
  // coat, the Pumpkin Lobber's barrel, Killer Queen's crown...); drawPathParts adds the rest.
  const spec = look.path ? pathSpecLook(kind, look.path) : look.spec;
  ctx.lineWidth = lw(s);
  ctx.strokeStyle = INK;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const kick = fired < 0.15 ? Math.sin((fired / 0.15) * Math.PI) : 0;
  const base = y + s * 0.3;
  groundShadow(ctx, x, base, s * 0.36, s * 0.11);
  ctx.save();
  if (look.dazed) {
    ctx.translate(x, base);
    ctx.rotate(Math.sin(t * 3) * 0.08);
    ctx.translate(-x, -base);
  }
  switch (kind) {
    case "hedgerow": {
      const n = 3 + Math.min(tier, 3);
      const dark = spec === 0 ? "#2f5a2a" : spec === 1 ? "#4a6b2c" : "#4c7a34";
      const light = spec === 0 ? "#3f6e33" : spec === 1 ? "#5e8636" : "#5f8f3f";
      for (let i = 0; i < n; i++) {
        const bx = x + (i - (n - 1) / 2) * s * (0.6 / n) * 1.3;
        const by = base - s * 0.2 - (i % 2) * s * 0.08 + Math.sin(t * 1.5 + i) * s * 0.008;
        blob(ctx, bx, by, s * (0.2 + (i % 2) * 0.03), i % 2 ? light : dark);
      }
      if (spec === 0) {
        ctx.strokeStyle = "#e9e1cf";
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const cx = x + Math.cos(a) * s * 0.32;
          const cy = base - s * 0.22 + Math.sin(a) * s * 0.18;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(a) * s * 0.08, cy + Math.sin(a) * s * 0.08);
          ctx.stroke();
        }
        ctx.strokeStyle = INK;
      }
      const berry = spec === 1 ? "#5b2a5e" : "#e8748b";
      ctx.fillStyle = berry;
      for (let i = 0; i < 2 + tier; i++) {
        ctx.beginPath();
        ctx.arc(x - s * 0.24 + i * s * (0.48 / (1 + tier)), base - s * 0.24 + ((i * 7) % 3) * s * 0.05, s * 0.04, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "scarecrow": {
      // Post, arms, a shirt and a straw hat; the arm swings forward as it throws.
      ctx.fillStyle = "#7a5634";
      rr(ctx, x - s * 0.03, base - s * 0.62, s * 0.06, s * 0.62, s * 0.02, "#7a5634");
      const coat = spec === 1 ? "#2f2f3a" : spec === 0 ? "#d9822b" : tier >= 3 ? "#3f6fb5" : "#c4433a";
      ctx.save();
      ctx.translate(x, base - s * 0.48);
      ctx.rotate(-kick * 0.7);
      rr(ctx, -s * 0.34, -s * 0.03, s * 0.68, s * 0.07, s * 0.03, "#7a5634");
      ctx.restore();
      rr(ctx, x - s * 0.16, base - s * 0.52, s * 0.32, s * 0.3, s * 0.06, coat);
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.beginPath();
      ctx.moveTo(x - s * 0.16, base - s * 0.4);
      ctx.lineTo(x + s * 0.16, base - s * 0.4);
      ctx.moveTo(x, base - s * 0.52);
      ctx.lineTo(x, base - s * 0.22);
      ctx.stroke();
      ctx.strokeStyle = INK;
      // Head: a sack, or a pumpkin for the Lobber.
      if (spec === 0) blob(ctx, x, base - s * 0.66, s * 0.15, "#e98a2b");
      else blob(ctx, x, base - s * 0.66, s * 0.13, "#e6cf9a");
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(x - s * 0.045, base - s * 0.67, s * 0.018, 0, Math.PI * 2);
      ctx.arc(x + s * 0.045, base - s * 0.67, s * 0.018, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.05, base - s * 0.61);
      ctx.quadraticCurveTo(x, base - s * 0.58, x + s * 0.05, base - s * 0.61);
      ctx.stroke();
      // Hat.
      ctx.fillStyle = spec === 1 ? "#3a3340" : "#e2c06a";
      ctx.beginPath();
      ctx.ellipse(x, base - s * 0.76, s * 0.21, s * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      rr(ctx, x - s * 0.1, base - s * 0.9, s * 0.2, s * 0.14, s * 0.04, spec === 1 ? "#3a3340" : "#e2c06a");
      if (spec === 1) {
        // Crows on the arms.
        for (const side of [-1, 1]) {
          const cx = x + side * s * 0.3;
          const cy = base - s * 0.55 + Math.sin(t * 4 + side) * s * 0.01;
          blob(ctx, cx, cy, s * 0.06, "#1d1b22");
          ctx.fillStyle = "#f2c94c";
          ctx.beginPath();
          ctx.moveTo(cx + side * s * 0.05, cy);
          ctx.lineTo(cx + side * s * 0.1, cy + s * 0.01);
          ctx.lineTo(cx + side * s * 0.05, cy + s * 0.02);
          ctx.fill();
        }
      }
      break;
    }
    case "beehive": {
      const body = spec === 0 ? "#c98a3a" : spec === 1 ? "#e8b13c" : "#d9a649";
      rr(ctx, x - s * 0.2, base - s * 0.08, s * 0.4, s * 0.08, s * 0.02, "#7a5634");
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.24, base - s * 0.06);
      ctx.bezierCurveTo(x - s * 0.26, base - s * 0.6, x + s * 0.26, base - s * 0.6, x + s * 0.24, base - s * 0.06);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "rgba(90,55,20,0.55)";
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        const yy = base - s * 0.06 - i * s * 0.11;
        const w = s * (0.24 - i * 0.035);
        ctx.moveTo(x - w, yy);
        ctx.quadraticCurveTo(x, yy + s * 0.04, x + w, yy);
        ctx.stroke();
      }
      ctx.strokeStyle = INK;
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(x, base - s * 0.12, s * 0.05, s * 0.035, 0, 0, Math.PI * 2);
      ctx.fill();
      if (spec === 0) {
        ctx.fillStyle = "#f2c94c";
        ctx.beginPath();
        ctx.moveTo(x - s * 0.1, base - s * 0.5);
        ctx.lineTo(x - s * 0.1, base - s * 0.6);
        ctx.lineTo(x - s * 0.05, base - s * 0.54);
        ctx.lineTo(x, base - s * 0.62);
        ctx.lineTo(x + s * 0.05, base - s * 0.54);
        ctx.lineTo(x + s * 0.1, base - s * 0.6);
        ctx.lineTo(x + s * 0.1, base - s * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      if (spec === 1) {
        ctx.fillStyle = "#f0b429";
        for (const dx of [-0.14, 0.02, 0.15]) {
          ctx.beginPath();
          ctx.moveTo(x + dx * s - s * 0.03, base - s * 0.3);
          ctx.quadraticCurveTo(x + dx * s, base - s * (0.16 + Math.sin(t * 2 + dx * 9) * 0.02), x + dx * s + s * 0.03, base - s * 0.3);
          ctx.fill();
        }
      }
      // Bees circling.
      const bees = 2 + Math.min(tier, 3);
      for (let i = 0; i < bees; i++) {
        const a = t * (2.4 + i * 0.3) + (i * Math.PI * 2) / bees;
        const bx = x + Math.cos(a) * s * 0.34;
        const by = base - s * 0.36 + Math.sin(a * 1.3) * s * 0.16;
        ctx.fillStyle = "#f2c94c";
        ctx.beginPath();
        ctx.ellipse(bx, by, s * 0.03, s * 0.022, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.beginPath();
        ctx.ellipse(bx, by - s * 0.02, s * 0.02, s * 0.012, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "stall": {
      rr(ctx, x - s * 0.3, base - s * 0.24, s * 0.6, s * 0.24, s * 0.03, "#8a5a35");
      // Produce on the counter.
      const goods = spec === 1 ? ["#e8c27a", "#e8c27a", "#e8c27a"] : ["#d4544a", "#f2c94c", "#5f8f3f", "#e98a2b"];
      goods.forEach((g, i) => {
        ctx.fillStyle = g;
        ctx.beginPath();
        if (spec === 1) ctx.ellipse(x - s * 0.18 + i * s * 0.18, base - s * 0.26, s * 0.08, s * 0.035, 0, 0, Math.PI * 2);
        else ctx.arc(x - s * 0.2 + i * s * 0.13, base - s * 0.27, s * 0.045, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
      ctx.strokeStyle = INK;
      ctx.fillStyle = "#7a5634";
      ctx.fillRect(x - s * 0.29, base - s * 0.6, s * 0.03, s * 0.36);
      ctx.fillRect(x + s * 0.26, base - s * 0.6, s * 0.03, s * 0.36);
      const awn = spec === 0 ? "#3f6fb5" : spec === 1 ? "#e98a2b" : "#c4433a";
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? "#fffbe6" : awn;
        ctx.beginPath();
        ctx.moveTo(x - s * 0.36 + i * s * 0.18, base - s * 0.58);
        ctx.lineTo(x - s * 0.36 + (i + 1) * s * 0.18, base - s * 0.58);
        ctx.lineTo(x - s * 0.36 + (i + 1) * s * 0.18, base - s * 0.46);
        ctx.quadraticCurveTo(x - s * 0.36 + (i + 0.5) * s * 0.18, base - s * 0.4, x - s * 0.36 + i * s * 0.18, base - s * 0.46);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      if (spec === 0) {
        // Bunting.
        ctx.strokeStyle = INK;
        ctx.beginPath();
        ctx.moveTo(x - s * 0.36, base - s * 0.66);
        ctx.quadraticCurveTo(x, base - s * 0.56, x + s * 0.36, base - s * 0.66);
        ctx.stroke();
        ["#c4433a", "#f2c94c", "#3f6fb5", "#5f8f3f"].forEach((c, i) => {
          const fx = x - s * 0.27 + i * s * 0.18;
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.moveTo(fx - s * 0.04, base - s * 0.63);
          ctx.lineTo(fx + s * 0.04, base - s * 0.63);
          ctx.lineTo(fx, base - s * 0.55);
          ctx.fill();
        });
      }
      // A coin glints after each wave.
      ctx.fillStyle = "#f2c94c";
      const gl = (Math.sin(t * 2) + 1) / 2;
      ctx.globalAlpha = 0.5 + gl * 0.5;
      ctx.beginPath();
      ctx.arc(x + s * 0.2, base - s * 0.1, s * 0.04, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case "pond": {
      const wide = spec === 1 ? 1.25 : 1;
      ctx.fillStyle = spec === 1 ? "#6f9f87" : "#79b0c8";
      ctx.beginPath();
      ctx.ellipse(x, base - s * 0.16, s * 0.38 * wide, s * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      for (let i = 0; i < 2; i++) {
        const r = ((t * 0.5 + i * 0.5) % 1) * s * 0.3;
        ctx.globalAlpha = 1 - ((t * 0.5 + i * 0.5) % 1);
        ctx.beginPath();
        ctx.ellipse(x - s * 0.1, base - s * 0.16, r, r * 0.45, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = INK;
      if (spec === 1) {
        ctx.fillStyle = "#5f8f3f";
        for (const [dx, dy] of [
          [-0.25, -0.12],
          [0.22, -0.2],
          [0.05, -0.06],
        ] as const) {
          ctx.beginPath();
          ctx.arc(x + dx * s, base + dy * s, s * 0.06, 0.5, Math.PI * 2);
          ctx.lineTo(x + dx * s, base + dy * s);
          ctx.fill();
        }
        ctx.fillStyle = "#f2a9c4";
        ctx.beginPath();
        ctx.arc(x + s * 0.22, base - s * 0.22, s * 0.03, 0, Math.PI * 2);
        ctx.fill();
      }
      const birds = spec === 0 ? 2 : Math.min(tier, 3);
      for (let i = 0; i < birds; i++) {
        const bx = x + Math.sin(t * 0.7 + i * 2.1) * s * 0.18;
        const by = base - s * 0.2 + Math.cos(t * 0.9 + i) * s * 0.04 - kick * s * 0.05;
        const goose = spec === 0;
        blob(ctx, bx, by, s * (goose ? 0.08 : 0.065), goose ? "#f4f1ea" : "#f2c94c");
        blob(ctx, bx + s * 0.06, by - s * (goose ? 0.11 : 0.06), s * (goose ? 0.04 : 0.04), goose ? "#f4f1ea" : "#3f7a4a");
        ctx.fillStyle = "#e98a2b";
        ctx.beginPath();
        ctx.moveTo(bx + s * 0.09, by - s * (goose ? 0.11 : 0.06));
        ctx.lineTo(bx + s * 0.14, by - s * (goose ? 0.1 : 0.05));
        ctx.lineTo(bx + s * 0.09, by - s * (goose ? 0.09 : 0.04));
        ctx.fill();
      }
      break;
    }
    case "barn": {
      const red = spec === 1 ? "#b8863e" : "#b5523b";
      ctx.fillStyle = red;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.3, base);
      ctx.lineTo(x - s * 0.3, base - s * 0.34);
      ctx.lineTo(x - s * 0.18, base - s * 0.52);
      ctx.lineTo(x + s * 0.18, base - s * 0.52);
      ctx.lineTo(x + s * 0.3, base - s * 0.34);
      ctx.lineTo(x + s * 0.3, base);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      rr(ctx, x - s * 0.11, base - s * 0.26, s * 0.22, s * 0.26, s * 0.01, "#f4ede1");
      ctx.beginPath();
      ctx.moveTo(x - s * 0.11, base - s * 0.26);
      ctx.lineTo(x + s * 0.11, base);
      ctx.moveTo(x + s * 0.11, base - s * 0.26);
      ctx.lineTo(x - s * 0.11, base);
      ctx.stroke();
      rr(ctx, x - s * 0.06, base - s * 0.44, s * 0.12, s * 0.08, s * 0.01, "#f4ede1");
      if (spec === 0) {
        // A little tractor beside it.
        const tx = x + s * 0.3 - kick * s * 0.06;
        rr(ctx, tx - s * 0.08, base - s * 0.2, s * 0.18, s * 0.12, s * 0.02, "#3f8a3d");
        blob(ctx, tx - s * 0.04, base - s * 0.06, s * 0.07, "#2b2320");
        blob(ctx, tx + s * 0.08, base - s * 0.05, s * 0.05, "#2b2320");
      }
      if (spec === 1) {
        for (const dx of [-0.36, 0.36]) {
          ctx.fillStyle = "#e2c06a";
          ctx.beginPath();
          ctx.ellipse(x + dx * s, base - s * 0.08, s * 0.08, s * 0.08, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
      break;
    }
    case "silo": {
      const w = spec === 1 ? 0.24 : 0.18;
      const body = spec === 0 ? "#6f9a4a" : "#c7ccd1";
      rr(ctx, x - s * w, base - s * 0.72, s * w * 2, s * 0.72, s * 0.04, body);
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      for (let i = 1; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(x - s * w, base - i * s * 0.14);
        ctx.lineTo(x + s * w, base - i * s * 0.14);
        ctx.stroke();
      }
      ctx.strokeStyle = INK;
      ctx.fillStyle = spec === 0 ? "#557a36" : "#9ea6ad";
      ctx.beginPath();
      ctx.arc(x, base - s * 0.72, s * w, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      shine(ctx, x - s * w * 0.5, base - s * 0.45, s * 0.03, s * 0.2);
      // Spout.
      ctx.save();
      ctx.translate(x + s * w, base - s * 0.6);
      ctx.rotate(-0.6 - kick * 0.4);
      rr(ctx, 0, -s * 0.03, s * 0.2, s * 0.06, s * 0.02, "#8a8f94");
      ctx.restore();
      break;
    }
    case "windmill": {
      // A whitewashed tower mill with a cap and four sails that turn (faster just after a gust).
      const h = 0.62 + tier * 0.04;
      ctx.fillStyle = spec === 1 ? "#b9b2a4" : "#f1ead9";
      ctx.beginPath();
      ctx.moveTo(x - s * 0.2, base);
      ctx.lineTo(x - s * 0.13, base - s * h);
      ctx.lineTo(x + s * 0.13, base - s * h);
      ctx.lineTo(x + s * 0.2, base);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      rr(ctx, x - s * 0.05, base - s * 0.16, s * 0.1, s * 0.16, s * 0.03, "#6b4a2b");
      ctx.fillStyle = "#5e3d22";
      ctx.beginPath();
      ctx.arc(x, base - s * h, s * 0.15, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (spec === 1) {
        ctx.fillStyle = "#9a9183";
        ctx.beginPath();
        ctx.ellipse(x + s * 0.27, base - s * 0.06, s * 0.1, s * 0.05, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      const hubY = base - s * (h - 0.04);
      const spin = t * (1.2 + Math.max(0, 1 - fired) * 6);
      const len = s * (spec === 0 ? 0.46 : 0.36);
      for (let i = 0; i < 4; i++) {
        const a = spin + (i * Math.PI) / 2;
        ctx.save();
        ctx.translate(x, hubY);
        ctx.rotate(a);
        ctx.fillStyle = spec === 0 ? "#f6efe0" : "rgba(246,239,224,0.8)";
        ctx.fillRect(s * 0.03, -s * 0.05, len, s * 0.1);
        ctx.strokeRect(s * 0.03, -s * 0.05, len, s * 0.1);
        ctx.restore();
      }
      blob(ctx, x, hubY, s * 0.04, "#2b2320");
      break;
    }
    case "cannon": {
      // Pip's Seed Cannon: a fat barrel on a cart, sacks of seed potatoes beside it.
      const wide = spec === 0 ? 0.13 : 0.09;
      blob(ctx, x - s * 0.24, base - s * 0.08, s * 0.1, "#c9a66b");
      blob(ctx, x - s * 0.15, base - s * 0.05, s * 0.08, "#b8923e");
      rr(ctx, x - s * 0.2, base - s * 0.2, s * 0.4, s * 0.12, s * 0.03, "#8a5a35");
      ctx.save();
      ctx.translate(x, base - s * 0.24);
      ctx.rotate(-0.55 - kick * 0.2);
      const barrels = spec === 1 ? 3 : 1;
      for (let i = 0; i < barrels; i++) {
        const off = (i - (barrels - 1) / 2) * s * 0.09;
        rr(ctx, -s * 0.06, off - s * wide, s * (0.42 - kick * 0.06), s * wide * 2, s * 0.04, spec === 0 ? "#d9822b" : "#5c6066");
      }
      for (let i = 0; i < tier; i++) {
        ctx.fillStyle = "#d4ae58";
        ctx.fillRect(s * (0.08 + i * 0.08), -s * wide, s * 0.03, s * wide * 2);
      }
      ctx.restore();
      ctx.fillStyle = "#5e3d22";
      for (const wx of [-0.13, 0.13]) {
        ctx.beginPath();
        ctx.arc(x + s * wx, base - s * 0.06, s * 0.08, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case "mast": {
      ctx.strokeStyle = "#5a5e63";
      ctx.lineWidth = Math.max(1.5, s * 0.03);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.18, base);
      ctx.lineTo(x, base - s * 0.85);
      ctx.lineTo(x + s * 0.18, base);
      for (let i = 1; i < 4; i++) {
        const yy = base - i * s * 0.2;
        const w = s * 0.18 * (1 - (i * 0.2) / 0.85);
        ctx.moveTo(x - w, yy);
        ctx.lineTo(x + w, yy);
      }
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = lw(s);
      const blink = Math.sin(t * 4) > 0;
      const lamp = spec === 1 ? (Math.sin(t * 8) > 0 ? "#ff3b30" : "#ffb3ad") : blink ? "#d95f3b" : "#7a2f1f";
      blob(ctx, x, base - s * 0.88, s * 0.05, lamp);
      if (spec === 0) {
        ctx.fillStyle = INK;
        ctx.fillRect(x + s * 0.02, base - s * 0.82, s * 0.16, s * 0.1);
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(x + s * 0.1, base - s * 0.77, s * 0.025, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = spec === 1 ? "rgba(255,59,48,0.7)" : "rgba(217,95,59,0.6)";
      const n = Math.min(tier, 3);
      for (let i = 1; i <= n; i++) {
        const ph = (t * 0.8 + i / n) % 1;
        ctx.globalAlpha = 1 - ph;
        ctx.beginPath();
        ctx.arc(x, base - s * 0.88, s * (0.1 + ph * 0.3), -0.85 * Math.PI, -0.15 * Math.PI);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = INK;
      break;
    }
    case "tent": {
      const cloth = spec === 1 ? "#f2e6c8" : "#fffbe6";
      ctx.fillStyle = cloth;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.36, base);
      ctx.lineTo(x, base - s * 0.62);
      ctx.lineTo(x + s * 0.36, base);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#e7dcc4";
      ctx.beginPath();
      ctx.moveTo(x - s * 0.08, base);
      ctx.lineTo(x, base - s * 0.3);
      ctx.lineTo(x + s * 0.08, base);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#4f9a76";
      ctx.fillRect(x - s * 0.035, base - s * 0.5, s * 0.07, s * 0.16);
      ctx.fillRect(x - s * 0.08, base - s * 0.455, s * 0.16, s * 0.07);
      if (spec === 1) {
        rr(ctx, x + s * 0.24, base - s * 0.26, s * 0.16, s * 0.24, s * 0.04, "#b8bcc2");
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        for (let i = 0; i < 2; i++) {
          const ph = (t * 0.6 + i * 0.5) % 1;
          ctx.globalAlpha = 1 - ph;
          ctx.beginPath();
          ctx.moveTo(x + s * 0.32, base - s * 0.3 - ph * s * 0.25);
          ctx.quadraticCurveTo(x + s * 0.36, base - s * 0.36 - ph * s * 0.25, x + s * 0.3, base - s * 0.42 - ph * s * 0.25);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.strokeStyle = INK;
      }
      if (spec === 0) {
        ctx.fillStyle = "#c4433a";
        ctx.beginPath();
        ctx.moveTo(x, base - s * 0.62);
        ctx.lineTo(x, base - s * 0.82);
        ctx.lineTo(x + s * 0.14, base - s * 0.76);
        ctx.lineTo(x, base - s * 0.72);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case "court": {
      const stone = spec === 0 ? "#e6dcc6" : "#ece6da";
      rr(ctx, x - s * 0.36, base - s * 0.08, s * 0.72, s * 0.08, s * 0.01, "#cfc5af");
      ctx.fillStyle = stone;
      for (let i = 0; i < 4; i++) rr(ctx, x - s * 0.28 + i * s * 0.17, base - s * 0.42, s * 0.07, s * 0.34, s * 0.01, stone);
      ctx.fillStyle = stone;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.38, base - s * 0.42);
      ctx.lineTo(x, base - s * 0.64);
      ctx.lineTo(x + s * 0.38, base - s * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Scales, which swing as it serves.
      ctx.save();
      ctx.translate(x, base - s * 0.53);
      ctx.rotate(kick * 0.4 + Math.sin(t) * 0.05);
      ctx.strokeStyle = "#a07a2a";
      ctx.beginPath();
      ctx.moveTo(-s * 0.09, 0);
      ctx.lineTo(s * 0.09, 0);
      ctx.stroke();
      ctx.fillStyle = "#d4ae58";
      ctx.beginPath();
      ctx.arc(-s * 0.09, s * 0.03, s * 0.03, 0, Math.PI);
      ctx.arc(s * 0.09, s * 0.03, s * 0.03, 0, Math.PI);
      ctx.fill();
      ctx.restore();
      if (spec === 1) {
        ctx.fillStyle = "#fff";
        for (let i = 0; i < 3; i++) rr(ctx, x + s * (0.28 + i * 0.03), base - s * (0.3 + i * 0.05), s * 0.12, s * 0.15, s * 0.01, "#fffdf6");
      }
      if (spec === 0) {
        ctx.fillStyle = "#d4ae58";
        ctx.beginPath();
        ctx.arc(x, base - s * 0.7, s * 0.05, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case "hall": {
      rr(ctx, x - s * 0.34, base - s * 0.44, s * 0.68, s * 0.44, s * 0.03, "#b36a4a");
      ctx.strokeStyle = "rgba(0,0,0,0.15)";
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(x - s * 0.34, base - i * s * 0.11);
        ctx.lineTo(x + s * 0.34, base - i * s * 0.11);
        ctx.stroke();
      }
      ctx.strokeStyle = INK;
      ctx.fillStyle = "#6b4a2b";
      ctx.beginPath();
      ctx.moveTo(x - s * 0.4, base - s * 0.42);
      ctx.lineTo(x, base - s * 0.66);
      ctx.lineTo(x + s * 0.4, base - s * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      rr(ctx, x - s * 0.07, base - s * 0.22, s * 0.14, s * 0.22, s * 0.04, "#f4ede1");
      // A union banner, waving.
      const banner = spec === 0 ? "#c4433a" : spec === 1 ? "#d4ae58" : "#3f6fb5";
      ctx.fillStyle = banner;
      ctx.beginPath();
      ctx.moveTo(x + s * 0.24, base - s * 0.7);
      for (let i = 0; i <= 4; i++) ctx.lineTo(x + s * (0.24 + i * 0.05), base - s * 0.7 + Math.sin(t * 4 + i) * s * 0.015);
      ctx.lineTo(x + s * 0.44, base - s * 0.56);
      for (let i = 4; i >= 0; i--) ctx.lineTo(x + s * (0.24 + i * 0.05), base - s * 0.56 + Math.sin(t * 4 + i) * s * 0.015);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + s * 0.24, base - s * 0.44);
      ctx.lineTo(x + s * 0.24, base - s * 0.74);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();

  if (look.path) {
    drawPathParts(ctx, kind, look.path, x, base, s, t, kick);
    pathPips(ctx, look.path, x, base, s);
    return;
  }

  // Tier: gold studs below; tier 4 wears its specialisation's rosette.
  if (tier >= 2 && tier <= 3) {
    for (let i = 0; i < tier; i++) {
      const sx = x + (i - (tier - 1) / 2) * s * 0.12;
      ctx.fillStyle = "#f2c94c";
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1, s * 0.02);
      ctx.beginPath();
      star(ctx, sx, base + s * 0.08, s * 0.045);
      ctx.fill();
      ctx.stroke();
    }
  } else if (tier === 4 && spec !== null) {
    const rx = x + s * 0.3;
    const ry = base - s * 0.02;
    ctx.fillStyle = SPEC_COLOURS[spec];
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, s * 0.02);
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = i % 2 ? s * 0.07 : s * 0.09;
      ctx.lineTo(rx + Math.cos(a) * r, ry + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f2c94c";
    ctx.beginPath();
    star(ctx, rx, ry, s * 0.045);
    ctx.fill();
  }
}

// ---- upgrade paths (Hedgerow 2 M4): a part for every tier bought, and a silhouette for each tier 3 ----

/** Path colours: A, B, C (the sheet's column tops, the pips under a tower, the 3D plinth's glow). */
export const PATH_COLOURS = ["#d4543c", "#3f7fd0", "#4f9a3e"];

/** Which old specialisation body a path tower's tier 3 wears, if any. */
function pathSpecLook(kind: TowerKind, path: readonly number[]): 0 | 1 | null {
  const top = path.findIndex((n) => n >= 3);
  if (top < 0) return null;
  const map: Partial<Record<TowerKind, Array<0 | 1 | null>>> = {
    scarecrow: [1, null, null],
    hedgerow: [0, 1, null],
    beehive: [0, 1, null],
    cannon: [0, 1, null],
    mast: [0, null, 1],
  };
  return map[kind]?.[top] ?? null;
}

/** Under the tower: one pip per tier bought, in its path's colour; a tier 3 is a diamond. */
function pathPips(ctx: C, path: readonly number[], x: number, base: number, s: number): void {
  const pips: Array<{ c: string; big: boolean }> = [];
  path.forEach((n, i) => {
    for (let k = 0; k < n; k++) pips.push({ c: PATH_COLOURS[i]!, big: k === 2 });
  });
  if (!pips.length) return;
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s * 0.018);
  pips.forEach((p, k) => {
    const px = x + (k - (pips.length - 1) / 2) * s * 0.1;
    const py = base + s * 0.08;
    const r = s * (p.big ? 0.05 : 0.033);
    ctx.fillStyle = p.c;
    ctx.beginPath();
    if (p.big) {
      ctx.moveTo(px, py - r);
      ctx.lineTo(px + r, py);
      ctx.lineTo(px, py + r);
      ctx.lineTo(px - r, py);
      ctx.closePath();
    } else ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
}

function crowAt(ctx: C, cx: number, cy: number, s: number, side: number, colour = "#1d1b22"): void {
  blob(ctx, cx, cy, s * 0.06, colour);
  ctx.fillStyle = "#f2c94c";
  ctx.beginPath();
  ctx.moveTo(cx + side * s * 0.05, cy);
  ctx.lineTo(cx + side * s * 0.1, cy + s * 0.01);
  ctx.lineTo(cx + side * s * 0.05, cy + s * 0.02);
  ctx.fill();
}

function flowerAt(ctx: C, fx: number, fy: number, r: number, petal: string, heart = "#f2c94c"): void {
  ctx.fillStyle = petal;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(fx + Math.cos(a) * r, fy + Math.sin(a) * r, r * 0.75, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = heart;
  ctx.beginPath();
  ctx.arc(fx, fy, r * 0.7, 0, Math.PI * 2);
  ctx.fill();
}

/** A heap of cut thorn on the lane (Blackthorn's piles), `k` its size from 0 to 1. */
export function drawThornPile(ctx: C, x: number, y: number, s: number, k = 1): void {
  ctx.save();
  ctx.lineWidth = Math.max(1.2, s * 0.022);
  ctx.strokeStyle = INK;
  ctx.fillStyle = "#5b4330";
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.02, s * 0.2 * k, s * 0.08 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "#e9e1cf";
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI + (i / 6) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * s * 0.08 * k, y);
    ctx.lineTo(x + Math.cos(a) * s * 0.2 * k, y + Math.sin(a) * s * 0.14 * k);
    ctx.stroke();
  }
  ctx.restore();
}

/** Every tier bought shows: crows, hats, bales, flowers, barrels; a tier 3 changes the outline. */
function drawPathParts(ctx: C, kind: TowerKind, path: readonly number[], x: number, base: number, s: number, t: number, kick: number): void {
  const [a = 0, b = 0, c = 0] = path;
  ctx.save();
  ctx.lineWidth = lw(s);
  ctx.strokeStyle = INK;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  switch (kind) {
    case "scarecrow": {
      // Flock: a crow per tier on the arms; Crow Caller adds one on the hat and two circling overhead.
      if (a >= 1 && a < 3) crowAt(ctx, x - s * 0.3, base - s * 0.55 + Math.sin(t * 4) * s * 0.01, s, -1);
      if (a === 2) crowAt(ctx, x + s * 0.3, base - s * 0.55 + Math.sin(t * 4 + 1) * s * 0.01, s, 1);
      if (a >= 3) {
        crowAt(ctx, x + s * 0.05, base - s * 0.95, s, 1);
        for (let i = 0; i < 2; i++) {
          const ang = t * 2.2 + i * Math.PI;
          crowAt(ctx, x + Math.cos(ang) * s * 0.36, base - s * 1.08 + Math.sin(ang * 1.4) * s * 0.06, s * 0.8, Math.cos(ang) > 0 ? 1 : -1);
        }
      }
      // Lookout: a taller hat, then lantern eyes; Hawk Post a perch with a hawk, taller than anything near.
      if (b >= 1) rr(ctx, x - s * 0.08, base - s * 1.02, s * 0.16, s * 0.14, s * 0.03, "#e2c06a");
      if (b >= 2) {
        ctx.fillStyle = "#ffd23f";
        ctx.shadowColor = "#ffd23f";
        ctx.shadowBlur = s * 0.12;
        ctx.beginPath();
        ctx.arc(x - s * 0.045, base - s * 0.67, s * 0.028, 0, Math.PI * 2);
        ctx.arc(x + s * 0.045, base - s * 0.67, s * 0.028, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        rr(ctx, x + s * 0.3, base - s * 0.48, s * 0.07, s * 0.09, s * 0.02, "#ffd27a");
      }
      if (b >= 3) {
        rr(ctx, x + s * 0.36, base - s * 1.2, s * 0.05, s * 1.2, s * 0.02, "#7a5634");
        rr(ctx, x + s * 0.26, base - s * 1.2, s * 0.25, s * 0.04, s * 0.02, "#7a5634");
        const flap = Math.sin(t * 3) * s * 0.03;
        ctx.fillStyle = "#7a4f2a";
        ctx.beginPath();
        ctx.ellipse(x + s * 0.39, base - s * 1.29, s * 0.07, s * 0.09, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + s * 0.33, base - s * 1.3);
        ctx.lineTo(x + s * 0.2, base - s * 1.22 - flap);
        ctx.lineTo(x + s * 0.33, base - s * 1.24);
        ctx.moveTo(x + s * 0.45, base - s * 1.3);
        ctx.lineTo(x + s * 0.58, base - s * 1.22 - flap);
        ctx.lineTo(x + s * 0.45, base - s * 1.24);
        ctx.fill();
        ctx.stroke();
        blob(ctx, x + s * 0.4, base - s * 1.4, s * 0.04, "#f4ede1");
        ctx.fillStyle = "#f2c94c";
        ctx.beginPath();
        ctx.moveTo(x + s * 0.43, base - s * 1.41);
        ctx.lineTo(x + s * 0.48, base - s * 1.39);
        ctx.lineTo(x + s * 0.43, base - s * 1.37);
        ctx.fill();
      }
      // Scythe: straw at the wrists, a turnip in each hand, then a scythe and the ring it cuts.
      if (c >= 1) {
        ctx.strokeStyle = "#e2c06a";
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(x + side * s * 0.34, base - s * 0.48);
          ctx.lineTo(x + side * s * 0.42, base - s * 0.42);
          ctx.moveTo(x + side * s * 0.34, base - s * 0.48);
          ctx.lineTo(x + side * s * 0.43, base - s * 0.5);
          ctx.stroke();
        }
        ctx.strokeStyle = INK;
      }
      if (c === 2)
        for (const side of [-1, 1]) {
          blob(ctx, x + side * s * 0.38, base - s * 0.5 - kick * s * 0.05, s * 0.05, "#efe2f0");
          ctx.fillStyle = "#8e4a93";
          ctx.beginPath();
          ctx.arc(x + side * s * 0.38, base - s * 0.48, s * 0.03, 0, Math.PI);
          ctx.fill();
        }
      if (c >= 3) {
        ctx.save();
        ctx.translate(x, base - s * 0.5);
        ctx.rotate(t * 5);
        rr(ctx, -s * 0.03, -s * 0.5, s * 0.05, s * 0.6, s * 0.02, "#8a5a35");
        ctx.fillStyle = "#c9d1d8";
        ctx.beginPath();
        ctx.moveTo(-s * 0.02, -s * 0.5);
        ctx.quadraticCurveTo(s * 0.3, -s * 0.56, s * 0.38, -s * 0.36);
        ctx.quadraticCurveTo(s * 0.22, -s * 0.46, -s * 0.02, -s * 0.42);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = "rgba(226,192,106,0.5)";
        ctx.beginPath();
        ctx.ellipse(x, base - s * 0.2, s * 0.5, s * 0.16, 0, t * 5, t * 5 + Math.PI * 1.2);
        ctx.stroke();
      }
      break;
    }
    case "hedgerow": {
      // Blackthorn: thorns, then a pile at the foot, then tall hawthorn spikes.
      ctx.strokeStyle = "#e9e1cf";
      if (a >= 1 && a < 3)
        for (let i = 0; i < 4; i++) {
          const ang = -Math.PI * (0.15 + i * 0.23);
          const cx = x + Math.cos(ang) * s * 0.3;
          const cy = base - s * 0.24 + Math.sin(ang) * s * 0.2;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(ang) * s * 0.08, cy + Math.sin(ang) * s * 0.08);
          ctx.stroke();
        }
      if (a >= 3)
        for (let i = 0; i < 5; i++) {
          const sx = x + (i - 2) * s * 0.12;
          ctx.beginPath();
          ctx.moveTo(sx, base - s * 0.42);
          ctx.lineTo(sx + (i - 2) * s * 0.03, base - s * 0.72 - (i % 2) * s * 0.08);
          ctx.stroke();
        }
      ctx.strokeStyle = INK;
      if (a >= 2) drawThornPile(ctx, x + s * 0.32, base - s * 0.02, s * 0.8, a >= 3 ? 1 : 0.7);
      // Bramble Maze: berries, a wider hedge, then low maze walls in front.
      if (b >= 1) {
        ctx.fillStyle = "#5b2a5e";
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.arc(x - s * 0.22 + i * s * 0.11, base - s * 0.34 + ((i * 5) % 3) * s * 0.05, s * 0.03, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (b >= 2) for (const side of [-1, 1]) blob(ctx, x + side * s * 0.38, base - s * 0.14, s * 0.13, "#3f6e33");
      if (b >= 3) {
        ctx.fillStyle = "#2f5a2a";
        for (const [wx, wy, ww, wh] of [
          [-0.45, 0.02, 0.32, 0.08],
          [-0.45, -0.06, 0.08, 0.16],
          [0.13, 0.02, 0.32, 0.08],
          [0.37, -0.06, 0.08, 0.16],
        ] as const) {
          ctx.beginPath();
          ctx.roundRect(x + wx * s, base + wy * s - s * 0.08, ww * s, wh * s, s * 0.03);
          ctx.fill();
          ctx.stroke();
        }
      }
      // Haybale: a square bale, then a round one, then the farm tractor.
      if (c >= 1) {
        rr(ctx, x - s * 0.46, base - s * 0.14, s * 0.2, s * 0.13, s * 0.02, "#d8b45a");
        ctx.strokeStyle = "#a8802f";
        ctx.beginPath();
        ctx.moveTo(x - s * 0.4, base - s * 0.14);
        ctx.lineTo(x - s * 0.4, base - s * 0.01);
        ctx.moveTo(x - s * 0.32, base - s * 0.14);
        ctx.lineTo(x - s * 0.32, base - s * 0.01);
        ctx.stroke();
        ctx.strokeStyle = INK;
      }
      if (c >= 2) {
        blob(ctx, x + s * 0.36, base - s * 0.1, s * 0.11, "#e2c06a");
        ctx.strokeStyle = "#a8802f";
        ctx.beginPath();
        ctx.arc(x + s * 0.36, base - s * 0.1, s * 0.06, 0, Math.PI * 1.6);
        ctx.stroke();
        ctx.strokeStyle = INK;
      }
      if (c >= 3) {
        const tx = x - s * 0.05 + kick * s * 0.05;
        rr(ctx, tx - s * 0.2, base - s * 0.2, s * 0.3, s * 0.13, s * 0.03, "#c4433a");
        rr(ctx, tx - s * 0.06, base - s * 0.33, s * 0.15, s * 0.14, s * 0.02, "#c4433a");
        ctx.fillStyle = "#bfe8ff";
        ctx.fillRect(tx - s * 0.03, base - s * 0.3, s * 0.09, s * 0.07);
        rr(ctx, tx - s * 0.17, base - s * 0.34, s * 0.03, s * 0.14, s * 0.01, "#3b3f44");
        blob(ctx, tx + s * 0.06, base - s * 0.07, s * 0.09, "#2b2320");
        blob(ctx, tx - s * 0.15, base - s * 0.05, s * 0.055, "#2b2320");
      }
      break;
    }
    case "beehive": {
      // Killer Bees: a red band, a drop of venom, then the queen's crown (the body).
      if (a >= 1) {
        ctx.strokeStyle = "#c4433a";
        ctx.lineWidth = Math.max(2, s * 0.045);
        ctx.beginPath();
        ctx.moveTo(x - s * 0.2, base - s * 0.29);
        ctx.quadraticCurveTo(x, base - s * 0.25, x + s * 0.2, base - s * 0.29);
        ctx.stroke();
        ctx.strokeStyle = INK;
        ctx.lineWidth = lw(s);
      }
      if (a >= 2) {
        ctx.fillStyle = "#7fc46a";
        ctx.beginPath();
        ctx.moveTo(x, base - s * 0.08);
        ctx.quadraticCurveTo(x + s * 0.04, base, x, base + s * 0.03);
        ctx.quadraticCurveTo(x - s * 0.04, base, x, base - s * 0.08);
        ctx.fill();
        ctx.stroke();
      }
      if (a >= 3) for (let i = 0; i < 3; i++) blob(ctx, x + Math.cos(t * 3 + i * 2) * s * 0.42, base - s * 0.5 + Math.sin(t * 4 + i) * s * 0.12, s * 0.03, "#d9433a");
      // Honey: a flower, honey dripping (the body), then a honey marsh round the stand.
      if (b >= 1) flowerAt(ctx, x - s * 0.34, base - s * 0.04, s * 0.03, "#c46ad9");
      if (b >= 3) {
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = "#f0b429";
        ctx.beginPath();
        ctx.ellipse(x, base + s * 0.02, s * 0.5, s * 0.14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "rgba(160,110,20,0.8)";
        ctx.stroke();
        ctx.strokeStyle = INK;
      }
      // Scent: wings on the hive, a ring of flowers, then two sunflowers taller than the hive.
      if (c >= 1)
        for (const side of [-1, 1]) {
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.beginPath();
          ctx.ellipse(x + side * s * 0.27, base - s * 0.42 + Math.sin(t * 20) * s * 0.01, s * 0.08, s * 0.045, side * 0.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      if (c >= 2) for (const [fx, col] of [[-0.36, "#e8748b"], [0.34, "#7fa0e8"], [0.24, "#f4ede1"]] as const) flowerAt(ctx, x + fx * s, base - s * 0.02, s * 0.03, col);
      if (c >= 3)
        for (const side of [-1, 1]) {
          ctx.strokeStyle = "#3f7a4a";
          ctx.lineWidth = Math.max(2, s * 0.03);
          ctx.beginPath();
          ctx.moveTo(x + side * s * 0.4, base);
          ctx.lineTo(x + side * s * 0.42, base - s * 0.8);
          ctx.stroke();
          ctx.strokeStyle = INK;
          ctx.lineWidth = lw(s);
          flowerAt(ctx, x + side * s * 0.42, base - s * 0.84, s * 0.06, "#f2c94c", "#6b4a2b");
        }
      break;
    }
    case "cannon": {
      // Big Shells: a brass band, a stack of shells, then the pumpkin barrel (the body) and a pumpkin.
      if (a >= 1) {
        ctx.fillStyle = "#d4ae58";
        ctx.beginPath();
        ctx.arc(x + s * 0.05, base - s * 0.34, s * 0.06, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      if (a >= 2) for (const [px, py] of [[0.28, -0.04], [0.38, -0.04], [0.33, -0.12]] as const) blob(ctx, x + px * s, base + py * s, s * 0.05, a >= 3 ? "#e98a2b" : "#b08a5a");
      // Flak: a hopper, an anti-air barrel pointing up, then Scatter Shot's three barrels (the body).
      if (b >= 1) rr(ctx, x - s * 0.1, base - s * 0.42, s * 0.14, s * 0.12, s * 0.02, "#8a5a35");
      if (b >= 2) {
        ctx.save();
        ctx.translate(x - s * 0.18, base - s * 0.2);
        ctx.rotate(-1.35);
        rr(ctx, 0, -s * 0.03, s * 0.3, s * 0.06, s * 0.02, "#5c6066");
        ctx.restore();
      }
      // Wrecker: a longer barrel, iron bands, then a wrecking ball swinging from a crane arm.
      if (c >= 1) {
        ctx.save();
        ctx.translate(x, base - s * 0.24);
        ctx.rotate(-0.55 - kick * 0.2);
        rr(ctx, s * 0.36, -s * 0.06, s * 0.14, s * 0.12, s * 0.03, "#5c6066");
        if (c >= 2) {
          ctx.fillStyle = "#2b2320";
          ctx.fillRect(s * 0.18, -s * 0.09, s * 0.03, s * 0.18);
          ctx.fillRect(s * 0.3, -s * 0.09, s * 0.03, s * 0.18);
        }
        ctx.restore();
      }
      if (c >= 3) {
        rr(ctx, x - s * 0.32, base - s * 0.95, s * 0.05, s * 0.95, s * 0.02, "#c9a14a");
        rr(ctx, x - s * 0.32, base - s * 0.95, s * 0.5, s * 0.05, s * 0.02, "#c9a14a");
        const sw = Math.sin(t * 2) * 0.35;
        const bx = x + s * 0.12 + Math.sin(sw) * s * 0.4;
        const by = base - s * 0.9 + Math.cos(sw) * s * 0.4;
        ctx.beginPath();
        ctx.moveTo(x + s * 0.12, base - s * 0.9);
        ctx.lineTo(bx, by);
        ctx.stroke();
        blob(ctx, bx, by, s * 0.1, "#3b3f44");
        shine(ctx, bx - s * 0.03, by - s * 0.03, s * 0.03, s * 0.02);
      }
      break;
    }
    case "mast": {
      // Pirate Radio: a taller aerial, a pirate flag, then a broadcast dish and bigger waves.
      if (a >= 1) {
        ctx.strokeStyle = "#5a5e63";
        ctx.beginPath();
        ctx.moveTo(x, base - s * 0.9);
        ctx.lineTo(x, base - s * 1.15);
        ctx.stroke();
        ctx.strokeStyle = INK;
        blob(ctx, x, base - s * 1.16, s * 0.025, "#d95f3b");
      }
      if (a >= 2) {
        rr(ctx, x - s * 0.26, base - s * 0.78, s * 0.2, s * 0.13, s * 0.01, "#1d1b22");
        ctx.fillStyle = "#f4ede1";
        ctx.beginPath();
        ctx.arc(x - s * 0.16, base - s * 0.73, s * 0.03, 0, Math.PI * 2);
        ctx.fill();
      }
      if (a >= 3) {
        ctx.fillStyle = "#d9dde2";
        ctx.beginPath();
        ctx.ellipse(x + s * 0.12, base - s * 0.55, s * 0.16, s * 0.2, -0.4, -Math.PI / 2, Math.PI / 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = "rgba(217,95,59,0.5)";
        for (let i = 1; i <= 2; i++) {
          const ph = (t * 0.6 + i / 2) % 1;
          ctx.beginPath();
          ctx.arc(x, base - s * 1.15, s * (0.2 + ph * 0.5), -0.9 * Math.PI, -0.1 * Math.PI);
          ctx.stroke();
        }
        ctx.strokeStyle = INK;
      }
      // Clinic: a red cross flag, a white tent at the foot, then a ward with its lamp lit.
      if (b >= 1) {
        rr(ctx, x + s * 0.03, base - s * 0.98, s * 0.16, s * 0.11, s * 0.01, "#ffffff");
        ctx.fillStyle = "#d9433a";
        ctx.fillRect(x + s * 0.095, base - s * 0.965, s * 0.03, s * 0.08);
        ctx.fillRect(x + s * 0.07, base - s * 0.94, s * 0.08, s * 0.03);
      }
      if (b >= 2) {
        ctx.fillStyle = "#fffbe6";
        ctx.beginPath();
        ctx.moveTo(x - s * 0.46, base);
        ctx.lineTo(x - s * 0.33, base - s * 0.24);
        ctx.lineTo(x - s * 0.2, base);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      if (b >= 3) {
        ctx.fillStyle = "#fffbe6";
        ctx.beginPath();
        ctx.moveTo(x + s * 0.2, base);
        ctx.lineTo(x + s * 0.36, base - s * 0.3);
        ctx.lineTo(x + s * 0.52, base);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#d9433a";
        ctx.fillRect(x + s * 0.345, base - s * 0.17, s * 0.03, s * 0.09);
        ctx.fillRect(x + s * 0.32, base - s * 0.14, s * 0.08, s * 0.03);
      }
      // Siren: a loudhailer, a blue light, then a bell in a frame up top.
      if (c >= 1) {
        ctx.fillStyle = "#9aa0a6";
        ctx.beginPath();
        ctx.moveTo(x - s * 0.02, base - s * 0.62);
        ctx.lineTo(x - s * 0.2, base - s * 0.7);
        ctx.lineTo(x - s * 0.2, base - s * 0.54);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      if (c >= 2) blob(ctx, x + s * 0.1, base - s * 0.42, s * 0.04, Math.sin(t * 8) > 0 ? "#3f7fd0" : "#a9c8ff");
      if (c >= 3) {
        ctx.strokeStyle = "#7a5634";
        ctx.lineWidth = Math.max(2, s * 0.03);
        ctx.beginPath();
        ctx.moveTo(x - s * 0.14, base - s * 0.92);
        ctx.lineTo(x - s * 0.14, base - s * 1.12);
        ctx.lineTo(x + s * 0.14, base - s * 1.12);
        ctx.lineTo(x + s * 0.14, base - s * 0.92);
        ctx.stroke();
        ctx.strokeStyle = INK;
        ctx.lineWidth = lw(s);
        const sw = Math.sin(t * 6) * 0.3;
        ctx.save();
        ctx.translate(x, base - s * 1.1);
        ctx.rotate(sw);
        ctx.fillStyle = "#d4ae58";
        ctx.beginPath();
        ctx.moveTo(-s * 0.07, s * 0.12);
        ctx.quadraticCurveTo(-s * 0.06, 0, 0, 0);
        ctx.quadraticCurveTo(s * 0.06, 0, s * 0.07, s * 0.12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

export function star(ctx: C, x: number, y: number, r: number): void {
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const rr2 = i % 2 ? r * 0.45 : r;
    const px = x + Math.cos(a) * rr2;
    const py = y + Math.sin(a) * rr2;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// ---- enemies ----

export interface EnemyLook {
  kind: EnemyKind;
  /** 1 = facing right. */
  facing: 1 | -1;
  /** Seconds since it was last hit (a white flash). */
  hit: number;
  ghost: boolean;
  /** Animation phase, so a column of vans doesn't bob in step. */
  phase: number;
  /** Bubble wrap left (0 = popped; undefined = whole). */
  shield?: number;
}

/** How big each enemy is drawn, relative to a van. */
export function enemyScale(kind: EnemyKind): number {
  switch (kind) {
    case "drone":
      return 0.75;
    case "courier":
      return 0.8;
    case "hatchback":
      return 0.9;
    case "quad":
      return 0.85;
    case "lorry":
      return 1.15;
    case "steel":
    case "artic":
      return 1.2;
    case "transporter":
      return 1.25;
    case "skip":
      return 1.3;
    case "plantdozer":
      return 1.5;
    case "carrier":
      return 1.1;
    case "rival":
      return 1.15;
    case "lawyer":
    case "lobbyist":
    case "influencer":
      return 0.85;
    case "boss":
    case "convoy":
    case "megadozer":
    case "clinic":
    case "blimp":
      return 1.55;
    case "ship":
    case "swarm":
    case "bus":
    case "board":
      return 1.7;
    case "hollowcandor":
      return 2.1;
    case "candor":
      return 1.5;
    case "director":
    case "remnant":
      return 1.1;
    default:
      return 1;
  }
}

/** Height above the ground the sprite floats (flying things). */
export function enemyLift(kind: EnemyKind): number {
  return kind === "drone" || kind === "quad" ? 0.32 : kind === "carrier" ? 0.4 : kind === "blimp" ? 0.55 : kind === "candor" || kind === "hollowcandor" ? 0.15 : 0;
}

function wheel(ctx: C, x: number, y: number, r: number, spin: number): void {
  blob(ctx, x, y, r, "#2b2320");
  ctx.fillStyle = "#b9bec4";
  ctx.beginPath();
  ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2b2320";
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(spin) * r * 0.45, y + Math.sin(spin) * r * 0.45);
  ctx.lineTo(x - Math.cos(spin) * r * 0.45, y - Math.sin(spin) * r * 0.45);
  ctx.stroke();
}

interface VehicleOpts {
  len: number;
  h: number;
  body: string;
  cab?: string;
  stripe?: string;
  label?: string;
  labelColor?: string;
  wheels?: number;
  cabFront?: boolean;
}

/** A side-on vehicle facing right, its wheels on the ground at y. */
function vehicle(ctx: C, x: number, y: number, s: number, t: number, o: VehicleOpts): void {
  const L = s * o.len;
  const H = s * o.h;
  const wr = s * 0.075;
  const bob = Math.abs(Math.sin(t * 9)) * s * 0.012;
  const top = y - wr - H - bob;
  const x0 = x - L / 2;
  // Body.
  rr(ctx, x0, top, L * (o.cabFront === false ? 1 : 0.74), H, s * 0.05, o.body);
  if (o.cabFront !== false) {
    ctx.fillStyle = o.cab ?? o.body;
    ctx.beginPath();
    ctx.moveTo(x0 + L * 0.74, top + H * 0.2);
    ctx.lineTo(x0 + L * 0.9, top + H * 0.2);
    ctx.quadraticCurveTo(x0 + L, top + H * 0.35, x0 + L, top + H * 0.6);
    ctx.lineTo(x0 + L, top + H);
    ctx.lineTo(x0 + L * 0.74, top + H);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Window.
    ctx.fillStyle = "#a9d4e6";
    ctx.beginPath();
    ctx.moveTo(x0 + L * 0.79, top + H * 0.3);
    ctx.lineTo(x0 + L * 0.89, top + H * 0.3);
    ctx.quadraticCurveTo(x0 + L * 0.95, top + H * 0.38, x0 + L * 0.96, top + H * 0.55);
    ctx.lineTo(x0 + L * 0.79, top + H * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Headlight.
    ctx.fillStyle = "#fff2a8";
    ctx.beginPath();
    ctx.arc(x0 + L * 0.98, top + H * 0.8, s * 0.025, 0, Math.PI * 2);
    ctx.fill();
  }
  if (o.stripe) {
    ctx.fillStyle = o.stripe;
    ctx.fillRect(x0 + s * 0.02, top + H * 0.62, L * 0.7, H * 0.16);
  }
  if (o.label) {
    ctx.fillStyle = o.labelColor ?? "#1f8a8a";
    ctx.font = `800 ${Math.max(6, Math.round(H * 0.32))}px 'Atkinson Hyperlegible', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(o.label, x0 + L * 0.37, top + H * 0.38);
  }
  shine(ctx, x0 + L * 0.2, top + H * 0.18, L * 0.14, H * 0.07);
  const n = o.wheels ?? 2;
  for (let i = 0; i < n; i++) {
    const wx = x0 + L * (0.18 + (i * 0.64) / Math.max(1, n - 1));
    wheel(ctx, wx, y - wr, wr, t * 12);
  }
}

function person(ctx: C, x: number, y: number, s: number, t: number, suit: string, head: string, extra?: (hx: number, hy: number) => void): void {
  const step = Math.sin(t * 10);
  ctx.strokeStyle = "#2b2320";
  ctx.lineWidth = Math.max(1.6, s * 0.045);
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.2);
  ctx.lineTo(x - s * 0.06 * step, y);
  ctx.moveTo(x, y - s * 0.2);
  ctx.lineTo(x + s * 0.06 * step, y);
  ctx.stroke();
  ctx.lineWidth = lw(s);
  rr(ctx, x - s * 0.09, y - s * 0.44, s * 0.18, s * 0.26, s * 0.05, suit);
  blob(ctx, x, y - s * 0.52, s * 0.08, head);
  extra?.(x, y - s * 0.52);
}

export function drawEnemy(ctx: C, look: EnemyLook, x: number, y: number, s0: number, t: number): void {
  const kind = look.kind;
  const s = s0 * enemyScale(kind);
  const lift = enemyLift(kind) * s0;
  const tt = t + look.phase;
  groundShadow(ctx, x, y, s * 0.3, s * 0.08, lift > 0 ? 0.15 : 0.25);
  ctx.save();
  if (look.ghost) ctx.globalAlpha = 0.28 + Math.sin(tt * 6) * 0.06;
  const hover = lift > 0 ? Math.sin(tt * 3) * s0 * 0.04 : 0;
  ctx.translate(x, y - lift + hover);
  ctx.scale(look.facing, 1);
  // Hit flash: the sprite itself brightens for a moment (no effect where canvas filters are unsupported).
  if (look.hit < 0.08) ctx.filter = "brightness(1.7)";
  ctx.lineWidth = lw(s0);
  ctx.strokeStyle = INK;
  ctx.lineJoin = "round";
  switch (kind) {
    case "van":
      vehicle(ctx, 0, 0, s, tt, { len: 0.62, h: 0.32, body: "#f4f6f8", stripe: "#1f8a8a", label: "H", wheels: 2 });
      break;
    case "phantom":
      vehicle(ctx, 0, 0, s, tt, { len: 0.62, h: 0.32, body: "#34363d", cab: "#2a2b30", wheels: 2 });
      break;
    case "wrapped": {
      vehicle(ctx, 0, 0, s, tt, { len: 0.62, h: 0.32, body: "#f4f6f8", stripe: "#1f8a8a", label: "H", wheels: 2 });
      if (look.shield !== 0) {
        // Bubble wrap: a glossy, lumpy shell over the van.
        ctx.fillStyle = "rgba(210,236,255,0.38)";
        ctx.strokeStyle = "rgba(120,170,210,0.9)";
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.2, s * 0.38, s * 0.24, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        for (let i = 0; i < 9; i++) {
          ctx.beginPath();
          ctx.arc(-s * 0.28 + (i % 5) * s * 0.14, -s * 0.3 + Math.floor(i / 5) * s * 0.14, s * 0.035, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = INK;
      }
      break;
    }
    case "truck":
      vehicle(ctx, 0, 0, s, tt, { len: 0.76, h: 0.36, body: "#d93a2f", label: "0.99", labelColor: "#ffe66b", wheels: 3 });
      break;
    case "tender":
      vehicle(ctx, 0, 0, s, tt, { len: 0.7, h: 0.26, body: "#8fb8d6", cab: "#d9e6ef", stripe: "#2f5a7a", wheels: 2 });
      break;
    case "director":
      vehicle(ctx, 0, 0, s, tt, { len: 0.8, h: 0.24, body: "#1d1f24", cab: "#1d1f24", stripe: "#d4ae58", wheels: 2 });
      break;
    case "clinic":
      vehicle(ctx, 0, 0, s, tt, { len: 0.72, h: 0.36, body: "#f7fbfa", stripe: "#7fd1b9", label: "+", labelColor: "#2f9a7c", wheels: 3 });
      break;
    case "boss":
      vehicle(ctx, 0, 0, s, tt, { len: 0.7, h: 0.36, body: "#1c1d22", cab: "#2a2b31", stripe: "#d4ae58", label: "ACQ", labelColor: "#d4ae58", wheels: 3 });
      crown(ctx, -s * 0.06, -s * 0.52, s * 0.14);
      break;
    case "convoy":
      vehicle(ctx, 0, 0, s, tt, { len: 0.8, h: 0.38, body: "#d93a2f", label: "0.99", labelColor: "#ffe66b", wheels: 4 });
      crown(ctx, -s * 0.06, -s * 0.54, s * 0.14);
      break;
    case "bus":
      vehicle(ctx, 0, 0, s, tt, { len: 0.86, h: 0.4, body: "#f2f4f7", stripe: "#d93a2f", label: "PELL", labelColor: "#2a4f9a", wheels: 3 });
      ctx.fillStyle = "#2a4f9a";
      ctx.fillRect(-s * 0.4, -s * 0.66, s * 0.03, s * 0.12);
      ctx.fillStyle = "#d93a2f";
      ctx.fillRect(-s * 0.37, -s * 0.66 + Math.sin(tt * 6) * s * 0.01, s * 0.1, s * 0.06);
      break;
    case "board":
      vehicle(ctx, 0, 0, s, tt, { len: 0.92, h: 0.26, body: "#1d1f24", cab: "#1d1f24", stripe: "#d4ae58", wheels: 3 });
      for (let i = 0; i < 4; i++) blob(ctx, -s * 0.3 + i * s * 0.13, -s * 0.44, s * 0.05, "#e9d7c7");
      crown(ctx, 0, -s * 0.56, s * 0.12);
      break;
    case "ship": {
      ctx.fillStyle = "#2f5a7a";
      ctx.beginPath();
      ctx.moveTo(-s * 0.45, -s * 0.24);
      ctx.lineTo(s * 0.45, -s * 0.24);
      ctx.lineTo(s * 0.36, -s * 0.07);
      ctx.lineTo(-s * 0.4, -s * 0.07);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      const cols = ["#d93a2f", "#1f8a8a", "#f2c94c", "#5b6f8a"];
      for (let i = 0; i < 6; i++) rr(ctx, -s * 0.38 + (i % 3) * s * 0.18, -s * 0.38 - Math.floor(i / 3) * s * 0.12, s * 0.17, s * 0.12, s * 0.01, cols[i % 4]!);
      rr(ctx, s * 0.2, -s * 0.5, s * 0.14, s * 0.26, s * 0.02, "#f4f6f8");
      for (let i = 0; i < 4; i++) wheel(ctx, -s * 0.33 + i * s * 0.22, -s * 0.06, s * 0.06, tt * 12);
      break;
    }
    case "bulldozer":
    case "megadozer": {
      const big = kind === "megadozer";
      rr(ctx, -s * 0.3, -s * 0.13, s * 0.5, s * 0.13, s * 0.06, "#3a3a3a");
      for (let i = 0; i < 4; i++) blob(ctx, -s * 0.24 + i * s * 0.13, -s * 0.065, s * 0.04, "#6a6a6a");
      rr(ctx, -s * 0.26, -s * 0.36, s * 0.38, s * 0.24, s * 0.04, "#f2b51f");
      rr(ctx, -s * 0.2, -s * 0.54, s * 0.2, s * 0.2, s * 0.03, "#f2b51f");
      rr(ctx, -s * 0.16, -s * 0.5, s * 0.12, s * 0.1, s * 0.02, "#a9d4e6");
      ctx.fillStyle = "#9aa0a6";
      ctx.beginPath();
      ctx.moveTo(s * 0.24, -s * 0.36);
      ctx.quadraticCurveTo(s * 0.34, -s * 0.2, s * 0.26, -s * 0.02);
      ctx.lineTo(s * 0.36, -s * 0.02);
      ctx.quadraticCurveTo(s * 0.44, -s * 0.2, s * 0.34, -s * 0.38);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (big) crown(ctx, -s * 0.1, -s * 0.62, s * 0.12);
      // Exhaust puff.
      ctx.fillStyle = "rgba(90,90,90,0.35)";
      const ph = (tt * 1.5) % 1;
      ctx.beginPath();
      ctx.arc(-s * 0.24, -s * (0.56 + ph * 0.2), s * (0.03 + ph * 0.05), 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    // The Fleet's rungs (Hedgerow 2 M2): one colour per rung, so a pop reads at a glance.
    case "courier": {
      // An e-scooter courier: deck, stem, rider in teal, a parcel box behind.
      wheel(ctx, -s * 0.15, -s * 0.05, s * 0.05, tt * 12);
      wheel(ctx, s * 0.15, -s * 0.05, s * 0.05, tt * 12);
      rr(ctx, -s * 0.18, -s * 0.1, s * 0.34, s * 0.04, s * 0.02, "#2b2b30");
      ctx.beginPath();
      ctx.moveTo(s * 0.15, -s * 0.1);
      ctx.lineTo(s * 0.15, -s * 0.4);
      ctx.lineTo(s * 0.08, -s * 0.42);
      ctx.stroke();
      rr(ctx, -s * 0.06, -s * 0.38, s * 0.12, s * 0.28, s * 0.04, "#5ec0a8");
      blob(ctx, 0, -s * 0.46, s * 0.07, "#efd6c4");
      rr(ctx, -s * 0.24, -s * 0.3, s * 0.14, s * 0.14, s * 0.02, "#c79a62");
      break;
    }
    case "hatchback":
      vehicle(ctx, 0, 0, s, tt, { len: 0.46, h: 0.24, body: "#e8b23a", stripe: "#2b2b30", wheels: 2 });
      break;
    case "pickup": {
      vehicle(ctx, 0, 0, s, tt, { len: 0.6, h: 0.2, body: "#4a7fc4", stripe: "#f4f6f8", wheels: 2 });
      rr(ctx, -s * 0.2, -s * 0.36, s * 0.13, s * 0.1, s * 0.01, "#c79a62");
      break;
    }
    case "sprinter":
      vehicle(ctx, 0, 0, s, tt, { len: 0.66, h: 0.34, body: "#8a4fd0", stripe: "#ffd23f", label: "24h", labelColor: "#ffd23f", wheels: 2 });
      break;
    case "lorry":
      vehicle(ctx, 0, 0, s, tt, { len: 0.8, h: 0.42, body: "#24345e", cab: "#e9ecef", stripe: "#5ab0ff", wheels: 3 });
      break;
    case "steel":
      // The Plated Lorry: riveted steel, rivets along the top.
      vehicle(ctx, 0, 0, s, tt, { len: 0.84, h: 0.44, body: "#7d8894", cab: "#5a636d", stripe: "#c9d0d6", wheels: 3 });
      ctx.fillStyle = "#dfe4e8";
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc((-0.36 + i * 0.13) * s, -s * 0.44, s * 0.018, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case "artic":
      // The Artic: a frost-box trailer behind a bubble-wrapped cab.
      vehicle(ctx, 0, 0, s, tt, { len: 0.94, h: 0.42, body: "#dfe9f2", cab: "#9fd3ff", stripe: "#6fd0f0", wheels: 3 });
      break;
    case "skip":
      vehicle(ctx, 0, 0, s, tt, { len: 0.8, h: 0.3, body: "#e0a82e", cab: "#b9831a", stripe: "#3b3f44", wheels: 3 });
      rr(ctx, -s * 0.34, -s * 0.5, s * 0.5, s * 0.16, s * 0.03, "#9a6b12");
      break;
    case "plantdozer":
      vehicle(ctx, 0, 0, s, tt, { len: 0.84, h: 0.36, body: "#f2c230", cab: "#2a2b31", stripe: "#2a2b31", wheels: 4 });
      rr(ctx, s * 0.36, -s * 0.5, s * 0.1, s * 0.5, s * 0.02, "#8a96a3");
      break;
    case "transporter":
      // The Car Transporter: a red cab and a two-deck rack of cars.
      vehicle(ctx, 0, 0, s, tt, { len: 0.96, h: 0.2, body: "#3b3f44", cab: "#b23a3a", wheels: 3 });
      for (const [x, y, c] of [[-0.3, -0.3, "#e8b23a"], [0.02, -0.3, "#4a7fc4"], [-0.3, -0.52, "#f4f6f8"], [0.02, -0.52, "#e8b23a"]] as const)
        rr(ctx, x * s, y * s, s * 0.26, s * 0.12, s * 0.03, c);
      break;
    case "quad": {
      rr(ctx, -s * 0.2, -s * 0.14, s * 0.4, s * 0.12, s * 0.04, "#f08a3c");
      for (const sx of [-0.34, -0.12, 0.12, 0.34]) {
        ctx.fillStyle = "rgba(200,210,220,0.6)";
        ctx.beginPath();
        ctx.ellipse(sx * s, -s * 0.2, s * 0.1 * Math.abs(Math.cos(tt * 40 + sx * 5)) + s * 0.02, s * 0.02, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      rr(ctx, -s * 0.1, s * 0.0, s * 0.2, s * 0.14, s * 0.01, "#c79a62");
      break;
    }
    case "drone": {
      rr(ctx, -s * 0.16, -s * 0.12, s * 0.32, s * 0.1, s * 0.04, "#e6eaee");
      ctx.beginPath();
      ctx.moveTo(-s * 0.16, -s * 0.08);
      ctx.lineTo(-s * 0.3, -s * 0.16);
      ctx.moveTo(s * 0.16, -s * 0.08);
      ctx.lineTo(s * 0.3, -s * 0.16);
      ctx.stroke();
      for (const sx of [-0.3, 0.3]) {
        ctx.fillStyle = "rgba(200,210,220,0.6)";
        ctx.beginPath();
        ctx.ellipse(sx * s, -s * 0.17, s * 0.14 * Math.abs(Math.cos(tt * 40)) + s * 0.02, s * 0.02, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = "#d95f3b";
      ctx.beginPath();
      ctx.arc(s * 0.1, -s * 0.07, s * 0.02, 0, Math.PI * 2);
      ctx.fill();
      // The parcel.
      ctx.strokeStyle = INK;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.02);
      ctx.lineTo(0, s * 0.03);
      ctx.stroke();
      rr(ctx, -s * 0.08, s * 0.03, s * 0.16, s * 0.12, s * 0.01, "#c79a62");
      ctx.strokeStyle = "#1f8a8a";
      ctx.beginPath();
      ctx.moveTo(-s * 0.08, s * 0.09);
      ctx.lineTo(s * 0.08, s * 0.09);
      ctx.stroke();
      ctx.strokeStyle = INK;
      break;
    }
    case "influencer": {
      // On an e-scooter, ring light held high.
      ctx.strokeStyle = INK;
      ctx.beginPath();
      ctx.moveTo(-s * 0.18, -s * 0.05);
      ctx.lineTo(s * 0.18, -s * 0.05);
      ctx.lineTo(s * 0.14, -s * 0.5);
      ctx.stroke();
      wheel(ctx, -s * 0.16, -s * 0.05, s * 0.05, tt * 12);
      wheel(ctx, s * 0.18, -s * 0.05, s * 0.05, tt * 12);
      rr(ctx, -s * 0.08, -s * 0.42, s * 0.16, s * 0.3, s * 0.06, "#f27ab0");
      blob(ctx, 0, -s * 0.5, s * 0.08, "#f3d2c1");
      ctx.fillStyle = "#f2e19a";
      ctx.beginPath();
      ctx.ellipse(-s * 0.01, -s * 0.58, s * 0.09, s * 0.05, 0, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,240,200,0.95)";
      ctx.lineWidth = Math.max(2, s * 0.04);
      ctx.beginPath();
      ctx.arc(s * 0.2, -s * 0.72, s * 0.1, 0, Math.PI * 2);
      ctx.stroke();
      const glow = ctx.createRadialGradient(s * 0.2, -s * 0.72, 0, s * 0.2, -s * 0.72, s * 0.45);
      glow.addColorStop(0, "rgba(255,200,230,0.45)");
      glow.addColorStop(1, "rgba(255,200,230,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(-s * 0.25, -s * 1.17, s * 0.9, s * 0.9);
      break;
    }
    case "blimp": {
      ctx.fillStyle = "#f27ab0";
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.3, s * 0.42, s * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#e05a98";
      ctx.beginPath();
      ctx.moveTo(-s * 0.36, -s * 0.3);
      ctx.lineTo(-s * 0.52, -s * 0.46);
      ctx.lineTo(-s * 0.48, -s * 0.3);
      ctx.lineTo(-s * 0.52, -s * 0.14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      rr(ctx, -s * 0.1, -s * 0.12, s * 0.2, s * 0.08, s * 0.02, "#f4f6f8");
      shine(ctx, -s * 0.1, -s * 0.42, s * 0.16, s * 0.04);
      ctx.fillStyle = "#fff";
      ctx.font = `800 ${Math.max(6, Math.round(s * 0.11))}px 'Atkinson Hyperlegible', sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("#BLESSED", 0, -s * 0.3);
      crown(ctx, 0, -s * 0.56, s * 0.12);
      break;
    }
    case "lawyer":
      person(ctx, 0, 0, s, tt, "#5b6370", "#efd6c4", (hx, hy) => {
        rr(ctx, s * 0.06, hy + s * 0.3, s * 0.14, s * 0.1, s * 0.01, "#3a2a24");
        ctx.fillStyle = "#3a3d44";
        ctx.beginPath();
        ctx.arc(hx, hy - s * 0.03, s * 0.08, Math.PI, 0);
        ctx.fill();
      });
      break;
    case "rival":
      vehicle(ctx, 0, 0, s, tt, { len: 0.5, h: 0.24, body: "#c9a227", cab: "#7a5a12", label: "P", wheels: 2 });
      break;
    case "lobbyist":
      person(ctx, 0, 0, s, tt, "#2f4a3c", "#efd6c4", (hx, hy) => {
        rr(ctx, s * 0.06, hy + s * 0.3, s * 0.14, s * 0.1, s * 0.01, "#8a5a2a");
        ctx.fillStyle = "#d4b24a";
        ctx.beginPath();
        ctx.arc(hx, hy - s * 0.03, s * 0.08, Math.PI, 0);
        ctx.fill();
      });
      break;
    case "carrier": {
      rr(ctx, -s * 0.32, -s * 0.16, s * 0.64, s * 0.14, s * 0.06, "#5b6572");
      rr(ctx, -s * 0.2, -s * 0.24, s * 0.4, s * 0.1, s * 0.04, "#7a8594");
      for (const sx of [-0.34, 0, 0.34]) {
        ctx.fillStyle = "rgba(200,210,220,0.6)";
        ctx.beginPath();
        ctx.ellipse(sx * s, -s * 0.27, s * 0.16 * Math.abs(Math.cos(tt * 30 + sx * 5)) + s * 0.02, s * 0.025, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#d4b24a";
      ctx.fillRect(-s * 0.06, -s * 0.06, s * 0.12, s * 0.04);
      break;
    }
    case "swarm":
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.translate((i - 1.5) * s * 0.16, (i % 2) * s * 0.04);
        person(ctx, 0, 0, s * 0.8, tt + i * 0.3, "#3a3d44", "#efd6c4", (_hx, hy) => {
          rr(ctx, s * 0.05, hy + s * 0.25, s * 0.12, s * 0.08, s * 0.01, "#3a2a24");
        });
        ctx.restore();
      }
      crown(ctx, 0, -s * 0.66, s * 0.12);
      break;
    case "hollowcandor":
    case "candor":
    case "remnant": {
      const R = s * (kind === "hollowcandor" ? 0.32 : kind === "candor" ? 0.26 : 0.18);
      const g = ctx.createRadialGradient(-R * 0.3, -R - R * 0.3, R * 0.1, 0, -R, R);
      g.addColorStop(0, kind === "remnant" ? "#d9dde6" : "#f4f6fa");
      g.addColorStop(0.6, kind === "hollowcandor" ? "#9aa3b5" : "#b7bfcf");
      g.addColorStop(1, kind === "hollowcandor" ? "#4a5163" : "#6e7790");
      ctx.fillStyle = g;
      ctx.beginPath();
      if (kind === "remnant") {
        ctx.moveTo(0, -R * 2);
        ctx.lineTo(R, -R);
        ctx.lineTo(0, 0);
        ctx.lineTo(-R, -R);
        ctx.closePath();
      } else ctx.arc(0, -R, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // The eye, which looks at the farmhouse.
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.ellipse(R * 0.25, -R, R * 0.35, R * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = kind === "hollowcandor" ? "#d93a2f" : "#1f8a8a";
      ctx.beginPath();
      ctx.arc(R * 0.35, -R, R * 0.12, 0, Math.PI * 2);
      ctx.fill();
      if (kind === "hollowcandor") {
        crown(ctx, 0, -R * 2.15, R * 0.5);
        ctx.strokeStyle = "rgba(217,58,47,0.5)";
        ctx.lineWidth = Math.max(2, s * 0.03);
        const ph = (tt % 1.2) / 1.2;
        ctx.globalAlpha = 1 - ph;
        ctx.beginPath();
        ctx.arc(0, -R, R * (1.1 + ph * 0.6), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      break;
    }
  }
  ctx.filter = "none";
  ctx.restore();
}

function crown(ctx: C, x: number, y: number, w: number): void {
  ctx.fillStyle = "#d4ae58";
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y + w * 0.35);
  ctx.lineTo(x - w / 2, y - w * 0.05);
  ctx.lineTo(x - w / 4, y + w * 0.15);
  ctx.lineTo(x, y - w * 0.2);
  ctx.lineTo(x + w / 4, y + w * 0.15);
  ctx.lineTo(x + w / 2, y - w * 0.05);
  ctx.lineTo(x + w / 2, y + w * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// ---- Cath ----

export interface HeroLook {
  facing: 1 | -1;
  walking: boolean;
  /** Seconds since her last swing. */
  swung: number;
  down: boolean;
  /** Seconds since she threw a pie. */
  threw: number;
  selected: boolean;
}

/**
 * Cath on the battlefield, chibi-sized: an olive blazer over a cream blouse, slim trousers, ankle boots, her
 * rolling pin, and her face from shared/cath (passed in as an image so she always looks like herself).
 */
export function drawHero(ctx: C, look: HeroLook, x: number, y: number, s: number, t: number, face: HTMLImageElement | null): void {
  const o = wornOutfit();
  ctx.lineWidth = lw(s);
  ctx.strokeStyle = INK;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (look.selected) {
    ctx.strokeStyle = "#f2c94c";
    ctx.lineWidth = Math.max(2, s * 0.04);
    ctx.setLineDash([s * 0.08, s * 0.06]);
    ctx.lineDashOffset = -t * s * 0.3;
    ctx.beginPath();
    ctx.ellipse(x, y, s * 0.32, s * 0.12, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = INK;
    ctx.lineWidth = lw(s);
  }
  groundShadow(ctx, x, y, s * 0.2, s * 0.06, 0.3);
  ctx.save();
  ctx.translate(x, y);
  if (look.down) {
    // Sitting on the verge, catching her breath.
    ctx.scale(look.facing, 1);
    rr(ctx, -s * 0.16, -s * 0.12, s * 0.28, s * 0.1, s * 0.04, o.trousers);
    rr(ctx, -s * 0.13, -s * 0.38, s * 0.24, s * 0.28, s * 0.07, o.jacket);
    if (face) ctx.drawImage(face, -s * 0.19, -s * 0.72, s * 0.36, s * 0.43);
    for (let i = 0; i < 3; i++) {
      const a = t * 3 + (i * Math.PI * 2) / 3;
      ctx.fillStyle = "#f2c94c";
      ctx.beginPath();
      star(ctx, Math.cos(a) * s * 0.2, -s * 0.78 + Math.sin(a) * s * 0.05, s * 0.04);
      ctx.fill();
    }
    ctx.restore();
    return;
  }
  ctx.scale(look.facing, 1);
  const walk = look.walking ? Math.sin(t * 12) : 0;
  const bounce = look.walking ? Math.abs(Math.sin(t * 12)) * s * 0.03 : Math.sin(t * 2) * s * 0.006;
  // Legs and boots.
  ctx.strokeStyle = o.trousers;
  ctx.lineWidth = Math.max(2, s * 0.06);
  ctx.beginPath();
  ctx.moveTo(-s * 0.04, -s * 0.2 - bounce);
  ctx.lineTo(-s * 0.04 - walk * s * 0.05, -s * 0.03);
  ctx.moveTo(s * 0.04, -s * 0.2 - bounce);
  ctx.lineTo(s * 0.04 + walk * s * 0.05, -s * 0.03);
  ctx.stroke();
  ctx.fillStyle = o.boots;
  ctx.strokeStyle = INK;
  ctx.lineWidth = lw(s) * 0.8;
  for (const lx of [-0.04 - walk * 0.05, 0.04 + walk * 0.05]) {
    ctx.beginPath();
    ctx.ellipse(lx * s + s * 0.02, -s * 0.025, s * 0.045, s * 0.025, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.lineWidth = lw(s);
  // Blazer, with the cream blouse at the neck and a leaf brooch.
  ctx.translate(0, -bounce);
  ctx.fillStyle = o.jacket;
  ctx.beginPath();
  ctx.moveTo(-s * 0.13, -s * 0.18);
  ctx.lineTo(-s * 0.11, -s * 0.44);
  ctx.quadraticCurveTo(0, -s * 0.5, s * 0.11, -s * 0.44);
  ctx.lineTo(s * 0.13, -s * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = o.blouse;
  ctx.beginPath();
  ctx.moveTo(-s * 0.04, -s * 0.47);
  ctx.lineTo(0, -s * 0.34);
  ctx.lineTo(s * 0.04, -s * 0.47);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = o.brooch;
  ctx.beginPath();
  ctx.ellipse(-s * 0.07, -s * 0.36, s * 0.022, s * 0.012, -0.6, 0, Math.PI * 2);
  ctx.fill();
  // Arm with the rolling pin: raised, then brought down on a swing.
  const sw = look.swung < 0.25 ? Math.sin((look.swung / 0.25) * Math.PI) : 0;
  const th = look.threw < 0.3 ? Math.sin((look.threw / 0.3) * Math.PI) : 0;
  ctx.save();
  ctx.translate(s * 0.1, -s * 0.4);
  ctx.rotate(-0.4 + sw * 1.6 - th * 1.2 + Math.sin(t * 2) * 0.03);
  ctx.strokeStyle = o.sleeve;
  ctx.lineWidth = Math.max(2, s * 0.06);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(s * 0.04, s * 0.15);
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = lw(s);
  ctx.save();
  ctx.translate(s * 0.04, s * 0.17);
  ctx.rotate(-1.2);
  rr(ctx, -s * 0.03, -s * 0.2, s * 0.06, s * 0.26, s * 0.03, "#d9b384");
  rr(ctx, -s * 0.015, -s * 0.26, s * 0.03, s * 0.07, s * 0.015, "#a9784a");
  ctx.restore();
  ctx.restore();
  // Head: her real face, slightly big for cuteness.
  if (face) ctx.drawImage(face, -s * 0.2, -s * 0.9, s * 0.4, s * 0.48);
  else blob(ctx, 0, -s * 0.62, s * 0.15, "#F7DCCB");
  ctx.restore();
}

// ---- the farmhouse ----

export function drawFarmhouse(ctx: C, x: number, y: number, s: number, t: number, health: number): void {
  ctx.lineWidth = lw(s);
  ctx.strokeStyle = INK;
  ctx.lineJoin = "round";
  const base = y + s * 0.34;
  groundShadow(ctx, x, base, s * 0.5, s * 0.12);
  // Walls and roof.
  rr(ctx, x - s * 0.36, base - s * 0.48, s * 0.72, s * 0.48, s * 0.02, "#f4ede1");
  ctx.fillStyle = "#b5523b";
  ctx.beginPath();
  ctx.moveTo(x - s * 0.46, base - s * 0.44);
  ctx.lineTo(x - s * 0.3, base - s * 0.82);
  ctx.lineTo(x + s * 0.3, base - s * 0.82);
  ctx.lineTo(x + s * 0.46, base - s * 0.44);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Chimney with smoke.
  rr(ctx, x + s * 0.14, base - s * 0.96, s * 0.1, s * 0.2, s * 0.01, "#8a5a35");
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.35 + i / 3) % 1;
    ctx.fillStyle = `rgba(240,236,228,${0.5 * (1 - ph)})`;
    ctx.beginPath();
    ctx.arc(x + s * 0.19 + ph * s * 0.2, base - s * (1 + ph * 0.5), s * (0.04 + ph * 0.06), 0, Math.PI * 2);
    ctx.fill();
  }
  // Door and windows (lit and warm).
  rr(ctx, x - s * 0.07, base - s * 0.26, s * 0.14, s * 0.26, s * 0.06, "#4f7f37");
  for (const wx of [-0.24, 0.16]) {
    rr(ctx, x + wx * s, base - s * 0.36, s * 0.1, s * 0.1, s * 0.01, "#ffe39a");
  }
  // Flower boxes.
  ctx.fillStyle = "#e8748b";
  for (const wx of [-0.22, -0.17, 0.18, 0.23]) {
    ctx.beginPath();
    ctx.arc(x + wx * s, base - s * 0.25, s * 0.025, 0, Math.PI * 2);
    ctx.fill();
  }
  // Damage: smoke and a cracked window as Goodwill drops.
  if (health < 0.5) {
    for (let i = 0; i < 2; i++) {
      const ph = (t * 0.6 + i * 0.5) % 1;
      ctx.fillStyle = `rgba(70,60,55,${0.45 * (1 - ph)})`;
      ctx.beginPath();
      ctx.arc(x - s * 0.2 + ph * s * 0.1, base - s * (0.6 + ph * 0.6), s * (0.06 + ph * 0.1), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ---- property icons (Hedgerow 2 section 2: a small icon row above every vehicle that carries one) ----

/**
 * One property's icon, centred on (x, y), `d` pixels across: a coloured roundel with a pictogram. Shared by the
 * 2D field, the build-menu badges and chips (icons.ts) and the 3D billboards (render3d/index.ts).
 */
export function drawPropIcon(ctx: C, prop: Property, x: number, y: number, d: number): void {
  const r = d / 2;
  const info = PROPERTIES[prop];
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = info.colour;
  ctx.fill();
  ctx.lineWidth = Math.max(1, d * 0.1);
  ctx.strokeStyle = "rgba(20,22,28,0.85)";
  ctx.stroke();
  const ink = prop === "airborne" || prop === "wrapped" || prop === "reefer" || prop === "reinforced" ? "#1d2430" : "#ffffff";
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = Math.max(1, d * 0.11);
  ctx.lineCap = "round";
  const k = r * 0.55;
  switch (prop) {
    case "stealth": // an eye, struck through
      ctx.beginPath();
      ctx.ellipse(x, y, k, k * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - k, y + k);
      ctx.lineTo(x + k, y - k);
      ctx.stroke();
      break;
    case "airborne": // a rotor
      ctx.beginPath();
      ctx.moveTo(x - k, y - k * 0.5);
      ctx.lineTo(x + k, y - k * 0.5);
      ctx.moveTo(x, y - k * 0.5);
      ctx.lineTo(x, y + k * 0.6);
      ctx.stroke();
      break;
    case "plated": // rivets
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        ctx.beginPath();
        ctx.arc(x + dx * k * 0.6, y + dy * k * 0.6, Math.max(0.8, d * 0.08), 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case "wrapped": // bubbles
      for (const [dx, dy] of [[-0.5, -0.3], [0.45, -0.35], [0, 0.45]] as const) {
        ctx.beginPath();
        ctx.arc(x + dx * k, y + dy * k, k * 0.38, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    case "sealed": // a mesh grille
      ctx.lineWidth = Math.max(0.8, d * 0.07);
      ctx.beginPath();
      for (const o of [-0.5, 0, 0.5]) {
        ctx.moveTo(x + o * k * 1.4, y - k);
        ctx.lineTo(x + o * k * 1.4, y + k);
        ctx.moveTo(x - k, y + o * k * 1.4);
        ctx.lineTo(x + k, y + o * k * 1.4);
      }
      ctx.stroke();
      break;
    case "reefer": // a snowflake
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3;
        ctx.moveTo(x - Math.cos(a) * k, y - Math.sin(a) * k);
        ctx.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k);
      }
      ctx.stroke();
      break;
    case "reinforced": // hazard bands
      ctx.lineWidth = Math.max(1, d * 0.14);
      ctx.beginPath();
      for (const o of [-0.6, 0.1]) {
        ctx.moveTo(x + (o - 0.3) * k * 1.4, y + k * 0.8);
        ctx.lineTo(x + (o + 0.5) * k * 1.4, y - k * 0.8);
      }
      ctx.stroke();
      break;
    case "rebrand": // a circular arrow
      ctx.beginPath();
      ctx.arc(x, y, k * 0.8, -Math.PI * 0.2, Math.PI * 1.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + k * 0.9, y - k * 0.75);
      ctx.lineTo(x + k * 0.65, y - k * 0.1);
      ctx.lineTo(x + k * 0.1, y - k * 0.5);
      ctx.fill();
      break;
    case "plant": // caterpillar tracks
      ctx.beginPath();
      ctx.moveTo(x - k, y + k * 0.4);
      ctx.lineTo(x + k, y + k * 0.4);
      ctx.moveTo(x - k * 0.7, y - k * 0.5);
      ctx.lineTo(x + k * 0.7, y - k * 0.5);
      ctx.stroke();
      break;
  }
  ctx.restore();
}

/** The properties to show over a vehicle: everything it carries except what its look already says (an Artic's own). */
export function propIconsFor(pm: number): Property[] {
  return propsOf(pm);
}
