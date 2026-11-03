// Plan item 59: a field that grows through the level. Every empty plain plot carries the act's crop, from bare
// earth through sprout and leaf to ripe as rounds are cleared, nearest the farmhouse first. A leak tramples the
// plot nearest the lane's exit back one stage. Drawing only: the rules never read this, so the tuner fit stands.

import type { Game, Level } from "./engine";
import { plotLooks } from "./plotlook";

/** 0 bare, 1 sprout, 2 leaf, 3 ripe. */
export type CropStage = 0 | 1 | 2 | 3;
export type Crop = "wheat" | "cabbage" | "sunflower" | "pumpkin" | "lavender";

/** One crop per act, in map.ts's act order (Brindle's wheat, Highmoor's kale, ...). */
const ACT_CROPS: readonly Crop[] = ["wheat", "cabbage", "sunflower", "pumpkin", "lavender"];

export function cropOf(level: Pick<Level, "id">): Crop {
  const act = Math.max(1, Math.ceil(level.id / 10));
  return ACT_CROPS[(act - 1) % ACT_CROPS.length]!;
}

/** An Endless field has no last round; its crop is fully grown by round 20. */
const ENDLESS_ROUNDS = 20;

export interface GrowthPlot {
  key: string;
  col: number;
  row: number;
  /** 0 at the farmhouse's plot to 1 at the farthest: the order the field ripens in. */
  fromHouse: number;
  /** Cells from the lane's exit (the farmhouse), for the leak's trample. */
  toExit: number;
  /** A per-plot lag in [0, 1), seeded by the level. */
  lag: number;
}

function hash(a: number, b: number, c: number): number {
  let h = (a * 374761393 + b * 668265263 + c * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const cache = new WeakMap<Level, GrowthPlot[]>();

/** The level's growing plots (every plain plot with a look), nearest the exit first. */
export function growthPlots(level: Level): GrowthPlot[] {
  const hit = cache.get(level);
  if (hit) return hit;
  const [ec, er] = level.path[level.path.length - 1]!;
  const raw = [...plotLooks(level).keys()].map((key) => {
    const [col, row] = key.split(",").map(Number) as [number, number];
    return { key, col, row, toExit: Math.hypot(col - ec, row - er) };
  });
  const far = Math.max(1, ...raw.map((p) => p.toExit));
  const out = raw
    .map((p) => ({ ...p, fromHouse: p.toExit / far, lag: hash(level.id, p.col, p.row) }))
    .sort((a, b) => a.toExit - b.toExit || a.row - b.row || a.col - b.col);
  cache.set(level, out);
  return out;
}

/** How far through the level's rounds the field is, 0 to 1. */
export function growthProgress(level: Level, cleared: number): number {
  const total = level.endless ? ENDLESS_ROUNDS : Math.max(1, level.waves.length);
  return Math.max(0, Math.min(1, cleared / total));
}

/** A plot's stage before any trampling: the farmhouse end ripens first, with a little seeded scatter. */
function baseStage(p: GrowthPlot, progress: number): CropStage {
  if (progress <= 0) return 0;
  const v = progress * 3.7 - p.fromHouse * 0.6 - p.lag * 0.5;
  return Math.max(0, Math.min(3, Math.floor(v))) as CropStage;
}

/**
 * Every growing plot's stage after `cleared` rounds and `leaks` leaks, keyed "c,r". Each leak tramples the
 * nearest plot to the exit that still has something growing and no tower on it, one stage back.
 * Deterministic: the same level, rounds, leaks and towers give the same field.
 */
export function cropStages(level: Level, cleared: number, leaks: number, occupied: ReadonlySet<string> = new Set()): Map<string, CropStage> {
  const progress = growthProgress(level, cleared);
  const out = new Map<string, CropStage>();
  const plots = growthPlots(level);
  for (const p of plots) out.set(p.key, baseStage(p, progress));
  let left = Math.max(0, Math.floor(leaks));
  while (left > 0) {
    const p = plots.find((q) => !occupied.has(q.key) && out.get(q.key)! > 0);
    if (!p) break;
    out.set(p.key, (out.get(p.key)! - 1) as CropStage);
    left--;
  }
  return out;
}

/** One plot's stage (the e2e and the renderers read the whole map; this is for tests and tools). */
export function cropStage(level: Level, cleared: number, leaks: number, col: number, row: number, occupied?: ReadonlySet<string>): CropStage | null {
  return cropStages(level, cleared, leaks, occupied).get(`${col},${row}`) ?? null;
}

/** The plots a tower (or a megastructure's annex) stands on. */
export function occupiedPlots(game: Pick<Game, "towers">): Set<string> {
  const out = new Set<string>();
  for (const t of game.towers) {
    out.add(`${t.col},${t.row}`);
    if (t.annex) out.add(`${t.annex[0]},${t.annex[1]}`);
  }
  return out;
}

/** The live field for a game: rounds cleared, its leaks so far and its towers. */
export function gameCrops(game: Pick<Game, "level" | "paid" | "towers" | "leaks">): Map<string, CropStage> {
  return cropStages(game.level, game.paid, game.leaks ?? 0, occupiedPlots(game));
}

/**
 * The harvest on a win: seconds after the win at which a plot turns ripe, a wave from the farmhouse out
 * (`HARVEST_SECONDS` to cross the field).
 */
export const HARVEST_SECONDS = 1.4;
export function harvestAt(p: GrowthPlot): number {
  return p.fromHouse * HARVEST_SECONDS;
}

/** The stages the renderers draw: on a win, every empty plot ripens in the harvest's wave. */
export function shownCrops(game: Pick<Game, "level" | "paid" | "towers" | "leaks" | "phase">, sinceWin: number | null): Map<string, CropStage> {
  const live = gameCrops(game);
  if (game.phase !== "won" || sinceWin === null) return live;
  for (const p of growthPlots(game.level)) if (live.has(p.key) && sinceWin >= harvestAt(p)) live.set(p.key, 3);
  return live;
}

/** Ripe plots without a tower: what the e2e counts. */
export function ripeCount(stages: ReadonlyMap<string, CropStage>, occupied: ReadonlySet<string>): number {
  let n = 0;
  for (const [k, s] of stages) if (s === 3 && !occupied.has(k)) n++;
  return n;
}
