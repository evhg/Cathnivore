import type { GameState, RegionId } from './types'

// SPEC 4.1: enemy piece pools. If a pool is empty, that placement is silently skipped.
export const POOL_SIZES = { outlet: 30, buyout: 12, doubt: 30 } as const

export function addOutlets(state: GameState, region: RegionId, n: number): GameState {
  const placed = Math.min(n, state.outletPool)
  if (placed <= 0) return state
  return {
    ...state,
    outletPool: state.outletPool - placed,
    regions: {
      ...state.regions,
      [region]: { ...state.regions[region], outlets: state.regions[region].outlets + placed },
    },
  }
}

export function addBuyout(state: GameState, region: RegionId, n = 1): GameState {
  const placed = Math.min(n, state.buyoutPool)
  if (placed <= 0) return state
  return {
    ...state,
    buyoutPool: state.buyoutPool - placed,
    regions: {
      ...state.regions,
      [region]: { ...state.regions[region], buyouts: state.regions[region].buyouts + placed },
    },
  }
}

export function addDoubt(state: GameState, region: RegionId, n = 1): GameState {
  const placed = Math.min(n, state.doubtPool)
  if (placed <= 0) return state
  return {
    ...state,
    doubtPool: state.doubtPool - placed,
    regions: {
      ...state.regions,
      [region]: { ...state.regions[region], doubt: state.regions[region].doubt + placed },
    },
  }
}

export function removeOutlets(state: GameState, region: RegionId, n: number): GameState {
  const removed = Math.min(n, state.regions[region].outlets)
  if (removed <= 0) return state
  return {
    ...state,
    outletPool: state.outletPool + removed,
    regions: {
      ...state.regions,
      [region]: { ...state.regions[region], outlets: state.regions[region].outlets - removed },
    },
  }
}

export function removeBuyout(state: GameState, region: RegionId, n = 1): GameState {
  const removed = Math.min(n, state.regions[region].buyouts)
  if (removed <= 0) return state
  return {
    ...state,
    buyoutPool: state.buyoutPool + removed,
    regions: {
      ...state.regions,
      [region]: { ...state.regions[region], buyouts: state.regions[region].buyouts - removed },
    },
  }
}

export function removeDoubt(state: GameState, region: RegionId, n: number): GameState {
  const removed = Math.min(n, state.regions[region].doubt)
  if (removed <= 0) return state
  return {
    ...state,
    doubtPool: state.doubtPool + removed,
    regions: {
      ...state.regions,
      [region]: { ...state.regions[region], doubt: state.regions[region].doubt - removed },
    },
  }
}

// SPEC 4.8: lose immediately if a Lost Land token must be placed but the pool is empty.
export function addLostLand(state: GameState, region: RegionId): GameState {
  if (state.lostLandPool <= 0) {
    return {
      ...state,
      result: { won: false, lossReason: 'lostLand', regionsLiberated: countLiberated(state), round: state.round },
    }
  }
  return {
    ...state,
    lostLandPool: state.lostLandPool - 1,
    regions: {
      ...state.regions,
      [region]: { ...state.regions[region], lostLand: state.regions[region].lostLand + 1 },
    },
  }
}

export function countLiberated(state: GameState): number {
  return Object.values(state.regions).filter((r) => r.liberated).length
}
