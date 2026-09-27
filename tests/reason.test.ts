import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { ALL_REGION_IDS } from '../src/content/map'
import { reasonForAction } from '../src/ai/reason'
import type { Action, GameConfig, GameState } from '../src/engine/types'

const CONFIG: GameConfig = {
  producers: ['mara', 'tomas'],
  difficulty: 'normal',
  activeRegions: ALL_REGION_IDS,
}

function baseState(): GameState {
  return createGame(CONFIG, 1)
}

// SPEC 9.2's own example: "Clearing Doubt in Saltmarsh before it's squeezed next round."
describe('reasonForAction', () => {
  it('names a squeeze-targeted Rebut, matching SPEC 9.2s own example shape', () => {
    const state: GameState = {
      ...baseState(),
      squeeze: { id: 'pressure-1-1', stage: 1, regionTypes: ['coast'] },
    }
    const action: Action = { kind: 'rebut', region: 'saltmarsh', count: 1 }
    expect(reasonForAction(state, action)).toBe("Clearing Doubt in Saltmarsh before it's squeezed next round.")
  })

  it('gives a plain reason for a Rebut with no upcoming Squeeze', () => {
    const state: GameState = { ...baseState(), squeeze: null }
    const action: Action = { kind: 'rebut', region: 'saltmarsh', count: 1 }
    expect(reasonForAction(state, action)).toBe('Clearing Doubt in Saltmarsh.')
  })

  it('calls out liberation when Open Stall would clear the last enemy piece', () => {
    const state = baseState()
    const region = state.regions.highmoor
    const cleared: GameState = {
      ...state,
      regions: { ...state.regions, highmoor: { ...region, outlets: 0, buyouts: 0, doubt: 0 } },
    }
    const action: Action = { kind: 'openStall', region: 'highmoor' }
    expect(reasonForAction(cleared, action)).toBe('Liberating Highmoor.')
  })

  // A second Stall can legally be opened in an already-liberated region (SPEC 4.6.1: up to the 3-Stall
  // cap, region.ts's canOpenStallIn doesn't forbid it). That action liberates nothing — it was already
  // liberated — so the reason must not claim it does.
  it('does not claim liberation for a Stall opened in an already-liberated region', () => {
    const state = baseState()
    const region = state.regions.highmoor
    const liberated: GameState = {
      ...state,
      regions: {
        ...state.regions,
        highmoor: { ...region, stalls: { mara: 1 }, outlets: 0, buyouts: 0, doubt: 0, liberated: true, everLiberated: true },
      },
    }
    const action: Action = { kind: 'openStall', region: 'highmoor' }
    expect(reasonForAction(liberated, action)).not.toBe('Liberating Highmoor.')
  })

  it('warns about an upcoming Expand for an Open Stall that would not yet liberate', () => {
    const state: GameState = {
      ...baseState(),
      expand: { id: 'pressure-1-1', stage: 1, regionTypes: ['pasture'] },
    }
    const action: Action = { kind: 'openStall', region: 'highmoor' }
    expect(reasonForAction(state, action)).toBe("Reinforcing Highmoor before it's expanded next round.")
  })

  it('names each producer role ability distinctly', () => {
    const state = baseState()
    expect(
      reasonForAction({ ...state, activeProducer: 'mara' }, { kind: 'role', targetRegion: 'brindleHills' }),
    ).toBe('Filing an Injunction in Brindle Hills to stop the Expand there.')
    expect(
      reasonForAction({ ...state, activeProducer: 'sol' }, { kind: 'role', choice: 'goodwill' }),
    ).toBe('Going On Air for extra Goodwill.')
    expect(
      reasonForAction({ ...state, activeProducer: 'sol' }, { kind: 'role', choice: 'trust' }),
    ).toBe('Going On Air to raise Public Trust.')
  })

  it('names the Improvement bought and the Scheme played', () => {
    const state = baseState()
    expect(reasonForAction(state, { kind: 'invest', improvementId: 'farm-shop' })).toBe('Investing in Farm Shop.')
    expect(reasonForAction(state, { kind: 'scheme', schemeId: 'loss-leader', targetRegion: 'oakvale' })).toBe(
      'Playing Loss Leader in Oakvale.',
    )
  })

  it('has a one-line reason for every action kind, never empty', () => {
    const state = baseState()
    const actions: Action[] = [
      { kind: 'openStall', region: 'highmoor' },
      { kind: 'supplyOutlets', region: 'highmoor', count: 1 },
      { kind: 'supplyBuyout', region: 'highmoor' },
      { kind: 'rebut', region: 'highmoor', count: 1 },
      { kind: 'invest', improvementId: 'farm-shop' },
      { kind: 'sell', count: 1 },
      { kind: 'scheme', schemeId: 'loss-leader' },
      { kind: 'graft' },
      { kind: 'role' },
      { kind: 'decide', decisionId: 'x', choice: 'marks' },
      { kind: 'tearUpContract' },
    ]
    for (const action of actions) {
      const reason = reasonForAction(state, action)
      expect(reason.length).toBeGreaterThan(0)
      expect(reason.endsWith('.')).toBe(true)
    }
  })
})
