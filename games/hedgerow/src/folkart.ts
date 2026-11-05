// Plan item 143: the 2D farmfolk, drawn in the field's own ink-outlined style. Each figure stands with its feet on
// (x, y) at cell size s and is small next to the towers (a farmhand is about half a cell tall), so they read as
// life on the farm, not as pieces. Poses: walking (a bob and swinging legs), tending (a hoe, a sniff, a peck),
// running (leaning in, faster stride), hiding (crouched, arms over the head) and cheering (arms up, a hop).

import type { Folk } from "./farmfolk";
import { groundShadow, INK } from "./sprites";

type C = CanvasRenderingContext2D;

const lw = (s: number) => Math.max(1.1, s * 0.022);

function limb(ctx: C, x1: number, y1: number, x2: number, y2: number, w: number, colour: string): void {
  ctx.strokeStyle = INK;
  ctx.lineCap = "round";
  ctx.lineWidth = w + 2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.strokeStyle = colour;
  ctx.lineWidth = w;
  ctx.stroke();
}

function pose(f: Folk, t: number) {
  const run = f.mode === "flee";
  const stride = f.moving ? Math.sin(t * (run ? 22 : 11) + f.id) : 0;
  const hop = f.mode === "cheer" ? Math.abs(Math.sin(f.t * 9 + f.id)) : 0;
  const bob = f.moving ? Math.abs(stride) * 0.04 : 0;
  return { run, stride, hop, bob, hide: f.mode === "home", cheer: f.mode === "cheer" };
}

