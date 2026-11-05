// Plan item 143: the people and animals working the farm. Bea, two farmhands, the dog and a few hens walk the
// verges and tend the plots between rounds; on a leak they run for the farmhouse, on a cleared round they cheer.
// Pure and deterministic (a seeded rng, no DOM): the 2D and 3D renderers only read positions and poses, and the
// unit test walks it for minutes of game time to check nobody ever stands on a lane cell.
//
// Movement is cell to cell between the centres of orthogonal neighbours that are both walkable, each critter
// carrying one fixed offset inside the cell (|offset| < 0.5), so the straight line between two walkable cells never
// crosses a third: nobody can set foot on a lane, a pond or a landmark. Lanes split the field, so each critter stays
// in its own region and "home" is the cell of that region nearest the farmhouse.

import { isPlot, laneCellsOf, plotKind, type Game, type GameEvent, type Level } from "./engine";

export type FolkKind = "bea" | "hand" | "dog" | "hen";
export type FolkMode = "work" | "flee" | "home" | "cheer";

export interface Folk {
  id: number;
  kind: FolkKind;
  /** Position in cell units (a cell's centre is col + 0.5). */
  x: number;
  y: number;
  /** -1 faces left, 1 right. */
  facing: 1 | -1;
  mode: FolkMode;
  /** True while stopped on an empty plot doing its job (hoeing, sniffing, pecking). */
  tending: boolean;
  /** True while walking or running between cells. */
  moving: boolean;
  /** Seconds in the current mode, for the renderers' animations. */
  t: number;
  // Internal state.
  ox: number;
  oy: number;
  fc: number;
  fr: number;
  tc: number;
  tr: number;
  k: number;
  wait: number;
  route: Array<[number, number]>;
  anchor: [number, number];
}

export interface FolkWorld {
  cols: number;
  rows: number;
  /** Walkable cells as "c,r". */
  walk: Set<string>;
  /** The farmhouse, in cell units. */
  house: [number, number];
  folk: Folk[];
  seed: number;
}

/** Cells per second, walking. Running is RUN times this. */
const SPEED: Record<FolkKind, number> = { bea: 1.1, hand: 0.85, dog: 1.7, hen: 0.6 };
const RUN = 2.8;
/** Seconds a leak keeps them indoors once home, and a cheer lasts. */
export const HIDE_SECS = 3.5;
export const CHEER_SECS = 2.2;

