// Small pictures of towers and enemies for the build menu, wave previews and enemy cards, drawn once by
// the same sprite code as the battlefield and cached as data URLs (the CSP allows data: images).

import type { EnemyKind, TowerKind } from "./engine";
import { drawEnemy, drawTower, enemyLift, enemyScale } from "./sprites";

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

export function towerIcon(kind: TowerKind, tier = 1, spec: 0 | 1 | null = null): string {
  return render(`t:${kind}:${tier}:${spec}`, 64, (ctx, size) => {
    const s = size * 0.95;
    drawTower(ctx, { kind, tier, spec, fired: 9, dazed: false }, size / 2, size * 0.5, s, 0.6);
  });
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
