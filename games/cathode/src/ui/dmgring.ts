// "I know I'm hit" (docs/design/cathode-combat.md S6.2): the damage ring around the crosshair. Each source
// gets a tapered blood crescent on a 190u ring that points at it and keeps pointing at it as she turns; a
// source behind her (or far above or below) also gets a chevron at the edge of the safe frame; a melee hit
// flashes that screen edge; a live grenade within 6 m sits on the ring as a pulsing glyph. All SVG, sized in u
// (1 viewBox unit = 1u), driven by custom properties only (CSP: no inline style attributes).

const NS = "http://www.w3.org/2000/svg";
/** Ring radius and the arc's span and thickness, in u (S6.2). */
export const RING = { r: 190, spanDeg: 38, thick: 14, tip: 2 } as const;
/** Up to four sources at once. */
const SLOTS = 4;
const HOLD_S = 0.6;
const FADE_S = 0.6;
const POP_S = 0.09;
const CORE_S = 0.12;
const MELEE_EDGE_S = 0.25;

export type HurtKind = "bullet" | "melee" | "blast" | "laser";

export interface HurtSource {
  /** What it is (an enemy, a blast): a repeat hit from the same key restarts its arc. */
  key: unknown;
  /** World position to keep pointing at, if it has one. */
  at?: { x: number; y: number; z: number } | null;
  bearing: number;
  elevDeg: number;
  kind: HurtKind;
  /** Share of her max health this hit took (drives the arc's strength). */
  share: number;
}

interface Slot {
  g: SVGGElement;
  chev: HTMLElement;
  key: unknown;
  at: { x: number; y: number; z: number } | null;
  bearing: number;
  elev: number;
  kind: HurtKind;
  base: number;
  t: number;
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>, parent?: Element): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent?.append(e);
  return e;
}

/** A tapered crescent centred on "up": `thick` at the middle, `tip` at the ends, `span` degrees wide. */
export function crescent(r: number, spanDeg: number, thick: number, tip: number, n = 28): string {
  const half = (spanDeg * Math.PI) / 360;
  const outer: string[] = [];
  const inner: string[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const a = -half + 2 * half * u;
    const p = Math.sin(Math.PI * u);
    const th = tip + (thick - tip) * p * p * (3 - 2 * p);
    // The outer edge bulges more than the inner one recedes: it reads as a blow landing from outside.
    const ro = r + th * 0.62;
    const ri = r - th * 0.38;
    outer.push(`${(ro * Math.sin(a)).toFixed(2)} ${(-ro * Math.cos(a)).toFixed(2)}`);
    inner.unshift(`${(ri * Math.sin(a)).toFixed(2)} ${(-ri * Math.cos(a)).toFixed(2)}`);
  }
  return `M${outer.join("L")}L${inner.join("L")}Z`;
}

/** An arc line along the ring (the 2u hot core of the first 120 ms). */
function coreLine(r: number, spanDeg: number): string {
  const half = (spanDeg * Math.PI) / 360;
  return `M${(r * Math.sin(-half)).toFixed(2)} ${(-r * Math.cos(half)).toFixed(2)}A${r} ${r} 0 0 1 ${(r * Math.sin(half)).toFixed(2)} ${(-r * Math.cos(half)).toFixed(2)}`;
}

export class DamageRing {
  readonly root: HTMLElement;
  private readonly ringSvg: SVGSVGElement;
  private readonly slots: Slot[] = [];
  private readonly nades: SVGGElement[] = [];
  private readonly edge: HTMLElement;
  private edgeT = 0;
  private readonly set: (e: Element, k: string, v: string) => void;

  constructor(parent: HTMLElement, set: (e: Element, k: string, v: string) => void) {
    this.set = set;
    this.root = document.createElement("div");
    this.root.className = "hud-dmg";
    this.root.setAttribute("aria-hidden", "true");
    parent.append(this.root);
    this.edge = document.createElement("div");
    this.edge.className = "hud-dmg-edge";
    this.root.append(this.edge);
    const ext = RING.r + 70;
    this.ringSvg = svg("svg", { class: "hud-dmg-ring", viewBox: `${-ext} ${-ext} ${ext * 2} ${ext * 2}` }, this.root);
    const defs = svg("defs", {}, this.ringSvg);
    // Feathered ends: a mask that fades the crescent in over its first and last fifth (a gradient's
    // currentColor would resolve at the gradient, not at the arc, so the colour stays on the path).
    const grad = svg("linearGradient", { id: "hud-dmg-feather", x1: "0", x2: "1", y1: "0", y2: "0" }, defs);
    for (const [o, a] of [["0", "0"], ["0.22", "1"], ["0.78", "1"], ["1", "0"]] as const) svg("stop", { offset: o, "stop-color": "#fff", "stop-opacity": a }, grad);
    const mask = svg("mask", { id: "hud-dmg-mask", maskContentUnits: "objectBoundingBox" }, defs);
    svg("rect", { x: "0", y: "0", width: "1", height: "1", fill: "url(#hud-dmg-feather)" }, mask);
    const body = crescent(RING.r, RING.spanDeg, RING.thick, RING.tip);
    const glow = crescent(RING.r, RING.spanDeg + 8, RING.thick * 2.8 + 6, RING.tip + 4);
    const core = coreLine(RING.r, RING.spanDeg * 0.78);
    for (let i = 0; i < SLOTS; i++) {
      const g = svg("g", { class: "hud-dmg-arc" }, this.ringSvg);
      svg("path", { class: "glow", d: glow, mask: "url(#hud-dmg-mask)" }, g);
      svg("path", { class: "body", d: body, mask: "url(#hud-dmg-mask)" }, g);
      svg("path", { class: "core", d: core }, g);
      const chev = document.createElement("div");
      chev.className = "hud-dmg-chev";
      const cs = svg("svg", { viewBox: "-24 -16 48 32" }, chev);
      svg("path", { d: "M-20 -12L0 2L20 -12L20 -4L0 12L-20 -4Z" }, cs);
      this.root.append(chev);
      this.slots.push({ g, chev, key: null, at: null, bearing: 0, elev: 0, kind: "bullet", base: 0, t: 1e9 });
    }
    for (let i = 0; i < 2; i++) {
      const g = svg("g", { class: "hud-dmg-nade" }, this.ringSvg);
      const inner = svg("g", { class: "in" }, g);
      svg("circle", { class: "plate", r: "22" }, inner);
      svg("circle", { class: "pulse", r: "22" }, inner);
      // A grenade: a body, a lever and a pin ring.
      svg("path", { class: "icon", d: "M-7 -3a7.5 8.5 0 1 0 14 0a7.5 8.5 0 1 0 -14 0ZM-4 -11h8v4h-8ZM2 -12l8 -3l1 2l-7 4Z" }, inner);
      svg("circle", { class: "pin", cx: "-6", cy: "-12", r: "3" }, inner);
      this.nades.push(g);
    }
  }

