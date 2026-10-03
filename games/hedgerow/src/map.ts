// The level select as a journey across Marrow: one painted scene per act, then its ten levels as stops on
// a winding trail (two rows of five, the second running back the other way), the boss at the end. Cath
// stands on the next level to play. Buttons keep the `level` class and `data-level` for tests.

import { endlessUnlocked } from "./endless";
import { cathSvg } from "../../../shared/cath/cath";
import { TWISTS, type Level } from "./engine";
import { isUnlocked, type SaveData } from "./store";

// ---- Act scenes: one painted backdrop per act ----
// Each act is a storybook painting on a 480×300 canvas: a graded sky with a sun or moon glow, three to five
// landscape bands that get paler and bluer with distance, the act's set piece around the middle, foreground
// detail, a light paper grain and a soft vignette. The story dialog shows the whole canvas ("story"); the map's
// act banner shows a 150-unit band around the set piece ("banner"), so both crops stay composed.

const SW = 480;
const SH = 300;
let sceneSeq = 0;

type Stop = [number, string, number?];
type Pt = [number, number];
type Leaf = { trunk: string; dark: string; mid: string; light: string };

const f = (v: number): string => String(Math.round(v * 10) / 10);

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const stopsSvg = (stops: Stop[]): string =>
  stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a === undefined ? "" : ` stop-opacity="${a}"`}/>`).join("");

/** Collects the scene's defs (deduplicated, ids unique to this call) and holds its seeded random source. */
class Brush {
  readonly defs: string[] = [];
  private readonly cache = new Map<string, string>();
  private k = 0;
  private readonly rand: () => number;
  constructor(
    private readonly pre: string,
    seed: number,
  ) {
    this.rand = mulberry(seed);
  }
  r(a = 0, b = 1): number {
    return a + (b - a) * this.rand();
  }
  def(key: string, make: (id: string) => string): string {
    let id = this.cache.get(key);
    if (!id) {
      id = `${this.pre}${this.k++}`;
      this.cache.set(key, id);
      this.defs.push(make(id));
    }
    return id;
  }
  /** A linear gradient in the shape's own box (top to bottom by default). */
  lin(stops: Stop[], x2 = 0, y2 = 1, x1 = 0, y1 = 0): string {
    const id = this.def(`l${JSON.stringify(stops)}${x1},${y1},${x2},${y2}`, (i) => `<linearGradient id="${i}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stopsSvg(stops)}</linearGradient>`);
    return `url(#${id})`;
  }
  /** A radial gradient in the shape's own box. */
  rad(stops: Stop[], cx = 0.5, cy = 0.5, r = 0.5): string {
    const id = this.def(`r${JSON.stringify(stops)}${cx},${cy},${r}`, (i) => `<radialGradient id="${i}" cx="${cx}" cy="${cy}" r="${r}">${stopsSvg(stops)}</radialGradient>`);
    return `url(#${id})`;
  }
}

/** A smooth Catmull-Rom curve through the points. */
function curve(pts: Pt[]): string {
  const p = pts;
  let d = `M${f(p[0]![0])} ${f(p[0]![1])}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i]!;
    const p1 = p[i]!;
    const p2 = p[i + 1]!;
    const p3 = p[i + 2] ?? p2;
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

/** A rolling height line: base plus a few seeded sines. */
function roll(b: Brush, base: number, amp: number, scale = 1): (x: number) => number {
  const p1 = b.r(0, 6.3);
  const p2 = b.r(0, 6.3);
  const p3 = b.r(0, 6.3);
  return (x) => base + amp * (0.55 * Math.sin(x / (70 * scale) + p1) + 0.3 * Math.sin(x / (31 * scale) + p2) + 0.15 * Math.sin(x / (13 * scale) + p3));
}

/** A landscape band whose top follows y(x), filled down past the bottom edge. */
function land(y: (x: number) => number, fill: string, extra = "", step = 20, x0 = -20, x1 = SW + 20): string {
  return `<path d="${landD(y, step, x0, x1)}" fill="${fill}"${extra}/>`;
}

/** Many small discs as one path (flowers, stars, pebbles, blossom). */
function dots(pts: [number, number, number][]): string {
  return pts.map(([x, y, r]) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`).join("");
}

function scatter(b: Brush, n: number, x0: number, x1: number, y0: number, y1: number, r0: number, r1: number, above?: (x: number) => number): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const x = b.r(x0, x1);
    let y = b.r(y0, y1);
    const r = b.r(r0, r1);
    if (above) y = Math.max(y, above(x) + r + 1);
    out.push([x, y, r]);
  }
  return out;
}

const dotPath = (pts: [number, number, number][], fill: string, opacity = 1): string =>
  pts.length ? `<path d="${dots(pts)}" fill="${fill}"${opacity < 1 ? ` opacity="${opacity}"` : ""}/>` : "";

/** A soft glow (sun, moon, lantern) as a radial-gradient disc. */
function glow(b: Brush, x: number, y: number, r: number, color: string, a = 0.9): string {
  return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${b.rad([[0, color, a], [0.35, color, a * 0.45], [1, color, 0]])}"/>`;
}

/** A painterly cumulus: puffs under one top-lit gradient, a flat clipped base, a lit rim toward the sun. */
function cloud(b: Brush, x: number, y: number, w: number, light: string, shade: string, opacity = 1, lx = -1, flat = true): string {
  const h = w * 0.38;
  const g = b.def(`cg${x},${y},${w}`, (id) => `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${f(y - h)}" x2="0" y2="${f(y)}"><stop offset="0" stop-color="${light}"/><stop offset=".45" stop-color="${light}"/><stop offset="1" stop-color="${shade}"/></linearGradient>`);
  const c = b.def(`cc${x},${y},${w}`, (id) => `<clipPath id="${id}"><rect x="${f(x - w)}" y="${f(y - h * 2)}" width="${f(w * 2)}" height="${f(h * 2 + w * 0.03)}"/></clipPath>`);
  const n = 5 + Math.floor(w / 36);
  let o = flat ? `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(w * 0.46)}" ry="${f(w * 0.03)}" fill="${shade}"/>` : "";
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) - 0.5;
    const env = Math.pow(1 - 4 * t * t, 0.6);
    const r = w * (0.07 + 0.12 * env) * b.r(0.85, 1.12);
    o += `<circle cx="${f(x + t * w * 0.86)}" cy="${f(y - r * 0.6 - env * w * 0.06)}" r="${f(r)}" fill="url(#${g})"/>`;
  }
  for (let i = 0; i < 3; i++) {
    const cx = x + (i - 1) * w * 0.17 + b.r(-0.04, 0.04) * w;
    const r = w * (i === 1 ? 0.16 : 0.12) * b.r(0.9, 1.1);
    o += `<circle cx="${f(cx)}" cy="${f(y - w * 0.13 - r * 0.7)}" r="${f(r)}" fill="url(#${g})"/>`;
  }
  o += `<ellipse cx="${f(x + lx * w * 0.14)}" cy="${f(y - w * 0.27)}" rx="${f(w * 0.12)}" ry="${f(w * 0.07)}" fill="${light}" opacity=".7"/>`;
  return `<g opacity="${opacity}"${flat ? ` clip-path="url(#${c})"` : ""}>${o}</g>`;
}

/** A long soft stratus layer, flat-bottomed and gently lit from above. */
function stratus(b: Brush, x: number, y: number, w: number, light: string, shade: string, a = 0.9): string {
  const n = 6;
  let o = "";
  const fill = b.lin([[0, light], [1, shade]]);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) - 0.5;
    const rx = w * b.r(0.12, 0.2);
    o += `<ellipse cx="${f(x + t * w * 0.8)}" cy="${f(y - b.r(2, 5))}" rx="${f(rx)}" ry="${f(rx * b.r(0.18, 0.28))}" fill="${fill}"/>`;
  }
  return `<g opacity="${a}">${o}<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(w / 2)}" ry="${f(w * 0.025)}" fill="${shade}"/></g>`;
}

/** A ribbon (river, creek, lane, boardwalk) through centre points [x, y, half-width], drawn far to near. */
function ribbon(pts: [number, number, number][]): string {
  const left = curve(pts.map(([x, y, w]) => [x - w, y] as Pt));
  const right = curve(pts.slice().reverse().map(([x, y, w]) => [x + w, y] as Pt)).replace(/^M/, "L");
  return `${left}${right}Z`;
}

/** A thin high streak of cloud. */
const streak = (b: Brush, x: number, y: number, w: number, color: string, a = 0.6): string =>
  `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(w / 2)}" ry="${f(Math.max(2.5, w * 0.045))}" fill="${b.rad([[0, color, a], [0.6, color, a * 0.7], [1, color, 0]])}"/>`;

/** A leafy mass: a circle whose edge is a ring of small bulges, so crowns read as foliage, not balls. */
function leafBlob(b: Brush, cx: number, cy: number, r: number, squash = 0.92): string {
  const n = Math.max(7, Math.round(r / 2.2));
  const a0 = b.r(0, 6.28);
  let d = "";
  let prev: Pt | null = null;
  for (let i = 0; i <= n; i++) {
    const a = a0 + (i / n) * Math.PI * 2;
    const rr = r * (i === n ? 1 : b.r(0.88, 1.04));
    const p: Pt = [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * squash];
    if (!prev) d += `M${f(p[0])} ${f(p[1])}`;
    else {
      const am = a - Math.PI / n;
      const k = r * b.r(1.12, 1.24);
      d += `Q${f(cx + Math.cos(am) * k)} ${f(cy + Math.sin(am) * k * squash)} ${f(p[0])} ${f(p[1])}`;
    }
    prev = p;
  }
  return d + "Z";
}

/** A broadleaf tree: cast shadow, tapered trunk, a dark leafy crown and lighter masses toward the light (lx = -1 lit from the left). */
function tree(b: Brush, x: number, y: number, s: number, p: Leaf, lx: number, shadow = 1, blossom?: string): string {
  let o = `<ellipse cx="${f(x - lx * s * 0.7 * shadow)}" cy="${f(y + 0.5)}" rx="${f(s * (0.6 + 0.8 * shadow))}" ry="${f(s * 0.14)}" fill="#14180c" opacity=".24"/>`;
  o += `<path d="M${f(x - s * 0.12)} ${f(y)}Q${f(x - s * 0.04)} ${f(y - s * 0.6)} ${f(x - s * 0.2)} ${f(y - s * 1.2)}L${f(x + s * 0.18)} ${f(y - s * 1.2)}Q${f(x + s * 0.05)} ${f(y - s * 0.6)} ${f(x + s * 0.12)} ${f(y)}Z" fill="${p.trunk}"/>`;
  const cy = y - s * 1.5;
  const blobs = (list: [number, number, number][]): string =>
    list.map(([dx, dy, r]) => leafBlob(b, x + dx * s + b.r(-0.05, 0.05) * s, cy + dy * s + b.r(-0.05, 0.05) * s, r * s * b.r(0.92, 1.08))).join("");
  o += `<path d="${blobs([[-0.5, 0.2, 0.5], [0.5, 0.18, 0.5], [0, -0.25, 0.62], [0, 0.25, 0.55]])}" fill="${p.dark}"/>`;
  o += `<path d="${blobs([[lx * 0.3 - 0.05, -0.2, 0.4], [lx * 0.05 + 0.12, -0.4, 0.3], [lx * 0.5, 0.05, 0.3]])}" fill="${p.mid}"/>`;
  o += `<path d="${blobs([[lx * 0.38, -0.44, 0.17], [lx * 0.6, -0.1, 0.13]])}" fill="${p.light}" opacity=".9"/>`;
  if (s > 9) o += dotPath(scatter(b, Math.round(s * 0.6), x + lx * s * 0.1 - s * 0.5, x + lx * s * 0.1 + s * 0.5, cy - s * 0.75, cy, s * 0.025, s * 0.05), p.light, 0.7);
  if (blossom) o += dotPath(scatter(b, 14, x - s * 0.8, x + s * 0.8, cy - s * 0.7, cy + s * 0.55, s * 0.05, s * 0.09), blossom, 0.95);
  return o;
}

/** A tall poplar or cypress: dark spindle with a lit flank. */
function poplar(x: number, y: number, h: number, p: Leaf, lx: number): string {
  const w = h * 0.17;
  return `<ellipse cx="${f(x - lx * h * 0.3)}" cy="${f(y)}" rx="${f(h * 0.35)}" ry="${f(h * 0.04)}" fill="#14180c" opacity=".2"/>` +
    `<path d="M${f(x)} ${f(y - h)}C${f(x + w * 1.3)} ${f(y - h * 0.6)} ${f(x + w)} ${f(y - h * 0.1)} ${f(x)} ${f(y)}C${f(x - w)} ${f(y - h * 0.1)} ${f(x - w * 1.3)} ${f(y - h * 0.6)} ${f(x)} ${f(y - h)}Z" fill="${p.dark}"/>` +
    `<path d="M${f(x)} ${f(y - h)}C${f(x + lx * w * 1.2)} ${f(y - h * 0.6)} ${f(x + lx * w * 0.9)} ${f(y - h * 0.2)} ${f(x + lx * w * 0.2)} ${f(y - h * 0.08)}C${f(x + lx * w * 0.3)} ${f(y - h * 0.4)} ${f(x + lx * w * 0.2)} ${f(y - h * 0.7)} ${f(x)} ${f(y - h)}Z" fill="${p.mid}"/>`;
}

