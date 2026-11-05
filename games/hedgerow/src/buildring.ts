/**
 * Plan item 156: the build ring. Tapping an empty plot lays its seed packets round it, so a phone builds at the plot
 * instead of scrolling a tray. This is the placement: pure, so it is unit-tested without a page.
 *
 * Packets sit on an arc round the plot's centre. A full circle when it fits; near an edge the arc narrows and turns
 * to face the open side (inward), widening its radius so the packets never touch. No packet may cover the plot.
 */
export type Box = { x: number; y: number; w: number; h: number };
export type Pt = { x: number; y: number };

export type RingLayout = {
  /** Packet centres, in the same space as `bounds`. */
  spots: Pt[];
  radius: number;
  /** The arc's middle direction (radians, screen space: 0 = right, +pi/2 = down). */
  facing: number;
  /** The arc's span (radians); 2pi is a full circle. */
  span: number;
};

const overlaps = (a: Box, b: Box): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * @param at the plot's centre
 * @param half half the plot's drawn size (px)
 * @param n packets
 * @param size a packet's side (px)
 * @param bounds where packets may go (the field, less anything over it)
 * @param gap px between neighbouring packets
 */
export function ringLayout(at: Pt, half: number, n: number, size: number, bounds: Box, gap = 8): RingLayout {
  const margin = 4;
  const inner: Box = { x: bounds.x + margin, y: bounds.y + margin, w: bounds.w - 2 * margin, h: bounds.h - 2 * margin };
  const plot: Box = { x: at.x - half, y: at.y - half, w: half * 2, h: half * 2 };
  // Clear of the plot at any angle: the packet's half-diagonal plus the plot's.
  const clear = (half + size / 2) * Math.SQRT2 + 2;
  const toMid = Math.atan2(inner.y + inner.h / 2 - at.y, inner.x + inner.w / 2 - at.x);
  const arc = (facing: number, span: number, r: number, k: number): Pt[] => {
    if (k <= 0) return [];
    if (k === 1) return [{ x: at.x + Math.cos(facing) * r, y: at.y + Math.sin(facing) * r }];
    const full = span >= Math.PI * 2 - 1e-6;
    const step = full ? span / k : span / (k - 1);
    const start = full ? facing - Math.PI / 2 : facing - span / 2;
    return Array.from({ length: k }, (_, i) => ({ x: at.x + Math.cos(start + i * step) * r, y: at.y + Math.sin(start + i * step) * r }));
  };
  const pitch = size + gap;
  /** One row on radius r, or two: the inner row takes its share by circumference, the outer sits a pitch further. */
  const place = (facing: number, span: number, r: number, rows: number): Pt[] => {
    if (rows === 1) return arc(facing, span, r, n);
    const r2 = r + pitch * 1.05;
    const k = Math.max(1, Math.min(n - 1, Math.round((n * r) / (r + r2))));
    return [...arc(facing, span, r, k), ...arc(facing, span, r2, n - k)];
  };
  const boxOf = (p: Pt): Box => ({ x: p.x - size / 2, y: p.y - size / 2, w: size, h: size });
  const inside = (p: Pt) => {
    const b = boxOf(p);
    return b.x >= inner.x && b.y >= inner.y && b.x + b.w <= inner.x + inner.w && b.y + b.h <= inner.y + inner.h;
  };
  const apart = (spots: Pt[]) => {
    for (let i = 0; i < spots.length; i++)
      for (let j = i + 1; j < spots.length; j++)
        if (Math.abs(spots[i]!.x - spots[j]!.x) < pitch && Math.abs(spots[i]!.y - spots[j]!.y) < pitch) return false;
    return true;
  };
  const spans = [Math.PI * 2, Math.PI * 1.5, Math.PI * 1.2, Math.PI, Math.PI * 0.75, Math.PI * 0.55, Math.PI * 0.42];
  const turns = [0, 0.25, -0.25, 0.5, -0.5, 0.75, -0.75, 1, -1];
  const reach = Math.max(inner.w, inner.h);
  // Of every arc that fits whole, the most compact (smallest outer radius); a wider span breaks a tie.
  let fit: { outer: number; layout: RingLayout } | null = null;
  let best: { score: number; layout: RingLayout } | null = null;
  // One row first: a second row is only for a field too small for one (it reads as a heap, not a ring).
  for (const rows of n >= 5 ? [1, 2] : [1]) {
    if (fit) break;
    for (const span of spans) {
      const full = span >= Math.PI * 2 - 1e-6;
      for (const t of full ? [0] : turns) {
        const facing = full ? -Math.PI / 2 : toMid + t;
        let r = clear;
        while (r < reach && !apart(place(facing, span, r, rows))) r += 3;
        for (let k = 0; k < 10 && r < reach; k++, r += 6) {
          const spots = place(facing, span, r, rows);
          const outer = rows === 1 ? r : r + pitch * 1.05;
          if (fit && outer >= fit.outer - 1e-6) break;
          if (spots.every(inside)) {
            fit = { outer, layout: { spots, radius: r, facing, span } };
            break;
          }
          let out = 0;
          for (const p of spots) {
            const b = boxOf(p);
            out += Math.max(0, inner.x - b.x) + Math.max(0, inner.y - b.y) + Math.max(0, b.x + b.w - inner.x - inner.w) + Math.max(0, b.y + b.h - inner.y - inner.h);
          }
          const score = out + r * 0.01;
          if (!best || score < best.score) best = { score, layout: { spots, radius: r, facing, span } };
        }
      }
    }
  }
  if (fit) return fit.layout;
  // Nothing fits whole (a tiny field): clamp the best try inside, then push any packet off the plot or a neighbour.
  const lay = best!.layout;
  const spots = lay.spots.map((p) => ({
    x: Math.min(inner.x + inner.w - size / 2, Math.max(inner.x + size / 2, p.x)),
    y: Math.min(inner.y + inner.h - size / 2, Math.max(inner.y + size / 2, p.y)),
  }));
  for (const p of spots) {
    if (!overlaps(boxOf(p), plot)) continue;
    // Step it out along the line from the plot's centre, staying inside where it can.
    const a = Math.atan2(p.y - at.y, p.x - at.x) || toMid;
    p.x = at.x + Math.cos(a) * clear;
    p.y = at.y + Math.sin(a) * clear;
  }
  return { ...lay, spots };
}

/** Whether two packets (or a packet and the plot) meet: tests and the page's own check share it. */
export function boxesMeet(a: Box, b: Box): boolean {
  return overlaps(a, b);
}
