// Rosettes: Hedgerow's achievements. Pure rules; main.ts feeds in what happened in a finished level and the
// save, and shows whatever is newly earned. Stored in SaveData.rosettes (an optional field, so no version bump).

import type { SaveData } from "./store";

/** What a finished level tells us. */
export interface LevelSummary {
  levelId: number;
  won: boolean;
  stars: number;
  /** Goodwill kept, 0 to 1. */
  kept: number;
  heroKills: number;
  earlyCalls: number;
  /** Distinct tower kinds standing at the end. */
  towerKinds: number;
  /** Towers standing at the end. */
  towers: number;
  /** Seed Bank ranks owned when the level started. */
  perkRanks: number;
}

export interface RosetteDef {
  id: string;
  name: string;
  how: string;
  /** Called after a win, with the save already updated for this level. */
  earned: (s: LevelSummary, data: SaveData) => boolean;
}

const cleared = (d: SaveData): number => Object.keys(d.stars).length;
const threeStar = (d: SaveData): number => Object.values(d.stars).filter((v) => v >= 3).length;

export const ROSETTES: RosetteDef[] = [
  { id: "first", name: "First Furrow", how: "Win a level.", earned: () => true },
  { id: "flawless", name: "Not a Scratch", how: "Win with every point of Goodwill kept.", earned: (s) => s.kept >= 1 },
  { id: "ten", name: "Parish Regular", how: "Clear 10 levels.", earned: (_s, d) => cleared(d) >= 10 },
  { id: "fifty", name: "Show Champion", how: "Clear 50 levels.", earned: (_s, d) => cleared(d) >= 50 },
  { id: "hundred", name: "Cath of the Hedgerow", how: "Clear all 100 levels.", earned: (_s, d) => cleared(d) >= 100 },
  { id: "gold10", name: "Gold Rosette", how: "Earn three stars on 10 levels.", earned: (_s, d) => threeStar(d) >= 10 },
  { id: "gold50", name: "Best in Show", how: "Earn three stars on 50 levels.", earned: (_s, d) => threeStar(d) >= 50 },
  { id: "bare", name: "Bare Hands", how: "Win a level from 8 up with three stars and an empty Seed Bank.", earned: (s) => s.levelId >= 8 && s.stars >= 3 && s.perkRanks === 0 },
  { id: "impatient", name: "No Time for Tea", how: "Call 5 waves early in one level and still win.", earned: (s) => s.earlyCalls >= 5 },
  { id: "mixed", name: "Mixed Borders", how: "Finish a level with 4 kinds of tower standing.", earned: (s) => s.towerKinds >= 4 },
  { id: "rolling", name: "Rolling Pin Rampage", how: "Win a level where Cath knocked out 25 enemies.", earned: (s) => s.heroKills >= 25 },
  { id: "tidy", name: "Tidy Garden", how: "Win a level from 8 up with 6 or fewer towers.", earned: (s) => s.levelId >= 8 && s.towers <= 6 },
];

/** Ids newly earned by this result. The caller stores them. */
export function newRosettes(s: LevelSummary, data: SaveData): string[] {
  if (!s.won) return [];
  const have = data.rosettes ?? {};
  return ROSETTES.filter((r) => !have[r.id] && r.earned(s, data)).map((r) => r.id);
}
