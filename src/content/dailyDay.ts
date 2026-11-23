// The Daily Market's number and map from the date alone, with no game code, so the site's market board can name
// today's daily without loading the engine (plan item 682).
import type { LayoutId } from './layouts'

/** Daily #1 is 2 November 2026, the day the Daily Market opened. */
export const DAY_ONE = Date.UTC(2026, 10, 2)
export const DAY_MS = 86_400_000

/** The map turns over day by day so a week holds every layout. */
export const LAYOUT_ORDER: LayoutId[] = ['ring', 'coast', 'delta']

/** Days since Daily #1 (0 on 2 November 2026) for a YYYY-MM-DD date. */
export function dailyDay(date: string): number {
  return Math.floor((Date.parse(`${date}T00:00:00Z`) - DAY_ONE) / DAY_MS)
}

export function dailyLayout(day: number): LayoutId {
  return LAYOUT_ORDER[((day % 3) + 3) % 3]!
}
