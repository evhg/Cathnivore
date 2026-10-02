// Hedgerow's sprites, drawn with Canvas 2D paths: towers (with their tiers and tier-4 specialisations),
// every enemy, Cath herself and the farmhouse. Each function draws centred on (x, y) at the bottom of the
// sprite (where it meets the ground), scaled to the cell size `s`, and animates from the clock `t` (seconds).
// Friendly things are warm, hand-made and outlined in ink; the corporations are glossy, cold and plastic
// (STYLE.md 2).

import type { EnemyKind, TowerKind } from "./engine";

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
}

const SPEC_COLOURS: [string, string] = ["#c4433a", "#3f6fb5"];

export function drawTower(ctx: C, look: TowerLook, x: number, y: number, s: number, t: number): void {
  const { kind, tier, spec, fired } = look;
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
}

/** How big each enemy is drawn, relative to a van. */
export function enemyScale(kind: EnemyKind): number {
  switch (kind) {
    case "drone":
      return 0.75;
    case "lawyer":
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
  return kind === "drone" ? 0.32 : kind === "blimp" ? 0.55 : kind === "candor" || kind === "hollowcandor" ? 0.15 : 0;
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
    rr(ctx, -s * 0.16, -s * 0.12, s * 0.28, s * 0.1, s * 0.04, "#3a3340");
    rr(ctx, -s * 0.13, -s * 0.38, s * 0.24, s * 0.28, s * 0.07, "#6E7C4B");
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
  ctx.strokeStyle = "#3a3340";
  ctx.lineWidth = Math.max(2, s * 0.06);
  ctx.beginPath();
  ctx.moveTo(-s * 0.04, -s * 0.2 - bounce);
  ctx.lineTo(-s * 0.04 - walk * s * 0.05, -s * 0.03);
  ctx.moveTo(s * 0.04, -s * 0.2 - bounce);
  ctx.lineTo(s * 0.04 + walk * s * 0.05, -s * 0.03);
  ctx.stroke();
  ctx.fillStyle = "#5a3a28";
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
  ctx.fillStyle = "#6E7C4B";
  ctx.beginPath();
  ctx.moveTo(-s * 0.13, -s * 0.18);
  ctx.lineTo(-s * 0.11, -s * 0.44);
  ctx.quadraticCurveTo(0, -s * 0.5, s * 0.11, -s * 0.44);
  ctx.lineTo(s * 0.13, -s * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#F7F0E3";
  ctx.beginPath();
  ctx.moveTo(-s * 0.04, -s * 0.47);
  ctx.lineTo(0, -s * 0.34);
  ctx.lineTo(s * 0.04, -s * 0.47);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#86AC5B";
  ctx.beginPath();
  ctx.ellipse(-s * 0.07, -s * 0.36, s * 0.022, s * 0.012, -0.6, 0, Math.PI * 2);
  ctx.fill();
  // Arm with the rolling pin: raised, then brought down on a swing.
  const sw = look.swung < 0.25 ? Math.sin((look.swung / 0.25) * Math.PI) : 0;
  const th = look.threw < 0.3 ? Math.sin((look.threw / 0.3) * Math.PI) : 0;
  ctx.save();
  ctx.translate(s * 0.1, -s * 0.4);
  ctx.rotate(-0.4 + sw * 1.6 - th * 1.2 + Math.sin(t * 2) * 0.03);
  ctx.strokeStyle = "#56623A";
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
