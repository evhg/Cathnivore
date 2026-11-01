// The daily challenge's day count and rule, split from daily.ts so the games page can name today's rule
// without pulling in the level table.

import type { Difficulty, Remix } from "./engine";

/** Whole days since 2026-01-01, UTC. */
export function dayOf(now: number): number {
  return Math.floor((now - Date.UTC(2026, 0, 1)) / 86400000);
}

/**
 * The day's rule (Hedgerow 2 M11): a twist on Fleet levels, the same for everyone. One day in four is plain;
 * the others are Hand Tools, Lean Year or Hard. Classic levels ignore it (the engine drops both).
 */
export interface DailyRule {
  name: string;
  remix: Remix | null;
  difficulty: Difficulty;
}
const RULES: DailyRule[] = [
  { name: "Plain day", remix: null, difficulty: "normal" },
  { name: "Hand Tools", remix: "hand", difficulty: "normal" },
  { name: "Lean Year", remix: "lean", difficulty: "normal" },
  { name: "Hard day", remix: null, difficulty: "hard" },
];
export function dailyRule(day: number): DailyRule {
  const h = Math.imul(day + 7, 2246822519) >>> 0;
  return RULES[(h >>> 8) % RULES.length]!;
}
