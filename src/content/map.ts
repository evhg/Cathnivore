import type { GameConfig, GameState, RegionId, RegionType } from '../engine/types'

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
  // Plan item 15: the Long Coast's extra hexes. Their type and neighbours always come from the layout.
  gullsHead: { id: 'gullsHead', name: "Gull's Head", type: 'coast', neighbors: [] },
  fernlea: { id: 'fernlea', name: 'Fernlea', type: 'crop', neighbors: [] },
  tarnside: { id: 'tarnside', name: 'Tarnside', type: 'pasture', neighbors: [] },
}

// Plan item 15: a game's own map. The config may carry its region types (seeded) and adjacency (the layout);
// absent, they are the ring's in REGIONS, so saves from before layouts read the same. Every rule reads a
// region's type and neighbours through these two, never REGIONS directly.
export function regionType(state: { config: GameConfig }, id: RegionId): RegionType {
  return state.config.regionTypes?.[id] ?? REGIONS[id].type
}

export function neighborsOf(state: { config: GameConfig }, id: RegionId): RegionId[] {
  return state.config.neighbors?.[id] ?? REGIONS[id].neighbors
}

// SPEC 10.2: "Tapping [a Squeeze/Expand/Scout card in the enemy plan strip] highlights the matching
// regions on the map." Shared by `Map.tsx`'s own SQUEEZE/EXPAND badges and `Game.tsx`'s plan-strip buttons
// so both use the same region-type match, instead of a second, potentially-drifting copy of the logic.
export function regionMatchesPressureSlot(state: GameState, region: RegionId, slot: 'squeeze' | 'expand' | 'scout'): boolean {
  // SPEC 4.8: "Liberated regions ignore Scout and Expand" (and Squeeze is a no-op there too, since
  // Damage is always 0 once a region has no Outlets/Buyouts/Doubt left) — so a liberated region never
  // actually matches a pressure slot, whatever its type, and must not be highlighted as if it did.
  if (state.regions[region].liberated) return false
  const card = slot === 'squeeze' ? state.squeeze : slot === 'expand' ? state.expand : state.scout
  if (!card) return false
  return card.regionTypes.includes(regionType(state, region))
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
