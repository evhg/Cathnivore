// Plan item 52: plots by what lies under them. Every plain building plot gets a look (bare earth, last year's
// stubble, clover, or earth with a puddle), seeded by the level, chosen so that orthogonal neighbours differ.
// Drawing only: the rules never read this.

import { isPlot, laneCellsOf, plotKind, sceneryCells, type Level } from "./engine";

export type PlotLook = "earth" | "stubble" | "clover" | "puddle";

/** Plan item 345: the build-mode plot outline, a cream stitch over a dark under-stroke (3:1+ on any crop). */
export const PLOT_STITCH = "rgba(255, 246, 214, 0.95)";
export const PLOT_STITCH_UNDER = "rgba(48, 34, 18, 0.55)";

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

/** Plan item 345: a field, a block of plots `c0..c1` by `r0..r1` sharing one base look. */
export interface Field { id: number; c0: number; c1: number; r0: number; r1: number }

const cache = new WeakMap<Level, { looks: Map<string, PlotLook>; field: Map<string, Field> }>();
/** A field runs at most this many rows deep (deeper blocks read as one flat slab). */
const MAX_DEPTH = 3;

function build(level: Level): { looks: Map<string, PlotLook>; field: Map<string, Field> } {
  const hit = cache.get(level);
  if (hit) return hit;
  const lane = laneCellsOf(level);
  const scenery = sceneryCells(level);
  const r01 = rng(level.id * 7919 + 52);
  const out = new Map<string, PlotLook>();
  const base = new Map<string, PlotLook>();
  const field = new Map<string, Field>();
  let ids = 0;
  const used = new Map<PlotLook, number>();
  // A barn's cell is its farmyard, not part of a field (item 345); a fallen oak lies across a field until cleared.
  const barns = new Set((level.barns ?? []).map(([c, r]) => `${c},${r}`));
  const plain = (c: number, r: number) =>
    !lane.has(`${c},${r}`) && !scenery.has(`${c},${r}`) && !barns.has(`${c},${r}`) && plotKind(level, c, r) === "plain";
  for (let r = 0; r < level.rows; r++) {
    let prev: PlotLook | undefined;
    for (let c = 0; c < level.cols; ) {
      if (!plain(c, r)) { c++; continue; }
      let end = c;
      while (end + 1 < level.cols && plain(end + 1, r)) end++;
      // A run under a field of exactly its span (and not yet MAX_DEPTH deep) extends that field down a row: real
      // fields are blocks, not one-row strips.
      const up = field.get(`${c},${r - 1}`);
      let look: PlotLook;
      let f: Field;
      if (up && up.c0 === c && up.c1 === end && up.r1 === r - 1 && r - up.r0 < MAX_DEPTH) {
        f = up;
        f.r1 = r;
        look = base.get(`${c},${r - 1}`)!;
      } else {
        // Looks the run would share an edge with: the cells above it, and the last run to its left in this row.
        const above = new Map<PlotLook, number>();
        for (let k = c; k <= end; k++) { const a = base.get(`${k},${r - 1}`); if (a) above.set(a, (above.get(a) ?? 0) + 1); }
        const roll = r01();
        const free = BASE.filter((l) => !above.has(l) && l !== prev);
        // Of the looks free here, the ones the level has used least, so a farm of few big fields still grows all three.
        const least = Math.min(...free.map((l) => used.get(l) ?? 0));
        const pool = free.length
          ? free.filter((l) => (used.get(l) ?? 0) === least)
          : [...BASE].sort((a, b) => (above.get(a) ?? 0) - (above.get(b) ?? 0)).slice(0, 1);
        look = pool[Math.floor(roll * pool.length)]!;
        used.set(look, (used.get(look) ?? 0) + 1);
        f = { id: ids++, c0: c, c1: end, r0: r, r1: r };
      }
      for (let k = c; k <= end; k++) {
        base.set(`${k},${r}`, look);
        field.set(`${k},${r}`, f);
        out.set(`${k},${r}`, look === "earth" && r01() < PUDDLE_RATE ? "puddle" : look);
      }
      prev = look;
      c = end + 1;
    }
  }
  const made = { looks: out, field };
  cache.set(level, made);
  return made;
}

/**
 * The look of every plain plot on a level, keyed "c,r". Plan item 345: a run of touching plots along a row (between
 * lanes, scenery and special ground) is one field with one look, a run under a field of the same span joins it (up
 * to three rows), and a new field takes a base look the fields it touches above and to its left don't have, so the
 * farm reads as blocks of crops, not a tile sheet (the rare puddle is a fourth look, cell by cell). Deterministic
 * per level id.
 */
export function plotLooks(level: Level): Map<string, PlotLook> {
  return build(level).looks;
}

/** Plan item 345: the field a plain plot belongs to (undefined off the farm's plain plots). */
export function fieldAt(level: Level, c: number, r: number): Field | undefined {
  return build(level).field.get(`${c},${r}`);
}

/** Plan item 345: whether two plots belong to one field. */
export function sameField(level: Level, c: number, r: number, c2: number, r2: number): boolean {
  const a = fieldAt(level, c, r);
  return !!a && a === fieldAt(level, c2, r2);
}

export function plotLook(level: Level, col: number, row: number): PlotLook | null {
  if (!isPlot(level, col, row)) return null;
  return plotLooks(level).get(`${col},${row}`) ?? null;
}