const key = (c: number, r: number) => `${c},${r}`;
const DIRS: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function rng(world: FolkWorld): number {
  // mulberry32
  let t = (world.seed = (world.seed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** The cells a critter may stand on: plots that aren't a pond, and no lane or landmark (isPlot excludes those). */
export function walkableCells(level: Level): Set<string> {
  const out = new Set<string>();
  const lanes = laneCellsOf(level);
  const blocked = new Set([...(level.oaks ?? []), ...(level.barns ?? [])].map(([c, r]) => key(c, r)));
  for (let r = 0; r < level.rows; r++)
    for (let c = 0; c < level.cols; c++) {
      const k = key(c, r);
      if (lanes.has(k) || blocked.has(k) || !isPlot(level, c, r) || plotKind(level, c, r) === "water") continue;
      out.add(k);
    }
  return out;
}

/** Cells reachable from (c, r) over `walk`, with their step distance. */
function flood(walk: Set<string>, c: number, r: number): Map<string, { d: number; from: string | null }> {
  const seen = new Map<string, { d: number; from: string | null }>([[key(c, r), { d: 0, from: null }]]);
  const q: Array<[number, number]> = [[c, r]];
  for (let i = 0; i < q.length; i++) {
    const [qc, qr] = q[i]!;
    const d = seen.get(key(qc, qr))!.d;
    for (const [dc, dr] of DIRS) {
      const nk = key(qc + dc, qr + dr);
      if (!walk.has(nk) || seen.has(nk)) continue;
      seen.set(nk, { d: d + 1, from: key(qc, qr) });
      q.push([qc + dc, qr + dr]);
    }
  }
  return seen;
}

const parse = (k: string): [number, number] => k.split(",").map(Number) as [number, number];

/** Who lives on this farm: Bea, two hands, the dog and three hens, fewer on a cramped field. */
const CAST: FolkKind[] = ["hand", "bea", "dog", "hen", "hand", "hen", "hen"];

export function makeFolk(level: Level, count = CAST.length): FolkWorld {
  const walk = walkableCells(level);
  const end = level.path[level.path.length - 1]!;
  const world: FolkWorld = { cols: level.cols, rows: level.rows, walk, house: [end[0] + 0.5, end[1] + 0.5], folk: [], seed: level.id * 7919 + 17 };
  const cells = [...walk].map(parse);
  if (!cells.length) return world;
  // Spread them out: each picks the free cell farthest from those already placed (ties by the seeded rng), the
  // hens settle next to the first hen, and the dog next to Bea.
  const taken: Array<[number, number]> = [];
  const n = Math.min(count, cells.length);
  for (let i = 0; i < n; i++) {
    const kind = CAST[i]!;
    let pick: [number, number] | undefined;
    const near = (to: [number, number]) =>
      cells.filter(([c, r]) => !taken.some(([a, b]) => a === c && b === r)).sort((a, b) => Math.hypot(a[0] - to[0], a[1] - to[1]) - Math.hypot(b[0] - to[0], b[1] - to[1]) || rng(world) - 0.5)[0];
    const firstHen = world.folk.find((f) => f.kind === "hen");
    const beaF = world.folk.find((f) => f.kind === "bea");
    if (kind === "hen" && firstHen) pick = near(firstHen.anchor);
    else if (kind === "dog" && beaF) pick = near(beaF.anchor);
    if (!pick) {
      let best = -1;
      for (const cell of cells) {
        if (taken.some(([a, b]) => a === cell[0] && b === cell[1])) continue;
        const d = taken.length ? Math.min(...taken.map(([a, b]) => Math.hypot(a - cell[0], b - cell[1]))) : rng(world) * 10;
        const score = d + rng(world) * 0.5;
        if (score > best) [best, pick] = [score, cell];
      }
    }
    if (!pick) pick = cells[Math.floor(rng(world) * cells.length)]!;
    taken.push(pick);
    const ox = (rng(world) - 0.5) * 0.5;
    const oy = (rng(world) - 0.5) * 0.4;
    world.folk.push({
      id: i,
      kind,
      x: pick[0] + 0.5 + ox,
      y: pick[1] + 0.5 + oy,
      facing: rng(world) < 0.5 ? 1 : -1,
      mode: "work",
      tending: false,
      moving: false,
      t: 0,
      ox,
      oy,
      fc: pick[0],
      fr: pick[1],
      tc: pick[0],
      tr: pick[1],
      k: 1,
      wait: rng(world) * 2,
      route: [],
      anchor: pick,
    });
  }
  return world;
}

/** A leak: everyone runs for the farmhouse (the cell of their own patch nearest it), then hides a moment. */
export function panic(world: FolkWorld): void {
  for (const f of world.folk) {
    const from = f.k >= 0.5 ? [f.tc, f.tr] : [f.fc, f.fr];
    const reach = flood(world.walk, from[0]!, from[1]!);
    let goal = key(from[0]!, from[1]!);
    let best = Infinity;
    for (const k of reach.keys()) {
      const [c, r] = parse(k);
      const d = Math.hypot(c + 0.5 - world.house[0], r + 0.5 - world.house[1]);
      if (d < best - 1e-9) [best, goal] = [d, k];
    }
    const route: Array<[number, number]> = [];
    for (let k: string | null = goal; k && k !== key(from[0]!, from[1]!); k = reach.get(k)!.from) route.unshift(parse(k));
    // Turn round on the spot: the step under way reverses to the cell it set out from, if that's nearer.
    if (f.k < 0.5) {
      [f.fc, f.fr, f.tc, f.tr] = [f.tc, f.tr, f.fc, f.fr];
      f.k = 1 - f.k;
    }
    f.route = route;
    f.mode = "flee";
    f.t = 0;
    f.wait = 0;
    f.tending = false;
  }
}

/** A cleared round: everyone stops and cheers (the ones hiding stay in). */
export function cheer(world: FolkWorld): void {
  for (const f of world.folk) {
    if (f.mode === "flee" || f.mode === "home") continue;
    f.mode = "cheer";
    f.t = 0;
    f.tending = false;
  }
}

function pickNext(world: FolkWorld, f: Folk, busy: Set<string>, wave: boolean): [number, number] | null {
  const opts: Array<{ c: number; r: number; w: number }> = [];
  for (const [dc, dr] of DIRS) {
    const c = f.tc + dc;
    const r = f.tr + dr;
    if (!world.walk.has(key(c, r))) continue;
    let w = 1;
    if (c === f.fc && r === f.fr) w *= 0.25; // don't dither back and forth
    if (busy.has(key(c, r))) w *= 0.15; // the plot a tower now stands on: walk round it
    const home = Math.hypot(c - f.anchor[0], r - f.anchor[1]);
    if (f.kind === "hen") w *= home <= 1.5 ? 1 : 0.1; // hens keep to their yard
    else if (f.kind === "dog") {
      const bea = world.folk.find((o) => o.kind === "bea");
      if (bea) w *= Math.hypot(c + 0.5 - bea.x, r + 0.5 - bea.y) < Math.hypot(f.x - bea.x, f.y - bea.y) ? 2.5 : 0.6;
    } else w *= home <= 3 ? 1 : 0.3;
    if (wave && f.kind !== "dog") w *= 0.5;
    opts.push({ c, r, w });
  }
  if (!opts.length) return null;
  let roll = rng(world) * opts.reduce((a, o) => a + o.w, 0);
  for (const o of opts) if ((roll -= o.w) <= 0) return [o.c, o.r];
  return [opts[0]!.c, opts[0]!.r];
}

/**
 * Advance everyone by dt seconds. `busy` holds the cells towers stand on (walked round when possible), `wave` is
 * true during a round (they work more slowly and keep their distance), `still` is reduced motion: poses change, no
 * one walks.
 */
export function stepFolk(world: FolkWorld, dt: number, busy: Set<string>, wave: boolean, still = false): void {
  if (dt <= 0) return;
  for (const f of world.folk) {
    f.t += dt;
    if (f.mode === "cheer" && f.t >= CHEER_SECS) [f.mode, f.t] = ["work", 0];
    if (f.mode === "home" && f.t >= HIDE_SECS) [f.mode, f.t, f.wait] = ["work", 0, 0.5 + rng(world)];
    if (still) {
      f.moving = false;
      if (f.mode === "flee") [f.mode, f.t] = ["home", 0];
      continue;
    }
    if (f.mode === "cheer" || f.mode === "home") {
      f.moving = false;
      continue;
    }
    const run = f.mode === "flee";
    let left = dt;
    while (left > 0) {
      if (f.k < 1) {
        const v = SPEED[f.kind] * (run ? RUN : wave ? 0.7 : 1);
        const step = Math.min(left, (1 - f.k) / v);
        f.k += step * v;
        left -= step;
        f.moving = true;
        if (f.k >= 1 - 1e-9) f.k = 1;
        continue;
      }
      // Arrived at (tc, tr).
      if (run) {
        const next = f.route.shift();
        if (!next) {
          [f.mode, f.t, f.moving] = ["home", 0, false];
          break;
        }
        [f.fc, f.fr, f.tc, f.tr, f.k] = [f.tc, f.tr, next[0], next[1], 0];
        continue;
      }
      // A tower just went up where it stands: it steps off at once rather than standing inside the tower.
      if (f.wait > 0 && busy.has(key(f.tc, f.tr))) f.wait = 0;
      if (f.wait > 0) {
        f.moving = false;
        f.tending = f.kind !== "dog" && !busy.has(key(f.tc, f.tr));
        const w = Math.min(left, f.wait);
        f.wait -= w;
        left -= w;
        continue;
      }
      const next = pickNext(world, f, busy, wave);
      if (!next) {
        f.wait = 1;
        continue;
      }
      [f.fc, f.fr, f.tc, f.tr, f.k] = [f.tc, f.tr, next[0], next[1], 0];
      f.tending = false;
      // The next stop's chore: hands hoe a while, hens peck in short bursts, the dog barely stops.
      const base = { bea: 1.4, hand: 2.4, dog: 0.4, hen: 0.9 }[f.kind];
      f.wait = base * (0.5 + rng(world)) * (wave ? 1.8 : 1);
    }
    const x = (f.fc + (f.tc - f.fc) * f.k) + 0.5 + f.ox;
    const y = (f.fr + (f.tr - f.fr) * f.k) + 0.5 + f.oy;
    if (Math.abs(x - f.x) > 1e-6) f.facing = x > f.x ? 1 : -1;
    f.x = x;
    f.y = y;
  }
}

/** True when every critter stands inside a walkable cell (for tests). */
export function allOffLanes(world: FolkWorld): boolean {
  return world.folk.every((f) => world.walk.has(key(Math.floor(f.x), Math.floor(f.y))));
}

/** The renderers' handle: one farm per game, fed the game's events and stepped with the draw clock. */
export class FarmFolk {
  world: FolkWorld | null = null;
  private of: Game | null = null;

  private sync(game: Game): FolkWorld {
    if (game !== this.of || !this.world) [this.of, this.world] = [game, makeFolk(game.level)];
    return this.world;
  }

  feed(events: readonly GameEvent[], game: Game): void {
    const w = this.sync(game);
    for (const ev of events) {
      if (ev.type === "leak") panic(w);
      else if (ev.type === "cleared") cheer(w);
    }
  }

  /** `?nofolk` leaves them out (before/after shots and draw-call comparisons). */
  readonly off = typeof location !== "undefined" && new URLSearchParams(location.search).has("nofolk");

  step(game: Game, dt: number, still: boolean): Folk[] {
    if (this.off) return [];
    const w = this.sync(game);
    const busy = new Set(game.towers.map((t) => key(t.col, t.row)));
    stepFolk(w, dt, busy, game.phase === "wave", still);
    return w.folk;
  }
}
