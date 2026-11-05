// Plan item 142: the valley remembers the week. Each daily solved this ISO week leaves a lasting feature in the valley
// (a mill, a footbridge, an orchard row, Bea's scarecrow), chosen by that day's seed; a missed day leaves a fallow
// plot. Pure data plus SVG strings, so the choice is unit-tested; main.ts places them clear of the tiles.

import { hashString } from './engine'
import { weekDays } from './weekstrip'
import type { DailyResult } from './store'

export type FeatureKind = 'mill' | 'footbridge' | 'orchard' | 'scarecrow' | 'fallow'

export interface ValleyFeature {
  day: string
  kind: FeatureKind
}

const KEEPS: FeatureKind[] = ['mill', 'footbridge', 'orchard', 'scarecrow']

/** This week's features up to today: one per solved day (by its seed), a fallow plot per missed day. */
export function weekFeatures(today: string, results: Record<string, DailyResult>): ValleyFeature[] {
  return weekDays(today, results)
    .filter((d) => d.state === 'solved' || d.state === 'missed')
    .map((d) => ({ day: d.day, kind: d.state === 'missed' ? 'fallow' : KEEPS[hashString(`${d.day}:keep`) % KEEPS.length]! }))
}

/**
 * Where features may stand, as % of the valley frame: its margins and corners, where the board rarely reaches.
 * main.ts tries them in this order from each day's own start, skipping any that would meet a tile.
 */
export const SPOTS: ReadonlyArray<readonly [number, number]> = [
  [8, 46], [90, 34], [9, 66], [91, 58], [30, 90], [70, 91], [88, 80], [24, 18], [76, 16], [50, 93], [6, 86], [94, 12],
]

export function firstSpot(day: string): number {
  return hashString(`${day}:spot`) % SPOTS.length
}

const INK = '#3b2a20'
/** Each feature's picture, drawn to a 48 x 48 box with its foot at the bottom centre. */
export function featureSvg(kind: FeatureKind): string {
  const open = '<svg viewBox="0 0 48 48" aria-hidden="true">'
  switch (kind) {
    case 'mill':
      return `${open}<path d="M18 46 20 20h8l2 26z" fill="#f1e4cc" stroke="${INK}" stroke-width="1.6"/><path d="M17 21h14l-7-7z" fill="#b5523b" stroke="${INK}" stroke-width="1.6"/><g stroke="${INK}" stroke-width="1.4" fill="#fbf3e2"><path d="M24 15 13 6l-2 3 11 8z"/><path d="M24 15l11-9 2 3-11 8z"/><path d="M24 15 15 26l3 2 7-11z"/><path d="M24 15l9 11-3 2-7-11z"/></g><circle cx="24" cy="15" r="1.8" fill="${INK}"/><path d="M22 46v-6h4v6" fill="#6b4a2b"/></svg>`
    case 'footbridge':
      return `${open}<path d="M3 40c6-12 36-12 42 0" fill="none" stroke="#8a5a32" stroke-width="5"/><path d="M3 40c6-12 36-12 42 0" fill="none" stroke="${INK}" stroke-width="1.4"/><g stroke="${INK}" stroke-width="1.4"><path d="M8 34v-7M16 30v-7M24 29v-7M32 30v-7M40 34v-7"/><path d="M6 28c8-7 28-7 36 0"/></g><path d="M2 44h44" stroke="#5f9ab0" stroke-width="3" stroke-linecap="round"/></svg>`
    case 'orchard':
      return `${open}${[8, 24, 40].map((x) => `<path d="M${x} 46v-9" stroke="#6b4a2b" stroke-width="2.4"/><circle cx="${x}" cy="31" r="7.5" fill="#6f9a45" stroke="${INK}" stroke-width="1.4"/><circle cx="${x - 3}" cy="30" r="1.5" fill="#c8402e"/><circle cx="${x + 2.5}" cy="33" r="1.5" fill="#c8402e"/>`).join('')}</svg>`
    case 'scarecrow':
      return `${open}<path d="M24 46V14M12 22h24" stroke="#6b4a2b" stroke-width="2.4"/><path d="M17 22h14l-2 13H19z" fill="#5f7a3a" stroke="${INK}" stroke-width="1.4"/><circle cx="24" cy="12" r="5" fill="#e8c88a" stroke="${INK}" stroke-width="1.4"/><path d="M17 9h14l-3-5h-8z" fill="#8a5a32" stroke="${INK}" stroke-width="1.4"/><path d="M12 22v5M36 22v5" stroke="#e8c88a" stroke-width="2"/></svg>`
    case 'fallow':
      return `${open}<path d="M4 44 9 30h30l5 14z" fill="#a88763" stroke="${INK}" stroke-width="1.4"/><g stroke="#7d5f40" stroke-width="1.4"><path d="M10 34h28M8 38h32M6 42h36"/></g><path d="M30 31l2-4 1 4M15 31l1-3 2 3" stroke="#8b9a5a" stroke-width="1.3" fill="none"/></svg>`
  }
}