/** A person: a farmhand (straw hat, shirt, braces, a hoe) or Bea (bunches, pink cardigan). */
function person(ctx: C, f: Folk, x: number, y: number, s: number, t: number): void {
  const bea = f.kind === "bea";
  const p = pose(f, t);
  const h = s * (bea ? 0.52 : 0.7);
  const shirt = bea ? "#e8748b" : f.id % 2 ? "#c4433a" : "#4f7fb0";
  const legs = bea ? "#f6efe4" : "#5b4a3a";
  const crouch = p.hide ? 0.25 : 0;
  const lift = p.hop * h * 0.18 + p.bob * h;
  const base = y - lift;
  const hip = base - h * (0.38 - crouch * 0.6);
  const neck = hip - h * (0.34 - crouch * 0.3);
  const lean = p.run ? f.facing * h * 0.12 : 0;
  groundShadow(ctx, x, y, h * 0.42, h * 0.12, 0.22);
  ctx.save();
  ctx.translate(x, 0);
  ctx.scale(f.facing, 1);
  const w = Math.max(2, h * 0.13);
  const L = Math.abs(lean);
  // Legs.
  limb(ctx, 0, hip, p.stride * h * 0.16, base, w, legs);
  limb(ctx, 0, hip, -p.stride * h * 0.16, base, w, legs);
  // Arms behind the body when walking; the hoe in the front hand when working.
  const sx = L * 0.6;
  const sy = neck + h * 0.06;
  // Body.
  ctx.lineWidth = lw(s);
  ctx.strokeStyle = INK;
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.roundRect(-h * 0.16 + L * 0.3, neck, h * 0.32, hip - neck + h * 0.06, h * 0.1);
  ctx.fill();
  ctx.stroke();
  if (!bea) {
    // Braces.
    ctx.strokeStyle = "#3a2f28";
    ctx.lineWidth = Math.max(1, h * 0.03);
    ctx.beginPath();
    ctx.moveTo(-h * 0.06 + L * 0.3, neck + h * 0.02);
    ctx.lineTo(-h * 0.06 + L * 0.3, hip);
    ctx.moveTo(h * 0.06 + L * 0.3, neck + h * 0.02);
    ctx.lineTo(h * 0.06 + L * 0.3, hip);
    ctx.stroke();
  }
  const skin = "#f0c9a0";
  if (p.cheer) {
    limb(ctx, sx - h * 0.1, sy, -h * 0.22, neck - h * 0.3, w * 0.9, skin);
    limb(ctx, sx + h * 0.1, sy, h * 0.24, neck - h * 0.32, w * 0.9, skin);
  } else if (p.hide) {
    limb(ctx, sx - h * 0.1, sy, -h * 0.02, neck - h * 0.2, w * 0.9, skin);
    limb(ctx, sx + h * 0.1, sy, h * 0.06, neck - h * 0.2, w * 0.9, skin);
  } else if (f.tending && !bea) {
    // Hoeing: the handle rocks down to the soil in front.
    const k = (Math.sin(f.t * 4 + f.id) + 1) / 2;
    const hx = h * (0.3 + k * 0.08);
    const hy = base - h * (0.02 + k * 0.18);
    ctx.strokeStyle = "#8a6238";
    ctx.lineWidth = Math.max(1.4, h * 0.05);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-h * 0.05, neck - h * 0.1);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.strokeStyle = "#7d8a92";
    ctx.lineWidth = Math.max(1.6, h * 0.07);
    ctx.beginPath();
    ctx.moveTo(hx - h * 0.02, hy - h * 0.02);
    ctx.lineTo(hx + h * 0.06, hy + h * 0.07);
    ctx.stroke();
    limb(ctx, sx, sy, h * 0.14, neck + h * 0.12, w * 0.9, skin);
    if (k > 0.85) {
      ctx.fillStyle = "rgba(120,86,52,0.6)";
      ctx.beginPath();
      ctx.arc(hx + h * 0.08, base - h * 0.06, h * 0.035, 0, Math.PI * 2);
      ctx.arc(hx + h * 0.15, base - h * 0.1, h * 0.025, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (f.tending && bea) {
    // Bea crouches to look at the crop, hands on her knees.
    limb(ctx, sx, sy, h * 0.12, hip, w * 0.9, skin);
  } else {
    limb(ctx, sx, sy, -p.stride * h * 0.14 + lean * 0.5, hip + h * 0.02, w * 0.9, skin);
  }
  // Head.
  const hr = h * (bea ? 0.19 : 0.15);
  const hx0 = L * 0.5;
  const hy0 = neck - hr * 0.95;
  if (bea) {
    ctx.fillStyle = "#2e211c";
    for (const d of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(hx0 + d * hr * 1.05, hy0 + hr * 0.15, hr * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(hx0, hy0, hr, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = lw(s);
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(hx0 + hr * 0.45, hy0 - hr * 0.05, Math.max(0.9, hr * 0.13), 0, Math.PI * 2);
  ctx.fill();
  if (bea) {
    ctx.fillStyle = "#2e211c";
    ctx.beginPath();
    ctx.arc(hx0, hy0 - hr * 0.15, hr * 1.02, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();
    ctx.fillStyle = "#f2c94c";
    for (const d of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(hx0 + d * hr * 0.8, hy0 - hr * 0.35, hr * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // A straw hat with a band.
    ctx.fillStyle = "#e3c26a";
    ctx.beginPath();
    ctx.ellipse(hx0, hy0 - hr * 0.55, hr * 1.55, hr * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(hx0 - hr * 0.75, hy0 - hr * 1.25, hr * 1.5, hr * 0.75, hr * 0.3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = shirt;
    ctx.fillRect(hx0 - hr * 0.74, hy0 - hr * 0.78, hr * 1.48, hr * 0.2);
  }
  ctx.restore();
}

function dog(ctx: C, f: Folk, x: number, y: number, s: number, t: number): void {
  const p = pose(f, t);
  const L = s * 0.48;
  const lift = p.hop * L * 0.25 + p.bob * L * 0.6;
  const base = y - lift;
  groundShadow(ctx, x, y, L * 0.55, L * 0.14, 0.22);
  ctx.save();
  ctx.translate(x, base);
  ctx.scale(f.facing, 1);
  const w = Math.max(1.6, L * 0.1);
  const coat = "#3b3029";
  // Legs.
  for (const [lx, ph] of [[-0.28, 0], [-0.18, Math.PI], [0.18, Math.PI], [0.28, 0]] as const) {
    const swing = f.moving ? Math.sin(t * (p.run ? 24 : 14) + ph) * L * 0.08 : 0;
    limb(ctx, lx * L, -L * 0.3, lx * L + swing, 0, w, coat);
  }
  // Tail: wags when happy, tucked when hiding.
  const wag = p.hide ? -0.2 : Math.sin(t * (p.cheer ? 26 : 10)) * 0.35;
  ctx.save();
  ctx.translate(-L * 0.36, -L * 0.42);
  ctx.rotate(-0.9 + wag + (p.hide ? 1.6 : 0));
  limb(ctx, 0, 0, 0, -L * 0.28, w * 0.8, coat);
  ctx.restore();
  // Body: a black-and-white collie.
  ctx.lineWidth = lw(s);
  ctx.strokeStyle = INK;
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.ellipse(0, -L * 0.42, L * 0.4, L * 0.17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#f4efe6";
  ctx.beginPath();
  ctx.ellipse(L * 0.22, -L * 0.36, L * 0.13, L * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head, low when sniffing.
  const hy = -L * (f.tending ? 0.36 : p.hide ? 0.42 : 0.62);
  const hx = L * 0.42;
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.ellipse(hx, hy, L * 0.16, L * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#f4efe6";
  ctx.beginPath();
  ctx.ellipse(hx + L * 0.12, hy + L * 0.04, L * 0.09, L * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(hx + L * 0.2, hy + L * 0.02, Math.max(1, L * 0.035), 0, Math.PI * 2);
  ctx.arc(hx + L * 0.04, hy - L * 0.03, Math.max(0.8, L * 0.025), 0, Math.PI * 2);
  ctx.fill();
  // Ear.
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.moveTo(hx - L * 0.08, hy - L * 0.08);
  ctx.lineTo(hx - L * 0.02, hy - L * 0.24);
  ctx.lineTo(hx + L * 0.04, hy - L * 0.08);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function hen(ctx: C, f: Folk, x: number, y: number, s: number, t: number): void {
  const p = pose(f, t);
  const L = s * 0.3;
  const peck = f.tending ? Math.max(0, Math.sin(f.t * 7 + f.id * 1.7)) : 0;
  const flap = p.run || p.cheer ? Math.abs(Math.sin(t * 20 + f.id)) : 0;
  const lift = p.hop * L * 0.4 + p.bob * L * 0.6;
  groundShadow(ctx, x, y, L * 0.5, L * 0.14, 0.2);
  ctx.save();
  ctx.translate(x, y - lift);
  ctx.scale(f.facing, 1);
  const leg = Math.max(1.2, L * 0.08);
  for (const d of [-1, 1]) {
    const sw = f.moving ? Math.sin(t * (p.run ? 26 : 16) + (d > 0 ? Math.PI : 0)) * L * 0.1 : 0;
    ctx.strokeStyle = "#d99a2b";
    ctx.lineWidth = leg;
    ctx.beginPath();
    ctx.moveTo(d * L * 0.08, -L * 0.3);
    ctx.lineTo(d * L * 0.08 + sw, 0);
    ctx.stroke();
  }
  const colour = f.id % 2 ? "#b5683a" : "#f3ead8";
  ctx.lineWidth = lw(s) * 0.9;
  ctx.strokeStyle = INK;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.ellipse(0, -L * 0.55, L * 0.42, L * 0.3, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Tail feathers.
  ctx.beginPath();
  ctx.moveTo(-L * 0.32, -L * 0.62);
  ctx.lineTo(-L * 0.52, -L * 0.98);
  ctx.lineTo(-L * 0.22, -L * 0.78);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Wing, flapping when she runs.
  ctx.fillStyle = f.id % 2 ? "#9a5530" : "#e2d6bf";
  ctx.beginPath();
  ctx.ellipse(-L * 0.02, -L * 0.6 - flap * L * 0.18, L * 0.22, L * (0.14 + flap * 0.1), -0.3 - flap * 0.6, 0, Math.PI * 2);
  ctx.fill();
  // Head, bobbing down to peck.
  const hx = L * (0.36 + peck * 0.1);
  const hy = -L * (0.92 - peck * 0.55);
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(hx, hy, L * 0.17, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#d4543c";
  ctx.beginPath();
  ctx.arc(hx - L * 0.02, hy - L * 0.17, L * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e7a83a";
  ctx.beginPath();
  ctx.moveTo(hx + L * 0.15, hy - L * 0.03);
  ctx.lineTo(hx + L * 0.3, hy + L * 0.02);
  ctx.lineTo(hx + L * 0.15, hy + L * 0.07);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(hx + L * 0.05, hy - L * 0.03, Math.max(0.7, L * 0.04), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Draw one critter with its feet at (x, y). */
export function drawFolk(ctx: C, f: Folk, x: number, y: number, s: number, t: number): void {
  if (f.kind === "dog") dog(ctx, f, x, y, s, t);
  else if (f.kind === "hen") hen(ctx, f, x, y, s, t);
  else person(ctx, f, x, y, s, t);
}
