import type { RegionState } from './types'

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