/** A row of hedge from (x1,y1) to (x2,y2): bumpy dark mass, a lit top, a shadow at the foot. */
function hedge(b: Brush, x1: number, y1: number, x2: number, y2: number, h: number, p: Leaf): string {
  const n = Math.max(3, Math.round(Math.hypot(x2 - x1, y2 - y1) / (h * 1.1)));
  const at = (t: number): Pt => [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
  let top = `M${f(x1)} ${f(y1)}`;
  let hi = "";
  for (let i = 0; i < n; i++) {
    const [ax, ay] = at(i / n);
    const [bx, by] = at((i + 1) / n);
    const k = h * b.r(0.9, 1.35);
    top += `C${f(ax)} ${f(ay - k)} ${f(bx)} ${f(by - k)} ${f(bx)} ${f(by)}`;
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2 - h * 0.62;
    hi += `M${f(mx - h * 0.35)} ${f(my + h * 0.15)}q${f(h * 0.35)} ${f(-h * 0.4)} ${f(h * 0.7)} 0z`;
  }
  return `<path d="M${f(x1)} ${f(y1 + 1)}L${f(x2)} ${f(y2 + 1)}l${f(-h * 0.4)} ${f(h * 0.35)}L${f(x1 - h * 0.4)} ${f(y1 + h * 0.35)}Z" fill="#14180c" opacity=".2"/>` +
    `<path d="${top}L${f(x2)} ${f(y2 + 1.5)}L${f(x1)} ${f(y1 + 1.5)}Z" fill="${p.dark}"/>` +
    `<path d="${hi}" fill="${p.mid}" opacity=".9"/>`;
}

/** A dry-stone wall along the points: grey body, lit coping, dark joints. */
function stoneWall(pts: Pt[], w: number, body = "#a39c88", lit = "#d8d1bd", joint = "#5f594c"): string {
  const d = curve(pts);
  return `<path d="${d}" fill="none" stroke="#2a2418" stroke-opacity=".18" stroke-width="${f(w * 1.4)}" stroke-linecap="round" transform="translate(${f(w * 0.3)} ${f(w * 0.45)})"/>` +
    `<path d="${d}" fill="none" stroke="${body}" stroke-width="${f(w)}" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${joint}" stroke-width="${f(w)}" stroke-dasharray="0.6 ${f(w * 0.9)} 0.5 ${f(w * 0.6)}" opacity=".45"/>` +
    `<path d="${d}" fill="none" stroke="${lit}" stroke-width="${f(w * 0.32)}" stroke-linecap="round" transform="translate(0 ${f(-w * 0.32)})"/>`;
}

interface HouseOpts {
  w: number;
  h: number;
  e: number;
  rh: number;
  wall: string;
  wallShade: string;
  roof: string;
  roofDark: string;
  win?: string;
  frame?: string;
  cols?: number;
  rows?: number;
  chimney?: boolean;
  smoke?: string;
  door?: string;
  flip?: boolean;
  courses?: string;
  thatch?: boolean;
}

/** A gabled building in a storybook oblique view: lit facade, shaded gable end, tiled roof, lit windows. */
function house(b: Brush, x: number, y: number, o: HouseOpts): string {
  const { w, h, e, rh } = o;
  const eaveY = y - h;
  const ry = eaveY - e * 0.15 - rh;
  const gx = x + w;
  let s = `<path d="M${f(x - 2)} ${f(y)}L${f(gx + e + 4)} ${f(y - e * 0.3)}L${f(gx + e + 14)} ${f(y + 3)}L${f(x + 6)} ${f(y + 4)}Z" fill="#1a160c" opacity=".22"/>`;
  s += `<rect x="${f(x)}" y="${f(eaveY)}" width="${f(w)}" height="${f(h)}" fill="${b.lin([[0, o.wall], [1, o.wallShade, 1]], 0, 1)}"/>`;
  if (o.courses) {
    let c = "";
    for (let i = 0; i < Math.round(w * h / 28); i++) {
      const cx = b.r(x + 1, gx - 4);
      const cy = b.r(eaveY + 2, y - 1);
      c += `M${f(cx)} ${f(cy)}h${f(b.r(2, 4))}`;
    }
    s += `<path d="${c}" stroke="${o.courses}" stroke-width=".7" opacity=".55"/>`;
  }
  s += `<path d="M${f(gx)} ${f(y)}L${f(gx)} ${f(eaveY)}L${f(gx + e / 2)} ${f(ry)}L${f(gx + e)} ${f(eaveY - e * 0.3)}L${f(gx + e)} ${f(y - e * 0.3)}Z" fill="${o.wallShade}"/>`;
  s += `<rect x="${f(x)}" y="${f(eaveY)}" width="${f(w)}" height="${f(Math.max(2, h * 0.12))}" fill="#1a1208" opacity=".22"/>`;
  const roofD = `M${f(x - 3)} ${f(eaveY + 1)}L${f(gx + 1)} ${f(eaveY + 1)}L${f(gx + e / 2 + 1)} ${f(ry)}L${f(x + e / 2 - 3)} ${f(ry)}Z`;
  s += `<path d="${roofD}" fill="${b.lin([[0, o.roof], [1, o.roofDark]], 0, 1)}"/>`;
  let tiles = "";
  const n = Math.max(3, Math.round((eaveY - ry) / 3.2));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const yy = eaveY + 1 - t * (eaveY + 1 - ry);
    tiles += `M${f(x - 3 + t * e / 2)} ${f(yy)}H${f(gx + 1 + t * e / 2)}`;
  }
  if (o.thatch) {
    for (let xx = x; xx < gx; xx += 2.4) tiles += `M${f(xx - 2)} ${f(eaveY)}l${f(e / 2)} ${f(ry - eaveY)}`;
  }
  s += `<path d="${tiles}" stroke="${o.roofDark}" stroke-width=".6" opacity=".55"/>`;
  s += `<path d="M${f(gx + 1)} ${f(eaveY + 1)}L${f(gx + e / 2 + 1)} ${f(ry)}L${f(gx + e + 2)} ${f(eaveY - e * 0.3 + 1)}" fill="none" stroke="${o.roofDark}" stroke-width="2.2" stroke-linejoin="round"/>`;
  s += `<path d="M${f(x + e / 2 - 3)} ${f(ry)}H${f(gx + e / 2 + 1)}" stroke="#fff" stroke-opacity=".28" stroke-width=".8"/>`;
  // windows
  const cols = o.cols ?? 3;
  const rows = o.rows ?? (h > 22 ? 2 : 1);
  const ww = Math.min(6, w / (cols * 2.4));
  const wh = ww * 1.25;
  let panes = "";
  let bars = "";
  const doorAt = Math.floor(cols / 2);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === rows - 1 && c === doorAt && o.door) continue;
      const wx = x + (w / cols) * (c + 0.5) - ww / 2;
      const wy = eaveY + h * 0.18 + r * ((h * 0.75) / rows);
      panes += `M${f(wx)} ${f(wy)}h${f(ww)}v${f(wh)}h${f(-ww)}Z`;
      bars += `M${f(wx + ww / 2)} ${f(wy)}v${f(wh)}M${f(wx)} ${f(wy + wh / 2)}h${f(ww)}M${f(wx - 0.6)} ${f(wy + wh + 0.4)}h${f(ww + 1.2)}`;
    }
  }
  s += `<path d="${panes}" fill="${o.win ?? "#ffd98a"}" stroke="${o.frame ?? "#f4ecdc"}" stroke-width=".7"/>`;
  s += `<path d="${bars}" stroke="${o.frame ?? "#f4ecdc"}" stroke-width=".55"/>`;
  if (o.door) {
    const dw = Math.min(7, w / cols * 0.6);
    const dx = x + (w / cols) * (doorAt + 0.5) - dw / 2;
    s += `<path d="M${f(dx)} ${f(y)}v${f(-dw * 1.5)}a${f(dw / 2)} ${f(dw / 2)} 0 0 1 ${f(dw)} 0v${f(dw * 1.5)}Z" fill="${o.door}"/>`;
  }
  // gable window
  s += `<circle cx="${f(gx + e / 2)}" cy="${f(eaveY - e * 0.15 + 1)}" r="${f(Math.min(2.4, e * 0.09))}" fill="${o.win ?? "#ffd98a"}" opacity=".9"/>`;
  if (o.chimney !== false) {
    const cx = x + w * 0.72 + e / 2;
    s += `<path d="M${f(cx)} ${f(ry + 1)}v-9h6v${f(9)}Z" fill="${o.wallShade}"/><path d="M${f(cx - 1)} ${f(ry - 8)}h8v-2h-8Z" fill="${o.roofDark}"/>`;
    if (o.smoke) {
      let sm = "";
      for (let i = 0; i < 6; i++) sm += `<circle cx="${f(cx + 3 + i * i * 1.1 + i * 2)}" cy="${f(ry - 13 - i * 6.5)}" r="${f(2.2 + i * 1.3)}" fill="${o.smoke}" opacity="${f(0.75 - i * 0.11)}"/>`;
      s += sm;
    }
  }
  if (o.flip) return `<g transform="translate(${f(2 * x + w)} 0) scale(-1 1)">${s}</g>`;
  return s;
}

function sheep(b: Brush, x: number, y: number, s: number): string {
  const dir = b.r() < 0.5 ? -1 : 1;
  return `<g transform="translate(${f(x)} ${f(y)}) scale(${f(dir * s)} ${f(s)})"><ellipse cx="-1" cy="0.6" rx="5.5" ry="1.1" fill="#1a160c" opacity=".25"/><path d="M-2.6 -.5v2.2M2.2 -.5v2.2" stroke="#3a3330" stroke-width="1"/><ellipse cx="0" cy="-2.4" rx="4.4" ry="2.9" fill="#d6cdb9"/><ellipse cx="-.5" cy="-3.3" rx="3.3" ry="1.7" fill="#fbf7ec"/><ellipse cx="4.4" cy="-3.2" rx="1.5" ry="1.15" fill="#3a3330"/></g>`;
}

/** Birds as little ticks: one path. */
function birds(b: Brush, n: number, x0: number, x1: number, y0: number, y1: number, s: number, color = "#3b3340"): string {
  let d = "";
  for (let i = 0; i < n; i++) {
    const x = b.r(x0, x1);
    const y = b.r(y0, y1);
    const k = s * b.r(0.7, 1.2);
    d += `M${f(x - k)} ${f(y - k * 0.3)}q${f(k * 0.5)} ${f(-k * 0.45)} ${f(k)} ${f(k * 0.3)}q${f(k * 0.5)} ${f(-k * 0.75)} ${f(k)} ${f(-k * 0.3)}`;
  }
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${f(Math.max(0.7, s * 0.28))}" stroke-linecap="round"/>`;
}

/** Grass blades or reeds as strokes in one path. */
function blades(b: Brush, n: number, x0: number, x1: number, yb: (x: number) => number, h0: number, h1: number, color: string, w = 0.8, lean = 0.3, a = 1): string {
  let d = "";
  for (let i = 0; i < n; i++) {
    const x = b.r(x0, x1);
    const y = yb(x);
    const h = b.r(h0, h1);
    d += `M${f(x)} ${f(y)}q${f(h * lean * b.r(-0.5, 1))} ${f(-h * 0.5)} ${f(h * lean * b.r(-1, 1.4))} ${f(-h)}`;
  }
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${f(w)}" stroke-linecap="round"${a < 1 ? ` opacity="${a}"` : ""}/>`;
}

/** Horizontal glints on water. */
function glints(b: Brush, n: number, x0: number, x1: number, y0: number, y1: number, len: number, color = "#ffffff", a = 0.6): string {
  let d = "";
  for (let i = 0; i < n; i++) {
    const y = b.r(y0, y1);
    const t = (y - y0) / Math.max(1, y1 - y0);
    d += `M${f(b.r(x0, x1))} ${f(y)}h${f(len * (0.4 + t) * b.r(0.5, 1.3))}`;
  }
  return `<path d="${d}" stroke="${color}" stroke-width=".9" stroke-linecap="round" opacity="${a}"/>`;
}

/** Diagonal shafts of light from a point. */
function shafts(b: Brush, x: number, y: number, angles: number[], len: number, color: string, a = 0.3): string {
  const fill = b.lin([[0, color, a], [1, color, 0]], 0, 1);
  return angles
    .map((ang) => {
      const w0 = b.r(4, 10);
      const w1 = w0 * b.r(3, 5);
      const dx = Math.sin(ang);
      const dy = Math.cos(ang);
      const nx = dy;
      const ny = -dx;
      return `<path d="M${f(x - nx * w0)} ${f(y - ny * w0)}L${f(x + nx * w0)} ${f(y + ny * w0)}L${f(x + dx * len + nx * w1)} ${f(y + dy * len + ny * w1)}L${f(x + dx * len - nx * w1)} ${f(y + dy * len - ny * w1)}Z" fill="${fill}"/>`;
    })
    .join("");
}

/** Paper grain, a little mottling, a vignette: the storybook finish. */
function finish(b: Brush, seed: number, tint = "#2a1a10", vig = 0.38): string {
  const grain = b.def("grain", (id) =>
    `<filter id="${id}" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="${seed}" stitchTiles="stitch" result="a"/><feColorMatrix in="a" type="matrix" values="0 0 0 0 .2 0 0 0 0 .14 0 0 0 0 .08 .16 0 0 0 -.06" result="g"/><feTurbulence type="fractalNoise" baseFrequency=".012 .02" numOctaves="2" seed="${seed + 7}" result="b"/><feColorMatrix in="b" type="matrix" values="0 0 0 0 .24 0 0 0 0 .17 0 0 0 0 .1 .34 0 0 0 -.12" result="m"/><feMerge><feMergeNode in="m"/><feMergeNode in="g"/></feMerge></filter>`,
  );
  return `<rect width="${SW}" height="${SH}" filter="url(#${grain})" opacity=".9"/>` +
    `<rect x="-10" y="-10" width="${SW + 20}" height="${SH + 20}" fill="${b.rad([[0, tint, 0], [0.62, tint, 0], [1, tint, vig]], 0.5, 0.42, 0.72)}"/>`;
}

const sky = (b: Brush, stops: Stop[]): string => `<rect x="-10" y="-10" width="${SW + 20}" height="${SH + 20}" fill="${b.lin(stops)}"/>`;
/** A band of horizon haze. */
const haze = (b: Brush, y: number, h: number, color: string, a = 0.55): string =>
  `<rect x="-10" y="${f(y - h / 2)}" width="${SW + 20}" height="${f(h)}" fill="${b.lin([[0, color, 0], [0.5, color, a], [1, color, 0]])}"/>`;

// ---- the ten acts ----

const SPRING: Leaf = { trunk: "#5a4232", dark: "#3d6631", mid: "#5d9140", light: "#a6c95f" };
const SPRING_FAR: Leaf = { trunk: "#6f7a64", dark: "#6f9268", mid: "#86a877", light: "#a9c48c" };

/** The d of a landscape band whose top follows y(x). */
function landD(y: (x: number) => number, step = 20, x0 = -20, x1 = SW + 20): string {
  const pts: Pt[] = [];
  for (let x = x0; x <= x1; x += step) pts.push([x, y(x)]);
  return `${curve(pts)}L${x1} ${SH + 6}L${x0} ${SH + 6}Z`;
}

/** Content clipped to a shape (fields painted onto a band, light on water). */
function clipTo(b: Brush, d: string, content: string): string {
  const id = b.def(`clip${d}`, (i) => `<clipPath id="${i}"><path d="${d}"/></clipPath>`);
  return `<g clip-path="url(#${id})">${content}</g>`;
}

/** Soft light or shadow pools on the ground. */
function pools(b: Brush, spots: [number, number, number][], color: string, a: number): string {
  const fill = b.rad([[0, color, a], [1, color, 0]]);
  return spots.map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${f(r * 0.28)}" fill="${fill}"/>`).join("");
}

/** Flowers in loose drifts around a few centres. */
function drifts(b: Brush, centres: Pt[], n: number, spread: number, r0: number, r1: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (const [cx, cy] of centres) for (let i = 0; i < n; i++) out.push([cx + b.r(-1, 1) * spread, cy + b.r(-1, 1) * spread * 0.3, b.r(r0, r1)]);
  return out;
}

/** Diagonal mowing or ploughing stripes. */
function stripes(x0: number, y0: number, dx: number, n: number, gap: number, len: number, color: string, w: number, a: number): string {
  let d = "";
  for (let i = 0; i < n; i++) d += `M${f(x0 + i * gap)} ${f(y0)}l${f(dx)} ${f(len)}`;
  return `<path d="${d}" stroke="${color}" stroke-width="${f(w)}" opacity="${a}"/>`;
}

/** Low rounded bushes (heather, gorse, samphire): a dark mound with a lit cap toward the light. */
function clumps(pts: [number, number, number][], dark: string, light: string, lx = 1): string {
  let d = "";
  let l = "";
  for (const [x, y, r] of pts.slice().sort((p, q) => p[1] - q[1])) {
    d += `M${f(x - r)} ${f(y)}a${f(r)} ${f(r * 0.62)} 0 0 1 ${f(2 * r)} 0Z`;
    l += `M${f(x - r * 0.55 + lx * r * 0.2)} ${f(y - r * 0.32)}a${f(r * 0.5)} ${f(r * 0.32)} 0 0 1 ${f(r)} 0Z`;
  }
  return `<path d="${d}" fill="${dark}"/><path d="${l}" fill="${light}" opacity=".85"/>`;
}

