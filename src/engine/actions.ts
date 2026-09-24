import { REGIONS } from '../content/map'
import { removeBuyout, removeDoubt, removeOutlets } from './pieces'
import { refreshAllLiberation } from './enemy'
import { advanceTurnIfNeeded } from './round'
import { regionStallTotal, stallCap } from './region'
import type { Action, GameState, ProducerId, RegionId } from './types'

function ownStalls(state: GameState, producer: ProducerId, region: RegionId): number {
  return state.regions[region].stalls[producer] ?? 0
}

function anyStallsAdjacentOrIn(state: GameState, producer: ProducerId, region: RegionId): boolean {
  if (ownStalls(state, producer, region) > 0) return true
  return REGIONS[region].neighbors.some((n) => ownStalls(state, producer, n) > 0)
}

// SPEC 4.8: nobody may place a Stall in Kingsmarket unless at least 2 of its neighbors are liberated.
function kingsmarketOpen(state: GameState): boolean {
  const neighbors = REGIONS.kingsmarket.neighbors
  const liberatedNeighbors = neighbors.filter((n) => state.regions[n].liberated).length
  return liberatedNeighbors >= 2
}

function canOpenStallIn(state: GameState, producer: ProducerId, region: RegionId): boolean {
  if (region === 'kingsmarket' && !kingsmarketOpen(state)) return false
  if (regionStallTotal(state.regions[region]) >= stallCap(state.regions[region])) return false
  return anyStallsAdjacentOrIn(state, producer, region)
}

export function legalActions(state: GameState): Action[] {
  if (state.result) return []
  const producer = state.activeProducer
  const p = state.producers[producer]
  const actions: Action[] = []

  if (p.resources.produce >= 1) {
    for (const id of state.config.activeRegions) {
      if (canOpenStallIn(state, producer, id)) actions.push({ kind: 'openStall', region: id })
    }
  }

  for (const id of state.config.activeRegions) {
    if (ownStalls(state, producer, id) === 0) continue
    const r = state.regions[id]
    if (r.outlets >= 1 && p.resources.produce >= 2) actions.push({ kind: 'supplyOutlets', region: id, count: 1 })
    if (r.outlets >= 2 && p.resources.produce >= 4) actions.push({ kind: 'supplyOutlets', region: id, count: 2 })
    if (r.buyouts >= 1 && p.resources.produce >= 4 && regionStallTotal(r) >= 2) {
      actions.push({ kind: 'supplyBuyout', region: id })
    }
    if (r.doubt >= 1 && p.resources.goodwill >= 1) actions.push({ kind: 'rebut', region: id, count: 1 })
    if (r.doubt >= 2 && p.resources.goodwill >= 2) actions.push({ kind: 'rebut', region: id, count: 2 })
  }

  for (let n = 1; n <= Math.min(3, p.resources.produce); n++) {
    actions.push({ kind: 'sell', count: n as 1 | 2 | 3 })
  }

  actions.push({ kind: 'graft' })
  if (!p.roleUsedThisRound) actions.push({ kind: 'role' })

  return actions
}

function assertLegal(state: GameState, action: Action): void {
  const legal = legalActions(state)
  const isLegal = legal.some((a) => JSON.stringify(a) === JSON.stringify(action))
  if (!isLegal) throw new Error(`Illegal action: ${JSON.stringify(action)}`)
}

// SPEC 6: the four producers' free, once-per-round role abilities.
function applyRole(state: GameState, producer: ProducerId): GameState {
  switch (producer) {
    case 'ines': {
      const target = state.config.activeRegions.find((id) => ownStalls(state, producer, id) > 0 && state.regions[id].doubt > 0)
      if (!target) return state
      return removeDoubt(state, target, 1)
    }
    case 'sol': {
      // Default choice: Public Trust +1. The UI/AI may prefer +2 Goodwill via a future `currentDecision`.
      return { ...state, publicTrust: Math.min(15, state.publicTrust + 1) }
    }
    case 'mara':
    case 'tomas':
    default:
      // Injunction (Mara) and Market Day (Tomas) need a target chosen by the caller; a no-op placeholder
      // keeps `role` legal without a target picker. Wired up once the UI/AI decision layer lands.
      return state
  }
}

export function applyAction(state: GameState, action: Action): GameState {
  assertLegal(state, action)
  const producer = state.activeProducer
  let next = state

  switch (action.kind) {
    case 'openStall': {
      next = spend(state, producer, { produce: 1, marks: 0, goodwill: 0 })
      const r = next.regions[action.region]
      next = {
        ...next,
        regions: {
          ...next.regions,
          [action.region]: { ...r, stalls: { ...r.stalls, [producer]: (r.stalls[producer] ?? 0) + 1 } },
        },
      }
      break
    }
    case 'supplyOutlets': {
      next = spend(state, producer, { produce: 2 * action.count, marks: 0, goodwill: 0 })
      next = removeOutlets(next, action.region, action.count)
      break
    }
    case 'supplyBuyout': {
      next = spend(state, producer, { produce: 4, marks: 0, goodwill: 0 })
      next = removeBuyout(next, action.region, 1)
      break
    }
    case 'rebut': {
      next = spend(state, producer, { produce: 0, marks: 0, goodwill: action.count })
      next = removeDoubt(next, action.region, action.count)
      break
    }
    case 'sell': {
      next = spend(state, producer, { produce: action.count, marks: 0, goodwill: 0 })
      next = gain(next, producer, { produce: 0, marks: action.count, goodwill: 0 })
      break
    }
    case 'graft': {
      next = gain(state, producer, { produce: 1, marks: 1, goodwill: 0 })
      break
    }
    case 'role': {
      next = applyRole(state, producer)
      next = {
        ...next,
        producers: { ...next.producers, [producer]: { ...next.producers[producer], roleUsedThisRound: true } },
      }
      break
    }
    case 'invest':
    case 'scheme':
      throw new Error(`Action not yet implemented: ${action.kind}`)
  }

  next = refreshAllLiberation(next)
  next = {
    ...next,
    actionsLeft: next.actionsLeft - (action.kind === 'role' ? 0 : 1),
    log: [...next.log, { type: 'action', producer, action }],
    actionHistory: [...next.actionHistory, action],
  }
  return advanceTurnIfNeeded(next)
}

function spend(state: GameState, producer: ProducerId, cost: { produce: number; marks: number; goodwill: number }): GameState {
  const p = state.producers[producer]
  return {
    ...state,
    producers: {
      ...state.producers,
      [producer]: {
        ...p,
        resources: {
          produce: p.resources.produce - cost.produce,
          marks: p.resources.marks - cost.marks,
          goodwill: p.resources.goodwill - cost.goodwill,
        },
      },
    },
  }
}

function gain(state: GameState, producer: ProducerId, amount: { produce: number; marks: number; goodwill: number }): GameState {
  const p = state.producers[producer]
  return {
    ...state,
    producers: {
      ...state.producers,
      [producer]: {
        ...p,
        resources: {
          produce: p.resources.produce + amount.produce,
          marks: p.resources.marks + amount.marks,
          goodwill: p.resources.goodwill + amount.goodwill,
        },
      },
    },
  }
}
