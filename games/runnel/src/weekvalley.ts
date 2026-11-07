// Plan item 142: the valley remembers the week. Each daily solved this ISO week leaves a lasting feature in the valley
// (a mill, a footbridge, an orchard row, Bea's scarecrow), chosen by that day's seed; a missed day leaves a fallow
// plot. Pure data plus SVG strings, so the choice is unit-tested; main.ts places them clear of the tiles.

import { hashString } from './engine'
import { weekDays } from './weekstrip'
import type { DailyResult } from './store'

export type FeatureKind = 'mill' | 'footbridge' | 'orchard' | 'scarecrow' | 'fallow'
/** Plan item 252: the valley's everyday props, set by the day's seed (not earned). */
export type PropKind = 'hayrick' | 'trough' | 'stile' | 'beehive' | 'churn' | 'barrow'

export interface ValleyFeature {
  day: string
  kind: FeatureKind
}

const KEEPS: FeatureKind[] = ['mill', 'footbridge', 'orchard', 'scarecrow']

/** This week's features up to today: one per solved day (by its seed), a fallow plot per missed day. */
export function weekFeatures(today: string, results: Record<string, DailyResult>): ValleyFeature[] {
  return weekDays(today, results)
    .filter((d) => d.state === 'solved' || d.state === 'missed')
    .map((d) => ({ day: d.day, kind: d.state === 'missed' ? 'fallow' : KEEPS[hashString(`${d.day}:keep`) % KEEPS.length]! }) as ValleyFeature)
    // Plan item 252: a first visit has nothing to keep, so no row of fallow plots; and at most two fallow plots show
    // (the latest), so a week of missed days never fills the margins with the same brown patch.
    .filter((f, _i, all) => f.kind !== 'fallow' || (Object.keys(results).length > 0 && all.filter((g) => g.kind === 'fallow').slice(-2).includes(f)))
}

const PROPS: PropKind[] = ['hayrick', 'trough', 'stile', 'beehive', 'churn', 'barrow']

/** Plan item 252: `n` different props for the valley, in an order set by the seed (no kind twice). */
export function valleyProps(seed: string, n = 4): PropKind[] {
  return [...PROPS].sort((a, b) => hashString(`${seed}:${a}`) - hashString(`${seed}:${b}`)).slice(0, Math.min(n, PROPS.length))
}

/** A prop's picture, 48 x 48 with its foot at the bottom centre, in the keeps' ink. */
export function propSvg(kind: PropKind): string {
  const open = '<svg viewBox="0 0 48 48" aria-hidden="true">'
  const shade = '<ellipse cx="24" cy="45" rx="17" ry="2.6" fill="#2a2018" opacity=".22"/>'
  switch (kind) {
    case 'hayrick':
      return `${open}${shade}<path d="M8 44c0-16 7-28 16-28s16 12 16 28z" fill="#e2bf62" stroke="${INK}" stroke-width="1.6"/><path d="M12 32c6-3 18-3 24 0M10 39c7-3 21-3 28 0" fill="none" stroke="#b08a34" stroke-width="1.4"/><path d="M24 16v-5" stroke="${INK}" stroke-width="1.6"/></svg>`
    case 'trough':
      return `${open}${shade}<path d="M6 30h36l-4 12H10z" fill="#9a7a56" stroke="${INK}" stroke-width="1.6"/><path d="M8 32h32" stroke="#6fb2cc" stroke-width="3" stroke-linecap="round"/><path d="M12 42v3M36 42v3" stroke="${INK}" stroke-width="2"/></svg>`
    case 'stile':
      return `${open}${shade}<path d="M10 44V18M38 44V18" stroke="#8a5a32" stroke-width="3"/><path d="M6 26h36M6 34h36" stroke="#a87444" stroke-width="3"/><path d="M14 38h20" stroke="#6b4a2b" stroke-width="3.4"/><path d="M10 18v26M38 18v26M6 26h36M6 34h36" fill="none" stroke="${INK}" stroke-width=".9" opacity=".6"/></svg>`
    case 'beehive':
      return `${open}${shade}<path d="M24 44v-4" stroke="${INK}" stroke-width="2"/><path d="M12 40c0-18 6-26 12-26s12 8 12 26z" fill="#e8c46a" stroke="${INK}" stroke-width="1.6"/><path d="M13 34h22M14 28h20M17 22h14" stroke="#b5902e" stroke-width="1.4"/><ellipse cx="24" cy="37" rx="3" ry="2" fill="${INK}"/><circle cx="38" cy="16" r="1.6" fill="${INK}"/><circle cx="34" cy="11" r="1.4" fill="${INK}"/></svg>`
    case 'churn':
      return `${open}${shade}<path d="M17 44V26l3-6h8l3 6v18z" fill="#c9ced2" stroke="${INK}" stroke-width="1.6"/><rect x="20" y="14" width="8" height="6" rx="1.5" fill="#aeb4b9" stroke="${INK}" stroke-width="1.4"/><path d="M17 32h14M17 38h14" stroke="#8e959b" stroke-width="1.4"/></svg>`
    case 'barrow':
      return `${open}${shade}<path d="M8 28h24l-3 10H11z" fill="#6f9a45" stroke="${INK}" stroke-width="1.6"/><circle cx="12" cy="20" r="3" fill="#c8402e"/><circle cx="20" cy="21" r="3.2" fill="#e8a53a"/><circle cx="27" cy="20" r="3" fill="#c8402e"/><circle cx="12" cy="40" r="4.5" fill="#6b4a2b" stroke="${INK}" stroke-width="1.4"/><path d="M32 30l10-4M29 38l9 6" stroke="#8a5a32" stroke-width="2.2"/></svg>`
  }
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