function brindle(b: Brush): string {
  const lx = -1;
  let o = sky(b, [[0, "#7fb9e0"], [0.5, "#c3e0ec"], [0.82, "#f6ead0"], [1, "#fde3b8"]]);
  o += glow(b, 118, 62, 160, "#fff4d0", 0.95) + `<circle cx="118" cy="62" r="13" fill="#fffbea"/>`;
  o += cloud(b, 345, 66, 130, "#ffffff", "#c9d6e3") + cloud(b, 52, 50, 90, "#ffffff", "#d1dce6", 0.95) + cloud(b, 446, 104, 62, "#fffaf0", "#d9dfe0", 0.9);
  o += streak(b, 220, 30, 90, "#ffffff", 0.5) + streak(b, 250, 36, 50, "#ffffff", 0.4);
  const far = roll(b, 122, 9, 1.4);
  o += land(far, b.lin([[0, "#a3bfcd"], [1, "#bccfca"]]));
  o += haze(b, 128, 22, "#f6efdc", 0.55);
  const mid = roll(b, 138, 7, 1.2);
  const midD = landD(mid);
  o += `<path d="${midD}" fill="${b.lin([[0, "#9cc07f"], [1, "#a8c58a"]])}"/>`;
  o += clipTo(b, midD, `<path d="M350 120L470 120L490 152L340 152Z" fill="#e6d55c" opacity=".9"/><path d="M40 120L150 120L136 152L20 152Z" fill="#b8d08c"/><path d="M240 120L330 120L338 152L232 152Z" fill="#8fb874"/>` + stripes(350, 130, 20, 14, 10, 30, "#c8b54a", 0.8, 0.5));
  for (const [x, s] of [[30, 6], [64, 5], [392, 6], [430, 5], [458, 7]] as const) o += tree(b, x, mid(x) + 3, s, SPRING_FAR, lx, 0.6);
  o += hedge(b, -10, 150, 140, 144, 3.5, SPRING_FAR) + hedge(b, 330, 146, 490, 152, 3.5, SPRING_FAR) + hedge(b, 150, 144, 236, 148, 3, SPRING_FAR);
  const field = roll(b, 156, 5, 1.6);
  const fieldD = landD(field);
  o += `<path d="${fieldD}" fill="${b.lin([[0, "#8aba5e"], [1, "#77a64e"]])}"/>`;
  o += clipTo(b, fieldD, stripes(-40, 150, 50, 30, 20, 60, "#a7d07a", 6, 0.25) + pools(b, [[120, 170, 90], [420, 172, 70]], "#fff6c8", 0.35));
  // orchard on the left in blossom
  for (const [x, y] of [[110, 166], [134, 162], [158, 166], [96, 176], [122, 174], [148, 176], [172, 172]] as const) o += tree(b, x, y, 6.5, SPRING, lx, 0.8, b.r() < 0.5 ? "#fbe3ea" : "#ffffff");
  // big oak behind the farm
  o += tree(b, 318, 160, 17, SPRING, lx, 1);
  // the farmhouse and its barn
  o += house(b, 330, 170, { w: 46, h: 17, e: 20, rh: 12, wall: "#b65a3e", wallShade: "#7f3d2c", roof: "#7a6f66", roofDark: "#4f4740", cols: 2, rows: 1, chimney: false, door: "#3b2a20", win: "#3b2a20", frame: "#e9d9c0" });
  o += house(b, 196, 172, { w: 66, h: 26, e: 26, rh: 18, wall: "#efe3c8", wallShade: "#b9a682", roof: "#6c7180", roofDark: "#454957", cols: 3, door: "#5a3a2a", smoke: "#f4f1ea", courses: "#a8977a" });
  o += hedge(b, 180, 176, 290, 177, 3, SPRING);
  o += dotPath(drifts(b, [[200, 174], [256, 174]], 8, 10, 0.8, 1.3), "#e36a7a") + dotPath(drifts(b, [[216, 175], [280, 175]], 6, 8, 0.8, 1.2), "#fff2b0");
  const near = roll(b, 188, 7, 1.3);
  const nearD = landD(near);
  o += `<path d="${nearD}" fill="${b.lin([[0, "#7aab4c"], [1, "#5f9139"]])}"/>`;
  o += clipTo(b, nearD, stripes(-60, 180, 70, 30, 24, 80, "#9cc768", 9, 0.14) + pools(b, [[380, 214, 120]], "#28401a", 0.22) + pools(b, [[110, 206, 110]], "#fff6c8", 0.3));
  // the lane winding up to the farm
  o += stoneWall([[-10, 214], [60, 206], [130, 204], [196, 198], [234, 192]], 4.5);
  o += stoneWall([[262, 196], [330, 200], [400, 206], [490, 212]], 4.5);
  for (const [x, y, s] of [[90, 222, 6], [118, 228, 5.5], [360, 220, 6], [404, 226, 5.5], [150, 218, 5]] as const) o += sheep(b, x, y, s / 4.5);
  const fore = roll(b, 246, 9, 1);
  o += land(fore, b.lin([[0, "#5f9136"], [1, "#3f6a27"]]));
  o += `<path d="${ribbon([[242, 176, 2.5], [236, 186, 4], [256, 204, 7], [246, 226, 11], [232, 256, 17], [240, 300, 30]])}" fill="${b.lin([[0, "#eadbb0"], [1, "#cdb382"]])}"/>`;
  o += `<path d="M240 184l10 20M236 228l-6 30M248 236l2 40" stroke="#b39a68" stroke-width="1" opacity=".55"/>`;
  o += tree(b, 18, 252, 34, SPRING, lx, 0.8) + tree(b, 466, 250, 30, SPRING, lx, 0.8);
  o += blades(b, 90, -10, 490, (x) => fore(x) + 8 + b.r(0, 40), 6, 14, "#86b84e", 0.9, 0.3, 0.8);
  o += dotPath(drifts(b, [[90, 262], [170, 276], [330, 270], [410, 262]], 14, 30, 1, 1.9), "#fff6d6") + dotPath(drifts(b, [[60, 280], [140, 258], [300, 284], [380, 276]], 12, 26, 1, 1.8), "#f6cf3e");
  o += dotPath(scatter(b, 26, 30, 450, 196, 240, 0.6, 1, near), "#fffbe8", 0.9);
  o += birds(b, 4, 150, 260, 70, 95, 4);
  o += shafts(b, 118, 62, [0.9, 1.15, 1.4], 260, "#fff5d6", 0.16);
  return o;
}

/** A chamfered granite slab lit from the right (lx = 1) or left. */
function slab(b: Brush, x: number, y: number, w: number, h: number, lx: number): string {
  const c = Math.min(h * 0.45, w * 0.2);
  const d = `M${f(x + c)} ${f(y)}H${f(x + w - c * b.r(0.6, 1.2))}L${f(x + w)} ${f(y + c)}V${f(y + h)}H${f(x)}V${f(y + c * b.r(0.6, 1.1))}Z`;
  const sx = lx > 0 ? x : x + w * 0.62;
  return `<path d="${d}" fill="${b.lin([[0, "#dcd6c8"], [0.35, "#b9b2a2"], [1, "#857e70"]])}"/>` +
    `<path d="M${f(sx)} ${f(y + c * 0.6)}h${f(w * 0.38)}v${f(h - c * 0.6)}h${f(-w * 0.38)}Z" fill="#4c4740" opacity=".28"/>` +
    `<path d="M${f(x + c)} ${f(y + 0.6)}H${f(x + w - c)}" stroke="#f3efe4" stroke-width="1" opacity=".7"/>`;
}

function highmoor(b: Brush): string {
  const lx = 1;
  let o = sky(b, [[0, "#5a92c6"], [0.45, "#a6c6de"], [0.8, "#e5e4d8"], [1, "#efe1c6"]]);
  o += glow(b, 396, 46, 140, "#fff2cf", 0.85) + `<circle cx="396" cy="46" r="11" fill="#fffbec"/>`;
  o += cloud(b, 280, 56, 190, "#fdfcf6", "#9aaac0", 1, 1) + cloud(b, 70, 78, 130, "#fbfbf6", "#a9b8ca", 0.95, 1) + cloud(b, 446, 112, 70, "#fdfbf4", "#c0c9d3", 0.85, 1);
  o += streak(b, 120, 22, 150, "#ffffff", 0.45) + streak(b, 380, 18, 110, "#ffffff", 0.4) + streak(b, 300, 30, 70, "#ffffff", 0.35);
  const far = roll(b, 126, 10, 1.6);
  o += land(far, b.lin([[0, "#97a5bd"], [1, "#aeb5c4"]]));
  o += `<path d="M392 ${f(far(395) + 2)}l4 -9l7 -2l5 4l3 -5l7 2l3 10Z" fill="#8790a3"/>`;
  o += haze(b, 132, 22, "#ece6db", 0.55);
  const mid = roll(b, 146, 9, 1.3);
  const midD = landD(mid);
  o += `<path d="${midD}" fill="${b.lin([[0, "#9a8299"], [0.5, "#8c7a83"], [1, "#7e7068"]])}"/>`;
  o += clipTo(b, midD, pools(b, [[110, 160, 110], [360, 164, 90]], "#3a2c3a", 0.25) + pools(b, [[250, 158, 120]], "#ffe9c0", 0.3) +
    `<path d="M-10 156C40 150 80 160 130 152S200 162 240 156" fill="none" stroke="#7f8a52" stroke-width="7" opacity=".35"/>`);
  // the great granite tor, with clitter at its foot
  const ty = mid(240) + 3;
  o += `<ellipse cx="${f(240 - lx * 34)}" cy="${f(ty + 1)}" rx="66" ry="4.5" fill="#2a2030" opacity=".3"/>`;
  const torPts: Pt[] = [[184, 0], [186, -9], [194, -12], [194, -24], [199, -27], [200, -39], [206, -43], [207, -55], [213, -59], [216, -68], [226, -70], [230, -60], [236, -57], [238, -45], [244, -42], [246, -30], [252, -28], [256, -32], [262, -40], [272, -41], [276, -31], [282, -28], [284, -17], [292, -14], [296, 0]];
  const torD = curve(torPts.map(([x, y]) => [x, ty + y] as Pt)) + "Z";
  o += `<path d="${torD}" fill="${b.lin([[0, "#77705f"], [0.45, "#a9a291"], [1, "#d9d3c4"]], 1, 0)}"/>`;
  o += clipTo(b, torD, `<rect x="180" y="${f(ty - 80)}" width="120" height="80" fill="${b.lin([[0, "#ffffff", 0.35], [0.5, "#ffffff", 0], [1, "#2a2030", 0.25]])}"/>` +
    `<path d="M186 ${f(ty - 11)}q20 2 40 -1M236 ${f(ty - 12)}q24 3 50 0M196 ${f(ty - 25)}q14 2 30 -1M248 ${f(ty - 28)}q10 1 22 -2M203 ${f(ty - 40)}q12 2 26 0M209 ${f(ty - 55)}q10 1 20 -1M262 ${f(ty - 40)}q6 1 12 0" fill="none" stroke="#4f493f" stroke-width="1.2" opacity=".6"/>` +
    `<path d="M188 ${f(ty - 12.6)}q20 2 40 -1M238 ${f(ty - 13.6)}q24 3 50 0M198 ${f(ty - 26.6)}q14 2 30 -1M205 ${f(ty - 41.6)}q12 2 26 0" fill="none" stroke="#f4efe2" stroke-width=".7" opacity=".45"/>` +
    `<path d="M214 ${f(ty)}v-12M232 ${f(ty - 12)}v-13M222 ${f(ty - 25)}v-13M268 ${f(ty - 14)}v-14M248 ${f(ty)}v-12M226 ${f(ty - 52)}v-11M216 ${f(ty - 38)}v-14" stroke="#4d4840" stroke-width="1" opacity=".7"/>`);
  o += dotPath(scatter(b, 14, 196, 286, ty - 50, ty - 4, 0.6, 1.4), "#b8bd84", 0.8);
  for (const [x, w] of [[172, 9], [302, 11], [318, 7], [160, 6], [334, 5]] as const) o += slab(b, x, ty - w * 0.4 + b.r(0, 4), w, w * 0.6, lx);
  o += dotPath(drifts(b, [[60, 160], [150, 166], [330, 164], [430, 156]], 18, 30, 0.7, 1.3), "#b77fbe", 0.85) + dotPath(drifts(b, [[100, 158], [380, 162]], 12, 22, 0.7, 1.2), "#e2c04c", 0.85);
  o += clumps(drifts(b, [[60, 172], [150, 178], [330, 176], [420, 170], [240, 182]], 16, 40, 1.2, 2.2).map(([x, y, r]) => [x, Math.max(y, mid(x) + 6), r] as [number, number, number]), "#7a5a7a", "#a77aa8");
  for (const x of [70, 100, 150, 330, 360]) o += sheep(b, x, mid(x) + b.r(8, 18), 0.8);
  const near = roll(b, 196, 10, 1.1);
  const nearD = landD(near);
  o += `<path d="${nearD}" fill="${b.lin([[0, "#86706a"], [0.4, "#77615c"], [1, "#5e4b4d"]])}"/>`;
  o += clipTo(b, nearD, pools(b, [[90, 214, 90], [300, 220, 110], [450, 206, 60]], "#9a5d96", 0.55) + pools(b, [[200, 208, 70], [400, 226, 60]], "#a0703a", 0.45) + pools(b, [[260, 206, 140]], "#ffe2b0", 0.25));
  o += stoneWall([[-10, 206], [80, 198], [170, 202], [250, 196], [340, 200], [490, 194]], 4, "#8e8b80", "#cbc6b8", "#4d4a42");
  o += clumps(drifts(b, [[40, 222], [120, 216], [210, 228], [300, 220], [380, 230], [460, 216], [80, 236], [250, 238], [420, 240]], 24, 30, 1.6, 3).map(([x, y, r]) => [x, Math.max(y, near(x) + 4), r] as [number, number, number]), "#7a4a78", "#b57ab4");
  o += clumps(drifts(b, [[160, 216], [420, 222]], 6, 22, 2, 3.4).map(([x, y, r]) => [x, Math.max(y, near(x) + 4), r] as [number, number, number]), "#5c6a2c", "#e3c044");
  for (const x of [120, 300, 420]) o += sheep(b, x, near(x) + b.r(14, 26), 1.25);
  const fore = roll(b, 248, 10, 1);
  o += land(fore, b.lin([[0, "#5d4757"], [1, "#3a2c38"]]));
  o += blades(b, 80, -10, 490, (x) => fore(x) + 4 + b.r(0, 44), 8, 18, "#9a7b5c", 1, 0.35, 0.8);
  o += clumps(drifts(b, [[30, 268], [110, 286], [200, 272], [290, 290], [380, 266], [460, 284], [150, 300], [340, 300]], 14, 40, 5, 10).map(([x, y, r]) => [x, Math.max(y, fore(x) + 6), r] as [number, number, number]), "#6b3a68", "#b06cae");
  o += dotPath(drifts(b, [[80, 274], [250, 280], [420, 274]], 14, 40, 0.8, 1.5), "#e2b4e0", 0.85);
  o += birds(b, 3, 140, 200, 104, 120, 3.4, "#4a3f4f") + birds(b, 2, 320, 360, 120, 130, 2.6, "#4a3f4f");
  return o;
}

