// Plan item 151: the people of the valley. A farmer, Bea, two sheep and Bea's cart walk its margins; when water
// reaches a field the farmer takes up the hoe, and at a solve everyone hops while Bea runs to her garden (item 68). main.ts places them (clear of the
// tiles, Cath, the garden, the spring house and the week's keeps) and drives their state; the walk is CSS.

export type FolkKind = 'farmer' | 'bea' | 'sheep' | 'cart'

export interface Folk {
  id: string
  kind: FolkKind
  /** How far it paces either side of its spot, in px (its walk must stay clear as well as its standing box). */
  range: number
}

export const FOLK: readonly Folk[] = [
  { id: 'farmer', kind: 'farmer', range: 26 },
  { id: 'bea', kind: 'bea', range: 34 },
  { id: 'sheep-1', kind: 'sheep', range: 14 },
  { id: 'sheep-2', kind: 'sheep', range: 12 },
  { id: 'cart', kind: 'cart', range: 44 },
]

/**
 * Where folk may stand, as % of the valley frame: a ring along its foot and its two sides below the skyline (folk
 * stand on ground, not on the hills' sky), dense enough that a full board still leaves room. Tried in order from each
 * one's own start, the foot first, so they spread out.
 */
export const FOLK_SPOTS: ReadonlyArray<readonly [number, number]> = [
  ...[14, 26, 38, 50, 62, 74, 86].map((x) => [x, 97] as const),
  ...[36, 46, 56, 66, 76, 86].flatMap((y) => [[5, y] as const, [95, y] as const]),
  ...[20, 32, 44, 56, 68, 80].map((x) => [x, 91] as const),
]

/** Each folk's first spot to try: spread round the ring so they don't all queue for the same one. */
export function folkStart(i: number): number {
  return Math.round((i * FOLK_SPOTS.length) / 5) % FOLK_SPOTS.length
}

const INK = '#3b2a20'
/** Each folk's picture in a 48 x 48 box, its feet at the bottom centre. Parts that move carry a class for the CSS. */
export function folkSvg(kind: FolkKind): string {
  const open = '<svg viewBox="0 0 48 48" aria-hidden="true">'
  const s = `stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"`
  switch (kind) {
    case 'farmer':
      return (
        `${open}<g class="folk-body">` +
        `<path d="M19 46l2-12M29 46l-2-12" stroke="#4a3a2c" stroke-width="3" stroke-linecap="round"/>` +
        `<path d="M16 35l2-14h12l2 14z" fill="#5b7d9a" ${s}/>` +
        `<circle cx="24" cy="15" r="5.5" fill="#e6b98f" ${s}/>` +
        `<path d="M15 12h18l-3-5H18z" fill="#d9b25a" ${s}/>` +
        `</g><g class="folk-tool"><path d="M30 24 40 44" stroke="#7a5230" stroke-width="2.4" stroke-linecap="round"/>` +
        `<path d="M37 43h7" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/></g></svg>`
      )
    case 'bea':
      return (
        `${open}<g class="folk-body">` +
        `<path d="M21 46l1-8M27 46l-1-8" stroke="#4a3a2c" stroke-width="2.6" stroke-linecap="round"/>` +
        `<path d="M17 39l3-15h8l3 15z" fill="#c8553d" ${s}/>` +
        `<circle cx="24" cy="18" r="5" fill="#e9c29a" ${s}/>` +
        `<path d="M19 16c0-5 10-5 10 0l2 6M19 16l-2 6" fill="none" stroke="#6b3f26" stroke-width="2.6" stroke-linecap="round"/>` +
        `<path class="folk-arm" d="M28 27l5-3" stroke="#e9c29a" stroke-width="2.4" stroke-linecap="round"/>` +
        `<path d="M32 23l5-1-1 5z" fill="#f2d45c" ${s}/></g></svg>`
      )
    case 'sheep':
      return (
        `${open}<g class="folk-body">` +
        `<path d="M14 46v-7M20 46v-6M30 46v-6M35 46v-7" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>` +
        `<path d="M11 34c-3-8 6-12 10-9 3-5 11-4 13 1 5-1 8 5 4 9 1 5-6 7-9 5-4 3-11 3-13-1-4 1-6-2-5-5z" fill="#f6f1e6" ${s}/>` +
        `<g class="folk-head"><ellipse cx="38" cy="31" rx="4.6" ry="3.6" fill="#3e352d" ${s}/><path d="M35 28l-2-2" stroke="${INK}" stroke-width="1.6"/></g>` +
        `</g></svg>`
      )
    case 'cart':
      return (
        `${open}<g class="folk-body">` +
        `<path d="M6 30h26l-2 8H8z" fill="#a46b3b" ${s}/>` +
        `<path d="M9 30c1-6 5-8 9-7 2-4 9-4 10 1" fill="#7aa04a" ${s}/>` +
        `<circle cx="11" cy="25" r="2" fill="#d9462f"/><circle cx="23" cy="24" r="2" fill="#e8a33b"/>` +
        `<path d="M32 33h10" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>` +
        `</g><g class="folk-wheel"><circle cx="16" cy="40" r="5.5" fill="#e8d2a6" ${s}/>` +
        `<path d="M16 34.5v11M10.5 40h11" stroke="${INK}" stroke-width="1.2"/></g></svg>`
      )
  }
}
