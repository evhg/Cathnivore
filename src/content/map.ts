import type { RegionId, RegionType } from '../engine/types'

export interface RegionDef {
  id: RegionId
  name: string
  type: RegionType
  neighbors: RegionId[]
}

// Hex flower: Kingsmarket in the centre, the ring order below sets adjacency
// (Highmoor-Saltmarsh-Rivermead-ShingleBay-Oakvale-BrindleHills-Highmoor), per SPEC 4.2.
const RING: RegionId[] = ['highmoor', 'saltmarsh', 'rivermead', 'shingleBay', 'oakvale', 'brindleHills']

function ringNeighbors(id: RegionId): RegionId[] {
  const i = RING.indexOf(id)
  const prev = RING[(i - 1 + RING.length) % RING.length]!
  const next = RING[(i + 1) % RING.length]!
  return ['kingsmarket', prev, next]
}

export const REGIONS: Record<RegionId, RegionDef> = {
  kingsmarket: { id: 'kingsmarket', name: 'Kingsmarket', type: 'capital', neighbors: [...RING] },
  highmoor: { id: 'highmoor', name: 'Highmoor', type: 'pasture', neighbors: ringNeighbors('highmoor') },
  saltmarsh: { id: 'saltmarsh', name: 'Saltmarsh', type: 'coast', neighbors: ringNeighbors('saltmarsh') },
  rivermead: { id: 'rivermead', name: 'Rivermead', type: 'crop', neighbors: ringNeighbors('rivermead') },
  shingleBay: { id: 'shingleBay', name: 'Shingle Bay', type: 'coast', neighbors: ringNeighbors('shingleBay') },
  oakvale: { id: 'oakvale', name: 'Oakvale', type: 'crop', neighbors: ringNeighbors('oakvale') },
  brindleHills: { id: 'brindleHills', name: 'Brindle Hills', type: 'pasture', neighbors: ringNeighbors('brindleHills') },
}

export const ALL_REGION_IDS: RegionId[] = [
  'kingsmarket',
  'highmoor',
  'saltmarsh',
  'rivermead',
  'shingleBay',
  'oakvale',
  'brindleHills',
]