/** A reed bed: a soft ochre mass, stalks and leaves, a few bulrush heads. */
function reeds(b: Brush, x0: number, x1: number, y: number, h: number, n: number): string {
  let mass = `M${f(x0)} ${f(y + 4)}`;
  for (let x = x0; x < x1; x += h * 0.4) mass += `Q${f(x + h * 0.2)} ${f(y - h * b.r(0.45, 0.7))} ${f(Math.min(x1, x + h * 0.4))} ${f(y - h * 0.2)}`;
  mass += `L${f(x1)} ${f(y + 4)}Z`;
  let heads = "";
  let caps = "";
  for (let i = 0; i < Math.round(n / 6); i++) {
    const x = b.r(x0 + 2, x1 - 2);
    const top = y - h * b.r(0.8, 1.05);
    heads += `M${f(x)} ${f(y)}V${f(top)}`;
    caps += `M${f(x - h * 0.03)} ${f(top + h * 0.06)}h${f(h * 0.06)}v${f(h * 0.14)}h${f(-h * 0.06)}Z`;
  }
  return `<path d="${mass}" fill="${b.lin([[0, "#d5b46e"], [1, "#9b7a42"]])}"/>` +
    blades(b, n, x0, x1, () => y + b.r(-2, 3), h * 0.5, h, "#8f6c38", Math.max(0.6, h * 0.025), 0.12) +
    blades(b, Math.round(n * 0.7), x0, x1, () => y + b.r(0, 4), h * 0.4, h * 0.9, "#e5c983", Math.max(0.5, h * 0.022), 0.25) +
    `<path d="${heads}" stroke="#6a5030" stroke-width="${f(Math.max(0.5, h * 0.015))}"/><path d="${caps}" fill="#5a3a22"/>`;
}

function egret(x: number, y: number, s: number, dir: number): string {
  return `<g transform="translate(${f(x)} ${f(y - 9 * s)}) scale(${f(dir * s)} ${f(s)})"><ellipse cx="0" cy="9.3" rx="5" ry=".8" fill="#2a2a1a" opacity=".22"/><path d="M-1 0l-.6 9M1.6 0l.4 9" stroke="#2a2a22" stroke-width=".7"/><path d="M-8 -1.5C-4 -5 3 -6 6 -3C7 -1 5 1 1 1C-2 1.4 -5 .8 -8 -1.5Z" fill="#fbfaf4"/><path d="M-6 -.6C-3 .6 2 .9 5 -1" fill="none" stroke="#cfd3cf" stroke-width="1.1"/><path d="M5 -3C8 -6 4 -9 6 -12C7 -14 9 -14.2 10 -13" fill="none" stroke="#fbfaf4" stroke-width="1.7" stroke-linecap="round"/><path d="M10 -13l5 1.4" stroke="#e0b030" stroke-width=".9" stroke-linecap="round"/></g>`;
}

function saltmarsh(b: Brush): string {
  let o = sky(b, [[0, "#98c3d4"], [0.5, "#dce8e4"], [0.85, "#f8ecd6"], [1, "#fde2c0"]]);
  o += glow(b, 340, 108, 180, "#fff0cc", 0.9) + `<circle cx="340" cy="108" r="12" fill="#fff9e6"/>`;
  for (const [x, y, w] of [[110, 40, 180], [300, 30, 140], [420, 58, 120], [70, 70, 100], [220, 64, 90]] as const) o += streak(b, x, y, w, "#ffffff", 0.55) + streak(b, x + 20, y + 4, w * 0.6, "#f6d4bc", 0.5);
  o += `<rect x="-10" y="128" width="${SW + 20}" height="20" fill="${b.lin([[0, "#93b4c2"], [1, "#c4d5d2"]])}"/>`;
  o += `<path d="M-10 129C40 124 90 124 140 128L140 130L-10 130Z" fill="#9fb0bd"/><path d="M410 130c20 -4 50 -5 80 -3v3Z" fill="#a9b8c1"/>`;
  o += `<ellipse cx="340" cy="133" rx="70" ry="4" fill="#fff4d6" opacity=".55"/>` + glints(b, 26, 260, 430, 130, 138, 7, "#fffbe6", 0.85);
  const flats = (x: number): number => 140 + Math.sin(x / 60) * 1.2;
  const flatD = landD(flats);
  o += `<path d="${flatD}" fill="${b.lin([[0, "#bbb47c"], [0.5, "#a6a466"], [1, "#8d8f52"]])}"/>`;
  o += clipTo(b, flatD, pools(b, [[110, 176, 120], [400, 196, 100]], "#9a7aa6", 0.4) + pools(b, [[300, 160, 140]], "#fff0c4", 0.35) + pools(b, [[60, 240, 100], [420, 250, 90]], "#6f7f3a", 0.45));
  // tidal creeks winding out to the sea, holding the sky
  const water = b.lin([[0, "#f6f0e0"], [0.5, "#cfdfdc"], [1, "#94b9c4"]]);
  const creek = (pts: [number, number, number][]): string =>
    `<path d="${ribbon(pts.map(([x, y, w]) => [x, y + 0.8, w + 0.8 + w * 0.15]))}" fill="#5f5a3a" opacity=".6"/><path d="${ribbon(pts)}" fill="${water}"/>`;
  o += creek([[362, 142, 0.6], [338, 152, 2], [356, 168, 4], [320, 190, 7], [344, 230, 12], [300, 300, 22]]);
  o += creek([[262, 143, 0.6], [226, 152, 1.8], [190, 166, 3.5], [140, 182, 6], [104, 206, 9], [140, 250, 14], [90, 300, 22]]);
  o += glints(b, 14, 300, 350, 196, 270, 6, "#ffffff", 0.8) + glints(b, 10, 100, 150, 196, 270, 6, "#ffffff", 0.7);
  o += dotPath(drifts(b, [[60, 190], [200, 176], [420, 182], [250, 210]], 16, 28, 0.6, 1.2), "#b59ac6", 0.8);
  // a hide on stilts
  o += `<path d="M392 152v12M410 152v12M398 152v12" stroke="#4a3a2a" stroke-width="1.2"/><rect x="388" y="140" width="26" height="13" fill="#8a6a48"/><rect x="408" y="140" width="6" height="13" fill="#5f4834"/><path d="M386 141l14 -8l16 8Z" fill="#5a4a3e"/><rect x="393" y="145" width="9" height="3" fill="#2a2018"/>`;
  o += pools(b, [[191, 154, 50], [421, 164, 60]], "#8a6a3a", 0.55) + reeds(b, 150, 232, 152, 12, 40) + reeds(b, 372, 470, 162, 15, 40);
  o += clumps(drifts(b, [[60, 176], [200, 196], [420, 210], [270, 176], [40, 220], [380, 186]], 9, 34, 1.5, 3.4), "#6e7a3a", "#a9b45c");
  o += blades(b, 120, -10, 490, (x) => flats(x) + 6 + b.r(0, 90), 2, 5, "#7c7d40", 0.6, 0.3, 0.7);
  o += egret(212, 168, 1.3, 1) + egret(352, 196, 1.6, -1) + egret(120, 212, 1.9, 1);
  o += `<path d="M150 92q8 -6 14 1q6 -8 14 -2" fill="none" stroke="#fbfaf4" stroke-width="2.2" stroke-linecap="round"/><path d="M178 86l4 1" stroke="#e0b030" stroke-width=".8"/>`;
  // the boardwalk into the marsh, with a handrail
  const bw: [number, number, number][] = [];
  for (let i = 0; i <= 16; i++) {
    const t = (i / 16) ** 1.3;
    bw.push([254 - Math.sin(t * 3) * 22 * t, 150 + t * 150, 2 + t * 34]);
  }
  const side = bw.map(([x, y, w]) => [x, y + 1 + w * 0.16, w] as [number, number, number]);
  let planks = "";
  let posts = "";
  let rail = "";
  bw.forEach(([x, y, w], i) => {
    planks += `M${f(x - w)} ${f(y)}H${f(x + w)}`;
    if (i % 2 === 0) {
      posts += `M${f(x - w)} ${f(y)}v${f(2 + w * 0.5)}M${f(x + w)} ${f(y)}v${f(2 + w * 0.5)}`;
      rail += `M${f(x - w)} ${f(y)}v${f(-2 - w * 0.55)}`;
    }
  });
  const railLine = curve(bw.map(([x, y, w]) => [x - w, y - 2 - w * 0.55] as Pt));
  o += `<path d="${posts}" stroke="#4a3626" stroke-width="2"/><path d="${ribbon(side)}" fill="#5e4632"/>`;
  o += `<path d="${ribbon(bw)}" fill="${b.lin([[0, "#c9b28a"], [1, "#a1825c"]])}"/><path d="${planks}" stroke="#6e553b" stroke-width=".7" opacity=".75"/>`;
  o += `<path d="${rail}" stroke="#5e4632" stroke-width="1.6"/><path d="${railLine}" fill="none" stroke="#7a5e40" stroke-width="1.4"/>`;
  // foreground reeds
  o += reeds(b, -20, 150, 304, 76, 80) + reeds(b, 330, 500, 306, 80, 80);
  o += birds(b, 5, 60, 200, 54, 80, 3, "#5d5a62");
  return o;
}

function willow(b: Brush, x: number, y: number, s: number, lx: number): string {
  const top = y - s * 2.35;
  let crown = `M${f(x - s * 1.12)} ${f(y - s * 0.32)}C${f(x - s * 1.3)} ${f(y - s * 1.5)} ${f(x - s * 0.9)} ${f(top)} ${f(x)} ${f(top)}C${f(x + s * 0.9)} ${f(top)} ${f(x + s * 1.3)} ${f(y - s * 1.5)} ${f(x + s * 1.12)} ${f(y - s * 0.32)}`;
  const n = 9;
  for (let i = 1; i <= n; i++) {
    const xx = x + s * 1.12 - (i / n) * s * 2.24;
    crown += `Q${f(xx + s * 0.12)} ${f(y - s * b.r(0.05, 0.25))} ${f(xx)} ${f(y - s * b.r(0.3, 0.45))}`;
  }
  crown += "Z";
  let strands = "";
  let lit = "";
  for (let i = 0; i < 24; i++) {
    const t = i / 23 - 0.5;
    const sx = x + t * s * 2.1;
    const sy = top + s * (0.25 + Math.abs(t) * 1.1) + b.r(0, s * 0.15);
    const ey = y - s * b.r(0.3, 0.6);
    const seg = `M${f(sx)} ${f(sy)}Q${f(sx + t * s * 0.4)} ${f((sy + ey) / 2)} ${f(sx + t * s * 0.3)} ${f(ey)}`;
    if (t * lx > -0.1) lit += seg;
    strands += seg;
  }
  return `<ellipse cx="${f(x - lx * s * 0.9)}" cy="${f(y)}" rx="${f(s * 1.5)}" ry="${f(s * 0.16)}" fill="#14180c" opacity=".24"/>` +
    `<path d="M${f(x - s * 0.12)} ${f(y)}q${f(s * 0.08)} ${f(-s * 0.6)} ${f(-s * 0.22)} ${f(-s * 1.2)}h${f(s * 0.3)}q${f(s * 0.05)} ${f(s * 0.6)} ${f(s * 0.16)} ${f(s * 1.2)}Z" fill="#4e3d30"/>` +
    `<path d="${crown}" fill="${b.lin([[0, "#86a446"], [0.6, "#5f7f32"], [1, "#4a6628"]])}"/>` +
    `<path d="${strands}" fill="none" stroke="#3f5a22" stroke-width="${f(s * 0.05)}" opacity=".55"/>` +
    `<path d="${lit}" fill="none" stroke="#c9da7c" stroke-width="${f(s * 0.045)}" opacity=".8" transform="translate(${f(lx * s * 0.06)} 0)"/>` +
    `<ellipse cx="${f(x + lx * s * 0.4)}" cy="${f(top + s * 0.45)}" rx="${f(s * 0.5)}" ry="${f(s * 0.22)}" fill="#d9e48e" opacity=".55"/>`;
}

