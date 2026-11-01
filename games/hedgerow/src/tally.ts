// The end-of-level tally (two-week plan item 10): after the stars land, the run's Marks, knockouts and Goodwill
// count up, then every leak of the run is replayed in round order as a strip of the vehicles that got through,
// each one landing with what it cost. Reduced motion shows the final values at once.

import type { EnemyKind } from "./engine";

/** One leak, as the field reported it. */
export interface LeakRecord {
  kind: EnemyKind;
  /** Goodwill it cost. */
  lost: number;
  /** The round it came in (1-based, as the player reads it). */
  round: number;
}

export interface TallyCounter {
  label: string;
  value: number;
  /** Shown after the counted number ("/ 20"). */
  suffix?: string;
}

export interface TallyLeak {
  kind: EnemyKind;
  round: number;
  lost: number;
  /** How many leaks of this kind in this round were folded into this chip. */
  n: number;
}

/** The longest leak strip shown: the rest fold into "+N more". */
export const MAX_LEAK_CHIPS = 8;

/**
 * Folds the run's leaks into chips: the same vehicle in the same round is one chip with a count, in round
 * order, trimmed to MAX_LEAK_CHIPS (the count of the rest comes back as `more`).
 */
export function foldLeaks(leaks: readonly LeakRecord[]): { chips: TallyLeak[]; more: number } {
  const chips: TallyLeak[] = [];
  for (const l of leaks) {
    const last = chips.find((c) => c.kind === l.kind && c.round === l.round);
    if (last) {
      last.n++;
      last.lost += l.lost;
    } else chips.push({ kind: l.kind, round: l.round, lost: l.lost, n: 1 });
  }
  chips.sort((a, b) => a.round - b.round);
  const shown = chips.slice(0, MAX_LEAK_CHIPS);
  const more = chips.slice(MAX_LEAK_CHIPS).reduce((a, c) => a + c.n, 0);
  return { chips: shown, more };
}

/** The counted value at time t (ms) of a count-up lasting `ms`: eased out, whole numbers, exact at the end. */
export function countAt(value: number, t: number, ms: number): number {
  if (t >= ms || ms <= 0) return value;
  if (t <= 0) return 0;
  const k = t / ms;
  return Math.floor(value * (1 - (1 - k) ** 3));
}

/** When each beat of the tally starts (ms after the dialog opens), after `stars` stars have landed. */
export function tallyTimeline(stars: number, chips: number): { counters: number; countMs: number; leaks: number[] } {
  const counters = 260 * Math.max(0, stars) + 420;
  const countMs = 900;
  const start = counters + countMs + 150;
  return { counters, countMs, leaks: Array.from({ length: chips }, (_, i) => start + i * 170) };
}
