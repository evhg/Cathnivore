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
 * The look of every plain plot on a level, keyed "c,r". Built row by row: each plot picks at random among the
 * base looks its left and upper neighbours don't have, so no two orthogonal plots share a base look (the rare
 * puddle is a fourth look). Deterministic per level id.
 */
export function plotLooks(level: Level): Map<string, PlotLook> {
  const hit = cache.get(level);
  if (hit) return hit;
  const lane = laneCellsOf(level);
  const scenery = sceneryCells(level);
  const r01 = rng(level.id * 7919 + 52);
  const out = new Map<string, PlotLook>();
  const base = new Map<string, PlotLook>();
  for (let r = 0; r < level.rows; r++)
    for (let c = 0; c < level.cols; c++) {
      const k = `${c},${r}`;
      const roll = r01();
      const roll2 = r01();
      if (lane.has(k) || scenery.has(k) || plotKind(level, c, r) !== "plain") continue;
      const taken = new Set([base.get(`${c - 1},${r}`), base.get(`${c},${r - 1}`)]);
      const free = BASE.filter((l) => !taken.has(l));
      const look = free[Math.floor(roll * free.length)]!;
      base.set(k, look);
      out.set(k, look === "earth" && roll2 < PUDDLE_RATE ? "puddle" : look);
    }
  cache.set(level, out);
  return out;
}

export function plotLook(level: Level, col: number, row: number): PlotLook | null {
  if (!isPlot(level, col, row)) return null;
  return plotLooks(level).get(`${col},${row}`) ?? null;
}