function rivermead(b: Brush): string {
  const lx = -1;
  let o = sky(b, [[0, "#6a7f98"], [0.35, "#a6b9c9"], [0.7, "#e4e6dc"], [1, "#f7ebce"]]);
  o += glow(b, 150, 84, 180, "#fff3d0", 0.95) + `<circle cx="150" cy="84" r="12" fill="#fffbec"/>`;
  o += ["#e88a7a", "#efc46a", "#9dcf86", "#7aaedc", "#a08ad0"].map((c, i) => `<path d="M300 150A${100 - i * 4} ${104 - i * 4} 0 0 1 ${f(500 - i * 8)} 150" fill="none" stroke="${c}" stroke-width="4" opacity=".24"/>`).join("");
  o += `<rect x="-10" y="-10" width="${SW + 20}" height="40" fill="${b.lin([[0, "#5c6c82"], [1, "#6a7f98", 0]])}"/>` + cloud(b, 380, 34, 250, "#c3ccd8", "#5f6e84", 1, -1, false) + cloud(b, 70, 30, 220, "#cbd3dd", "#66768c", 1, -1, false) + cloud(b, 236, 16, 160, "#d5dce4", "#76849a", 1, -1, false);
  o += cloud(b, 256, 112, 70, "#fffaf0", "#d8dbd6", 0.85);
  const far = roll(b, 128, 8, 1.6);
  o += land(far, b.lin([[0, "#9ab0be"], [1, "#b2c3c2"]]));
  for (const x of [40, 52, 420, 436, 450]) o += poplar(x, far(x) + 8, 22, SPRING_FAR, lx);
  o += haze(b, 134, 20, "#eef0e6", 0.55);
  const mid = roll(b, 146, 4, 1.8);
  const midD = landD(mid);
  o += `<path d="${midD}" fill="${b.lin([[0, "#9cc27c"], [1, "#7fab60"]])}"/>`;
  o += clipTo(b, midD, pools(b, [[120, 170, 120], [380, 200, 120]], "#fff3c8", 0.35) + pools(b, [[420, 160, 80]], "#2f4a28", 0.2));
  // water meadow pools
  for (const [x, y, rx] of [[80, 172, 30], [380, 168, 26], [430, 192, 34], [46, 200, 26]] as const) o += `<ellipse cx="${x}" cy="${f(y + 0.6)}" rx="${f(rx + 1.5)}" ry="${f(rx * 0.15)}" fill="#5f8a4c" opacity=".5"/><ellipse cx="${x}" cy="${y}" rx="${f(rx)}" ry="${f(rx * 0.12)}" fill="${b.lin([[0, "#e6ecea"], [1, "#a9c0c8"]])}"/><path d="M${x - rx * 0.5} ${y}h${rx * 0.4}" stroke="#fff" stroke-width=".8" opacity=".8"/>`;
  const fore = roll(b, 252, 7, 1);
  o += land(fore, b.lin([[0, "#6d9e45"], [1, "#46742d"]]));
  // the river
  const riv: [number, number, number][] = [[236, 146, 1.5], [230, 156, 6], [222, 170, 14], [234, 190, 40], [216, 230, 60], [200, 300, 96]];
  o += `<path d="${ribbon(riv.map(([x, y, w]) => [x, y + 0.6, w + 1.5]))}" fill="#4a5a3a" opacity=".6"/>`;
  const rivD = ribbon(riv);
  o += `<path d="${rivD}" fill="${b.lin([[0, "#eef0ea"], [0.35, "#c3d3da"], [1, "#7d9db2"]])}"/>`;
  // the stone bridge
  const by = 186;
  const span = (x: number, r: number): string => `M${x - r} ${by + 10}A${r} ${r * 0.85} 0 0 1 ${x + r} ${by + 10}`;
  o += clipTo(b, rivD, `<path d="M150 ${by + 10}H330L326 ${by + 22}H154Z" fill="#c9bfa6" opacity=".35"/><path d="M178 ${by + 10}a18 8 0 0 0 36 0ZM218 ${by + 10}a22 10 0 0 0 44 0ZM266 ${by + 10}a18 8 0 0 0 36 0Z" fill="#4f5a54" opacity=".25"/>` +
    pools(b, [[150, 210, 40], [330, 206, 40]], "#3f5a2a", 0.5) + glints(b, 22, 140, 300, 214, 296, 10, "#ffffff", 0.55));
  const deck = `M150 ${by - 6}Q240 ${by - 16} 330 ${by - 6}L330 ${by + 10}L150 ${by + 10}Z`;
  o += `<path d="${deck}${span(196, 18)}Z${span(240, 22)}Z${span(284, 18)}Z" fill="${b.lin([[0, "#ddd3bc"], [1, "#a99b80"]])}" fill-rule="evenodd"/>`;
  o += `<path d="${span(196, 18)}Z${span(240, 22)}Z${span(284, 18)}Z" fill="#33403c" opacity=".8"/>`;
  o += `<path d="${span(196, 18)}M${240 - 22} ${by + 10}A22 18.7 0 0 1 ${240 + 22} ${by + 10}${span(284, 18)}" fill="none" stroke="#efe6d0" stroke-width="1.6" opacity=".7"/>`;
  o += `<path d="M150 ${by - 6}Q240 ${by - 16} 330 ${by - 6}" fill="none" stroke="#f3ecd9" stroke-width="2.4"/><path d="M150 ${by - 2}Q240 ${by - 12} 330 ${by - 2}" fill="none" stroke="#8a7d66" stroke-width=".8" opacity=".7"/>`;
  let stones = "";
  for (let i = 0; i < 40; i++) stones += `M${f(b.r(152, 326))} ${f(b.r(by - 4, by + 8))}h${f(b.r(2.5, 5))}`;
  o += `<path d="${stones}" stroke="#7e7058" stroke-width=".7" opacity=".5"/>`;
  o += blades(b, 40, 120, 176, (x) => 300 - (x - 120) * 1.6 + b.r(-6, 2), 6, 14, "#5f8a34", 1, 0.2) + blades(b, 40, 300, 360, (x) => 214 + (x - 300) * 1.4 + b.r(-4, 4), 6, 14, "#5f8a34", 1, 0.2);
  o += willow(b, 150, 196, 20, lx) + willow(b, 334, 192, 18, lx) + willow(b, 104, 168, 9, lx);
  o += tree(b, 400, 160, 10, SPRING, lx) + tree(b, 60, 156, 8, SPRING, lx);
  const cow = (x: number, y: number, s: number): string => `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="1" rx="6" ry="1" fill="#1a160c" opacity=".25"/><path d="M-3.5 -1v2.5M3 -1v2.5" stroke="#2a2420" stroke-width="1"/><rect x="-5" y="-5" width="10" height="5" rx="2.4" fill="#f2ede2"/><path d="M-3 -5h4v3h-4ZM2 -4h2v3h-2Z" fill="#2a2420"/><rect x="4" y="-6" width="3" height="3.4" rx="1" fill="#2a2420"/></g>`;
  o += cow(388, 180, 1.2) + cow(414, 184, 1.1) + cow(70, 188, 1.2);
  o += blades(b, 60, -10, 120, (x) => fore(x) + 6 + b.r(0, 40), 8, 18, "#90bf58", 1, 0.3, 0.85) + blades(b, 60, 330, 490, (x) => fore(x) + 6 + b.r(0, 40), 8, 18, "#90bf58", 1, 0.3, 0.85);
  o += dotPath(drifts(b, [[30, 270], [80, 284], [370, 276], [440, 268]], 14, 24, 1, 1.9), "#f4cf3a");
  o += birds(b, 4, 180, 300, 92, 116, 3.5, "#4b4f5a");
  return o;
}

function oakvale(b: Brush): string {
  const lx = 1;
  let o = sky(b, [[0, "#cfdca0"], [0.45, "#f1e8b4"], [0.75, "#d9d79a"], [1, "#a9b974"]]);
  o += glow(b, 360, 40, 220, "#fff6d0", 0.95);
  // far trunks dissolving in the light
  let far = "";
  for (let i = 0; i < 16; i++) {
    const x = b.r(-10, 490);
    const w = b.r(3, 6);
    far += `M${f(x)} 0h${f(w)}l${f(w * 0.3)} 160h${f(-w * 1.6)}Z`;
  }
  o += `<path d="${far}" fill="#b5bd8c" opacity=".7"/>`;
  o += haze(b, 120, 140, "#f6efc4", 0.5);
  let mid = "";
  for (const x of [40, 96, 150, 330, 386, 430]) {
    const w = b.r(7, 11);
    mid += `M${f(x)} -10h${f(w)}c0 80 ${f(w * 0.2)} 150 ${f(w * 0.6)} 172h${f(-w * 2.2)}c${f(w * 0.4)} -22 ${f(w * 0.6)} -92 ${f(w * 0.6)} -172Z`;
  }
  o += `<path d="${mid}" fill="#7f8a5c"/>`;
  // ground
  const floor = roll(b, 162, 4, 1.4);
  o += land(floor, b.lin([[0, "#a8ab64"], [0.5, "#7f8f45"], [1, "#56682d"]]));
  // the woodland path into the trees
  const fore = roll(b, 250, 8, 1);
  o += land(fore, b.lin([[0, "#5c7231"], [1, "#2f3f18"]]));
  o += `<path d="M190 300C210 260 260 240 236 210C226 196 238 176 246 166L252 166C252 180 250 196 262 212C292 246 280 270 300 300Z" fill="${b.lin([[0, "#e9d9a2"], [1, "#b9a06a"]])}" opacity=".9"/>`;
  // the old oak at the heart of the wood
  const ox = 244;
  const oy = 168;
  o += `<ellipse cx="${ox - 30}" cy="${oy + 2}" rx="70" ry="6" fill="#2a2a10" opacity=".25"/>`;
  o += `<path d="M${ox - 14} ${oy}C${ox - 10} ${oy - 20} ${ox - 6} ${oy - 34} ${ox - 22} ${oy - 52}L${ox - 40} ${oy - 64}L${ox - 36} ${oy - 68}L${ox - 14} ${oy - 56}C${ox - 6} ${oy - 54} ${ox - 2} ${oy - 70} ${ox - 6} ${oy - 84}L${ox + 2} ${oy - 84}C${ox + 6} ${oy - 70} ${ox + 6} ${oy - 58} ${ox + 18} ${oy - 60}L${ox + 42} ${oy - 70}L${ox + 44} ${oy - 66}L${ox + 20} ${oy - 50}C${ox + 8} ${oy - 36} ${ox + 10} ${oy - 18} ${ox + 18} ${oy}Z" fill="#4c3b2a"/>`;
  o += `<path d="M${ox + 2} ${oy}C${ox + 2} ${oy - 20} ${ox + 2} ${oy - 40} ${ox + 6} ${oy - 52}L${ox + 18} ${oy - 58}C${ox + 8} ${oy - 36} ${ox + 10} ${oy - 18} ${ox + 18} ${oy}Z" fill="#8a7050" opacity=".75"/>`;
  const crown: Leaf = { trunk: "#4c3b2a", dark: "#4f6a2c", mid: "#76913a", light: "#c9d470" };
  const masses = (list: [number, number, number][], dx0: number): string => list.map(([dx, dy, r]) => leafBlob(b, ox + dx + dx0, oy + dy, r)).join("");
  o += `<path d="${masses([[-50, -70, 24], [-20, -86, 30], [20, -88, 30], [52, -72, 24], [0, -66, 26], [-36, -96, 20], [36, -100, 20], [2, -110, 22]], 0)}" fill="${crown.dark}"/>`;
  o += `<path d="${masses([[-10, -98, 20], [30, -98, 19], [54, -82, 14], [10, -118, 13], [-40, -84, 12]], lx * 6)}" fill="${crown.mid}"/>`;
  o += `<path d="${masses([[40, -106, 9], [60, -88, 7], [16, -126, 7], [-2, -110, 7], [28, -118, 6]], lx * 4)}" fill="${crown.light}" opacity=".85"/>`;
  o += dotPath(scatter(b, 26, ox - 10, ox + 70, oy - 130, oy - 80, 0.6, 1.4), crown.light, 0.75);
  // great trunks framing the wood
  const trunk = (x: number, w: number, dir: number): string =>
    `<path d="M${f(x - w)} 310C${f(x - w * 0.6)} 220 ${f(x - w * 0.5)} 120 ${f(x - w * 0.3)} -10H${f(x + w * 0.5)}C${f(x + w * 0.4)} 120 ${f(x + w * 0.6)} 220 ${f(x + w * 1.1)} 310Z" fill="#3a2c20"/>` +
    `<path d="M${f(x + dir * w * 0.25)} 310C${f(x + dir * w * 0.3)} 220 ${f(x + dir * w * 0.2)} 120 ${f(x + dir * w * 0.1)} -10" fill="none" stroke="#7a6248" stroke-width="${f(w * 0.35)}" opacity=".6"/>` +
    `<path d="M${f(x - w * 0.2)} 300C${f(x - w * 0.1)} 200 ${f(x - w * 0.2)} 120 ${f(x)} 20M${f(x + w * 0.3)} 290C${f(x + w * 0.4)} 210 ${f(x + w * 0.2)} 100 ${f(x + w * 0.25)} 0" fill="none" stroke="#24190f" stroke-width="1" opacity=".6"/>`;
  o += trunk(28, 22, 1) + trunk(452, 20, -1) + trunk(118, 9, 1) + trunk(370, 8, -1);
  // canopy across the top
  const leafy = (y0: number, y1: number, n: number, r0: number, r1: number, c: string, a = 1): string => {
    let d = "";
    for (let i = 0; i < n; i++) {
      const x = -20 + (i + b.r(-0.3, 0.3)) * (520 / n);
      const r = b.r(r0, r1);
      d += leafBlob(b, x, b.r(y0, y1), r, 0.85);
    }
    return `<path d="${d}" fill="${c}"${a < 1 ? ` opacity="${a}"` : ""}/>`;
  };
  o += `<rect x="-10" y="-10" width="${SW + 20}" height="32" fill="#2c4019"/>`;
  o += leafy(16, 34, 16, 14, 22, "#2c4019") + leafy(8, 26, 20, 10, 16, "#3f5a24") + leafy(14, 30, 26, 5, 9, "#5a7a2e", 0.95) + leafy(6, 26, 30, 2.5, 5, "#8aa63e", 0.8);
  o += dotPath(drifts(b, [[300, 22], [360, 30], [420, 20], [250, 26]], 12, 24, 1.2, 2.8), "#d2dc72", 0.85);
  o += shafts(b, 400, -10, [0.32, 0.44, 0.55, 0.66, 0.8, 0.95], 340, "#fff6c8", 0.36);
  // dappled light, bluebells and ferns
  o += pools(b, [[150, 196, 26], [300, 204, 34], [210, 230, 30], [380, 222, 22], [96, 220, 20], [256, 178, 20]], "#fff3b0", 0.55);
  const bells: Pt[] = [[70, 214], [140, 232], [110, 260], [350, 222], [410, 246], [330, 266], [180, 200], [300, 196]];
  o += pools(b, bells.map(([x, y]) => [x, y, 46] as [number, number, number]), "#6f78d0", 0.55);
  o += dotPath(drifts(b, bells, 22, 30, 0.7, 1.4), "#7d86d8", 0.95) + dotPath(drifts(b, bells, 10, 26, 0.6, 1.1), "#c3c8f6", 0.9);
  const fern = (x: number, y: number, s: number, c: string): string => {
    let d = "";
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.32;
      const ex = x + Math.cos(a) * s * 1.4;
      const ey = y + Math.sin(a) * s;
      d += `M${f(x)} ${f(y)}Q${f((x + ex) / 2)} ${f(Math.min(y, ey) - s * 0.3)} ${f(ex)} ${f(ey)}`;
    }
    return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${f(s * 0.12)}" stroke-linecap="round" stroke-dasharray="${f(s * 0.06)} ${f(s * 0.05)}"/>`;
  };
  o += fern(60, 290, 40, "#5f8a2a") + fern(430, 292, 44, "#5f8a2a") + fern(150, 280, 22, "#7aa23a") + fern(340, 284, 24, "#7aa23a");
  return o;
}

