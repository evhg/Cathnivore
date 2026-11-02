// Plan item 15: replayable maps. Each layout is a set of hexes in axial coordinates (pointy-top: q to the
// right, r down-right), so adjacency is never hand-written: two regions border when their hexes touch, except
// across a delta channel without a bridge. Region types are seeded per game from the layout's mix, with
// Kingsmarket always the capital. `layoutConfig` turns a layout and a seed into the GameConfig fields the
// rules read (content/map.ts `regionType` and `neighborsOf`).

import { createRng, shuffle } from '../engine/rng'
import type { GameConfig, RegionId, RegionType } from '../engine/types'

export type LayoutId = 'ring' | 'coast' | 'delta'

export interface Layout {
  id: LayoutId
  name: string
  blurb: string
  /** Axial (q, r) per region in play. */
  hexes: Partial<Record<RegionId, [number, number]>>
  /** The types dealt to every region but Kingsmarket (shuffled by the seed unless `fixedTypes`). */
  mix: RegionType[]
  /** The ring keeps its printed types (SPEC 4.2) unless a Daily Market seeds it. */
  fixedTypes?: Partial<Record<RegionId, RegionType>>
  /** Delta channels: pairs of touching hexes with water between them. */
  channels?: [RegionId, RegionId][]
  /** Channels with a bridge: still neighbours. */
  bridges?: [RegionId, RegionId][]
}

const AXIAL_DIRS: [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [0, -1],
  [1, -1],
]

export const LAYOUTS: Record<LayoutId, Layout> = {
  ring: {
    id: 'ring',
    name: 'The Ring',
    blurb: 'Six regions round Kingsmarket.',
    hexes: { kingsmarket: [0, 0], rivermead: [1, 0], shingleBay: [0, 1], oakvale: [-1, 1], brindleHills: [-1, 0], highmoor: [0, -1], saltmarsh: [1, -1] },
    mix: ['pasture', 'pasture', 'crop', 'crop', 'coast', 'coast'],
    fixedTypes: { highmoor: 'pasture', saltmarsh: 'coast', rivermead: 'crop', shingleBay: 'coast', oakvale: 'crop', brindleHills: 'pasture' },
  },
  coast: {
    id: 'coast',
    name: 'The Long Coast',
    blurb: 'Ten regions down a ragged shore. Kingsmarket is harder to reach.',
    hexes: {
      kingsmarket: [0, 0],
      rivermead: [1, 0],
      shingleBay: [0, 1],
      oakvale: [-1, 1],
      brindleHills: [-1, 0],
      highmoor: [0, -1],
      saltmarsh: [1, -1],
      gullsHead: [2, -2],
      fernlea: [2, -1],
      tarnside: [1, 1],
    },
    mix: ['pasture', 'pasture', 'pasture', 'crop', 'crop', 'crop', 'coast', 'coast', 'coast'],
  },
  delta: {
    id: 'delta',
    name: 'The Delta',
    blurb: 'Seven regions split by the river. Only the bridges cross it.',
    hexes: { highmoor: [1, -2], brindleHills: [0, -1], saltmarsh: [1, -1], kingsmarket: [0, 0], oakvale: [-1, 1], shingleBay: [0, 1], rivermead: [-1, 2] },
    mix: ['pasture', 'pasture', 'crop', 'crop', 'coast', 'coast'],
    // The river comes down between the west and east arms; Kingsmarket sits on the mouth.
    channels: [
      ['brindleHills', 'saltmarsh'],
      ['oakvale', 'shingleBay'],
      ['kingsmarket', 'shingleBay'],
      ['highmoor', 'brindleHills'],
    ],
    bridges: [['kingsmarket', 'shingleBay']],
  },
}

const key = (q: number, r: number) => `${q},${r}`
const pair = (a: RegionId, b: RegionId, list: [RegionId, RegionId][] | undefined) => !!list?.some(([x, y]) => (x === a && y === b) || (x === b && y === a))

/** Who borders whom on a layout: touching hexes, less unbridged channels. */
export function layoutNeighbors(layout: Layout): Partial<Record<RegionId, RegionId[]>> {
  const at = new Map<string, RegionId>()
  for (const [id, [q, r]] of Object.entries(layout.hexes) as [RegionId, [number, number]][]) at.set(key(q, r), id)
  const out: Partial<Record<RegionId, RegionId[]>> = {}
  for (const [id, [q, r]] of Object.entries(layout.hexes) as [RegionId, [number, number]][]) {
    const ns: RegionId[] = []
    for (const [dq, dr] of AXIAL_DIRS) {
      const n = at.get(key(q + dq, r + dr))
      if (!n) continue
      if (pair(id, n, layout.channels) && !pair(id, n, layout.bridges)) continue
      ns.push(n)
    }
    out[id] = ns
  }
  return out
}

/** The region types for a game: Kingsmarket the capital, the rest dealt from the layout's mix by the seed. */
export function layoutTypes(layout: Layout, seed: number, seedRing = false): Partial<Record<RegionId, RegionType>> {
  if (layout.fixedTypes && !seedRing) return { kingsmarket: 'capital', ...layout.fixedTypes }
  const ids = (Object.keys(layout.hexes) as RegionId[]).filter((id) => id !== 'kingsmarket')
  const [dealt] = shuffle(layout.mix, createRng(seed ^ 0x5eed))
  const out: Partial<Record<RegionId, RegionType>> = { kingsmarket: 'capital' }
  ids.forEach((id, i) => (out[id] = dealt[i]!))
  return out
}

/** The config fields a layout sets. The ring without seeding sets none, so a ring game is the classic game. */
export function layoutConfig(id: LayoutId, seed: number, seedRing = false): Pick<GameConfig, 'activeRegions'> & Partial<Pick<GameConfig, 'regionTypes' | 'neighbors' | 'layout'>> {
  const layout = LAYOUTS[id]
  const activeRegions = Object.keys(layout.hexes) as RegionId[]
  if (id === 'ring' && !seedRing) return { activeRegions }
  return { activeRegions, layout: id, regionTypes: layoutTypes(layout, seed, seedRing), neighbors: layoutNeighbors(layout) }
}
