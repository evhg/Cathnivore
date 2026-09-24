import { REGIONS } from '../content/map'
import type { GameState, ProducerId, RegionId, RegionState } from './types'

export function regionStallTotal(region: RegionState): number {
  return Object.values(region.stalls).reduce((a, b) => a + (b ?? 0), 0)
}

export function isLiberated(region: RegionState): boolean {
  return regionStallTotal(region) > 0 && region.outlets === 0 && region.buyouts === 0 && region.doubt === 0
}

// SPEC 4.6.1: max 3 Stalls per region (all producers combined), minus 1 per Lost Land token, never below 1.
export function stallCap(region: RegionState): number {
  return Math.max(1, 3 - region.lostLand)
}

function ownStalls(state: GameState, producer: ProducerId, region: RegionId): number {
  return state.regions[region].stalls[producer] ?? 0
}

// SPEC 4.8: nobody may place a Stall in Kingsmarket unless at least 2 of its neighbors are liberated.
export function kingsmarketOpen(state: GameState): boolean {
  const neighbors = REGIONS.kingsmarket.neighbors
  const liberatedNeighbors = neighbors.filter((n) => state.regions[n].liberated).length
  return liberatedNeighbors >= 2
}

// SPEC 4.6.1: legal to Open Stall in a region containing your Stall or bordering one that does.
export function anyStallsAdjacentOrIn(state: GameState, producer: ProducerId, region: RegionId): boolean {
  if (ownStalls(state, producer, region) > 0) return true
  return REGIONS[region].neighbors.some((n) => ownStalls(state, producer, n) > 0)
}

export function canOpenStallIn(state: GameState, producer: ProducerId, region: RegionId): boolean {
  if (region === 'kingsmarket' && !kingsmarketOpen(state)) return false
  if (regionStallTotal(state.regions[region]) >= stallCap(state.regions[region])) return false
  return anyStallsAdjacentOrIn(state, producer, region)
}

// Regions bordering (or equal to) a liberated region, usable by anyone (SPEC 5 "Grass Roots").
export function regionsBorderingLiberated(state: GameState): RegionId[] {
  return (Object.keys(state.regions) as RegionId[]).filter((id) =>
    REGIONS[id].neighbors.some((n) => state.regions[n].liberated),
  )
}

function anyProducerHasStall(state: GameState, region: RegionId): boolean {
  return regionStallTotal(state.regions[region]) > 0
}

// SPEC 6 Tomas "Market Day": open a Stall for free in a region bordering any producer's Stall (not just
// the actor's own), still subject to the Kingsmarket guard and the Stall cap.
export function canMarketDayOpenIn(state: GameState, region: RegionId): boolean {
  if (region === 'kingsmarket' && !kingsmarketOpen(state)) return false
  if (regionStallTotal(state.regions[region]) >= stallCap(state.regions[region])) return false
  if (anyProducerHasStall(state, region)) return true
  return REGIONS[region].neighbors.some((n) => anyProducerHasStall(state, n))
}
