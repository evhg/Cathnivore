// Plan item 95: Cath's advice for the round, said in a speech bubble beside her on the field before Go. Pure: where
// the bubble goes. It stays within reach of her (so it reads as hers), never over the round's threat queued at the
// gate (the leads and their count plate) or her own figure, and as little over the lane's tiles, then the plots, as
// it can. (Her post is beside the lane and the lanes are packed: often no spot near her is clear of every tile.)

import type { Box } from "./intro";

export type BarkSide = "top" | "bottom" | "left" | "right";

export interface BarkSpot extends Box {
  /** Which of the bubble's edges faces Cath, so its tail points at her. */
  side: BarkSide;
  /** Where along that edge the tail sits, in px from the box's left (top/bottom) or top (left/right). */
  tail: number;
}

const overlap = (a: Box, b: Box): number => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};

const area = (box: Box, list: readonly Box[]): number => {
  let a = 0;
  for (const b of list) a += overlap(box, b);
  return a;
};

/** The distance from a point to a box's nearest point (0 inside it). */
export function reachOf(box: Box, p: { x: number; y: number }): number {
  const dx = Math.max(box.x - p.x, 0, p.x - (box.x + box.w));
  const dy = Math.max(box.y - p.y, 0, p.y - (box.y + box.h));
  return Math.hypot(dx, dy);
}

/**
 * The bubble's box. `cath` is her figure on screen (feet to head); `lanes` the lane cells' boxes; `plots` the plots';
 * `avoid` other overlays (the gate queue's plate, Cath's tip bubble). Every box shares the field's coordinates.
 * The bubble's nearest point stays within `reach` px of her figure's centre; a spot clear of the overlays beats any
 * spot on them, then clear of her figure, then the fewest lane pixels, then the fewest plot pixels, then the nearest
 * to above her.
 */
export function barkSpot(
  cath: Box,
  size: { w: number; h: number },
  field: { w: number; h: number },
  lanes: readonly Box[],
  plots: readonly Box[] = [],
  avoid: readonly Box[] = [],
  reach = 116,
  margin = 6,
): BarkSpot {
  const c = { x: cath.x + cath.w / 2, y: cath.y + cath.h / 2 };
  // Above her head, centred: the spot a comic would pick.
  const ideal = { x: c.x - size.w / 2, y: cath.y - 10 - size.h };
  const step = 6;
  let best: { x: number; y: number; cost: number } | null = null;
  const x0 = Math.max(margin, Math.floor(c.x - reach - size.w));
  const x1 = Math.min(field.w - margin - size.w, Math.ceil(c.x + reach));
  const y0 = Math.max(margin, Math.floor(c.y - reach - size.h));
  const y1 = Math.min(field.h - margin - size.h, Math.ceil(c.y + reach));
  for (let y = y0; y <= y1; y += step)
    for (let x = x0; x <= x1; x += step) {
      const box = { x, y, w: size.w, h: size.h };
      if (reachOf(box, c) > reach) continue;
      const cost =
        area(box, avoid) * 1e11 + overlap(box, cath) * 1e9 + area(box, lanes) * 1e5 + area(box, plots) * 4 + Math.hypot(x - ideal.x, y - ideal.y);
      if (!best || cost < best.cost) best = { x, y, cost };
    }
  // A field too small to search (or Cath off it): above her, clamped into the field.
  const at = best ?? {
    x: Math.min(Math.max(margin, ideal.x), Math.max(margin, field.w - margin - size.w)),
    y: Math.min(Math.max(margin, ideal.y), Math.max(margin, field.h - margin - size.h)),
  };
  const box = { x: at.x, y: at.y, w: size.w, h: size.h };
  // The tail goes on the edge that faces her: the larger gap decides between a vertical and a horizontal edge.
  const gapY = c.y > box.y + box.h ? c.y - (box.y + box.h) : box.y > c.y ? box.y - c.y : 0;
  const gapX = c.x > box.x + box.w ? c.x - (box.x + box.w) : box.x > c.x ? box.x - c.x : 0;
  const clampT = (v: number, len: number) => Math.round(Math.min(len - 14, Math.max(14, v)));
  let side: BarkSide;
  if (gapY >= gapX) side = c.y >= box.y + box.h / 2 ? "bottom" : "top";
  else side = c.x >= box.x + box.w / 2 ? "right" : "left";
  const tail = side === "top" || side === "bottom" ? clampT(c.x - box.x, box.w) : clampT(c.y - box.y, box.h);
  return { ...box, side, tail };
}
