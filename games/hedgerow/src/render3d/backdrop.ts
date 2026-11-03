// Plan item 66: a painted sky and horizon behind the 3D field, like the backdrop of a stage set. The camera looks
// down too steeply to ever see a real horizon, so a tall painted card stands just behind the far scenery: the
// act's sky (morning gold to evening rose), a few soft clouds, and rows of hills and hedges that fade into the
// air, with the nearest row in the act's own grass so the card meets the ground without a seam. Unlit and out
// of the fog, one draw call.
import * as THREE from "three";
import type { ActLight } from "./palette";

/** How far behind the field's far edge (row 0) the card stands. The act's far scenery sits in front of it. */
export const BACKDROP_Z = -4.9;
/** The card's height in world units: tall enough that its top is always above the frame. */
export const BACKDROP_H = 9;
/** World height of the painted hills' highest crest: everything on the card above it is sky. */
export const BACKDROP_SKY_Y = (1 - 0.825 + 0.03 * 1.0) * BACKDROP_H - 0.6;

function mix(a: string, b: string, t: number): string {
  return "#" + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
}

/** A row of rolling hills across the card, from `y` (fraction of height, its crest line) down to the bottom. */
function hills(ctx: CanvasRenderingContext2D, w: number, h: number, y: number, amp: number, freq: number, phase: number, fill: string, hedge?: string): void {
  ctx.beginPath();
  ctx.moveTo(0, h);
  const crest = (x: number) =>
    h * (y - amp * (0.55 * Math.sin((x / w) * Math.PI * 2 * freq + phase) + 0.3 * Math.sin((x / w) * Math.PI * 2 * freq * 2.3 + phase * 1.7) + 0.15 * Math.sin((x / w) * Math.PI * 2 * freq * 5.1 + phase * 0.4)));
  for (let x = 0; x <= w; x += 4) ctx.lineTo(x, crest(x));
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (!hedge) return;
  // Hedge lines and the odd tree along the crest: the farmed country rolling away.
  ctx.fillStyle = hedge;
  for (let x = 0; x <= w; x += 3) {
    const cy = crest(x);
    ctx.fillRect(x, cy - 1, 3, 2.2);
  }
  for (let i = 0; i < 26; i++) {
    const x = ((Math.sin(i * 12.9898 + phase) * 43758.5453) % 1 + 1) % 1 * w;
    const r = 3 + (i % 3) * 1.6;
    ctx.beginPath();
    ctx.arc(x, crest(x) - r * 0.7, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // A few field boundaries running down the slope.
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 9; i++) {
    const x = ((Math.sin(i * 78.233 + phase * 3) * 12345.678) % 1 + 1) % 1 * w;
    ctx.fillRect(x, crest(x), 2, h * 0.08);
  }
  ctx.globalAlpha = 1;
}

/** The card's painting for an act's light: pure apart from the canvas it draws into (so it's cheap to test). */
export function paintBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, L: ActLight, night: boolean): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  // Only the card's lower third is ever in frame (the camera looks down), so the sky's whole sweep sits there.
  g.addColorStop(0, L.skyTop);
  g.addColorStop(0.68, L.skyTop);
  g.addColorStop(0.79, mix(L.skyTop, L.skyBottom, 0.55));
  g.addColorStop(0.85, L.skyBottom);
  g.addColorStop(1, L.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // A low sun's glow on the horizon (warm by day, a pale moon's haze at night).
  const sun = ctx.createRadialGradient(w * 0.68, h * 0.8, 0, w * 0.68, h * 0.8, w * 0.35);
  sun.addColorStop(0, night ? "rgba(200,210,255,0.28)" : "rgba(255,236,190,0.55)");
  sun.addColorStop(1, "rgba(255,236,190,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);
  // Soft clouds, flat-bottomed like a poster's.
  ctx.fillStyle = night ? "rgba(150,160,200,0.18)" : "rgba(255,255,255,0.55)";
  for (let i = 0; i < 7; i++) {
    const cx = ((i * 0.618 + 0.11) % 1) * w;
    const cy = h * (0.72 + (i % 3) * 0.035);
    const s = w * (0.022 + (i % 4) * 0.008);
    ctx.beginPath();
    for (let k = 0; k < 4; k++) ctx.arc(cx + (k - 1.5) * s * 0.9, cy - (k % 2) * s * 0.35, s * (0.75 + (k % 2) * 0.3), Math.PI, 0);
    ctx.closePath();
    ctx.fill();
  }
  // The country rolling away: three rows of hills, palest (most air) furthest away, the nearest in the grass.
  const air = night ? L.fog : L.skyBottom;
  hills(ctx, w, h, 0.825, 0.03, 2, 0.6, mix(L.grass[1], air, 0.72));
  hills(ctx, w, h, 0.86, 0.022, 3, 2.1, mix(L.grass[0], air, 0.5), mix(L.grass[1], air, 0.6));
  hills(ctx, w, h, 0.893, 0.015, 4, 4.4, mix(L.grass[1], air, 0.25), mix("#3f6e33", air, 0.35));
}

/** The card itself: a wide plane standing at `BACKDROP_Z`, its foot a little below the ground. */
export function buildBackdrop(cols: number, L: ActLight, night: boolean): THREE.Mesh {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  paintBackdrop(ctx, canvas.width, canvas.height, L, night);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const width = cols + 40;
  const geo = new THREE.PlaneGeometry(width, BACKDROP_H);
  const mat = new THREE.MeshBasicMaterial({ map: tex, fog: false, toneMapped: false, depthWrite: true });
  const mesh = new THREE.Mesh(geo, mat);
  // The foot sits 0.6 below the ground so the hills' base never shows a gap over a dip.
  mesh.position.set(cols / 2, BACKDROP_H / 2 - 0.6, BACKDROP_Z);
  mesh.name = "backdrop";
  mesh.renderOrder = -1;
  return mesh;
}
