// Plan item 52: plots by what lies under them. Every plain building plot gets a look (bare earth, last year's
// stubble, clover, or earth with a puddle), seeded by the level, chosen so that orthogonal neighbours differ.
// Drawing only: the rules never read this.

import { isPlot, laneCellsOf, plotKind, sceneryCells, type Level } from "./engine";

export type PlotLook = "earth" | "stubble" | "clover" | "puddle";

const BASE: readonly PlotLook[] = ["earth", "stubble", "clover"];
/** About one earth bed in seven holds a puddle. */
const PUDDLE_RATE = 0.15;

/** mulberry32 (the same as theme.ts's rng; kept here so theme.ts can import this module without a cycle). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cache = new WeakMap<Level, Map<string, PlotLook>>();

/**
 * The look of every plain plot on a level, keyed "c,r". Plan item 345: a run of touching plots along a row (between
 * lanes, scenery and special ground) is one field with one look, and a run takes a base look the run above it
 * doesn't have where they touch, so the field reads as strips of crops, not a tile sheet (the rare puddle is a
 * fourth look, cell by cell). Deterministic per level id.
 */
export function plotLooks(level: Level): Map<string, PlotLook> {
  const hit = cache.get(level);
  if (hit) return hit;
  const lane = laneCellsOf(level);
  const scenery = sceneryCells(level);
  const r01 = rng(level.id * 7919 + 52);
  const out = new Map<string, PlotLook>();
  const base = new Map<string, PlotLook>();
  const plain = (c: number, r: number) => !lane.has(`${c},${r}`) && !scenery.has(`${c},${r}`) && plotKind(level, c, r) === "plain";
  for (let r = 0; r < level.rows; r++) {
    let prev: PlotLook | undefined;
    for (let c = 0; c < level.cols; ) {
      if (!plain(c, r)) { c++; continue; }
      let end = c;
      while (end + 1 < level.cols && plain(end + 1, r)) end++;
      // Looks the run would share an edge with: the cells above it, and the last run to its left in this row.
      const above = new Map<PlotLook, number>();
      for (let k = c; k <= end; k++) { const a = base.get(`${k},${r - 1}`); if (a) above.set(a, (above.get(a) ?? 0) + 1); }
      const roll = r01();
      const free = BASE.filter((l) => !above.has(l) && l !== prev);
      const pool = free.length ? free : [...BASE].sort((a, b) => (above.get(a) ?? 0) - (above.get(b) ?? 0)).slice(0, 1);
      const look = pool[Math.floor(roll * pool.length)]!;
      for (let k = c; k <= end; k++) {
        base.set(`${k},${r}`, look);
        out.set(`${k},${r}`, look === "earth" && r01() < PUDDLE_RATE ? "puddle" : look);
      }
      prev = look;
      c = end + 1;
    }
  }
  cache.set(level, out);
  return out;
}

/** Plan item 345: whether two plots belong to one field (side by side in a row, one run, one base look). */
export function sameField(level: Level, c: number, r: number, c2: number, r2: number): boolean {
  if (r !== r2 || Math.abs(c - c2) !== 1) return false;
  const looks = plotLooks(level);
  const a = looks.get(`${c},${r}`);
  const b = looks.get(`${c2},${r2}`);
  const flat = (l: PlotLook | undefined) => (l === "puddle" ? "earth" : l);
  return !!a && !!b && flat(a) === flat(b);
}

export function plotLook(level: Level, col: number, row: number): PlotLook | null {
  if (!isPlot(level, col, row)) return null;
  return plotLooks(level).get(`${col},${row}`) ?? null;
}