function shingleBay(b: Brush): string {
  let o = sky(b, [[0, "#3f4c5f"], [0.4, "#76859a"], [0.72, "#c9c6b6"], [1, "#e9dcbd"]]);
  o += glow(b, 120, 118, 120, "#fff2c8", 0.75);
  o += shafts(b, 130, 92, [-0.35, -0.1, 0.15, 0.4], 60, "#fff2d0", 0.3);
  o += cloud(b, 360, 50, 270, "#8e9bae", "#3c4659", 1, -1, false) + cloud(b, 70, 36, 230, "#9aa6b6", "#454f62", 1, -1, false) + cloud(b, 230, 18, 210, "#7c899c", "#3a4356", 1, -1, false);
  o += cloud(b, 170, 98, 90, "#e6e2d6", "#8e96a2", 0.9) + cloud(b, 420, 104, 70, "#b7bec6", "#6a7484", 0.9);
  // rain under the far cloud
  o += `<path d="M380 80l-14 50M392 80l-14 50M404 82l-14 48M416 80l-12 46M428 84l-12 44" stroke="#5d6a7c" stroke-width="3" opacity=".22"/>`;
  // far headland and the sea
  o += `<path d="M-10 134C20 126 50 124 80 130L96 136H-10Z" fill="#7e8ca0"/>`;
  o += `<rect x="-10" y="135" width="${SW + 20}" height="80" fill="${b.lin([[0, "#7f97a0"], [0.3, "#5f7f8c"], [1, "#4f7381"]])}"/>`;
  o += `<ellipse cx="130" cy="146" rx="90" ry="7" fill="#e9e0c4" opacity=".4"/>`;
  o += glints(b, 22, 60, 220, 138, 160, 9, "#fff6dc", 0.75);
  let caps = "";
  for (let i = 0; i < 22; i++) {
    const y = b.r(144, 205);
    const s = 3 + (y - 140) * 0.12;
    caps += `M${f(b.r(-10, 330))} ${f(y)}q${f(s)} ${f(-s * 0.5)} ${f(s * 2)} 0`;
  }
  o += `<path d="${caps}" fill="none" stroke="#e9f0ee" stroke-width="1.1" stroke-linecap="round" opacity=".7"/>`;
  // the cliffs and lighthouse
  const cliff = `M310 300L314 214C316 194 306 178 316 162C324 144 330 128 338 118C352 106 384 98 420 100C450 102 470 106 490 110V300Z`;
  o += `<path d="${cliff}" fill="${b.lin([[0, "#9a8b72"], [0.25, "#cfc3a8"], [0.7, "#b2a386"], [1, "#857660"]], 1, 0)}"/>`;
  o += clipTo(b, cliff, `<rect x="300" y="96" width="200" height="210" fill="${b.lin([[0, "#ffffff", 0.15], [0.6, "#000000", 0], [1, "#1a1408", 0.35]])}"/>`);
  let strata = "";
  for (let i = 0; i < 9; i++) strata += `M${f(306 + i * 2)} ${f(130 + i * 16)}C${f(360)} ${f(126 + i * 16)} ${f(420)} ${f(134 + i * 16)} 490 ${f(128 + i * 16)}`;
  o += `<path d="${strata}" fill="none" stroke="#8b7b61" stroke-width="1" opacity=".4"/>`;
  o += `<path d="M352 112L344 170L356 240L346 300H366L374 230L362 160Z M410 104L404 150L416 214L408 300H424L430 220L420 150Z M452 106L446 160L458 230L452 300H470L474 210L464 150Z" fill="#7f705a" opacity=".38"/>`;
  o += `<path d="M330 120L326 180L340 250M384 106L380 170L392 250M436 106L432 180" fill="none" stroke="#efe6d0" stroke-width="2" opacity=".45"/>`;
  o += clumps([[312, 296, 12], [334, 300, 14], [300, 300, 8], [354, 302, 9]], "#6f6250", "#a89a80", -1);
  o += `<path d="M322 118C340 104 380 96 420 98C450 100 470 104 490 108V114C460 108 420 104 380 106C360 108 340 112 326 120Z" fill="#7d9a52"/>`;
  o += `<path d="M330 114C350 104 380 99 420 100" fill="none" stroke="#a8c06c" stroke-width="2"/>`;
  // lighthouse
  const hx = 402;
  const hy = 101;
  o += `<path d="M${hx} ${hy - 51}L${hx - 210} ${hy - 86}L${hx - 210} ${hy - 50}Z" fill="${b.lin([[0, "#fff6cc", 0], [1, "#fff6cc", 0.42]], 1, 0)}"/>`;
  o += glow(b, hx, hy - 52, 30, "#fff1b0", 0.9);
  o += `<path d="M${hx - 9} ${hy}L${hx - 6} ${hy - 44}H${hx + 6}L${hx + 9} ${hy}Z" fill="${b.lin([[0, "#ffffff"], [0.6, "#e9e4da"], [1, "#a9a296"]], 1, 0)}"/>`;
  o += `<path d="M${hx - 8.2} ${hy - 12}H${hx + 8.2}L${hx + 7.6} ${hy - 20}H${hx - 7.6}ZM${hx - 7.1} ${hy - 28}H${hx + 7.1}L${hx + 6.6} ${hy - 36}H${hx - 6.6}Z" fill="#c23c33"/>`;
  o += `<path d="M${hx + 2} ${hy}L${hx + 3} ${hy - 44}H${hx + 6}L${hx + 9} ${hy}Z" fill="#2a1e18" opacity=".18"/>`;
  o += `<rect x="${hx - 8}" y="${hy - 46}" width="16" height="2.4" fill="#2f2a2a"/><rect x="${hx - 5}" y="${hy - 55}" width="10" height="9" fill="#fff4c0"/><path d="M${hx - 5} ${hy - 55}h10M${hx} ${hy - 55}v9" stroke="#2f2a2a" stroke-width=".8"/><path d="M${hx - 6.5} ${hy - 55}L${hx} ${hy - 61}L${hx + 6.5} ${hy - 55}Z" fill="#2f2a2a"/>`;
  o += house(b, 420, 104, { w: 22, h: 10, e: 10, rh: 6, wall: "#f2ece0", wallShade: "#b8b0a0", roof: "#3d4450", roofDark: "#262b33", cols: 2, rows: 1, smoke: "#d9dde2" });
  // the shingle beach
  const beach = (x: number): number => 206 + x * 0.04 + Math.sin(x / 50) * 3;
  o += `<path d="M-10 ${f(beach(-10) - 3)}${Array.from({ length: 16 }, (_, i) => `L${f(i * 20)} ${f(beach(i * 20) - 3 + Math.sin(i * 1.7) * 1.5)}`).join("")}" fill="none" stroke="#f4f6f1" stroke-width="3" stroke-linecap="round" opacity=".8"/>`;
  o += land(beach, b.lin([[0, "#b9ae99"], [0.4, "#a0947d"], [1, "#7a6f5d"]]), "", 20, -20, 320);
  o += dotPath(scatter(b, 150, -10, 320, 210, 300, 0.5, 1.4, beach), "#ddd4c3", 0.85) + dotPath(scatter(b, 120, -10, 320, 210, 300, 0.5, 1.4, beach), "#6e6556", 0.6) + dotPath(scatter(b, 40, -10, 320, 210, 300, 0.5, 1.2, beach), "#9bb0b8", 0.7) + pools(b, [[140, 214, 120]], "#fff2cc", 0.3);
  // boats pulled up on the shingle, and a groyne
  const boat = (x: number, y: number, s: number, hull: string, stripe: string): string =>
    `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="-2" cy="2" rx="20" ry="2.4" fill="#1a160c" opacity=".3"/><path d="M-18 -6H18L13 2H-13Z" fill="${hull}"/><path d="M-17.4 -4.6H17.2L16.4 -3H-16.6Z" fill="${stripe}"/><path d="M-18 -6H18" stroke="#2a2018" stroke-width="1"/><path d="M-4 -6V-24M-4 -22L8 -8" stroke="#3a2c20" stroke-width="1"/></g>`;
  o += boat(150, 232, 1.4, "#3f6fa0", "#f2e3c2") + boat(222, 222, 1.1, "#c2493b", "#f6efe0") + boat(40, 238, 1.2, "#e2b84a", "#3f6fa0");
  o += `<path d="M260 210l40 26M268 206l40 26" stroke="#4a3a2a" stroke-width="3"/><path d="M262 207v-6M276 216v-6M290 225v-6M304 234v-6" stroke="#3a2c20" stroke-width="3.5" stroke-linecap="round"/>`;
  o += birds(b, 5, 160, 320, 70, 110, 4.5, "#f3f1ea") + birds(b, 3, 200, 280, 100, 120, 3, "#2f3640");
  return o;
}

function theRift(b: Brush): string {
  const lx = -1;
  let o = sky(b, [[0, "#2f2c5c"], [0.35, "#7d4d78"], [0.62, "#e07a5f"], [0.82, "#f6b26b"], [1, "#ffd99a"]]);
  o += glow(b, 110, 138, 200, "#ffd18a", 0.95) + `<circle cx="110" cy="138" r="18" fill="#fff0c6"/>`;
  for (const [x, y, w] of [[260, 70, 260], [120, 92, 200], [390, 104, 150], [60, 60, 160], [330, 44, 180]] as const) o += streak(b, x, y, w, "#f7a07a", 0.6) + `<ellipse cx="${x + 10}" cy="${y + 2.5}" rx="${f(w * 0.42)}" ry="${f(w * 0.022)}" fill="#ffd9a8" opacity=".55"/>`;
  const far = roll(b, 136, 6, 1.6);
  o += land(far, b.lin([[0, "#7d5a7a"], [1, "#8d6a7c"]]));
  o += haze(b, 140, 22, "#f6b98a", 0.5);
  const mid = roll(b, 150, 3, 2);
  o += land(mid, b.lin([[0, "#b88a52"], [0.5, "#9a7a3e"], [1, "#7c6a34"]]));
  // ploughed rows converging toward the sun
  let rows = "";
  for (let i = -8; i <= 16; i++) rows += `M${f(110 + i * 4)} 152L${f(110 + i * 70)} 310`;
  o += `<path d="${rows}" stroke="#5c4a24" stroke-width="1.2" opacity=".35"/>`;
  const fore = roll(b, 248, 6, 1);
  o += land(fore, b.lin([[0, "#6c5a30"], [1, "#3c2e1e"]]));
  // cranes against the sky
  const crane = (x: number, y: number, h: number, jl: number): string => {
    let lat = "";
    for (let yy = y - h; yy < y; yy += 6) lat += `M${x - 3} ${f(yy)}L${x + 3} ${f(yy + 6)}M${x + 3} ${f(yy)}L${x - 3} ${f(yy + 6)}`;
    return `<path d="M${x - 3} ${y}V${y - h}M${x + 3} ${y}V${y - h}${lat}" stroke="#2b2238" stroke-width="1" fill="none"/>` +
      `<path d="M${x - 24} ${y - h}H${x + jl}M${x - 24} ${y - h + 4}H${x + jl * 0.9}M${x} ${y - h - 12}L${x - 24} ${y - h}M${x} ${y - h - 12}L${x + jl} ${y - h}" stroke="#2b2238" stroke-width="1.6" fill="none"/>` +
      `<rect x="${x - 26}" y="${y - h}" width="10" height="7" fill="#2b2238"/><rect x="${x - 6}" y="${y - h - 2}" width="10" height="8" fill="#2b2238"/><path d="M${f(x + jl * 0.6)} ${y - h + 4}v${f(h * 0.35)}" stroke="#2b2238" stroke-width=".6"/><path d="M${f(x + jl * 0.6 - 3)} ${f(y - h + 4 + h * 0.35)}h6v4h-6Z" fill="#2b2238"/>` +
      glow(b, x, y - h - 12, 6, "#ff5a4a", 1) + `<circle cx="${x}" cy="${y - h - 12}" r="1.4" fill="#ff7a6a"/>`;
  };
  o += crane(330, 152, 98, 70) + crane(410, 154, 76, 52) + crane(250, 150, 58, 40);
  // the rift: a raw cut through the fields
  o += `<path d="M230 152C250 170 200 190 230 216C260 240 200 270 214 310L300 310C280 270 320 240 290 214C270 196 300 172 262 152Z" fill="${b.lin([[0, "#8a5a3a"], [1, "#5a3624"]])}"/>`;
  o += `<path d="M236 158C254 174 214 190 242 216C268 240 222 270 238 310L262 310C250 270 296 240 270 214C250 196 278 174 252 158Z" fill="#3a2418" opacity=".7"/>`;
  o += `<path d="M190 166l14 -10l16 10ZM300 170l18 -14l22 14ZM170 200l20 -12l26 12Z" fill="#7a5034"/>`;
  // barrier and cones
  o += `<path d="M196 172h22M196 176h22" stroke="#f3a43a" stroke-width="2.2" stroke-dasharray="4 3"/><path d="M198 172v8M216 172v8" stroke="#2b2238" stroke-width="1"/>`;
  o += [180, 288, 300].map((x) => `<path d="M${x} 196l3 -9l3 9Z" fill="#f08a3c"/><path d="M${x + 1.2} 192.5h3.6" stroke="#fff" stroke-width="1"/>`).join("");
  // the fence cutting across the field, with its long shadow
  const fy = (x: number): number => 186 + (x - 120) * 0.22;
  let posts = "";
  let shadow = "";
  for (let x = 120; x <= 500; x += 18) {
    posts += `M${x} ${f(fy(x))}v${f(-18 - (x - 120) * 0.05)}`;
    shadow += `M${x} ${f(fy(x))}l${f(36 + (x - 120) * 0.1)} 4`;
  }
  o += `<path d="${shadow}" stroke="#3a2418" stroke-width="2" opacity=".35"/>`;
  o += `<path d="M120 ${f(fy(120) - 9)}L500 ${f(fy(500) - 28)}L500 ${f(fy(500))}L120 ${f(fy(120))}Z" fill="#46424f" opacity=".18"/>`;
  let mesh = "";
  for (let x = 120; x <= 500; x += 5) mesh += `M${x} ${f(fy(x))}l5 ${f(-18 - (x - 120) * 0.05)}M${x + 5} ${f(fy(x + 5))}l-5 ${f(-18 - (x - 120) * 0.05)}`;
  o += `<path d="${mesh}" stroke="#6c6878" stroke-width=".4" opacity=".55"/>`;
  o += `<path d="${posts}" stroke="#2b2238" stroke-width="2"/><path d="M120 ${f(fy(120) - 17)}L500 ${f(fy(500) - 36)}" stroke="#2b2238" stroke-width="1.2"/>`;
  o += `<g transform="translate(360 ${f(fy(360) - 30)}) rotate(12)"><rect width="40" height="14" fill="#f2c94c"/><rect x="1.5" y="1.5" width="37" height="11" fill="none" stroke="#2b2238" stroke-width=".8"/><text x="20" y="9.8" text-anchor="middle" font-size="6.6" font-weight="800" fill="#2b2238" font-family="sans-serif">KEEP OUT</text></g>`;
  // the last farm on the left, still lit
  o += tree(b, 70, 160, 14, { trunk: "#2b2238", dark: "#3a2c3e", mid: "#5a4250", light: "#c9805a" }, lx, 3.5);
  o += house(b, 20, 166, { w: 34, h: 13, e: 14, rh: 10, wall: "#c99a72", wallShade: "#6a4a4c", roof: "#5a4050", roofDark: "#2f2434", cols: 2, rows: 1, win: "#ffcf6a", frame: "#7a5a50", smoke: "#c9a8b0" });
  o += blades(b, 100, -10, 210, (x) => fore(x) + 4 + b.r(0, 44), 8, 18, "#c9a05a", 1, 0.3, 0.8) + blades(b, 90, 300, 490, (x) => fore(x) + 4 + b.r(0, 44), 8, 18, "#c9a05a", 1, 0.3, 0.8);
  o += birds(b, 7, 140, 260, 60, 100, 3.5, "#2b2238");
  return o;
}

