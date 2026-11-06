// Plan item 202: each act's 2D margins are a place, not the same patchwork everywhere. The ground past the field's
// hedge gets the act's own land (Saltmarsh: marsh cut by creeks, salt pans, a boardwalk, beach huts and gulls), and
// its pieces are placed by a seeded placer that never puts two identical pieces within 200 px of each other.
// Acts without a set yet keep item 120's patchwork of neighbours' fields (theme.ts).

export type MarginPiece = "saltpan" | "hut" | "gulls" | "post";

export interface MarginSet {
  name: string;
  /** The pieces and their weights; sizes are in cells (w, h). */
  pieces: Array<{ kind: MarginPiece; weight: number; w: number; h: number }>;
  /** Pieces per square cell of margin (before the spacing rules thin them). */
  density: number;
  /** A boardwalk down each side margin. */
  boardwalk: boolean;
}

/** By act index (0 = Brindle Hills). Saltmarsh first; the rest follow in later slices. */
export const MARGIN_SETS: Partial<Record<number, MarginSet>> = {
  2: {
    name: "saltmarsh",
    pieces: [
      { kind: "saltpan", weight: 5, w: 1.35, h: 0.95 },
      { kind: "hut", weight: 3, w: 0.62, h: 0.95 },
      { kind: "gulls", weight: 2, w: 0.9, h: 0.45 },
      { kind: "post", weight: 2, w: 0.3, h: 0.7 },
    ],
    density: 0.32,
    boardwalk: true,
  },
};

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Placed {
  kind: MarginPiece;
  /** Centre, CSS px. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** No two identical pieces closer than this (centre to centre, CSS px). */
export const SAME_GAP = 200;

/** Seeded random in [0, 1) (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Places a set's pieces in the margin rects: wholly inside a rect, clear of `keepOut` (the boardwalks), not
 * overlapping each other, and never two of a kind within `SAME_GAP` px. Pure and seeded: the same input always
 * gives the same placement.
 */
export function placeMargin(set: MarginSet, rects: Rect[], cell: number, seed: number, keepOut: Rect[] = []): Placed[] {
  const rand = seeded(seed);
  const area = rects.reduce((a, r) => a + r.w * r.h, 0) / (cell * cell);
  const want = Math.round(area * set.density);
  const total = set.pieces.reduce((a, p) => a + p.weight, 0);
  const out: Placed[] = [];
  const hit = (a: Rect, b: Rect, pad: number) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
  for (let tries = 0; out.length < want && tries < want * 40 + 40; tries++) {
    let pick = rand() * total;
    let spec = set.pieces[0]!;
    for (const p of set.pieces) {
      pick -= p.weight;
      if (pick <= 0) {
        spec = p;
        break;
      }
    }
    const k = 0.85 + rand() * 0.3;
    const w = spec.w * cell * k;
    const h = spec.h * cell * k;
    // Pick a rect by area, then a spot wholly inside it.
    let ra = rand() * area * cell * cell;
    let r = rects[0];
    for (const c of rects) {
      ra -= c.w * c.h;
      if (ra <= 0) {
        r = c;
        break;
      }
    }
    if (!r || r.w < w || r.h < h) continue;
    const box = { x: r.x + rand() * (r.w - w), y: r.y + rand() * (r.h - h), w, h };
    if (keepOut.some((o) => hit(box, o, cell * 0.08))) continue;
    if (out.some((o) => hit(box, { x: o.x - o.w / 2, y: o.y - o.h / 2, w: o.w, h: o.h }, cell * 0.15))) continue;
    const cx = box.x + w / 2;
    const cy = box.y + h / 2;
    if (out.some((o) => o.kind === spec.kind && Math.hypot(o.x - cx, o.y - cy) < SAME_GAP)) continue;
    out.push({ kind: spec.kind, x: cx, y: cy, w, h });
  }
  return out;
}

/** What the last painted 2D field put in its margins (`window.hedgerow.margin2d()`). */
export let lastMargin: { act: number; set: string; pieces: Placed[] } | null = null;
export function recordMargin(m: typeof lastMargin): void {
  lastMargin = m;
}

const HUTS: ReadonlyArray<readonly [string, string]> = [
  ["#d9534f", "#f6f1e4"],
  ["#5b8fd1", "#f6f1e4"],
  ["#e9c46a", "#f6f1e4"],
  ["#7fb59a", "#f6f1e4"],
];

/** The marsh ground in a margin rect: muted sea-green, with tidal creeks meandering across it. */
export function paintMarsh(ctx: CanvasRenderingContext2D, r: Rect, s: number, rand: () => number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  ctx.fillStyle = "rgba(112,140,104,0.42)";
  ctx.fillRect(r.x, r.y, r.w, r.h);
  // Samphire and sea lavender speckle.
  for (let i = 0; i < (r.w * r.h) / (s * s) * 14; i++) {
    ctx.fillStyle = rand() > 0.75 ? "rgba(170,140,200,0.45)" : "rgba(78,112,70,0.4)";
    ctx.beginPath();
    ctx.arc(r.x + rand() * r.w, r.y + rand() * r.h, s * (0.02 + rand() * 0.03), 0, Math.PI * 2);
    ctx.fill();
  }
  // Creeks: wandering channels from the top of the rect to its bottom, mud-banked.
  const n = Math.max(1, Math.round(r.w / (s * 2.6)));
  for (let c = 0; c < n; c++) {
    let x = r.x + ((c + 0.3 + rand() * 0.4) / n) * r.w;
    const pts: Array<[number, number]> = [];
    for (let y = r.y - s; y <= r.y + r.h + s; y += s * 0.45) {
      x += (rand() - 0.5) * s * 0.55;
      x = Math.max(r.x, Math.min(r.x + r.w, x));
      pts.push([x, y]);
    }
    for (const [width, color] of [
      [0.2, "rgba(122,100,72,0.55)"],
      [0.11, "#86b6c4"],
      [0.03, "rgba(235,246,246,0.7)"],
    ] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, s * width);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** A boardwalk down a margin: weathered planks on posts. */
export function paintBoardwalk(ctx: CanvasRenderingContext2D, r: Rect, s: number): void {
  ctx.save();
  ctx.fillStyle = "rgba(40,50,40,0.25)";
  ctx.fillRect(r.x + s * 0.06, r.y, r.w, r.h);
  ctx.fillStyle = "#b8956a";
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = "rgba(90,64,40,0.6)";
  ctx.lineWidth = Math.max(1, s * 0.02);
  for (let y = r.y; y < r.y + r.h; y += s * 0.16) {
    ctx.beginPath();
    ctx.moveTo(r.x, y);
    ctx.lineTo(r.x + r.w, y);
    ctx.stroke();
  }
  ctx.fillStyle = "#6e5236";
  for (let y = r.y + s * 0.4; y < r.y + r.h; y += s * 1.3) {
    ctx.fillRect(r.x - s * 0.05, y, s * 0.08, s * 0.12);
    ctx.fillRect(r.x + r.w - s * 0.03, y, s * 0.08, s * 0.12);
  }
  ctx.restore();
}

export function paintPiece(ctx: CanvasRenderingContext2D, p: Placed, s: number, rand: () => number): void {
  const x0 = p.x - p.w / 2;
  const y0 = p.y - p.h / 2;
  ctx.save();
  switch (p.kind) {
    case "saltpan": {
      // A shallow rectangular pan, crusted white at the rim, pink where the brine is strongest.
      ctx.fillStyle = "rgba(40,50,40,0.22)";
      ctx.beginPath();
      ctx.roundRect(x0 + s * 0.05, y0 + s * 0.06, p.w, p.h, s * 0.12);
      ctx.fill();
      ctx.fillStyle = "#efeee6";
      ctx.beginPath();
      ctx.roundRect(x0, y0, p.w, p.h, s * 0.12);
      ctx.fill();
      const g = ctx.createLinearGradient(x0, y0, x0 + p.w, y0 + p.h);
      g.addColorStop(0, "#a9d0d8");
      g.addColorStop(1, rand() > 0.5 ? "#e6b9c4" : "#c4dfe3");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(x0 + s * 0.09, y0 + s * 0.09, p.w - s * 0.18, p.h - s * 0.18, s * 0.08);
      ctx.fill();
      // Raked salt in rows, and a divider wall.
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = Math.max(1, s * 0.025);
      for (let y = y0 + s * 0.22; y < y0 + p.h - s * 0.15; y += s * 0.14) {
        ctx.beginPath();
        ctx.moveTo(x0 + s * 0.16, y);
        ctx.lineTo(x0 + p.w * 0.45, y);
        ctx.stroke();
      }
      ctx.fillStyle = "#efeee6";
      ctx.fillRect(x0 + p.w * 0.5 - s * 0.03, y0, s * 0.06, p.h);
      // A salt heap at one end.
      ctx.fillStyle = "#fbfaf4";
      ctx.beginPath();
      ctx.moveTo(x0 + p.w * 0.62, y0 + p.h * 0.72);
      ctx.quadraticCurveTo(x0 + p.w * 0.72, y0 + p.h * 0.2, x0 + p.w * 0.84, y0 + p.h * 0.72);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "hut": {
      const [c, light] = HUTS[Math.floor(rand() * HUTS.length)]!;
      const bh = p.h * 0.66;
      const by = y0 + p.h - bh;
      ctx.fillStyle = "rgba(30,40,30,0.25)";
      ctx.beginPath();
      ctx.ellipse(p.x + s * 0.06, y0 + p.h, p.w * 0.6, s * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      // Striped planks.
      const stripes = 5;
      for (let i = 0; i < stripes; i++) {
        ctx.fillStyle = i % 2 ? light : c;
        ctx.fillRect(x0 + (p.w / stripes) * i, by, p.w / stripes + 0.5, bh);
      }
      ctx.fillStyle = "#4a3a2c";
      ctx.fillRect(p.x - p.w * 0.16, by + bh * 0.35, p.w * 0.32, bh * 0.65);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(x0 - s * 0.06, by + s * 0.02);
      ctx.lineTo(p.x, y0);
      ctx.lineTo(x0 + p.w + s * 0.06, by + s * 0.02);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(40,30,20,0.6)";
      ctx.lineWidth = Math.max(1, s * 0.025);
      ctx.stroke();
      break;
    }
    case "gulls": {
      ctx.strokeStyle = "#f7f6f0";
      ctx.lineWidth = Math.max(1.2, s * 0.045);
      ctx.lineCap = "round";
      const n = 2 + Math.floor(rand() * 2);
      for (let i = 0; i < n; i++) {
        const gx = x0 + (p.w * (i + 0.5)) / n + (rand() - 0.5) * s * 0.1;
        const gy = y0 + p.h * (0.3 + rand() * 0.5);
        const r = s * (0.1 + rand() * 0.05);
        // A grey shadow under each, then the wings.
        ctx.strokeStyle = "rgba(40,60,60,0.35)";
        ctx.beginPath();
        ctx.moveTo(gx - r, gy + s * 0.18);
        ctx.quadraticCurveTo(gx - r / 2, gy - r * 0.5 + s * 0.18, gx, gy + s * 0.18);
        ctx.quadraticCurveTo(gx + r / 2, gy - r * 0.5 + s * 0.18, gx + r, gy + s * 0.18);
        ctx.stroke();
        ctx.strokeStyle = "#f7f6f0";
        ctx.beginPath();
        ctx.moveTo(gx - r, gy);
        ctx.quadraticCurveTo(gx - r / 2, gy - r * 0.6, gx, gy);
        ctx.quadraticCurveTo(gx + r / 2, gy - r * 0.6, gx + r, gy);
        ctx.stroke();
      }
      break;
    }
    case "post": {
      // A mooring post, a coil of rope and a lobster pot.
      ctx.fillStyle = "rgba(30,40,30,0.25)";
      ctx.beginPath();
      ctx.ellipse(p.x + s * 0.05, y0 + p.h, p.w * 0.6, s * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#6e5236";
      ctx.fillRect(p.x - p.w * 0.22, y0, p.w * 0.44, p.h);
      ctx.fillStyle = "#8a6a48";
      ctx.fillRect(p.x - p.w * 0.22, y0, p.w * 0.14, p.h);
      ctx.strokeStyle = "#d8c08a";
      ctx.lineWidth = Math.max(1, s * 0.03);
      ctx.beginPath();
      ctx.ellipse(p.x, y0 + p.h * 0.35, p.w * 0.32, s * 0.05, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}
