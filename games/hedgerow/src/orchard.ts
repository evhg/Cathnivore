// The Endless Orchard: a roguelike run. Each depth is a field drawn by the run's seed from a band of the story
// levels; clearing it offers three boons, you keep one, and the run ends the first time a field is lost. The best
// depth is saved (store.ts recordOrchard). The daily seed is the day number, so everyone gets the same run.

import type { Level } from "./engine";
import { LEVELS } from "./levels";

export interface Boon {
  id: string;
  name: string;
  text: string;
  /** Applied to each field of the run after the field is picked. */
  apply: (level: Level) => Level;
}

export const BOONS: Boon[] = [
  { id: "pockets", name: "Deep pockets", text: "Start every field with 25% more Marks.", apply: (l) => ({ ...l, startMarks: Math.round(l.startMarks * 1.25) }) },
  { id: "neighbours", name: "Good neighbours", text: "+4 Goodwill on every field.", apply: (l) => ({ ...l, goodwill: l.goodwill + 4 }) },
  { id: "thin", name: "Thin crowds", text: "Enemies have 8% less health.", apply: (l) => ({ ...l, hpScale: (l.hpScale ?? 1) * 0.92 }) },
  { id: "windfall", name: "Windfall", text: "+150 Marks at the start of every field.", apply: (l) => ({ ...l, startMarks: l.startMarks + 150 }) },
  { id: "pantry", name: "Full pantry", text: "+8 Goodwill, but 4% tougher enemies.", apply: (l) => ({ ...l, goodwill: l.goodwill + 8, hpScale: (l.hpScale ?? 1) * 1.04 }) },
  { id: "market", name: "Market day", text: "+60% Marks to start, enemies 6% tougher.", apply: (l) => ({ ...l, startMarks: Math.round(l.startMarks * 1.6), hpScale: (l.hpScale ?? 1) * 1.06 }) },
  { id: "frost", name: "Late frost", text: "Enemies have 14% less health, but -2 Goodwill.", apply: (l) => ({ ...l, hpScale: (l.hpScale ?? 1) * 0.86, goodwill: Math.max(3, l.goodwill - 2) }) },
  { id: "scrimp", name: "Scrimp and save", text: "+12% Marks and +2 Goodwill.", apply: (l) => ({ ...l, startMarks: Math.round(l.startMarks * 1.12), goodwill: l.goodwill + 2 }) },
];

export const ORCHARD_BAND = 4;
export const ORCHARD_MAX_DEPTH = 24;

function rng(seed: number): () => number {
  let s = (Math.imul(seed | 0, 2654435761) >>> 0) || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** Story levels an Orchard run can draw from: boss fields and Endless fields are left out. */
const POOL = LEVELS.filter((l) => l.id % 10 !== 0 && !l.endless);

/** Depth 1 draws from the first band of levels; every depth moves the band on, up to the last level. */
export function orchardFieldId(seed: number, depth: number): number {
  const start = Math.min(POOL.length - ORCHARD_BAND, Math.floor(((depth - 1) / ORCHARD_MAX_DEPTH) * (POOL.length - ORCHARD_BAND)));
  const rand = rng(seed * 131 + depth * 17);
  return POOL[start + Math.floor(rand() * ORCHARD_BAND)]!.id;
}

/** Three distinct boons not yet taken, the same for the same seed and depth. */
export function orchardOffers(seed: number, depth: number, taken: string[]): Boon[] {
  const rand = rng(seed * 977 + depth * 31 + 5);
  const left = BOONS.filter((b) => !taken.includes(b.id));
  const out: Boon[] = [];
  while (out.length < 3 && left.length) out.push(left.splice(Math.floor(rand() * left.length), 1)[0]!);
  return out;
}

/** The field for a depth with the run's boons applied. */
export function orchardLevel(seed: number, depth: number, taken: string[]): Level {
  const id = orchardFieldId(seed, depth);
  let level: Level = { ...LEVELS.find((l) => l.id === id)!, before: [], after: [] };
  for (const b of taken) {
    const boon = BOONS.find((x) => x.id === b);
    if (boon) level = boon.apply(level);
  }
  return { ...level, name: `Orchard ${depth}: ${level.place}`, orchard: depth };
}