function theBallot(b: Brush): string {
  const lx = -1;
  let o = sky(b, [[0, "#78b6e0"], [0.55, "#c9e1ea"], [1, "#f6ecd0"]]);
  o += glow(b, 90, 50, 130, "#fff5d6", 0.9) + `<circle cx="90" cy="50" r="12" fill="#fffbea"/>`;
  o += cloud(b, 360, 46, 120, "#ffffff", "#d0dce6") + cloud(b, 180, 28, 80, "#ffffff", "#d6e0e8", 0.9) + cloud(b, 460, 84, 60, "#ffffff", "#dbe2e6", 0.85);
  const far = roll(b, 132, 6, 1.6);
  o += land(far, b.lin([[0, "#a8c0c4"], [1, "#b6cbbf"]]));
  // the church spire over the roofs
  o += `<path d="M412 136V110h10V136ZM412 110l5 -28l5 28Z" fill="#a3b3b4"/>`;
  o += haze(b, 136, 16, "#f3efdd", 0.5);
  const mid = (x: number): number => 150 + Math.sin(x / 80) * 2;
  o += land(mid, b.lin([[0, "#8fbd64"], [1, "#7fb056"]]));
  // cottages either side of the hall
  o += tree(b, 70, 150, 12, SPRING, lx) + tree(b, 420, 152, 12, SPRING, lx);
  o += house(b, 20, 166, { w: 48, h: 16, e: 18, rh: 13, wall: "#f3e7cf", wallShade: "#c2ad88", roof: "#c9a25a", roofDark: "#8a6a34", thatch: true, cols: 3, rows: 1, door: "#2f5a7a", smoke: "#f4f1ea" });
  o += house(b, 370, 166, { w: 48, h: 16, e: 18, rh: 13, wall: "#e9d5c6", wallShade: "#b39684", roof: "#a94f3a", roofDark: "#6e3224", cols: 3, rows: 1, door: "#3c6a3a", flip: true });
  // the village hall, today's polling station
  const hx = 190;
  const hy = 172;
  o += `<path d="M${hx - 4} ${hy}L${hx + 120} ${hy - 8}L${hx + 140} ${hy + 6}L${hx + 4} ${hy + 6}Z" fill="#1a160c" opacity=".22"/>`;
  o += `<rect x="${hx}" y="${hy - 34}" width="100" height="34" fill="${b.lin([[0, "#c96f4e"], [1, "#9a4e36"]])}"/>`;
  let bricks = "";
  for (let r = 0; r < 11; r++) bricks += `M${hx} ${hy - 34 + r * 3.1}h100`;
  o += `<path d="${bricks}" stroke="#7a3c2a" stroke-width=".4" opacity=".55"/>`;
  o += `<path d="M${hx - 4} ${hy - 33}L${hx + 50} ${hy - 62}L${hx + 104} ${hy - 33}Z" fill="${b.lin([[0, "#5d6170"], [1, "#3e414e"]])}"/>`;
  o += `<path d="M${hx - 4} ${hy - 33}L${hx + 50} ${hy - 62}L${hx + 104} ${hy - 33}" fill="none" stroke="#f1e7d6" stroke-width="2.5" stroke-linejoin="round"/>`;
  o += `<path d="M${hx + 50} ${hy - 62}V${hy - 33}L${hx + 104} ${hy - 33}Z" fill="#000" opacity=".15"/>`;
  // bell cupola and flag
  o += `<rect x="${hx + 45}" y="${hy - 74}" width="10" height="12" fill="#f1e7d6"/><path d="M${hx + 43} ${hy - 74}l7 -7l7 7Z" fill="#3e414e"/><circle cx="${hx + 50}" cy="${hy - 68}" r="2" fill="#c9a24a"/><path d="M${hx + 50} ${hy - 81}v-12" stroke="#3e414e" stroke-width=".8"/><path d="M${hx + 50} ${hy - 93}l9 2.5l-9 2.5Z" fill="#2f7f8a"/>`;
  // arched windows and the open door
  let win = "";
  for (const wx of [hx + 10, hx + 26, hx + 66, hx + 82]) win += `M${wx} ${hy - 6}v-16a4 4 0 0 1 8 0v16Z`;
  o += `<path d="${win}" fill="#ffe2a0" stroke="#f1e7d6" stroke-width="1.2"/>`;
  o += `<path d="M${hx + 42} ${hy}v-18a8 8 0 0 1 16 0v18Z" fill="#ffcf74" stroke="#f1e7d6" stroke-width="1.4"/><path d="M${hx + 42} ${hy}v-18l-4 2v16Z" fill="#7a3c2a"/>`;
  o += `<rect x="${hx + 22}" y="${hy - 44}" width="56" height="9" rx="1.5" fill="#f6f0e2" stroke="#2f3a4a" stroke-width=".8"/><text x="${hx + 50}" y="${hy - 37.6}" text-anchor="middle" font-size="5.4" font-weight="800" letter-spacing=".4" fill="#2f3a4a" font-family="sans-serif">POLLING STATION</text>`;
  // the green, its chestnut, posters and bunting
  const near = (x: number): number => 176 + Math.sin(x / 70) * 2;
  const nearD = landD(near);
  o += `<path d="${nearD}" fill="${b.lin([[0, "#86bb58"], [1, "#5f9a3e"]])}"/>`;
  o += clipTo(b, nearD, stripes(-200, 176, 120, 34, 26, 130, "#a3d070", 12, 0.12) + pools(b, [[110, 200, 120]], "#fff4c8", 0.3) + pools(b, [[400, 230, 100]], "#25401a", 0.2));
  o += `<path d="${ribbon([[240, 172, 9], [240, 200, 14], [240, 240, 22], [240, 300, 34]])}" fill="${b.lin([[0, "#ecdcb4"], [1, "#cdb88a"]])}"/>`;
  let flags = "";
  for (let y = 178; y < 300; y += 5 + (y - 170) * 0.06) {
    const w = 9 + (y - 172) * 0.2;
    flags += `M${f(240 - w)} ${f(y)}H${f(240 + w)}`;
  }
  o += `<path d="${flags}" stroke="#b9a274" stroke-width=".6" opacity=".6"/>`;
  o += dotPath(drifts(b, [[204, 174], [276, 174]], 10, 14, 0.9, 1.5), "#e4505c") + dotPath(drifts(b, [[214, 175], [266, 175]], 8, 12, 0.9, 1.4), "#fff1b8");
  // the duck pond and a bench
  o += `<ellipse cx="392" cy="${f(near(392) + 52)}" rx="50" ry="9" fill="#4f7a3a"/><ellipse cx="392" cy="${f(near(392) + 51)}" rx="47" ry="7.5" fill="${b.lin([[0, "#d8e8ee"], [1, "#8fb6c8"]])}"/>`;
  o += `<path d="M362 ${f(near(392) + 50)}h22M398 ${f(near(392) + 53)}h18" stroke="#fff" stroke-width=".9" opacity=".8"/>`;
  o += `<g transform="translate(380 ${f(near(392) + 50)})"><ellipse cx="0" cy="0" rx="3.2" ry="1.6" fill="#f6f2e6"/><circle cx="2.6" cy="-1.6" r="1.2" fill="#f6f2e6"/><path d="M3.6 -1.6l1.6 .3" stroke="#e8a030" stroke-width=".8"/></g><g transform="translate(404 ${f(near(392) + 48)})"><ellipse cx="0" cy="0" rx="3" ry="1.5" fill="#6a5a3a"/><circle cx="-2.4" cy="-1.5" r="1.1" fill="#2f6a4a"/></g>`;
  o += `<path d="M72 228h22M74 228v6M92 228v6M72 224h22" stroke="#6a4a30" stroke-width="1.6"/><path d="M70 236h28" stroke="#1a160c" stroke-width="2" opacity=".2"/>`;
  o += tree(b, 120, 196, 22, SPRING, lx, 1.2) + tree(b, 380, 198, 20, SPRING, lx, 1.2);
  const board = (x: number, y: number, c: string, t1: string, t2: string): string =>
    `<path d="M${x + 2} ${y}l-4 16M${x + 22} ${y}l4 16" stroke="#5a4232" stroke-width="1.6"/><rect x="${x - 2}" y="${y - 24}" width="28" height="26" rx="1.5" fill="${c}" stroke="#2b2320" stroke-width=".8"/><text x="${x + 12}" y="${y - 13}" text-anchor="middle" font-size="7" font-weight="800" fill="#fff" font-family="sans-serif">${t1}</text><text x="${x + 12}" y="${y - 5}" text-anchor="middle" font-size="5.2" font-weight="700" fill="#fff" font-family="sans-serif">${t2}</text>`;
  o += board(170, 200, "#1f8a8a", "VOTE", "PELL") + board(298, 202, "#4f8a3a", "KEEP", "LANES");
  const bunting = (x1: number, y1: number, x2: number, y2: number, sag: number): string => {
    const cols = ["#d9473b", "#f2c94c", "#3f6fb5", "#ffffff", "#4f9a5a"];
    const paths = cols.map(() => "");
    const n = Math.round((x2 - x1) / 9);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t + sag * 4 * t * (1 - t);
      paths[i % cols.length] += `M${f(x - 3)} ${f(y)}l3 7l3 -7Z`;
    }
    return `<path d="M${x1} ${y1}Q${(x1 + x2) / 2} ${f((y1 + y2) / 2 + sag * 2)} ${x2} ${y2}" fill="none" stroke="#5a4a3a" stroke-width=".6"/>` + paths.map((d, i) => `<path d="${d}" fill="${cols[i]}"/>`).join("");
  };
  o += bunting(150, 134, hx + 45, hy - 66, 10) + bunting(hx + 55, hy - 66, 340, 134, 10) + bunting(40, 120, 150, 134, 8) + bunting(340, 134, 460, 126, 8);
  const fore = roll(b, 256, 6, 1);
  o += land(fore, b.lin([[0, "#5f9a3a"], [1, "#3f7027"]]));
  o += dotPath(scatter(b, 40, -10, 490, 254, 298, 1.2, 2.2, fore), "#e44d5a", 0.95) + dotPath(scatter(b, 40, -10, 490, 254, 298, 1.2, 2.2, fore), "#fff4d6") + dotPath(scatter(b, 30, -10, 490, 254, 298, 1, 2, fore), "#f4c63a");
  o += dotPath(scatter(b, 30, 0, 480, 180, 240, 0.7, 1.2, near), "#fffbe8", 0.8);
  o += birds(b, 3, 260, 330, 70, 90, 3.4);
  return o;
}

function theMerger(b: Brush): string {
  const lx = -1;
  let o = sky(b, [[0, "#7f8a99"], [0.5, "#b8bec6"], [1, "#d9d8d0"]]);
  o += glow(b, 140, 50, 140, "#eef0f0", 0.6);
  for (const [x, y, w] of [[120, 34, 300], [380, 54, 260], [230, 82, 340], [50, 96, 200], [420, 112, 160]] as const) o += stratus(b, x, y, w, "#d2d6db", "#8a94a1", 0.85);
  // glass towers looming behind the fields
  const grid = b.def("grid", (id) => `<pattern id="${id}" width="5" height="6" patternUnits="userSpaceOnUse"><path d="M0 0h5M0 0v6" stroke="#e7eef4" stroke-width=".5" opacity=".55" fill="none"/></pattern>`);
  const tower = (x: number, top: number, w: number, side: number, tone: string, lit: string): string =>
    `<path d="M${x} 160V${top}H${x + w}V160Z" fill="${b.lin([[0, lit], [0.5, tone], [1, "#5b6a7c"]], 1, 1)}"/>` +
    `<path d="M${x + w} 160V${top}L${x + w + side} ${top + side * 0.3}V160Z" fill="${b.lin([[0, "#5c6878"], [1, "#46505e"]], 0, 1)}"/>` +
    `<rect x="${x}" y="${top}" width="${w}" height="${160 - top}" fill="url(#${grid})"/>` +
    `<path d="M${x + w * 0.15} ${top + 4}L${x + w * 0.5} ${top + 4}L${x + w * 0.1} ${f(top + (160 - top) * 0.6)}L${x + w * 0.04} ${f(top + (160 - top) * 0.6)}Z" fill="#ffffff" opacity=".22"/>`;
  o += tower(150, 46, 26, 8, "#8b9db0", "#c7d4de") + tower(296, 34, 30, 9, "#7f93a8", "#c3d0dc") + tower(190, 18, 36, 10, "#7a8ea4", "#d4dfe8") + tower(250, 4, 34, 10, "#71869d", "#cad8e3") + tower(340, 60, 24, 7, "#8fa1b2", "#ced8e0") + tower(110, 72, 22, 6, "#94a4b4", "#d0dae2");
  o += `<rect x="256" y="12" width="22" height="7" rx="1" fill="#2f3a48"/><text x="267" y="17.6" text-anchor="middle" font-size="5.4" font-weight="800" fill="#e7a23a" font-family="sans-serif">HC</text>`;
  o += `<path d="M162 46V26M159 46V26M162 26H192M162 26H150M161 18L150 26M161 18L192 26M184 26v10" stroke="#3a4250" stroke-width="1" fill="none"/><rect x="181" y="36" width="6" height="3" fill="#3a4250"/><circle cx="161" cy="18" r="1.3" fill="#ff6a5a"/>`;
  o += haze(b, 150, 50, "#dcdcd4", 0.75);
  // a patchwork of small fields in front
  const far = roll(b, 158, 3, 1.6);
  o += land(far, b.lin([[0, "#9fae86"], [1, "#93a37a"]]));
  const fields: [string, string][] = [["M-10 172L120 164L160 176L-10 190Z", "#a7b56e"], ["M120 164L250 162L262 176L160 176Z", "#c4b876"], ["M250 162L380 164L396 178L262 176Z", "#8fae6a"], ["M380 164L490 166L490 182L396 178Z", "#b3b377"], ["M-10 190L160 176L190 206L-10 222Z", "#8aa85e"], ["M160 176L262 176L300 208L190 206Z", "#9db766"], ["M262 176L396 178L440 210L300 208Z", "#c8bb72"], ["M396 178L490 182L490 214L440 210Z", "#89a65c"], ["M-10 222L190 206L210 242L-10 246Z", "#b6b06c"], ["M190 206L300 208L320 240L210 242Z", "#7f9f56"], ["M300 208L440 210L470 238L320 240Z", "#a3b465"], ["M440 210L490 214L490 238L470 238Z", "#c2b874"]];
  o += fields.map(([d, c]) => `<path d="${d}" fill="${c}"/>`).join("");
  let furrows = "";
  for (let i = 0; i < 8; i++) furrows += `M${170 + i * 14} 178L${200 + i * 14} 206M${270 + i * 16} 178L${310 + i * 16} 208`;
  o += `<path d="${furrows}" stroke="#6f7a3a" stroke-width=".7" opacity=".45"/>`;
  const H9: Leaf = { trunk: "#4a3e30", dark: "#3f5a34", mid: "#5f7a46", light: "#8ea068" };
  o += hedge(b, -10, 172, 120, 164, 3, H9) + hedge(b, 120, 164, 250, 162, 3, H9) + hedge(b, 250, 162, 490, 166, 3, H9) + hedge(b, -10, 190, 160, 176, 4, H9) + hedge(b, 160, 176, 396, 178, 4, H9) + hedge(b, 396, 178, 490, 182, 4, H9);
  o += hedge(b, 160, 176, 190, 206, 4, H9) + hedge(b, 396, 178, 440, 210, 4, H9) + hedge(b, -10, 222, 190, 206, 4, H9) + hedge(b, 190, 206, 440, 210, 4, H9) + hedge(b, 300, 208, 320, 240, 4, H9);
  o += tree(b, 120, 166, 9, H9, lx) + tree(b, 400, 180, 10, H9, lx);
  o += house(b, 206, 196, { w: 34, h: 13, e: 14, rh: 10, wall: "#efe4cc", wallShade: "#a9997c", roof: "#6a6e78", roofDark: "#454852", cols: 2, rows: 1, door: "#4a3a2a", smoke: "#e6e8ea" });
  o += house(b, 256, 198, { w: 26, h: 12, e: 12, rh: 8, wall: "#9e5a40", wallShade: "#6a3a2a", roof: "#5a5c62", roofDark: "#3a3c42", cols: 1, rows: 1, chimney: false });
  for (const [x, y] of [[60, 204], [84, 210], [110, 200], [340, 196], [360, 200]] as const) o += sheep(b, x, y, 1);
  const fore = roll(b, 236, 6, 1);
  o += land(fore, b.lin([[0, "#71904f"], [1, "#46602f"]]));
  o += hedge(b, -20, 240, 500, 236, 8, H9);
  o += blades(b, 90, -10, 490, (x) => fore(x) + 10 + b.r(0, 50), 8, 16, "#8ba660", 1, 0.3, 0.8);
  // fine drizzle
  let rain = "";
  for (let i = 0; i < 40; i++) rain += `M${f(b.r(0, 480))} ${f(b.r(0, 220))}l-2 9`;
  o += `<path d="${rain}" stroke="#eef2f4" stroke-width=".6" opacity=".45"/>`;
  o += birds(b, 4, 360, 460, 90, 120, 3, "#4a4f5a");
  return o;
}

