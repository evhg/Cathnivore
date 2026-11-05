// Small pictures of towers and enemies for the build menu, wave previews and enemy cards, drawn once by
// the same sprite code as the battlefield and cached as data URLs (the CSP allows data: images).

import type { EnemyKind, TowerKind } from "./engine";
import type { Path } from "./paths";
import type { Property } from "./fleet";
import { TIER_SCALE, drawEnemy, drawPropIcon, drawTower, enemyLift, enemyScale, towerTier } from "./sprites";

const cache = new Map<string, string>();

function render(key: string, size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void): string {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  const dpr = 2;
  c.width = size * dpr;
  c.height = size * dpr;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  ctx.scale(dpr, dpr);
  draw(ctx, size);
  const url = c.toDataURL("image/png");
  cache.set(key, url);
  return url;
}

export function towerIcon(kind: TowerKind, tier = 1, spec: 0 | 1 | null = null, path?: Path): string {
  return render(`t:${kind}:${tier}:${spec}:${path?.join("") ?? ""}`, 64, (ctx, size) => {
    // A higher tier stands taller on its plinth (plan item 19): shrink the cell so it still fits the icon.
    const s = (size * 0.95) / (TIER_SCALE[towerTier({ tier, ...(path ? { path } : {}) }) - 1] ?? 1);
    const look = { kind, tier, spec, fired: 9, dazed: false, still: true, ...(path ? { path } : {}) };
    fitted(ctx, size, size / 2, size * 0.5 + s * 0.3, (c, ox, oy) => drawTower(c, look, ox + size / 2, oy + size * 0.5, s, 0.6));
  });
}

/**
 * Plan item 163: tall towers (the Windmill's sails, the Radio Mast, the Grain Silo) drew past the icon's top edge
 * and lost their heads. The picture is drawn on a sheet with room all round, measured, and shrunk about its
 * ground point (never enlarged) until its solid parts (faint radio rings left out) sit inside the icon.
 */
function fitted(ctx: CanvasRenderingContext2D, size: number, gx: number, gy: number, draw: (c: CanvasRenderingContext2D, ox: number, oy: number) => void): void {
  const dpr = 2;
  const pad = size;
  const sheet = document.createElement("canvas");
  sheet.width = sheet.height = (size + pad * 2) * dpr;
  const sc = sheet.getContext("2d", { willReadFrequently: true });
  if (!sc) {
    draw(ctx, 0, 0);
    return;
  }
  sc.scale(dpr, dpr);
  draw(sc, pad, pad);
  const W = sheet.width;
  const px = sc.getImageData(0, 0, W, W).data;
  let x0 = W, y0 = W, x1 = -1, y1 = -1;
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++)
      if (px[(y * W + x) * 4 + 3]! > 150) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return;
  // Sheet px -> icon units, relative to the ground point.
  const top = y0 / dpr - pad - gy;
  const left = x0 / dpr - pad - gx;
  const right = (x1 + 1) / dpr - pad - gx;
  const bottom = (y1 + 1) / dpr - pad - gy;
  const room = { top: gy - size * 0.02, left: gx - size * 0.03, right: size * 0.97 - gx, bottom: size * 0.99 - gy };
  const k = Math.min(1, room.top / Math.max(1e-6, -top), room.left / Math.max(1e-6, -left), room.right / Math.max(1e-6, right), bottom > 0 ? room.bottom / bottom : 1);
  ctx.save();
  ctx.translate(gx, gy);
  ctx.scale(k, k);
  ctx.drawImage(sheet, -(pad + gx), -(pad + gy), size + pad * 2, size + pad * 2);
  ctx.restore();
}

export function enemyIcon(kind: EnemyKind): string {
  return render(`e:${kind}`, 64, (ctx, size) => {
    const k = enemyScale(kind);
    const s = (size * 1.1) / Math.max(1, k * 1.1);
    const lift = enemyLift(kind) * s;
    drawEnemy(ctx, { kind, facing: 1, hit: 9, ghost: false, phase: 0 }, size / 2, size * 0.78 + lift * 0.4, s, 0);
  });
}

export function img(src: string, cls: string): HTMLImageElement {
  const el = document.createElement("img");
  el.src = src;
  el.alt = "";
  el.className = cls;
  el.setAttribute("aria-hidden", "true");
  return el;
}

/** A Fleet property's icon (Hedgerow 2 section 2), as on the field, for chips, badges and the Almanac. */
export function propIcon(prop: Property): string {
  return render(`p:${prop}`, 32, (ctx, size) => drawPropIcon(ctx, prop, size / 2, size / 2, size - 2));
}
