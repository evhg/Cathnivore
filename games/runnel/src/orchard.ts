// The Orchard: thirty fixed puzzles in Bea's orchard, each a little harder than the last. Level n always
// gives the same board, and a level opens once the one before it is solved.

import { type GenerateOptions, dropsFor } from './engine'

export const ORCHARD_LEVELS = 30

export function orchardSeed(level: number): string {
  return `orchard-${level}`
}

/** Board size and special pieces for a level: small boards first, then sluices, reservoirs and bridges. */
export function orchardOptions(level: number): GenerateOptions {
  const n = Math.max(1, Math.min(ORCHARD_LEVELS, Math.floor(level)))
  const radius = n <= 8 ? 2 : n <= 20 ? 3 : 4
  return {
    radius,
    fixedCount: n >= 6 ? Math.min(3, Math.floor((n - 6) / 6) + 1) : 0,
    reservoirCount: n >= 11 ? Math.min(3, Math.floor((n - 11) / 7) + 1) : 0,
    bridgeCount: n >= 16 ? Math.min(3, Math.floor((n - 16) / 7) + 1) : 0,
  }
}

export function orchardName(level: number): string {
  const names = ['Apple', 'Pear', 'Plum', 'Cherry', 'Quince', 'Fig', 'Medlar', 'Damson', 'Greengage', 'Walnut']
  return `${names[(level - 1) % names.length]} row ${Math.floor((level - 1) / names.length) + 1}`
}

export interface OrchardResult {
  drops: 1 | 2 | 3
  taps: number
  timeMs: number
}

/** Highest level a player may open: one past their furthest solved level. */
export function unlockedLevel(results: Record<number, OrchardResult>): number {
  let n = 0
  while (n < ORCHARD_LEVELS && results[n + 1]) n++
  return Math.min(ORCHARD_LEVELS, n + 1)
}

/** Records a solve, keeping the better of old and new drops, then taps. */
export function recordOrchard(
  results: Record<number, OrchardResult>,
  level: number,
  taps: number,
  par: number,
  timeMs: number,
): OrchardResult {
  const next: OrchardResult = { drops: dropsFor(taps, par), taps, timeMs }
  const old = results[level]
  if (!old || next.drops > old.drops || (next.drops === old.drops && next.taps < old.taps)) results[level] = next
  return results[level]!
}

export function totalDrops(results: Record<number, OrchardResult>): number {
  return Object.values(results).reduce((s, r) => s + r.drops, 0)
}
