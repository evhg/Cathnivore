import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { legalActions, applyAction } from '../src/engine/actions'
import { validate } from '../src/engine/api'
import { ALL_REGION_IDS } from '../src/content/map'
import { IMPROVEMENTS_BY_ID } from '../src/content/improvements'
import { SCHEMES_BY_ID } from '../src/content/schemes'
import type { GameConfig, GameState } from '../src/engine/types'

const FULL_CONFIG: GameConfig = {
  producers: ['mara', 'tomas'],
  difficulty: 'normal',
  activeRegions: ALL_REGION_IDS,
}

// Gives Mara enough of every resource to buy/play anything in the market or plan, for tests that don't
// care about exact costs.
function richMara(state: GameState): GameState {
  return {
    ...state,
    producers: {
      ...state.producers,
      mara: { ...state.producers.mara, resources: { produce: 20, marks: 20, goodwill: 20 } },
    },
  }
}

describe('Invest', () => {
  it('buying an Improvement spends Marks, adds it to the tableau, empties its Market slot, and applies its effect', () => {
    let state = richMara(createGame(FULL_CONFIG, 5))
    const improvementId = state.market.find((id): id is string => id !== null)!
    const card = IMPROVEMENTS_BY_ID.get(improvementId)!
    const before = state.producers.mara
    state = applyAction(state, { kind: 'invest', improvementId })
    expect(state.producers.mara.resources.marks).toBe(before.resources.marks - card.cost)
    expect(state.producers.mara.improvements).toContain(improvementId)
    expect(state.market).not.toContain(improvementId)
    expect(validate(state)).toEqual([])
  })

  it('is not legal without enough Marks', () => {
    const state = createGame(FULL_CONFIG, 5) // starting Marks are well under every Improvement's cost
    const actions = legalActions(state)
    expect(actions.some((a) => a.kind === 'invest')).toBe(false)
  })

  it('Farm Shop gives +1 Marks production immediately', () => {
    let state = richMara(createGame(FULL_CONFIG, 5))
    // Force it into a slot for a deterministic test of its effect.
    state = { ...state, market: ['farm-shop', ...state.market.slice(1)] }
    const before = state.producers.mara.production.marks
    state = applyAction(state, { kind: 'invest', improvementId: 'farm-shop' })
    expect(state.producers.mara.production.marks).toBe(before + 1)
  })
})

describe('Scheme', () => {
  it('playing a Scheme spends Goodwill, empties its Cath\'s Plan slot, discards it, and applies its effect', () => {
    let state = richMara(createGame(FULL_CONFIG, 5))
    state = { ...state, cathsPlan: ['leaked-memo', ...state.cathsPlan.slice(1)] }
    const before = state.producers.mara.resources.goodwill
    const beforeRift = state.rift
    // Saltmarsh (a Coast region) starts with 1 Doubt (SPEC 4.3.2), so it's a legal target.
    state = applyAction(state, { kind: 'scheme', schemeId: 'leaked-memo', targetRegion: 'saltmarsh' })
    expect(state.producers.mara.resources.goodwill).toBe(before - SCHEMES_BY_ID.get('leaked-memo')!.cost)
    expect(state.cathsPlan).not.toContain('leaked-memo')
    expect(state.schemeDiscard).toContain('leaked-memo')
    expect(state.rift).toBe(beforeRift + 2)
    expect(validate(state)).toEqual([])
  })

  it('Loss Leader removes 2 Outlets from a targeted region with the player\'s Stall', () => {
    let state = richMara(createGame(FULL_CONFIG, 5))
    state = { ...state, cathsPlan: ['loss-leader', ...state.cathsPlan.slice(1)] }
    // Mara's home (Brindle Hills) keeps its starting Outlet and she starts with a Stall there.
    const before = state.regions.brindleHills.outlets
    expect(before).toBeGreaterThanOrEqual(1)
    state = applyAction(state, { kind: 'scheme', schemeId: 'loss-leader', targetRegion: 'brindleHills' })
    expect(state.regions.brindleHills.outlets).toBe(Math.max(0, before - 2))
  })

  it('is not offered as a legal action without enough Goodwill', () => {
    let state = createGame(FULL_CONFIG, 5)
    state = { ...state, cathsPlan: ['leaked-memo', ...state.cathsPlan.slice(1)] }
    state = {
      ...state,
      producers: { ...state.producers, mara: { ...state.producers.mara, resources: { ...state.producers.mara.resources, goodwill: 0 } } },
    }
    const actions = legalActions(state)
    expect(actions.some((a) => a.kind === 'scheme')).toBe(false)
  })

  it('a required-target Scheme with no legal target is not offered', () => {
    let state = richMara(createGame(FULL_CONFIG, 5))
    // Grass Roots needs a region bordering a liberated one; nothing is liberated at game start.
    state = { ...state, cathsPlan: ['grass-roots', ...state.cathsPlan.slice(1)] }
    const actions = legalActions(state)
    expect(actions.some((a) => a.kind === 'scheme' && a.schemeId === 'grass-roots')).toBe(false)
  })
})