function kingsmarket(b: Brush): string {
  let o = sky(b, [[0, "#0d1230"], [0.45, "#232a58"], [0.78, "#4a3f6a"], [1, "#7a4f5e"]]);
  o += dotPath(scatter(b, 90, -10, 490, 0, 130, 0.3, 0.8), "#ffffff", 0.8) + dotPath(scatter(b, 14, -10, 490, 0, 100, 0.9, 1.3), "#fff6d8", 0.95);
  o += glow(b, 400, 46, 70, "#e8eeff", 0.55);
  o += `<path d="M402 33A13 13 0 1 0 402 59A10.5 13 0 1 1 402 33Z" fill="#f6f2e2"/>`;
  o += streak(b, 130, 70, 200, "#6a6a9a", 0.35) + streak(b, 330, 88, 160, "#7a6a90", 0.3);
  // distant roofs
  const far = roll(b, 150, 4, 1.5);
  o += land(far, "#3a3360");
  // the cathedral
  const c = "#1c1a36";
  const cx = 160;
  const cy = 176;
  let cat = `M${cx} ${cy}V${cy - 70}l4 -10l4 10V${cy - 54}H${cx + 26}V${cy - 70}l4 -10l4 10V${cy}Z`;
  cat += `M${cx + 8} ${cy - 54}H${cx + 26}V${cy - 40}L${cx + 17} ${cy - 50}L${cx + 8} ${cy - 40}Z`;
  cat += `M${cx - 30} ${cy}V${cy - 92}l2 -5l2 5V${cy - 98}l6 -6l6 6V${cy - 92}l2 -5l2 5V${cy}Z`;
  cat += `M${cx + 34} ${cy}V${cy - 50}L${cx + 150} ${cy - 50}V${cy}Z`;
  cat += `M${cx + 34} ${cy - 50}L${cx + 92} ${cy - 66}L${cx + 150} ${cy - 50}Z`;
  cat += `M${cx + 100} ${cy - 50}V${cy - 84}H${cx + 126}V${cy - 50}ZM${cx + 100} ${cy - 84}L${cx + 113} ${cy - 156}L${cx + 126} ${cy - 84}Z`;
  cat += `M${cx + 66} ${cy}V${cy - 60}L${cx + 92} ${cy - 76}V${cy}Z`;
  o += `<path d="${cat}" fill="${c}"/>`;
  // moonlit edges
  o += `<path d="M${cx + 113} ${cy - 156}L${cx + 126} ${cy - 84}V${cy - 50}" fill="none" stroke="#6a6aa8" stroke-width=".9" opacity=".7"/>`;
  // rose window and lancets aglow
  o += glow(b, cx + 17, cy - 30, 20, "#ffb84a", 0.6);
  o += `<circle cx="${cx + 17}" cy="${cy - 30}" r="7" fill="${b.rad([[0, "#ffe7a0"], [0.6, "#f2a446"], [1, "#b8582a"]])}"/><path d="M${cx + 10} ${cy - 30}h14M${cx + 17} ${cy - 37}v14M${cx + 12} ${cy - 35}l10 10M${cx + 22} ${cy - 35}l-10 10" stroke="${c}" stroke-width=".8"/>`;
  let lancets = "";
  for (let i = 0; i < 7; i++) lancets += `M${cx + 40 + i * 15} ${cy - 14}v-20a2.6 2.6 0 0 1 5.2 0v20Z`;
  lancets += `M${cx - 22} ${cy - 50}v-16a2.6 2.6 0 0 1 5.2 0v16ZM${cx - 12} ${cy - 50}v-16a2.6 2.6 0 0 1 5.2 0v16ZM${cx + 109} ${cy - 66}v-10a2.6 2.6 0 0 1 5.2 0v10Z`;
  o += `<path d="${lancets}" fill="#e89a46" opacity=".85"/>`;
  o += `<path d="M${cx + 12} ${cy}v-14a5 5 0 0 1 10 0v14Z" fill="#ffcf74"/>`;
  // the town in front, windows lit
  const roofs = (base: number, n: number, x0: number, x1: number, col: string, winCol: string): string => {
    let d = "";
    let w = "";
    let x = x0;
    for (let i = 0; i < n && x < x1; i++) {
      const bw = b.r(18, 30);
      const bh = b.r(16, 30);
      const pk = b.r(7, 13);
      d += `M${f(x)} ${base}V${f(base - bh)}L${f(x + bw / 2)} ${f(base - bh - pk)}L${f(x + bw)} ${f(base - bh)}V${base}Z`;
      if (b.r() < 0.6) d += `M${f(x + bw * 0.7)} ${f(base - bh - pk * 0.4)}v-9h4v9Z`;
      for (let k = 0; k < 3; k++) if (b.r() < 0.55) w += `M${f(x + 3 + k * (bw - 6) / 3)} ${f(base - bh + 5 + b.r(0, bh - 14))}h3.2v4.2h-3.2Z`;
      x += bw + b.r(-2, 1);
    }
    return `<path d="${d}" fill="${col}"/><path d="${w}" fill="${winCol}"/>`;
  };
  o += roofs(186, 30, -20, 500, "#2a2648", "#e6a94e");
  o += roofs(212, 30, -30, 510, "#221e3c", "#ffc768");
  // the market square: cobbles, stalls and lantern strings
  o += `<rect x="-10" y="210" width="${SW + 20}" height="100" fill="${b.lin([[0, "#3d3048"], [1, "#221a2c"]])}"/>`;
  o += `<ellipse cx="240" cy="236" rx="190" ry="34" fill="${b.rad([[0, "#ffb860", 0.5], [1, "#ffb860", 0]])}"/>`;
  let cob = "";
  for (let i = 0; i < 70; i++) cob += `M${f(b.r(0, 480))} ${f(b.r(222, 298))}h${f(b.r(2, 4))}`;
  o += `<path d="${cob}" stroke="#7a5a6a" stroke-width=".8" opacity=".5"/>`;
  const stripes = b.def("awn", (id) => `<pattern id="${id}" width="8" height="10" patternUnits="userSpaceOnUse"><rect width="4" height="10" fill="#d9473b"/><rect x="4" width="4" height="10" fill="#f6ead2"/></pattern>`);
  const stall = (x: number, y: number, w: number): string =>
    `<rect x="${x}" y="${y - 16}" width="${w}" height="16" fill="#3a2a2a"/><rect x="${x + 2}" y="${y - 14}" width="${w - 4}" height="7" fill="#ffcf74" opacity=".85"/>` +
    dotPath(scatter(b, 10, x + 3, x + w - 3, y - 10, y - 7, 1.1, 1.8), "#e8743a") +
    `<path d="M${x - 4} ${y - 16}L${x + 2} ${y - 28}H${x + w - 2}L${x + w + 4} ${y - 16}Z" fill="url(#${stripes})"/><path d="M${x - 4} ${y - 16}H${x + w + 4}" stroke="#7a2a24" stroke-width="1.2"/><path d="M${x} ${y}v-16M${x + w} ${y}v-16" stroke="#2a1e1e" stroke-width="1.2"/>`;
  o += stall(180, 236, 40) + stall(244, 238, 44) + stall(310, 234, 36) + stall(120, 238, 36);
  const lanterns = (x1: number, y1: number, x2: number, y2: number, sag: number, n: number): string => {
    let s = `<path d="M${x1} ${y1}Q${(x1 + x2) / 2} ${f((y1 + y2) / 2 + sag * 2)} ${x2} ${y2}" fill="none" stroke="#1a1426" stroke-width=".7"/>`;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t + sag * 4 * t * (1 - t);
      s += glow(b, x, y + 3, 9, "#ffbe5c", 0.55) + `<ellipse cx="${f(x)}" cy="${f(y + 3)}" rx="2" ry="2.6" fill="${i % 3 ? "#ffd27a" : "#ff9a5a"}"/>`;
    }
    return s;
  };
  o += lanterns(-10, 160, 160, 176, 10, 8) + lanterns(160, 176, 330, 166, 12, 8) + lanterns(330, 166, 490, 172, 10, 7);
  o += `<ellipse cx="240" cy="306" rx="300" ry="40" fill="#120c1c" opacity=".5"/>`;
  return o;
}

const ACTS: ((b: Brush) => string)[] = [brindle, highmoor, saltmarsh, rivermead, oakvale, shingleBay, theRift, theBallot, theMerger, kingsmarket];
/** The canvas y where each act's banner crop starts, and the vignette tint for each act. */
const BANNER_TOP = [88, 84, 90, 116, 52, 60, 76, 80, 46, 56];
const TINT = ["#2a1a10", "#1e1828", "#2a2010", "#18202a", "#1a200c", "#10141e", "#1e0e20", "#1e180c", "#1a1e26", "#05040e"];

/**
 * The painted backdrop for act n. "story" (the default) is the whole 480×300 canvas for the story dialog;
 * "banner" is a 150-unit band around the act's set piece for the map's act header.
 */
export function actScene(n: number, crop: "story" | "banner" = "story"): string {
  const i = (((n - 1) % ACTS.length) + ACTS.length) % ACTS.length;
  const b = new Brush(`as${++sceneSeq}-`, 7919 * (i + 1));
  const body = ACTS[i]!(b) + finish(b, i + 3, TINT[i], i === 9 ? 0.5 : 0.36);
  // The banner pins its top edge just above the set piece: phones show about 130 units of height, wide screens
  // fewer, and the title plate covers the bottom, so the set piece sits in the top half of the band.
  const vb = crop === "banner" ? `0 ${BANNER_TOP[i]!} ${SW} 150` : `0 0 ${SW} ${SH}`;
  const fit = crop === "banner" ? "xMidYMin slice" : "xMidYMid slice";
  return `<svg class="act-scene" viewBox="${vb}" preserveAspectRatio="${fit}" aria-hidden="true"><defs>${b.defs.join("")}</defs>${body}</svg>`;
}

export function renderMap(list: HTMLElement, levels: Level[], data: SaveData, open: (lv: Level) => void, openEndless?: (act: number) => void): void {
  list.replaceChildren();
  const acts = new Map<number, Level[]>();
  for (const lv of levels) {
    const n = Math.floor((lv.id - 1) / 10) + 1;
    if (!acts.has(n)) acts.set(n, []);
    acts.get(n)!.push(lv);
  }
  let current: HTMLElement | null = null;
  const nextId = levels.find((lv) => isUnlocked(data, lv.id) && !data.stars[String(lv.id)])?.id ?? null;
  for (const [n, lvs] of acts) {
    const li = document.createElement("li");
    li.className = "act";
    const firstUnlocked = isUnlocked(data, lvs[0]!.id);
    if (!firstUnlocked) li.classList.add("act-locked");
    const got = lvs.reduce((a, lv) => a + (data.stars[String(lv.id)] ?? 0), 0);
    const head = document.createElement("div");
    head.className = "act-head";
    // Banners are painted once as images (lazy, cached by the browser): ten live SVG scenes with grain
    // filters made the map heavy to scroll on phones. The story scene stays live SVG.
    const img = document.createElement("img");
    img.className = "act-scene";
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(actScene(n, "banner").replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" '))}`;
    head.replaceChildren(img);
    const title = document.createElement("div");
    title.className = "act-title";
    const num = document.createElement("span");
    num.className = "act-num";
    num.textContent = `Act ${n}`;
    const place = document.createElement("span");
    place.className = "act-place";
    place.textContent = lvs[0]!.place;
    const tally = document.createElement("span");
    tally.className = "act-tally";
    tally.textContent = `★ ${got}/${lvs.length * 3}`;
    tally.setAttribute("aria-label", `${got} of ${lvs.length * 3} stars`);
    title.append(num, place, tally);
    if (openEndless && endlessUnlocked(data.stars, n)) {
      const best = data.endless?.[String(n)] ?? 0;
      const eb = document.createElement("button");
      eb.type = "button";
      eb.className = "act-endless";
      eb.dataset.endless = String(n);
      eb.textContent = best ? `∞ Endless · best wave ${best}` : "∞ Endless";
      eb.title = "Waves that never stop. Goodwill runs out, and your best wave is kept.";
      eb.addEventListener("click", () => openEndless(n));
      title.append(eb);
    }
    head.append(title);
    li.append(head);

    const trail = document.createElement("ol");
    trail.className = "trail";
    const svgNS = "http://www.w3.org/2000/svg";
    const path = document.createElementNS(svgNS, "svg");
    path.setAttribute("class", "trail-path");
    path.setAttribute("viewBox", "0 0 100 100");
    path.setAttribute("preserveAspectRatio", "none");
    path.setAttribute("aria-hidden", "true");
    const pts: string[] = [];
    lvs.forEach((_, i) => {
      const row = Math.floor(i / 5);
      const col = row % 2 === 0 ? i % 5 : 4 - (i % 5);
      pts.push(`${(col + 0.5) * 20},${row === 0 ? 30 : 76}`);
    });
    const pl = document.createElementNS(svgNS, "polyline");
    pl.setAttribute("points", pts.join(" "));
    pl.setAttribute("vector-effect", "non-scaling-stroke");
    path.append(pl);
    trail.append(path);

    lvs.forEach((lv, i) => {
      const row = Math.floor(i / 5);
      const col = row % 2 === 0 ? i % 5 : 4 - (i % 5);
      const unlocked = isUnlocked(data, lv.id);
      const stars = data.stars[String(lv.id)] ?? 0;
      const item = document.createElement("li");
      item.className = `stop c${col + 1} r${row + 1}`;
      const b = document.createElement("button");
      b.type = "button";
      const boss = lv.id % 10 === 0;
      b.className = `level node${boss ? " level-boss" : ""}${stars ? " cleared" : ""}`;
      b.disabled = !unlocked;
      b.dataset.level = String(lv.id);
      b.setAttribute(
        "aria-label",
        unlocked
          ? `Level ${lv.id}, ${lv.name}${boss ? ", boss" : ""}. ${lv.waves.length} waves. ${stars} of 3 stars${data.heroic?.[String(lv.id)] ? ", Heroic cleared" : ""}.`
          : `Level ${lv.id}, ${lv.name}. Locked: clear level ${lv.id - 1} first.`,
      );
      const numEl = document.createElement("span");
      numEl.className = "level-num";
      numEl.textContent = String(lv.id);
      const st = document.createElement("span");
      st.className = "level-stars";
      st.textContent = unlocked ? "★".repeat(stars) + "☆".repeat(3 - stars) + (data.heroic?.[String(lv.id)] ? "◆" : "") : "";
      const name = document.createElement("span");
      name.className = "level-name";
      name.textContent = lv.name;
      if (lv.twists?.length && unlocked) {
        const tw = document.createElement("span");
        tw.className = "level-twist";
        tw.textContent = lv.twists.map((t) => TWISTS[t].name).join(" · ");
        name.append(tw);
      }
      b.append(numEl, st, name);
      if (lv.id === nextId) {
        b.classList.add("next");
        const me = document.createElement("span");
        me.className = "you";
        me.setAttribute("aria-hidden", "true");
        me.innerHTML = cathSvg({ framing: "face", expression: "smirk" });
        b.append(me);
        current = b;
      }
      b.addEventListener("click", () => open(lv));
      item.append(b);
      trail.append(item);
    });
    li.append(trail);
    list.append(li);
  }
  (current as HTMLElement | null)?.scrollIntoView({ block: "center" });
}
