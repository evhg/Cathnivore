import { describe, expect, it } from 'vitest'
import { ALL_REGION_IDS, REGIONS, neighborsOf, regionType } from '../src/content/map'
import { kingsmarketOpen, anyStallsAdjacentOrIn } from '../src/engine/region'
import { createGame } from '../src/engine/state'
import type { GameConfig } from '../src/engine/types'

// Plan item 15, slice 1: every rule reads a region's type and neighbours through the game's config, so a
// layout can change both; a config without them is the ring.

const base: GameConfig = { producers: ['mara', 'tomas'], difficulty: 'normal', activeRegions: ALL_REGION_IDS }

describe('map layout plumbing', () => {
  it('without overrides, types and neighbours are the ring', () => {
    const g = createGame(base, 7)
    for (const id of ALL_REGION_IDS) {
      expect(regionType(g, id)).toBe(REGIONS[id].type)
      expect(neighborsOf(g, id)).toEqual(REGIONS[id].neighbors)
    }
  })
  it('seeded region types change the setup (a coast gets its extra Doubt)', () => {
    const ring = createGame(base, 7)
    const swapped = createGame({ ...base, regionTypes: { rivermead: 'coast' } }, 7)
    expect(regionType(swapped, 'rivermead')).toBe('coast')
    expect(swapped.regions.rivermead.doubt).toBe(ring.regions.rivermead.doubt + 1)
  })
  it('adjacency comes from the config: Kingsmarket opens on its own neighbours, stalls spread along them', () => {
    const neighbors: GameConfig['neighbors'] = { ...Object.fromEntries(ALL_REGION_IDS.map((id) => [id, REGIONS[id].neighbors])), kingsmarket: ['highmoor', 'saltmarsh'] }
    const g = createGame({ ...base, neighbors }, 7)
    const lib = (s: typeof g, ids: string[]) => ({ ...s, regions: Object.fromEntries(Object.entries(s.regions).map(([k, r]) => [k, { ...r, liberated: ids.includes(k) }])) }) as typeof g
    expect(kingsmarketOpen(lib(g, ['rivermead', 'oakvale']))).toBe(false)
    expect(kingsmarketOpen(lib(g, ['highmoor', 'saltmarsh']))).toBe(true)
    const withStall = { ...g, regions: { ...g.regions, highmoor: { ...g.regions.highmoor, stalls: { mara: 1 } } } }
    expect(anyStallsAdjacentOrIn(withStall, 'mara', 'kingsmarket')).toBe(true)
    expect(anyStallsAdjacentOrIn(withStall, 'mara', 'rivermead')).toBe(false)
  })
})
