import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { applyAction, legalActions } from '../src/engine/actions'
import { resolveSqueeze } from '../src/engine/enemy'
import { currentDecision } from '../src/engine/api'
import { ALL_REGION_IDS } from '../src/content/map'
import type { GameConfig, PressureCard } from '../src/engine/types'

const FULL_CONFIG: GameConfig = {
  producers: ['mara', 'tomas'],
  difficulty: 'normal',
  activeRegions: ALL_REGION_IDS,
}

// SPEC 4.7 Squeeze: Mara's home (Brindle Hills, Pasture) taking damage > defence forces a choice of
// which production track she lowers by 1.
function squeezeCard(): PressureCard {
  return { id: 'test-squeeze', stage: 1, regionTypes: ['pasture'] }
}

describe('currentDecision (SPEC 9.1)', () => {
  it('Squeeze home-region loss: applies a default track and exposes it as a pending decision', () => {
    let state = createGame(FULL_CONFIG, 5)
    state = {
      ...state,
      squeeze: squeezeCard(),
      regions: { ...state.regions, brindleHills: { ...state.regions.brindleHills, outlets: 5, buyouts: 0 } },
    }
    const before = state.producers.mara.production

    const next = resolveSqueeze(state)

    const decision = currentDecision(next)
    expect(decision).not.toBeNull()
    expect(decision!.kind).toBe('squeezeProductionLoss')
    if (!decision || decision.kind !== 'squeezeProductionLoss') throw new Error('unreachable')
    expect(decision.producer).toBe('mara')
    // Default track (first of produce/marks/goodwill with production > 0) is already applied.
    expect(next.producers.mara.production[decision.applied]).toBe(before[decision.applied] - 1)

    // While a decision is pending, it's the only legal action.
    const actions = legalActions(next)
    expect(actions.every((a) => a.kind === 'decide')).toBe(true)
    expect(actions.length).toBe(decision.options.length)
  })

  it('resolving with a different choice swaps the production penalty, not stacks it', () => {
    let state = createGame(FULL_CONFIG, 5)
    state = {
      ...state,
      squeeze: squeezeCard(),
      regions: { ...state.regions, brindleHills: { ...state.regions.brindleHills, outlets: 5, buyouts: 0 } },
    }
    const before = state.producers.mara.production
    const afterSqueeze = resolveSqueeze(state)
    const decision = currentDecision(afterSqueeze)!
    if (decision.kind !== 'squeezeProductionLoss') throw new Error('unreachable')
    const otherTrack = decision.options.find((o) => o !== decision.applied)!

    const resolved = applyAction(afterSqueeze, { kind: 'decide', decisionId: decision.id, choice: otherTrack })

    expect(currentDecision(resolved)).toBeNull()
    // The originally-applied track is back to its starting value...
    expect(resolved.producers.mara.production[decision.applied]).toBe(before[decision.applied])
    // ...and the newly chosen track is down by 1 instead.
    expect(resolved.producers.mara.production[otherTrack]).toBe(before[otherTrack] - 1)
  })

  it('resolving with the same choice as the default is a no-op on production', () => {
    let state = createGame(FULL_CONFIG, 5)
    state = {
      ...state,
      squeeze: squeezeCard(),
      regions: { ...state.regions, brindleHills: { ...state.regions.brindleHills, outlets: 5, buyouts: 0 } },
    }
    const afterSqueeze = resolveSqueeze(state)
    const decision = currentDecision(afterSqueeze)!
    if (decision.kind !== 'squeezeProductionLoss') throw new Error('unreachable')

    const resolved = applyAction(afterSqueeze, { kind: 'decide', decisionId: decision.id, choice: decision.applied })

    expect(currentDecision(resolved)).toBeNull()
    expect(resolved.producers.mara.production).toEqual(afterSqueeze.producers.mara.production)
  })

  it('Kingsmarket first liberation: defaults to Marks and exposes it as a pending decision', () => {
    let state = createGame(FULL_CONFIG, 5)
    // Clear Kingsmarket to just-liberatable (a Stall, no enemy pieces) and open one there directly.
    state = {
      ...state,
      regions: {
        ...state.regions,
        kingsmarket: { ...state.regions.kingsmarket, outlets: 0, buyouts: 0, doubt: 0 },
        // Two neighbours liberated, so the Kingsmarket guard (SPEC 4.8) allows a Stall there.
        highmoor: { ...state.regions.highmoor, liberated: true, everLiberated: true, outlets: 0 },
        saltmarsh: { ...state.regions.saltmarsh, liberated: true, everLiberated: true, outlets: 0, doubt: 0 },
      },
      producers: { ...state.producers, mara: { ...state.producers.mara, resources: { ...state.producers.mara.resources, produce: 5 } } },
    }
    const before = state.producers.mara.production

    const next = applyAction(state, { kind: 'openStall', region: 'kingsmarket' })

    expect(next.regions.kingsmarket.liberated).toBe(true)
    const decision = currentDecision(next)
    expect(decision).not.toBeNull()
    expect(decision!.kind).toBe('kingsmarketBonus')
    expect(decision!.applied).toBe('marks')
    expect(next.producers.mara.production.marks).toBe(before.marks + 1)

    const resolved = applyAction(next, { kind: 'decide', decisionId: decision!.id, choice: 'goodwill' })
    expect(currentDecision(resolved)).toBeNull()
    expect(resolved.producers.mara.production.marks).toBe(before.marks)
    expect(resolved.producers.mara.production.goodwill).toBe(before.goodwill + 1)
  })
})
