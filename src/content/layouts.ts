// Plan item 15: replayable maps. Each layout is a set of hexes in axial coordinates (pointy-top: q to the
// right, r down-right), so adjacency is never hand-written: two regions border when their hexes touch, except
// across a delta channel without a bridge. Each region keeps its printed terrain; the seed deals which region sits
// on which hex (plan item 33), with Kingsmarket always the capital in the middle. `layoutConfig` turns a layout and a seed into the GameConfig fields the
// rules read (content/map.ts `regionType` and `neighborsOf`).

import { createRng, shuffle } from '../engine/rng'
import { REGIONS } from './map'
import type { GameConfig, RegionId, RegionType } from '../engine/types'

export type LayoutId = 'ring' | 'coast' | 'delta'

export interface Layout {
  id: LayoutId
  name: string
  blurb: string
  /** Axial (q, r) per region in play. */
  hexes: Partial<Record<RegionId, [number, number]>>
  /** The printed types of every region but Kingsmarket (plan item 33: a region's terrain never moves). */
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
    blurb: 'Six regions round the capital.',
    hexes: { kingsmarket: [0, 0], rivermead: [1, 0], shingleBay: [0, 1], oakvale: [-1, 1], brindleHills: [-1, 0], highmoor: [0, -1], saltmarsh: [1, -1] },
    mix: ['pasture', 'pasture', 'crop', 'crop', 'coast', 'coast'],
    fixedTypes: { highmoor: 'pasture', saltmarsh: 'coast', rivermead: 'crop', shingleBay: 'coast', oakvale: 'crop', brindleHills: 'pasture' },
  },
  coast: {
    id: 'coast',
    name: 'The Long Coast',
    blurb: 'Ten regions on a long shore.',
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
    blurb: 'A river splits it. Two bridges.',
    hexes: { kingsmarket: [0, 0], rivermead: [1, 0], shingleBay: [0, 1], oakvale: [-1, 1], brindleHills: [-1, 0], highmoor: [0, -1], saltmarsh: [1, -1] },
    mix: ['pasture', 'pasture', 'crop', 'crop', 'coast', 'coast'],
    // The river comes in at the top between Highmoor and Saltmarsh, runs down Kingsmarket's east side and out to
    // sea between Oakvale and Shingle Bay: west bank and east bank, crossed only at the city bridge (to
    // Rivermead) and the low bridge (Oakvale to Shingle Bay).
    channels: [
      ['highmoor', 'saltmarsh'],
      ['kingsmarket', 'saltmarsh'],
      ['kingsmarket', 'rivermead'],
      ['kingsmarket', 'shingleBay'],
      ['oakvale', 'shingleBay'],
    ],
    bridges: [
      ['kingsmarket', 'rivermead'],
      ['oakvale', 'shingleBay'],
    ],
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

/**
 * Plan item 33: a region keeps its printed terrain wherever it sits (Brindle Hills is always hills, Shingle Bay
 * always shore). Kingsmarket is the capital. A layout's mix is the printed types of its regions.
 */
export function layoutTypes(layout: Layout): Partial<Record<RegionId, RegionType>> {
  const out: Partial<Record<RegionId, RegionType>> = { kingsmarket: 'capital' }
  for (const id of Object.keys(layout.hexes) as RegionId[]) if (id !== 'kingsmarket') out[id] = layout.fixedTypes?.[id] ?? REGIONS[id].type
  return out
}

/**
 * What the seed deals instead (plan item 33): which region sits on which of the layout's hexes. A map from the
 * printed slot (the region the layout names there) to the region now on it; Kingsmarket stays in the middle.
 */
export function layoutPlacement(layout: Layout, seed: number): Partial<Record<RegionId, RegionId>> {
  const ids = (Object.keys(layout.hexes) as RegionId[]).filter((id) => id !== 'kingsmarket')
  const [dealt] = shuffle(ids, createRng(seed ^ 0x5eed))
  const out: Partial<Record<RegionId, RegionId>> = {}
  ids.forEach((slot, i) => (out[slot] = dealt[i]!))
  return out
}

/** The layout as dealt: every hex, channel and bridge moved with the region now on it. */
export function placedLayout(id: LayoutId, placement?: Partial<Record<RegionId, RegionId>>): Layout {
  const base = LAYOUTS[id]
  if (!placement) return base
  const at = (slot: RegionId): RegionId => placement[slot] ?? slot
  const hexes: Layout['hexes'] = {}
  for (const [slot, qr] of Object.entries(base.hexes) as [RegionId, [number, number]][]) hexes[at(slot)] = qr
  const move = (list?: [RegionId, RegionId][]) => list?.map(([a, b]): [RegionId, RegionId] => [at(a), at(b)])
  return { ...base, hexes, channels: move(base.channels), bridges: move(base.bridges) }
}

/** The config fields a layout sets. The ring without seeding sets none, so a ring game is the classic game. */
export function layoutConfig(id: LayoutId, seed: number, seedRing = false): Pick<GameConfig, 'activeRegions'> & Partial<Pick<GameConfig, 'regionTypes' | 'neighbors' | 'layout' | 'placement'>> {
  const layout = LAYOUTS[id]
  const activeRegions = Object.keys(layout.hexes) as RegionId[]
  if (id === 'ring' && !seedRing) return { activeRegions }
  const placement = layoutPlacement(layout, seed)
  return { activeRegions, layout: id, placement, regionTypes: layoutTypes(layout), neighbors: layoutNeighbors(placedLayout(id, placement)) }
}