  /** A hit from `src`: restarts its arc if it already has one, else takes a free slot (or the oldest). */
  hit(src: HurtSource): void {
    let s = this.slots.find((x) => x.key !== null && x.key === src.key && x.t < HOLD_S + FADE_S);
    if (!s) s = this.slots.reduce((a, b) => (b.t > a.t ? b : a));
    s.key = src.key ?? {};
    s.at = src.at ?? null;
    s.bearing = src.bearing;
    s.elev = src.elevDeg;
    s.kind = src.kind;
    s.base = 0.45 + 0.55 * Math.min(1, src.share / 0.25);
    s.t = 0;
    if (src.kind === "melee") {
      this.edgeT = MELEE_EDGE_S;
      const b = src.bearing;
      const side = Math.abs(b) > 2.36 ? "b" : Math.abs(b) < 0.4 ? "t" : b > 0 ? "r" : "l";
      for (const k of ["l", "r", "t", "b"]) this.edge.classList.toggle(`at-${k}`, k === side);
    }
  }

  /** Screenshot stages: moves every live arc `sec` seconds on (the frozen HUD runs at dt 0). */
  advance(sec: number): void {
    for (const s of this.slots) if (s.t < HOLD_S + FADE_S) s.t += sec;
    this.edgeT = Math.max(0, this.edgeT - sec);
  }

  /** Clears every arc (a new screenshot stage, a respawn). */
  clear(): void {
    for (const s of this.slots) {
      s.t = 1e9;
      s.key = null;
    }
    this.edgeT = 0;
  }

  /** The strongest arc's opacity right now (the screenshot runner's "stale arc" check reads it). */
  get alpha(): number {
    let a = 0;
    for (const s of this.slots) a = Math.max(a, this.slotAlpha(s));
    return a;
  }

  private slotAlpha(s: Slot): number {
    if (s.t >= HOLD_S + FADE_S) return 0;
    return s.base * (s.t < HOLD_S ? 1 : 1 - (s.t - HOLD_S) / FADE_S);
  }

  /**
   * Per frame. `resolve` turns a world position into the current bearing and elevation, so an arc tracks its
   * attacker as she turns; `nades` are live grenades within 6 m (their bearings).
   */
  update(dt: number, resolve: ((p: { x: number; y: number; z: number }) => { bearing: number; elevDeg: number }) | null, nades: number[]): void {
    let top = 0;
    for (const s of this.slots) {
      s.t += dt;
      const a = this.slotAlpha(s);
      top = Math.max(top, a);
      if (a <= 0) {
        this.set(s.g, "--a", "0");
        this.set(s.chev, "--a", "0");
        continue;
      }
      if (s.at && resolve) {
        const r = resolve(s.at);
        s.bearing = r.bearing;
        s.elev = r.elevDeg;
      }
      const sc = s.t < POP_S ? 1.15 - 0.15 * (s.t / POP_S) : 1;
      this.set(s.g, "--rot", `${((s.bearing * 180) / Math.PI).toFixed(1)}deg`);
      this.set(s.g, "--s", sc.toFixed(3));
      this.set(s.g, "--a", a.toFixed(3));
      s.g.classList.toggle("is-core", s.t < CORE_S);
      for (const k of ["blast", "laser"] as const) s.g.classList.toggle(`k-${k}`, s.kind === k);
      // Behind her (past 100 degrees either way), or more than 35 degrees up or down: a chevron at the frame's edge.
      const behind = Math.abs(s.bearing) > (100 * Math.PI) / 180;
      const off = behind || Math.abs(s.elev) > 35;
      if (off) {
        const top2 = !behind && s.elev > 35;
        s.chev.classList.toggle("at-top", top2);
        s.chev.classList.toggle("at-bottom", !top2);
        this.set(s.chev, "--cx", (50 + Math.sin(s.bearing) * 30).toFixed(1));
        for (const k of ["blast", "laser"] as const) s.chev.classList.toggle(`k-${k}`, s.kind === k);
      }
      this.set(s.chev, "--a", off ? a.toFixed(3) : "0");
    }
    this.set(this.root, "--a", top.toFixed(3));
    this.edgeT = Math.max(0, this.edgeT - dt);
    this.set(this.edge, "--a", (this.edgeT / MELEE_EDGE_S).toFixed(3));
    this.nades.forEach((g, i) => {
      const b = nades[i];
      this.set(g, "--a", b === undefined ? "0" : "1");
      if (b !== undefined) this.set(g, "--rot", `${((b * 180) / Math.PI).toFixed(1)}deg`);
    });
  }
}
