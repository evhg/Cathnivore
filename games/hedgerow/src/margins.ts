// Plan item 202: each act's 2D margins are a place, not the same patchwork everywhere. The ground past the field's
// hedge gets the act's own land (Saltmarsh: marsh cut by creeks, salt pans, a boardwalk, beach huts and gulls), and
// its pieces are placed by a seeded placer that never puts two identical pieces within 200 px of each other.
// Acts without a set yet keep item 120's patchwork of neighbours' fields (theme.ts).

export type MarginPiece = "saltpan" | "hut" | "gulls" | "post" | "mill" | "punt" | "tor" | "cairn" | "flock" | "willow" | "heather";

/** Pieces drawn by theme.ts's shared decor painter (base point at the piece's foot). */
export const DECOR_PIECES: ReadonlySet<MarginPiece> = new Set<MarginPiece>(["willow", "heather"]);

export interface MarginSet {
  name: string;
  /** The pieces and their weights; sizes are in cells (w, h). */
  pieces: Array<{ kind: MarginPiece; weight: number; w: number; h: number }>;
  /** Pieces per square cell of margin (before the spacing rules thin them). */
  density: number;
  /** A boardwalk down each side margin. */
  boardwalk: boolean;
  /** The land the pieces stand on. */
  ground: "marsh" | "meadow" | "moor";
  /** Pieces on the act's water margin (the river or the sea), if it has one. */
  water?: Array<{ kind: MarginPiece; weight: number; w: number; h: number }>;
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
    ground: "marsh",
  },
  // Rivermead: water meadows by the river, a watermill on its race, pollarded willows, punts moored on the river.
  3: {
    name: "rivermead",
    pieces: [
      { kind: "mill", weight: 2, w: 1.5, h: 1.3 },
      { kind: "willow", weight: 5, w: 0.9, h: 1.1 },
      { kind: "flock", weight: 2, w: 1.1, h: 0.5 },
    ],
    density: 0.3,
    boardwalk: false,
    ground: "meadow",
    water: [{ kind: "punt", weight: 1, w: 1.1, h: 0.36 }],
  },
  // Highmoor: open moor of heather and bracken, granite tors, cairns and a grazing flock behind dry-stone walls.
  1: {
    name: "highmoor",
    pieces: [
      { kind: "tor", weight: 3, w: 1.5, h: 1.1 },
      { kind: "heather", weight: 5, w: 0.7, h: 0.5 },
      { kind: "cairn", weight: 2, w: 0.5, h: 0.65 },
      { kind: "flock", weight: 3, w: 1.1, h: 0.5 },
    ],
    density: 0.3,
    boardwalk: false,
    ground: "moor",
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
export function placeMargin(set: MarginSet, rects: Rect[], cell: number, seed: number, keepOut: Rect[] = [], pieces = set.pieces): Placed[] {
  const rand = seeded(seed);
  const area = rects.reduce((a, r) => a + r.w * r.h, 0) / (cell * cell);
  const want = Math.round(area * set.density);
  const total = pieces.reduce((a, p) => a + p.weight, 0);
  const out: Placed[] = [];
  const hit = (a: Rect, b: Rect, pad: number) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
  for (let tries = 0; out.length < want && tries < want * 40 + 40; tries++) {
    let pick = rand() * total;
    let spec = pieces[0]!;
    for (const p of pieces) {
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

/** A water meadow: lush grass in strips, cut by a mill race; or a moor: heather, bracken and dry-stone walls. */
export function paintGround(ctx: CanvasRenderingContext2D, ground: MarginSet["ground"], r: Rect, s: number, rand: () => number): void {
  if (ground === "marsh") return paintMarsh(ctx, r, s, rand);
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  if (ground === "meadow") {
    ctx.fillStyle = "rgba(96,150,70,0.3)";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    // Buttercups and lady's smock in the long grass.
    for (let i = 0; i < (r.w * r.h) / (s * s) * 16; i++) {
      ctx.fillStyle = rand() > 0.6 ? "rgba(245,214,80,0.75)" : rand() > 0.5 ? "rgba(236,214,236,0.7)" : "rgba(60,110,50,0.35)";
      ctx.beginPath();
      ctx.arc(r.x + rand() * r.w, r.y + rand() * r.h, s * (0.02 + rand() * 0.025), 0, Math.PI * 2);
      ctx.fill();
    }
    // A mill race: one wide, slow stream down the margin.
    let x = r.x + r.w * (0.35 + rand() * 0.3);
    const pts: Array<[number, number]> = [];
    for (let y = r.y - s; y <= r.y + r.h + s; y += s * 0.6) {
      x += (rand() - 0.5) * s * 0.35;
      x = Math.max(r.x + s * 0.3, Math.min(r.x + r.w - s * 0.3, x));
      pts.push([x, y]);
    }
    for (const [width, color] of [
      [0.32, "rgba(70,100,50,0.45)"],
      [0.22, "#7fb3cc"],
      [0.04, "rgba(235,246,246,0.6)"],
    ] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, s * width);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.stroke();
    }
  } else {
    // Moor: heather-brown ground, purple and bracken-gold patches, grey dry-stone walls across it.
    ctx.fillStyle = "rgba(122,98,82,0.36)";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    for (let i = 0; i < (r.w * r.h) / (s * s) * 3; i++) {
      const x = r.x + rand() * r.w;
      const y = r.y + rand() * r.h;
      const rr = s * (0.3 + rand() * 0.6);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
      g.addColorStop(0, rand() > 0.5 ? "rgba(150,96,170,0.4)" : "rgba(196,150,70,0.35)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    ctx.strokeStyle = "rgba(150,146,136,0.85)";
    ctx.lineWidth = Math.max(1.5, s * 0.07);
    ctx.setLineDash([s * 0.09, s * 0.04]);
    for (let y = r.y + s * (1.5 + rand()); y < r.y + r.h; y += s * (2.6 + rand() * 1.6)) {
      ctx.beginPath();
      ctx.moveTo(r.x, y);
      ctx.quadraticCurveTo(r.x + r.w / 2, y + (rand() - 0.5) * s, r.x + r.w, y + (rand() - 0.5) * s * 0.6);
      ctx.stroke();
    }
    ctx.setLineDash([]);
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
      g.addColorStop(0, "#7db8c9");
      g.addColorStop(1, rand() > 0.5 ? "#d996aa" : "#9cc9d6");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(x0 + s * 0.09, y0 + s * 0.09, p.w - s * 0.18, p.h - s * 0.18, s * 0.08);
      ctx.fill();
      // Raked salt in rows, and a divider wall.
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
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
    case "mill": {
      // A stone watermill with a slate roof and its wheel on the near side.
      const bh = p.h * 0.6;
      const by = y0 + p.h - bh;
      ctx.fillStyle = "rgba(30,40,30,0.25)";
      ctx.beginPath();
      ctx.ellipse(p.x + s * 0.08, y0 + p.h, p.w * 0.55, s * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#d8cbb0";
      ctx.fillRect(x0 + p.w * 0.12, by, p.w * 0.66, bh);
      ctx.fillStyle = "rgba(120,100,80,0.35)";
      for (let k = 0; k < 6; k++) ctx.fillRect(x0 + p.w * (0.15 + rand() * 0.55), by + bh * (0.1 + rand() * 0.8), s * 0.12, s * 0.05);
      ctx.fillStyle = "#56606a";
      ctx.beginPath();
      ctx.moveTo(x0 + p.w * 0.06, by + s * 0.02);
      ctx.lineTo(x0 + p.w * 0.45, y0 + p.h * 0.12);
      ctx.lineTo(x0 + p.w * 0.84, by + s * 0.02);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#3e3226";
      ctx.fillRect(x0 + p.w * 0.36, by + bh * 0.45, p.w * 0.14, bh * 0.55);
      ctx.fillStyle = "#f2d98a";
      ctx.fillRect(x0 + p.w * 0.2, by + bh * 0.25, p.w * 0.09, bh * 0.18);
      // The wheel.
      const wx = x0 + p.w * 0.84;
      const wy = by + bh * 0.55;
      const wr = p.h * 0.3;
      ctx.strokeStyle = "#6e5236";
      ctx.lineWidth = Math.max(1.5, s * 0.05);
      ctx.beginPath();
      ctx.arc(wx, wy, wr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, s * 0.03);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.lineTo(wx + Math.cos(a) * wr, wy + Math.sin(a) * wr);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(220,240,246,0.7)";
      ctx.beginPath();
      ctx.ellipse(wx, wy + wr, wr * 0.9, s * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "punt": {
      ctx.fillStyle = "rgba(20,40,60,0.3)";
      ctx.beginPath();
      ctx.ellipse(p.x + s * 0.04, p.y + p.h * 0.35, p.w * 0.52, p.h * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#8a5a36";
      ctx.beginPath();
      ctx.roundRect(x0, y0, p.w, p.h, p.h * 0.3);
      ctx.fill();
      ctx.fillStyle = "#c9a06c";
      ctx.fillRect(x0 + p.w * 0.08, y0 + p.h * 0.22, p.w * 0.84, p.h * 0.56);
      ctx.strokeStyle = "#5a3a22";
      ctx.lineWidth = Math.max(1, s * 0.03);
      ctx.beginPath();
      ctx.moveTo(x0 - p.w * 0.1, y0 - p.h * 0.6);
      ctx.lineTo(x0 + p.w * 1.05, y0 + p.h * 1.4);
      ctx.stroke();
      break;
    }
    case "tor": {
      // A granite tor: stacked weathered slabs.
      ctx.fillStyle = "rgba(30,30,30,0.25)";
      ctx.beginPath();
      ctx.ellipse(p.x + s * 0.08, y0 + p.h, p.w * 0.55, s * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      const rows = 3;
      for (let i = 0; i < rows; i++) {
        const rw = p.w * (0.95 - i * 0.22) * (0.9 + rand() * 0.2);
        const rh = (p.h / rows) * 0.95;
        const ry = y0 + p.h - (i + 1) * rh;
        const rx = p.x - rw / 2 + (rand() - 0.5) * s * 0.15;
        ctx.fillStyle = i % 2 ? "#9a968c" : "#aaa69c";
        ctx.beginPath();
        ctx.roundRect(rx, ry, rw, rh, rh * 0.35);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.fillRect(rx + rh * 0.3, ry + rh * 0.12, rw - rh * 0.6, rh * 0.18);
        ctx.fillStyle = "rgba(60,60,50,0.25)";
        ctx.fillRect(rx + rh * 0.3, ry + rh * 0.78, rw - rh * 0.6, rh * 0.14);
      }
      break;
    }
    case "cairn": {
      for (let i = 0; i < 4; i++) {
        const rw = p.w * (0.9 - i * 0.18);
        const rh = (p.h / 4) * 0.95;
        ctx.fillStyle = i % 2 ? "#8c887e" : "#a4a096";
        ctx.beginPath();
        ctx.ellipse(p.x + (rand() - 0.5) * s * 0.04, y0 + p.h - (i + 0.5) * rh, rw / 2, rh / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "flock": {
      // Three or four sheep grazing together, heads down.
      const n = 3 + Math.floor(rand() * 2);
      for (let i = 0; i < n; i++) {
        const sx = x0 + (p.w * (i + 0.5)) / n + (rand() - 0.5) * s * 0.12;
        const sy = y0 + p.h * (0.4 + rand() * 0.4);
        const r = s * 0.11;
        ctx.fillStyle = "rgba(30,40,20,0.22)";
        ctx.beginPath();
        ctx.ellipse(sx + s * 0.02, sy + r * 0.9, r * 1.2, r * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f4f1e6";
        ctx.beginPath();
        ctx.ellipse(sx, sy, r * 1.15, r * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#3a3430";
        const dir = rand() > 0.5 ? 1 : -1;
        ctx.beginPath();
        ctx.ellipse(sx + dir * r * 1.1, sy + r * 0.25, r * 0.38, r * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
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
