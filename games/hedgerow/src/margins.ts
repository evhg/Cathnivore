// Plan item 202: each act's 2D margins are a place, not the same patchwork everywhere. The ground past the field's
// hedge gets the act's own land (Saltmarsh: marsh cut by creeks, salt pans, a boardwalk, beach huts and gulls), and
// its pieces are placed by a seeded placer that never puts two identical pieces within 200 px of each other.
// Acts without a set yet keep item 120's patchwork of neighbours' fields (theme.ts).

export type MarginPiece =
  | "saltpan"
  | "hut"
  | "gulls"
  | "post"
  | "mill"
  | "punt"
  | "tor"
  | "cairn"
  | "flock"
  | "willow"
  | "heather"
  | "oak"
  | "deadtree"
  | "stall"
  | "tower"
  | "boat"
  | "logpile"
  | "kiln"
  | "deer"
  | "nets"
  | "pots"
  | "fissure"
  | "barrier"
  | "digger"
  | "marquee"
  | "hustings"
  | "crane"
  | "cars"
  | "cabin"
  | "lanterns"
  | "cart"
  | "billboard";

/** Pieces drawn by theme.ts's shared decor painter (base point at the piece's foot). */
export const DECOR_PIECES: ReadonlySet<MarginPiece> = new Set<MarginPiece>(["willow", "heather", "oak", "deadtree", "stall", "tower", "boat", "billboard"]);

/** Pieces with an ambient loop (`drawMarginLife`). */
export const LIVE_PIECES: ReadonlySet<MarginPiece> = new Set<MarginPiece>(["gulls", "mill", "kiln", "fissure", "marquee", "crane", "lanterns"]);

