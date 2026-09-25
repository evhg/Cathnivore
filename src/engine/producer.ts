import type { GameState, ProducerId, ResourceKind } from './types'

// Shared helpers for modifying a producer's production tracks and resources, used by Improvements,
// Schemes, the liberation bonus (SPEC 4.8) and Harvest (SPEC 4.5.1).
export function addProduction(state: GameState, producer: ProducerId, amount: Partial<Record<ResourceKind, number>>): GameState {
  const p = state.producers[producer]
  return {
    ...state,
    producers: {
      ...state.producers,
      [producer]: {
        ...p,
        production: {
          produce: p.production.produce + (amount.produce ?? 0),
          marks: p.production.marks + (amount.marks ?? 0),
          goodwill: p.production.goodwill + (amount.goodwill ?? 0),
        },
      },
    },
  }
}

export function addResources(state: GameState, producer: ProducerId, amount: Partial<Record<ResourceKind, number>>): GameState {
  const p = state.producers[producer]
  return {
    ...state,
    producers: {
      ...state.producers,
      [producer]: {
        ...p,
        resources: {
          produce: Math.max(0, p.resources.produce + (amount.produce ?? 0)),
          marks: Math.max(0, p.resources.marks + (amount.marks ?? 0)),
          goodwill: Math.max(0, p.resources.goodwill + (amount.goodwill ?? 0)),
        },
      },
    },
  }
}

export function hasImprovement(state: GameState, producer: ProducerId, improvementId: string): boolean {
  return state.producers[producer].improvements.includes(improvementId)
}

export function improvementCount(state: GameState, producer: ProducerId, improvementId: string): number {
  return state.producers[producer].improvements.filter((id) => id === improvementId).length
}
