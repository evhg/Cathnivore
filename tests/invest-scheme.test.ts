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

// Forces `id` into Cath's Plan slot 0 for a deterministic test target, without duplicating or losing a
// card: `id` may already be face up (elsewhere in the plan), in the deck or in the discard, depending on
// the seed's shuffle. If it's already in the plan, swap it into slot 0; otherwise pull it out of the deck
// or discard and put whatever was in slot 0 back into the deck to keep the total scheme count correct.
function forceScheme(state: GameState, id: string): GameState {
  const planIndex = state.cathsPlan.indexOf(id)
  if (planIndex >= 0) {
    const cathsPlan = [...state.cathsPlan]
    ;[cathsPlan[0], cathsPlan[planIndex]] = [cathsPlan[planIndex]!, cathsPlan[0] ?? null]
    return { ...state, cathsPlan }
  }
  const displaced = state.cathsPlan[0] ?? null
  return {
    ...state,
    cathsPlan: [id, ...state.cathsPlan.slice(1)],
    schemeDeck: [...state.schemeDeck.filter((s) => s !== id), ...(displaced ? [displaced] : [])],
    schemeDiscard: state.schemeDiscard.filter((s) => s !== id),
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
    let state = createGame(FULL_CONFIG, 5)
    // Every Improvement costs at least 2 Marks (SPEC 7); 0 is under all of them regardless of the seed's market draw.
    state = {
      ...state,
      producers: { ...state.producers, mara: { ...state.producers.mara, resources: { ...state.producers.mara.resources, marks: 0 } } },
    }
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
    state = forceScheme(state, 'leaked-memo')
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
    state = forceScheme(state, 'loss-leader')
    // Mara's home (Brindle Hills) keeps its starting Outlet and she starts with a Stall there.
    const before = state.regions.brindleHills.outlets
    expect(before).toBeGreaterThanOrEqual(1)
    state = applyAction(state, { kind: 'scheme', schemeId: 'loss-leader', targetRegion: 'brindleHills' })
    expect(state.regions.brindleHills.outlets).toBe(Math.max(0, before - 2))
  })

  it('is not offered as a legal action without enough Goodwill', () => {
    let state = createGame(FULL_CONFIG, 5)
    state = forceScheme(state, 'leaked-memo')
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
    state = forceScheme(state, 'grass-roots')
    const actions = legalActions(state)
    expect(actions.some((a) => a.kind === 'scheme' && a.schemeId === 'grass-roots')).toBe(false)
  })
})

describe('freeSchemePlays (SPEC 8.2 ch6 "the Plan unlocks and the players get one free Scheme")', () => {
  it('lets a producer with 0 Goodwill play a Scheme for free, and decrements the grant', () => {
    let state = createGame(FULL_CONFIG, 5)
    state = forceScheme(state, 'leaked-memo')
    state = {
      ...state,
      freeSchemePlays: 1,
      producers: { ...state.producers, mara: { ...state.producers.mara, resources: { ...state.producers.mara.resources, goodwill: 0 } } },
    }
    expect(legalActions(state).some((a) => a.kind === 'scheme' && a.schemeId === 'leaked-memo')).toBe(true)
    state = applyAction(state, { kind: 'scheme', schemeId: 'leaked-memo', targetRegion: 'saltmarsh' })
    expect(state.producers.mara.resources.goodwill).toBe(0)
    expect(state.freeSchemePlays).toBe(0)
    expect(state.cathsPlan).not.toContain('leaked-memo')
    expect(validate(state)).toEqual([])
  })

  it('does not spend the grant when the producer could already afford the card', () => {
    let state = richMara(createGame(FULL_CONFIG, 5))
    state = forceScheme(state, 'leaked-memo')
    state = { ...state, freeSchemePlays: 1 }
    const before = state.producers.mara.resources.goodwill
    state = applyAction(state, { kind: 'scheme', schemeId: 'leaked-memo', targetRegion: 'saltmarsh' })
    expect(state.producers.mara.resources.goodwill).toBe(before - SCHEMES_BY_ID.get('leaked-memo')!.cost)
    expect(state.freeSchemePlays).toBe(1)
  })

  it('the unlockCathsPlan scripted trigger grants exactly one free play alongside unlocking the Plan', () => {
    const config: GameConfig = {
      ...FULL_CONFIG,
      cathsPlanLocked: true,
      scriptedTrigger: { liberatedCount: 0, effect: 'unlockCathsPlan', sceneId: 'planUnlocked' },
    }
    let state = createGame(config, 5)
    expect(state.cathsPlanLocked).toBe(true)
    expect(state.freeSchemePlays).toBe(0)
    // Round 1 -> 2 cleanup: liberatedCount (0) already meets the trigger's threshold, so it fires here.
    for (let i = 0; i < 6; i++) state = applyAction(state, legalActions(state).find((a) => a.kind === 'graft')!)
    expect(state.cathsPlanLocked).toBe(false)
    expect(state.freeSchemePlays).toBe(1)
  })
})