export interface MarginSet {
  name: string;
  /** The pieces and their weights; sizes are in cells (w, h). */
  pieces: Array<{ kind: MarginPiece; weight: number; w: number; h: number }>;
  /** Pieces per square cell of margin (before the spacing rules thin them). */
  density: number;
  /** A boardwalk down each side margin. */
  boardwalk: boolean;
  /** The land the pieces stand on. */
  ground: "marsh" | "meadow" | "moor" | "wood" | "shingle" | "scorch" | "green" | "tarmac" | "cobbles";
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
  // Oakvale: old woodland, bluebells under the oaks, a woodsman's log pile, a charcoal clamp smoking, deer.
  4: {
    name: "oakvale",
    pieces: [
      { kind: "oak", weight: 6, w: 0.95, h: 1.15 },
      { kind: "logpile", weight: 2, w: 0.9, h: 0.5 },
      { kind: "kiln", weight: 2, w: 0.8, h: 0.9 },
      { kind: "deer", weight: 2, w: 0.9, h: 0.6 },
    ],
    density: 0.32,
    boardwalk: false,
    ground: "wood",
  },
  // Shingle Bay: a pebble beach in bands, beach huts, boats hauled up, nets on poles, lobster pots, gulls.
  5: {
    name: "shingle-bay",
    pieces: [
      { kind: "hut", weight: 3, w: 0.62, h: 0.95 },
      { kind: "boat", weight: 3, w: 1.0, h: 0.85 },
      { kind: "nets", weight: 2, w: 1.0, h: 0.7 },
      { kind: "pots", weight: 2, w: 0.6, h: 0.45 },
      { kind: "gulls", weight: 2, w: 0.9, h: 0.45 },
    ],
    density: 0.3,
    boardwalk: false,
    ground: "shingle",
  },
  // The Rift: scorched, cracked ground, glowing fissures, dead trees, roadworks barriers and an abandoned digger.
  6: {
    name: "the-rift",
    pieces: [
      { kind: "fissure", weight: 4, w: 1.3, h: 0.6 },
      { kind: "deadtree", weight: 4, w: 0.8, h: 1.0 },
      { kind: "barrier", weight: 2, w: 1.0, h: 0.5 },
      { kind: "digger", weight: 2, w: 1.3, h: 0.9 },
    ],
    density: 0.3,
    boardwalk: false,
    ground: "scorch",
  },
  // The Ballot: a village green on polling day: bunting, a striped marquee, the hustings stage, stalls, oaks.
  7: {
    name: "the-ballot",
    pieces: [
      { kind: "marquee", weight: 3, w: 1.2, h: 0.95 },
      { kind: "hustings", weight: 2, w: 1.2, h: 0.85 },
      { kind: "stall", weight: 3, w: 1.0, h: 0.85 },
      { kind: "oak", weight: 3, w: 0.95, h: 1.15 },
      // Plan item 224: Hollowell's adverts along the roads in.
      { kind: "billboard", weight: 3, w: 2.3, h: 1.15 },
    ],
    density: 0.3,
    boardwalk: false,
    ground: "green",
  },
  // The Merger: the farmland's gone to a business park: car parks, glass blocks, a tower crane, site cabins.
  8: {
    name: "the-merger",
    pieces: [
      { kind: "tower", weight: 4, w: 0.85, h: 1.35 },
      { kind: "crane", weight: 2, w: 1.3, h: 1.4 },
      { kind: "cars", weight: 3, w: 1.1, h: 0.45 },
      { kind: "cabin", weight: 2, w: 0.9, h: 0.6 },
      { kind: "billboard", weight: 3, w: 2.3, h: 1.15 },
    ],
    density: 0.3,
    boardwalk: false,
    ground: "tarmac",
  },
  // Kingsmarket: a cobbled night market: stalls under strung lanterns, barrows of produce.
  9: {
    name: "kingsmarket",
    pieces: [
      { kind: "stall", weight: 5, w: 1.0, h: 0.85 },
      { kind: "lanterns", weight: 3, w: 1.3, h: 0.5 },
      { kind: "cart", weight: 3, w: 0.8, h: 0.55 },
      { kind: "oak", weight: 1, w: 0.95, h: 1.15 },
    ],
    density: 0.32,
    boardwalk: false,
    ground: "cobbles",
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
  if (ground !== "meadow" && ground !== "moor") return paintLand(ctx, ground, r, s, rand);
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

const dot = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
};

/** The later acts' land: woodland floor, a shingle beach, scorched earth, a village green, tarmac, cobbles. */
function paintLand(ctx: CanvasRenderingContext2D, ground: MarginSet["ground"], r: Rect, s: number, rand: () => number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  const n = (r.w * r.h) / (s * s);
  if (ground === "wood") {
    // Dappled woodland floor: leaf litter, drifts of bluebells, pools of sun.
    ctx.fillStyle = "rgba(70,90,44,0.42)";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    for (let i = 0; i < n * 1.6; i++) {
      const x = r.x + rand() * r.w;
      const y = r.y + rand() * r.h;
      const rr = s * (0.25 + rand() * 0.35);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
      g.addColorStop(0, rand() > 0.45 ? "rgba(112,104,200,0.26)" : "rgba(250,236,170,0.18)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    for (let i = 0; i < n * 18; i++) dot(ctx, r.x + rand() * r.w, r.y + rand() * r.h, s * (0.015 + rand() * 0.02), rand() > 0.5 ? "rgba(120,110,210,0.7)" : rand() > 0.5 ? "rgba(150,100,50,0.45)" : "rgba(40,70,30,0.35)");
  } else if (ground === "shingle") {
    // Shingle in bands parallel to the sea: sand, grey pebbles, a wrack line of weed.
    ctx.fillStyle = "rgba(214,200,170,0.55)";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    for (let y = r.y + s * rand(); y < r.y + r.h; y += s * (0.9 + rand() * 0.8)) {
      ctx.fillStyle = "rgba(150,146,136,0.28)";
      ctx.fillRect(r.x, y, r.w, s * (0.25 + rand() * 0.3));
      ctx.strokeStyle = "rgba(90,96,60,0.45)";
      ctx.lineWidth = Math.max(1, s * 0.03);
      ctx.beginPath();
      for (let x = r.x; x <= r.x + r.w; x += s * 0.2) ctx.lineTo(x, y + (rand() - 0.5) * s * 0.08);
      ctx.stroke();
    }
    for (let i = 0; i < n * 30; i++) {
      const c = ["rgba(168,164,156,0.8)", "rgba(206,200,188,0.85)", "rgba(120,118,112,0.7)", "rgba(196,170,140,0.75)"][Math.floor(rand() * 4)]!;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(r.x + rand() * r.w, r.y + rand() * r.h, s * (0.025 + rand() * 0.03), s * (0.018 + rand() * 0.02), rand() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (ground === "scorch") {
    // Dry, scorched earth, cracked into plates.
    ctx.fillStyle = "rgba(120,84,58,0.42)";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    for (let i = 0; i < n * 1.2; i++) {
      const x = r.x + rand() * r.w;
      const y = r.y + rand() * r.h;
      const rr = s * (0.3 + rand() * 0.6);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
      g.addColorStop(0, "rgba(50,34,28,0.18)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    ctx.strokeStyle = "rgba(60,38,26,0.5)";
    ctx.lineWidth = Math.max(1, s * 0.022);
    for (let i = 0; i < n * 2.2; i++) {
      let x = r.x + rand() * r.w;
      let y = r.y + rand() * r.h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 3; k++) {
        x += (rand() - 0.5) * s * 0.7;
        y += (rand() - 0.5) * s * 0.7;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else if (ground === "green") {
    // A mown village green in stripes, with bunting strung across it.
    ctx.fillStyle = "rgba(120,176,84,0.3)";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = "rgba(255,255,230,0.09)";
    for (let x = r.x; x < r.x + r.w; x += s * 0.9) ctx.fillRect(x, r.y, s * 0.45, r.h);
    for (let y = r.y + s * (1 + rand()); y < r.y + r.h; y += s * (3 + rand() * 1.5)) {
      const sag = s * 0.25;
      ctx.strokeStyle = "rgba(70,60,50,0.55)";
      ctx.lineWidth = Math.max(1, s * 0.015);
      ctx.beginPath();
      ctx.moveTo(r.x, y);
      ctx.quadraticCurveTo(r.x + r.w / 2, y + sag * 2, r.x + r.w, y);
      ctx.stroke();
      const flags = ["#d9534f", "#f6f1e4", "#5b8fd1"];
      for (let k = 0, x = r.x + s * 0.12; x < r.x + r.w; x += s * 0.24, k++) {
        const t = (x - r.x) / r.w;
        const fy = y + 4 * sag * t * (1 - t);
        ctx.fillStyle = flags[k % 3]!;
        ctx.beginPath();
        ctx.moveTo(x - s * 0.06, fy);
        ctx.lineTo(x + s * 0.06, fy);
        ctx.lineTo(x, fy + s * 0.14);
        ctx.closePath();
        ctx.fill();
      }
    }
  } else if (ground === "tarmac") {
    // Grey tarmac car park: painted bays, kerbed islands with a shrub.
    ctx.fillStyle = "rgba(96,100,104,0.55)";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = "rgba(240,240,232,0.6)";
    ctx.lineWidth = Math.max(1, s * 0.025);
    for (let y = r.y + s * 0.6; y < r.y + r.h; y += s * 1.6) {
      for (let x = r.x + s * 0.2; x < r.x + r.w - s * 0.2; x += s * 0.4) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + s * 0.55);
        ctx.stroke();
      }
    }
    for (let i = 0; i < n * 6; i++) dot(ctx, r.x + rand() * r.w, r.y + rand() * r.h, s * (0.02 + rand() * 0.04), "rgba(40,44,48,0.25)");
  } else {
    // Cobbles at dusk, worn smooth, with a lantern's warmth pooled here and there.
    ctx.fillStyle = "rgba(92,72,70,0.5)";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    const c = s * 0.16;
    for (let y = r.y, row = 0; y < r.y + r.h; y += c * 0.8, row++)
      for (let x = r.x - (row % 2) * c * 0.5; x < r.x + r.w; x += c) {
        ctx.fillStyle = rand() > 0.5 ? "rgba(150,128,116,0.45)" : "rgba(120,100,96,0.45)";
        ctx.beginPath();
        ctx.ellipse(x + c / 2, y + c * 0.4, c * 0.42, c * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    for (let i = 0; i < n * 0.8; i++) {
      const x = r.x + rand() * r.w;
      const y = r.y + rand() * r.h;
      const rr = s * (0.6 + rand() * 0.6);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
      g.addColorStop(0, "rgba(255,190,110,0.28)");
      g.addColorStop(1, "rgba(255,190,110,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
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

/** A fissure's zig-zag, the same every call for the same piece. */
function fissurePoints(p: Placed): Array<[number, number]> {
  const r = seeded(Math.round(p.x * 13 + p.y * 7));
  const out: Array<[number, number]> = [];
  for (let i = 0; i <= 6; i++) out.push([p.x - p.w / 2 + (p.w * i) / 6, p.y + (i === 0 || i === 6 ? 0 : (r() - 0.5) * p.h * 0.8)]);
  return out;
}

const LANTERN_COLOURS = ["#ffb04a", "#e8748b", "#f2c94c", "#ff8a5c"];
/** Where a lantern string's lanterns hang, and their paper colours. */
function lanternSpots(p: Placed): Array<[number, number, string]> {
  const x0 = p.x - p.w / 2;
  const y0 = p.y - p.h / 2;
  const out: Array<[number, number, string]> = [];
  for (let i = 1; i <= 4; i++) {
    const t = i / 5;
    out.push([x0 + p.w * t, y0 + 4 * (p.h * 0.33) * t * (1 - t) + p.h * 0.18, LANTERN_COLOURS[i % 4]!]);
  }
  return out;
}

/** The crane's jib and counter-jib across the mast's head. */
function drawJib(ctx: CanvasRenderingContext2D, p: Placed, s: number): void {
  const mx = p.x - p.w * 0.1;
  const top = p.y - p.h / 2 + p.h * 0.12;
  ctx.fillStyle = "#e0a82e";
  ctx.fillRect(mx - p.w * 0.3, top - s * 0.06, p.w * 0.88, s * 0.07);
  ctx.fillStyle = "#6b6f75";
  ctx.fillRect(mx - p.w * 0.32, top - s * 0.02, s * 0.16, s * 0.12);
  ctx.fillStyle = "#c48e1e";
  ctx.fillRect(mx - s * 0.06, top - s * 0.16, s * 0.12, s * 0.12);
}

export function paintPiece(ctx: CanvasRenderingContext2D, p: Placed, s: number, rand: () => number): void {
  const x0 = p.x - p.w / 2;
  const y0 = p.y - p.h / 2;
  ctx.save();
  switch (p.kind) {
    case "saltpan": {
      // Plan item 224: a pan dug into the marsh, not a framed panel (the white rim, divider and heap read as an
      // image icon from across the field). A low mud bank of uneven sides, brine pink where it's strongest with a
      // few ripples and a crust at its edge, small salt heaps on the bank and a rake leaning on one.
      const j = () => (rand() - 0.5) * s * 0.07;
      const pan = (inset: number) => {
        const l = x0 + inset, r = x0 + p.w - inset, t = y0 + inset * 0.8, btm = y0 + p.h - inset * 0.8;
        ctx.beginPath();
        ctx.moveTo(l + s * 0.06 + j(), t + j());
        ctx.lineTo(r - s * 0.04 + j(), t + s * 0.02 + j());
        ctx.quadraticCurveTo(r + j(), (t + btm) / 2, r - s * 0.03 + j(), btm + j());
        ctx.lineTo(l + s * 0.03 + j(), btm - s * 0.02 + j());
        ctx.quadraticCurveTo(l + j(), (t + btm) / 2, l + s * 0.06 + j(), t + j());
        ctx.closePath();
      };
      // The bank: trodden mud, darker at its outer foot.
      ctx.fillStyle = "#9c8f74";
      pan(0);
      ctx.fill();
      ctx.strokeStyle = "rgba(60,50,35,0.45)";
      ctx.lineWidth = Math.max(1, s * 0.025);
      ctx.stroke();
      // The brine, sunk below the bank (a shadow along its top edge).
      const g = ctx.createLinearGradient(x0, y0, x0 + p.w, y0 + p.h);
      g.addColorStop(0, "#86b9c4");
      g.addColorStop(1, rand() > 0.5 ? "#d89aa8" : "#a9cdd3");
      ctx.fillStyle = g;
      pan(s * 0.1);
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = "rgba(40,45,40,0.22)";
      ctx.fillRect(x0, y0, p.w, s * 0.16);
      // Ripples.
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = Math.max(1, s * 0.018);
      for (let k = 0; k < 3; k++) {
        const ry = y0 + p.h * (0.35 + k * 0.17);
        const rx = x0 + p.w * (0.2 + rand() * 0.35);
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.quadraticCurveTo(rx + p.w * 0.1, ry - s * 0.04, rx + p.w * 0.2, ry);
        ctx.stroke();
      }
      ctx.restore();
      // The salt crust where the brine meets the bank.
      ctx.strokeStyle = "rgba(250,248,240,0.8)";
      ctx.lineWidth = Math.max(1, s * 0.03);
      ctx.setLineDash([s * 0.08, s * 0.05]);
      pan(s * 0.11);
      ctx.stroke();
      ctx.setLineDash([]);
      // Salt heaps along the bank's top, raked up out of the pan, and the rake.
      const heaps = 2 + Math.floor(rand() * 2);
      for (let k = 0; k < heaps; k++) {
        const hx = x0 + p.w * (0.22 + k * 0.24) + j();
        const hy = y0 + s * 0.06;
        const hw = s * (0.09 + rand() * 0.04);
        ctx.fillStyle = "rgba(40,40,30,0.25)";
        ctx.beginPath();
        ctx.ellipse(hx + hw * 0.3, hy + s * 0.01, hw, hw * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fbfaf4";
        ctx.beginPath();
        ctx.moveTo(hx - hw, hy);
        ctx.quadraticCurveTo(hx, hy - hw * 1.5, hx + hw, hy);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(120,110,90,0.5)";
        ctx.lineWidth = Math.max(1, s * 0.015);
        ctx.stroke();
      }
      ctx.strokeStyle = "#6e5236";
      ctx.lineWidth = Math.max(1.2, s * 0.03);
      ctx.beginPath();
      ctx.moveTo(x0 + p.w * 0.86, y0 + p.h * 0.1);
      ctx.lineTo(x0 + p.w * 0.66, y0 + p.h * 0.62);
      ctx.moveTo(x0 + p.w * 0.6, y0 + p.h * 0.58);
      ctx.lineTo(x0 + p.w * 0.72, y0 + p.h * 0.66);
      ctx.stroke();
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
    case "logpile": {
      // Felled trunks stacked, cut ends to us.
      ctx.fillStyle = "rgba(30,40,20,0.28)";
      ctx.beginPath();
      ctx.ellipse(p.x + s * 0.05, y0 + p.h, p.w * 0.55, s * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      const lr = p.h * 0.24;
      const rows = [4, 3, 2];
      rows.forEach((count, row) => {
        for (let i = 0; i < count; i++) {
          const lx = p.x + (i - (count - 1) / 2) * lr * 2;
          const ly = y0 + p.h - lr - row * lr * 1.7;
          dot(ctx, lx, ly, lr, "#7a5634");
          dot(ctx, lx, ly, lr * 0.78, "#d9b480");
          ctx.strokeStyle = "rgba(122,86,52,0.6)";
          ctx.lineWidth = Math.max(1, s * 0.012);
          ctx.beginPath();
          ctx.arc(lx, ly, lr * 0.42, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
      break;
    }
    case "kiln": {
      // A charcoal burner's clamp: an earth-covered mound, a vent, a sack beside it.
      ctx.fillStyle = "rgba(30,40,20,0.28)";
      ctx.beginPath();
      ctx.ellipse(p.x + s * 0.05, y0 + p.h, p.w * 0.55, s * 0.09, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#5a4a3a";
      ctx.beginPath();
      ctx.ellipse(p.x, y0 + p.h - p.h * 0.25, p.w * 0.45, p.h * 0.32, 0, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.beginPath();
      ctx.ellipse(p.x - p.w * 0.12, y0 + p.h - p.h * 0.42, p.w * 0.18, p.h * 0.08, -0.3, 0, Math.PI * 2);
      ctx.fill();
      dot(ctx, p.x, y0 + p.h - p.h * 0.55, s * 0.05, "#2a2420");
      ctx.fillStyle = "#c8ac7a";
      ctx.beginPath();
      ctx.roundRect(p.x + p.w * 0.3, y0 + p.h - p.h * 0.28, p.w * 0.2, p.h * 0.28, s * 0.03);
      ctx.fill();
      break;
    }
    case "deer": {
      // A doe and her fawn, heads up.
      for (const [dx, k] of [
        [-0.2, 1],
        [0.28, 0.7],
      ] as const) {
        const cx = p.x + dx * p.w;
        const by = y0 + p.h * 0.62;
        const bw = p.w * 0.26 * k;
        ctx.fillStyle = "rgba(30,40,20,0.25)";
        ctx.beginPath();
        ctx.ellipse(cx, y0 + p.h, bw * 1.1, s * 0.05, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#6e4a2c";
        ctx.lineWidth = Math.max(1, s * 0.03 * k);
        ctx.beginPath();
        for (const lx of [-0.7, -0.4, 0.45, 0.75]) {
          ctx.moveTo(cx + lx * bw, by);
          ctx.lineTo(cx + lx * bw, y0 + p.h);
        }
        ctx.stroke();
        ctx.fillStyle = "#a8703e";
        ctx.beginPath();
        ctx.ellipse(cx, by, bw, bw * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx + bw * 0.7, by - bw * 0.1);
        ctx.lineTo(cx + bw * 1.05, by - bw * 0.95);
        ctx.lineTo(cx + bw * 1.3, by - bw * 0.85);
        ctx.lineTo(cx + bw * 0.95, by + bw * 0.1);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + bw * 1.25, by - bw * 0.95, bw * 0.3, bw * 0.18, 0.3, 0, Math.PI * 2);
        ctx.fill();
        dot(ctx, cx - bw * 0.95, by - bw * 0.1, bw * 0.16, "#f4ead8");
      }
      break;
    }
    case "nets": {
      // Fishing nets hung to dry between two poles, a float or two caught in them.
      const top = y0 + p.h * 0.1;
      const bot = y0 + p.h;
      ctx.fillStyle = "rgba(40,40,30,0.22)";
      ctx.fillRect(x0, bot - s * 0.04, p.w, s * 0.06);
      ctx.fillStyle = "#6e5236";
      ctx.fillRect(x0, top, s * 0.05, bot - top);
      ctx.fillRect(x0 + p.w - s * 0.05, top, s * 0.05, bot - top);
      ctx.strokeStyle = "rgba(60,80,90,0.75)";
      ctx.lineWidth = Math.max(0.8, s * 0.012);
      ctx.beginPath();
      const nx0 = x0 + s * 0.05;
      const nx1 = x0 + p.w - s * 0.05;
      ctx.moveTo(nx0, top + s * 0.03);
      ctx.quadraticCurveTo((nx0 + nx1) / 2, top + p.h * 0.25, nx1, top + s * 0.03);
      for (let x = nx0; x <= nx1; x += s * 0.08) {
        const t = (x - nx0) / (nx1 - nx0);
        ctx.moveTo(x, top + s * 0.03 + 4 * p.h * 0.11 * t * (1 - t));
        ctx.lineTo(x + s * 0.03, top + p.h * 0.62);
      }
      for (let y = top + p.h * 0.2; y < top + p.h * 0.62; y += s * 0.08) {
        ctx.moveTo(nx0, y);
        ctx.lineTo(nx1, y + s * 0.02);
      }
      ctx.stroke();
      dot(ctx, x0 + p.w * 0.35, top + p.h * 0.4, s * 0.04, "#e8743c");
      dot(ctx, x0 + p.w * 0.66, top + p.h * 0.48, s * 0.04, "#e8743c");
      break;
    }
    case "pots": {
      // Lobster pots stacked: netted domes on slatted bases, a coil of orange rope.
      const pw = p.w * 0.42;
      const ph = p.h * 0.48;
      for (const [dx, dy] of [
        [-0.22, 0],
        [0.24, 0],
        [0.01, -1],
      ] as const) {
        const px = p.x + dx * p.w - pw / 2;
        const py = y0 + p.h - ph + dy * ph * 0.9;
        ctx.fillStyle = "#6e5236";
        ctx.fillRect(px, py + ph * 0.7, pw, ph * 0.3);
        ctx.fillStyle = "rgba(60,90,100,0.85)";
        ctx.beginPath();
        ctx.ellipse(px + pw / 2, py + ph * 0.7, pw / 2, ph * 0.7, 0, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = "rgba(230,236,230,0.55)";
        ctx.lineWidth = Math.max(0.8, s * 0.012);
        ctx.beginPath();
        for (let k = 1; k < 4; k++) {
          ctx.moveTo(px + (pw * k) / 4, py + ph * 0.7);
          ctx.lineTo(px + pw / 2, py + ph * 0.05);
        }
        ctx.stroke();
      }
      ctx.strokeStyle = "#e8743c";
      ctx.lineWidth = Math.max(1, s * 0.025);
      ctx.beginPath();
      ctx.ellipse(x0 + p.w * 0.94, y0 + p.h * 0.92, p.w * 0.1, s * 0.04, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "fissure": {
      // A crack in the ground, its depths glowing ember-orange (the glow breathes in drawMarginLife).
      const pts = fissurePoints(p);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const [wd, color] of [
        [0.13, "rgba(40,24,20,0.5)"],
        [0.07, "#2a1612"],
        [0.025, "#ff8a3c"],
      ] as const) {
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, s * wd);
        ctx.beginPath();
        pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
        ctx.stroke();
      }
      break;
    }
    case "barrier": {
      // Red-and-white roadworks barriers on feet, a cone at each end.
      const by = y0 + p.h * 0.4;
      const bh = p.h * 0.22;
      ctx.fillStyle = "rgba(30,20,20,0.25)";
      ctx.fillRect(x0, y0 + p.h - s * 0.04, p.w, s * 0.06);
      ctx.fillStyle = "#3a3a3a";
      ctx.fillRect(x0 + p.w * 0.2, by, s * 0.035, y0 + p.h - by);
      ctx.fillRect(x0 + p.w * 0.78, by, s * 0.035, y0 + p.h - by);
      const stripes = 7;
      for (let i = 0; i < stripes; i++) {
        ctx.fillStyle = i % 2 ? "#f6f1e4" : "#c4433a";
        ctx.fillRect(x0 + p.w * 0.12 + ((p.w * 0.76) / stripes) * i, by, (p.w * 0.76) / stripes + 0.5, bh);
      }
      for (const cx of [x0 + p.w * 0.05, x0 + p.w * 0.95]) {
        ctx.fillStyle = "#f08a3c";
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.08, y0 + p.h);
        ctx.lineTo(cx, y0 + p.h - s * 0.24);
        ctx.lineTo(cx + s * 0.08, y0 + p.h);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillRect(cx - s * 0.04, y0 + p.h - s * 0.12, s * 0.08, s * 0.035);
      }
      break;
    }
    case "digger": {
      // An abandoned yellow excavator, its arm down in a trench.
      const gy = y0 + p.h;
      ctx.fillStyle = "rgba(30,20,20,0.28)";
      ctx.beginPath();
      ctx.ellipse(p.x, gy, p.w * 0.5, s * 0.09, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3a3a3a";
      ctx.beginPath();
      ctx.roundRect(x0 + p.w * 0.05, gy - p.h * 0.2, p.w * 0.55, p.h * 0.2, p.h * 0.1);
      ctx.fill();
      ctx.fillStyle = "#e0a82e";
      ctx.fillRect(x0 + p.w * 0.08, gy - p.h * 0.45, p.w * 0.5, p.h * 0.26);
      ctx.fillRect(x0 + p.w * 0.12, gy - p.h * 0.72, p.w * 0.24, p.h * 0.28);
      ctx.fillStyle = "rgba(200,226,236,0.85)";
      ctx.fillRect(x0 + p.w * 0.15, gy - p.h * 0.68, p.w * 0.18, p.h * 0.16);
      ctx.strokeStyle = "#c48e1e";
      ctx.lineWidth = Math.max(2, s * 0.07);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x0 + p.w * 0.5, gy - p.h * 0.42);
      ctx.lineTo(x0 + p.w * 0.78, gy - p.h * 0.92);
      ctx.lineTo(x0 + p.w * 0.95, gy - p.h * 0.25);
      ctx.stroke();
      ctx.fillStyle = "#5a4a3a";
      ctx.beginPath();
      ctx.moveTo(x0 + p.w * 0.88, gy - p.h * 0.28);
      ctx.lineTo(x0 + p.w, gy - p.h * 0.28);
      ctx.lineTo(x0 + p.w * 0.96, gy - p.h * 0.08);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "marquee": {
      // A striped marquee with its flap tied back (its pennant flutters in drawMarginLife).
      const gy = y0 + p.h;
      const eave = y0 + p.h * 0.45;
      ctx.fillStyle = "rgba(30,40,20,0.25)";
      ctx.beginPath();
      ctx.ellipse(p.x + s * 0.06, gy, p.w * 0.55, s * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      const stripes = 6;
      for (let i = 0; i < stripes; i++) {
        ctx.fillStyle = i % 2 ? "#f6f1e4" : "#d9534f";
        ctx.fillRect(x0 + (p.w / stripes) * i, eave, p.w / stripes + 0.5, gy - eave);
      }
      ctx.fillStyle = "#4a3a2c";
      ctx.beginPath();
      ctx.moveTo(p.x - p.w * 0.12, gy);
      ctx.lineTo(p.x, eave + (gy - eave) * 0.25);
      ctx.lineTo(p.x + p.w * 0.12, gy);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#f6f1e4";
      ctx.beginPath();
      ctx.moveTo(x0 - s * 0.05, eave);
      ctx.lineTo(p.x, y0 + p.h * 0.18);
      ctx.lineTo(x0 + p.w + s * 0.05, eave);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(60,40,30,0.55)";
      ctx.lineWidth = Math.max(1, s * 0.02);
      ctx.stroke();
      ctx.fillStyle = "#d9534f";
      for (let i = 0; i < 6; i++) {
        const sx = x0 + (p.w / 6) * i;
        ctx.beginPath();
        ctx.arc(sx + p.w / 12, eave, p.w / 12, 0, Math.PI);
        ctx.fill();
      }
      ctx.strokeStyle = "#4a3a2c";
      ctx.beginPath();
      ctx.moveTo(p.x, y0 + p.h * 0.18);
      ctx.lineTo(p.x, y0);
      ctx.stroke();
      break;
    }
    case "hustings": {
      // The hustings: a plank stage, a lectern, a VOTE banner and a few folding chairs.
      const gy = y0 + p.h;
      const deck = y0 + p.h * 0.55;
      ctx.fillStyle = "rgba(30,40,20,0.25)";
      ctx.fillRect(x0 + s * 0.05, gy - s * 0.02, p.w, s * 0.07);
      ctx.fillStyle = "#8a6a48";
      ctx.fillRect(x0, deck, p.w, p.h * 0.18);
      ctx.fillStyle = "#6e5236";
      ctx.fillRect(x0, deck + p.h * 0.18, p.w, gy - deck - p.h * 0.18);
      ctx.fillStyle = "#1f3a6a";
      ctx.fillRect(x0 + p.w * 0.08, y0, p.w * 0.84, p.h * 0.3);
      ctx.fillStyle = "#f6f1e4";
      ctx.font = `700 ${Math.max(6, Math.round(p.h * 0.18))}px 'Hedgerow UI', system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("VOTE", p.x, y0 + p.h * 0.16);
      ctx.fillStyle = "#4a3a2c";
      ctx.fillRect(p.x - p.w * 0.06, deck - p.h * 0.2, p.w * 0.12, p.h * 0.2);
      ctx.fillStyle = "#d9534f";
      ctx.fillRect(p.x - p.w * 0.08, deck - p.h * 0.24, p.w * 0.16, p.h * 0.05);
      break;
    }
    case "crane": {
      // A tower crane: a lattice mast and its counterweight (the jib slews in drawMarginLife).
      const gy = y0 + p.h;
      const mx = p.x - p.w * 0.1;
      ctx.fillStyle = "rgba(30,30,40,0.25)";
      ctx.fillRect(mx - s * 0.2, gy - s * 0.03, s * 0.4, s * 0.08);
      ctx.fillStyle = "#6b6f75";
      ctx.fillRect(mx - s * 0.16, gy - s * 0.1, s * 0.32, s * 0.1);
      ctx.strokeStyle = "#e0a82e";
      ctx.lineWidth = Math.max(1, s * 0.025);
      const mw = s * 0.09;
      ctx.beginPath();
      ctx.moveTo(mx - mw, gy - s * 0.1);
      ctx.lineTo(mx - mw, y0 + p.h * 0.12);
      ctx.moveTo(mx + mw, gy - s * 0.1);
      ctx.lineTo(mx + mw, y0 + p.h * 0.12);
      for (let y = gy - s * 0.1, k = 0; y > y0 + p.h * 0.16; y -= mw * 2, k++) {
        ctx.moveTo(mx - mw, y);
        ctx.lineTo(mx + mw, y - mw * 2);
      }
      ctx.stroke();
      drawJib(ctx, p, s);
      break;
    }
    case "cars": {
      // A row of parked cars nose-in, in company silver and one red one.
      const n = 3;
      const cw = p.w / n;
      for (let i = 0; i < n; i++) {
        const cx = x0 + cw * i + cw * 0.1;
        const c = i === 1 && rand() > 0.5 ? "#c4433a" : ["#c8ccd2", "#8fa3b4", "#3e4650"][Math.floor(rand() * 3)]!;
        ctx.fillStyle = "rgba(20,20,30,0.3)";
        ctx.fillRect(cx + s * 0.03, y0 + s * 0.04, cw * 0.8, p.h);
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.roundRect(cx, y0, cw * 0.8, p.h, cw * 0.2);
        ctx.fill();
        ctx.fillStyle = "rgba(40,60,80,0.75)";
        ctx.fillRect(cx + cw * 0.12, y0 + p.h * 0.2, cw * 0.56, p.h * 0.18);
        ctx.fillRect(cx + cw * 0.12, y0 + p.h * 0.66, cw * 0.56, p.h * 0.14);
      }
      break;
    }
    case "cabin": {
      // Stacked site cabins, the steel-blue of the Hollowell contractor, with a small window lit.
      const gy = y0 + p.h;
      ctx.fillStyle = "rgba(20,20,30,0.28)";
      ctx.fillRect(x0 + s * 0.06, gy - s * 0.02, p.w, s * 0.07);
      for (const [dy, off] of [
        [0, 0],
        [1, 0.12],
      ] as const) {
        const ch = p.h * 0.46;
        const cy = gy - ch * (dy + 1);
        const cx = x0 + p.w * off;
        ctx.fillStyle = dy ? "#5b7f9e" : "#4a6c8a";
        ctx.fillRect(cx, cy, p.w * 0.86, ch);
        ctx.fillStyle = "rgba(0,0,0,0.15)";
        for (let x = cx + s * 0.06; x < cx + p.w * 0.86; x += s * 0.1) ctx.fillRect(x, cy, s * 0.015, ch);
        ctx.fillStyle = dy ? "#ffe9a8" : "rgba(200,226,236,0.8)";
        ctx.fillRect(cx + p.w * 0.12, cy + ch * 0.25, p.w * 0.2, ch * 0.35);
      }
      break;
    }
    case "lanterns": {
      // Paper lanterns strung between two poles (they glow and flicker in drawMarginLife).
      ctx.fillStyle = "#3a2a22";
      ctx.fillRect(x0, y0, s * 0.04, p.h);
      ctx.fillRect(x0 + p.w - s * 0.04, y0, s * 0.04, p.h);
      ctx.strokeStyle = "rgba(40,30,30,0.7)";
      ctx.lineWidth = Math.max(0.8, s * 0.015);
      ctx.beginPath();
      ctx.moveTo(x0, y0 + s * 0.04);
      ctx.quadraticCurveTo(p.x, y0 + p.h * 0.7, x0 + p.w, y0 + s * 0.04);
      ctx.stroke();
      for (const [lx, ly, c] of lanternSpots(p)) {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.ellipse(lx, ly, s * 0.09, s * 0.115, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "cart": {
      // A costermonger's barrow piled with apples and greens.
      const gy = y0 + p.h;
      ctx.fillStyle = "rgba(30,20,20,0.3)";
      ctx.beginPath();
      ctx.ellipse(p.x, gy, p.w * 0.5, s * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#4a3a2c";
      ctx.lineWidth = Math.max(1, s * 0.03);
      ctx.beginPath();
      ctx.moveTo(x0 + p.w * 0.8, gy - p.h * 0.45);
      ctx.lineTo(x0 + p.w, gy - p.h * 0.2);
      ctx.stroke();
      ctx.fillStyle = "#8a5a36";
      ctx.fillRect(x0, gy - p.h * 0.6, p.w * 0.82, p.h * 0.3);
      for (let i = 0; i < 9; i++)
        dot(ctx, x0 + p.w * (0.08 + (i % 5) * 0.16), gy - p.h * (0.62 + Math.floor(i / 5) * 0.12), p.h * 0.1, ["#c4433a", "#e0a82e", "#6a9a3a"][i % 3]!);
      for (const wx of [x0 + p.w * 0.2, x0 + p.w * 0.62]) {
        dot(ctx, wx, gy - p.h * 0.18, p.h * 0.18, "#4a3a2c");
        dot(ctx, wx, gy - p.h * 0.18, p.h * 0.07, "#a88a5a");
      }
      break;
    }
  }
  ctx.restore();
}

/**
 * Plan item 202: the margins' ambient loops, drawn each frame over the painted field: a gull wheels over each
 * flock of gulls, the mill's wheel turns, a charcoal clamp smokes, a fissure's embers breathe, a marquee's pennant
 * flutters, a crane's hook runs along its jib, and the market's lanterns flicker. Not drawn under reduced motion (the painted margin stays as is).
 */
export function drawMarginLife(ctx: CanvasRenderingContext2D, pieces: readonly Placed[], s: number, t: number): void {
  pieces.forEach((p, i) => {
    if (p.kind === "gulls") {
      const a = t * 0.7 + i * 1.9;
      const gx = p.x + Math.cos(a) * s * 0.7;
      const gy = p.y - s * 0.35 + Math.sin(a) * s * 0.28;
      const r = s * 0.13;
      const flap = Math.sin(t * 6 + i) * 0.35;
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(1.2, s * 0.045);
      ctx.strokeStyle = "rgba(40,60,60,0.3)";
      ctx.beginPath();
      ctx.moveTo(gx - r, gy + s * 0.5);
      ctx.lineTo(gx, gy + s * 0.5 + r * 0.2);
      ctx.lineTo(gx + r, gy + s * 0.5);
      ctx.stroke();
      ctx.strokeStyle = "#fbfaf4";
      ctx.beginPath();
      ctx.moveTo(gx - r, gy - r * flap);
      ctx.quadraticCurveTo(gx - r / 2, gy - r * (0.5 + flap), gx, gy);
      ctx.quadraticCurveTo(gx + r / 2, gy - r * (0.5 + flap), gx + r, gy - r * flap);
      ctx.stroke();
    } else if (p.kind === "kiln") {
      // Smoke curls up from the clamp's vent and drifts off.
      const vx = p.x;
      const vy = p.y + p.h / 2 - p.h * 0.55;
      for (let k = 0; k < 4; k++) {
        const ph = (t * 0.35 + k / 4 + i * 0.3) % 1;
        ctx.fillStyle = `rgba(220,220,214,${(0.45 * (1 - ph)).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(vx + Math.sin(ph * 5 + i) * s * 0.12 + ph * s * 0.3, vy - ph * s * 1.1, s * (0.06 + ph * 0.14), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (p.kind === "fissure") {
      // The ember glow in the crack breathes.
      const pts = fissurePoints(p);
      const a = 0.25 + 0.25 * Math.sin(t * 1.6 + i * 1.3);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = `rgba(255,150,70,${a.toFixed(3)})`;
      ctx.lineWidth = Math.max(1.5, s * 0.09);
      ctx.beginPath();
      pts.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.stroke();
    } else if (p.kind === "marquee") {
      // A pennant flutters on the marquee's pole.
      const px = p.x;
      const py = p.y - p.h / 2;
      const f = Math.sin(t * 5 + i) * s * 0.04;
      ctx.fillStyle = "#5b8fd1";
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + s * 0.14, py + s * 0.02 + f, px + s * 0.28, py + s * 0.05 + f * 1.6);
      ctx.lineTo(px, py + s * 0.12);
      ctx.closePath();
      ctx.fill();
    } else if (p.kind === "crane") {
      // The trolley runs out along the jib and back, its hook on a cable.
      const mx = p.x - p.w * 0.1;
      const top = p.y - p.h / 2 + p.h * 0.12;
      const reach = mx + s * 0.1 + (0.5 + 0.5 * Math.sin(t * 0.4 + i)) * (p.w * 0.58 - s * 0.2);
      const drop = s * (0.35 + 0.15 * Math.sin(t * 0.3 + i));
      ctx.fillStyle = "#3a3a3a";
      ctx.fillRect(reach - s * 0.05, top + s * 0.01, s * 0.1, s * 0.05);
      ctx.strokeStyle = "rgba(40,40,40,0.8)";
      ctx.lineWidth = Math.max(0.8, s * 0.012);
      ctx.beginPath();
      ctx.moveTo(reach, top + s * 0.06);
      ctx.lineTo(reach, top + drop);
      ctx.stroke();
      ctx.fillStyle = "#c4433a";
      ctx.fillRect(reach - s * 0.04, top + drop, s * 0.08, s * 0.06);
    } else if (p.kind === "lanterns") {
      // Each lantern's warm halo flickers on its own.
      for (const [k, [lx, ly]] of lanternSpots(p).entries()) {
        const a = 0.42 + 0.14 * Math.sin(t * 7.3 + k * 2.1 + i) * Math.sin(t * 3.1 + k);
        const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, s * 0.4);
        g.addColorStop(0, `rgba(255,200,120,${a.toFixed(3)})`);
        g.addColorStop(1, "rgba(255,200,120,0)");
        ctx.fillStyle = g;
        ctx.fillRect(lx - s * 0.4, ly - s * 0.4, s * 0.8, s * 0.8);
      }
    } else if (p.kind === "mill") {
      // Matches paintPiece's wheel: the turning spokes over the painted ones.
      const y0 = p.y - p.h / 2;
      const wx = p.x - p.w / 2 + p.w * 0.84;
      const wy = y0 + p.h * 0.4 + p.h * 0.6 * 0.55;
      const wr = p.h * 0.3;
      ctx.fillStyle = "#6f9fb5";
      ctx.beginPath();
      ctx.arc(wx, wy, wr * 0.92, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#6e5236";
      ctx.lineWidth = Math.max(1, s * 0.035);
      for (let k = 0; k < 8; k++) {
        const ang = (k / 8) * Math.PI * 2 + t * 0.9;
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.lineTo(wx + Math.cos(ang) * wr, wy + Math.sin(ang) * wr);
        ctx.stroke();
        ctx.fillStyle = "#8a6a48";
        ctx.fillRect(wx + Math.cos(ang) * wr * 0.9 - s * 0.03, wy + Math.sin(ang) * wr * 0.9 - s * 0.03, s * 0.06, s * 0.06);
      }
    }
  });
}
