import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { legalActions, applyAction } from '../src/engine/actions'
import { validate } from '../src/engine/api'
import { ALL_REGION_IDS } from '../src/content/map'
import type { GameConfig, GameState } from '../src/engine/types'

const FULL_CONFIG: GameConfig = {
  producers: ['mara', 'tomas'],
  difficulty: 'normal',
  activeRegions: ALL_REGION_IDS,
}

const SOL_CONFIG: GameConfig = {
  producers: ['sol', 'ines'],
  difficulty: 'normal',
  activeRegions: ALL_REGION_IDS,
}

describe('role abilities (SPEC 6)', () => {
  it("Mara's Injunction adds the chosen region to expandSkip and is once per round", () => {
    const state = createGame(FULL_CONFIG, 5)
    expect(legalActions(state).some((a) => a.kind === 'role' && a.targetRegion === 'brindleHills')).toBe(true)
    const next = applyAction(state, { kind: 'role', targetRegion: 'brindleHills' })
    expect(next.expandSkip).toContain('brindleHills')
    expect(next.producers.mara.roleUsedThisRound).toBe(true)
    expect(legalActions(next).some((a) => a.kind === 'role')).toBe(false)
    expect(validate(next)).toEqual([])
  })

  it("Tomas's Market Day opens a free Stall in a region bordering any producer's Stall", () => {
    let state = createGame(FULL_CONFIG, 5)
    // Advance to Tomas's turn (first player is Mara; use up her 3 actions with graft).
    state = applyAction(state, { kind: 'graft' })
    state = applyAction(state, { kind: 'graft' })
    state = applyAction(state, { kind: 'graft' })
    expect(state.activeProducer).toBe('tomas')
    const highmoorStallsBefore = state.regions.highmoor.stalls.tomas ?? 0
    const before = state.producers.tomas.resources.produce
    // Highmoor borders Oakvale (Tomas's home) so it's a legal Market Day target.
    expect(legalActions(state).some((a) => a.kind === 'role' && a.targetRegion === 'highmoor')).toBe(true)
    state = applyAction(state, { kind: 'role', targetRegion: 'highmoor' })
    expect(state.regions.highmoor.stalls.tomas).toBe(highmoorStallsBefore + 1)
    expect(state.producers.tomas.resources.produce).toBe(before) // free: no Produce spent
    expect(validate(state)).toEqual([])
  })

  it("Sol's On Air is a real choice between Public Trust +1 and +2 Goodwill (M4 balance-loop iteration 8)", () => {
    const trustState = createGame(SOL_CONFIG, 5)
    const legal = legalActions(trustState)
    expect(legal.some((a) => a.kind === 'role' && a.choice === 'trust')).toBe(true)
    expect(legal.some((a) => a.kind === 'role' && a.choice === 'goodwill')).toBe(true)

    const trustBefore = trustState.publicTrust
    const afterTrust = applyAction(trustState, { kind: 'role', choice: 'trust' })
    expect(afterTrust.publicTrust).toBe(Math.min(15, trustBefore + 1))
    expect(afterTrust.producers.sol.resources.goodwill).toBe(trustState.producers.sol.resources.goodwill)
    expect(afterTrust.producers.sol.roleUsedThisRound).toBe(true)
    expect(legalActions(afterTrust).some((a) => a.kind === 'role')).toBe(false)
    expect(validate(afterTrust)).toEqual([])

    const goodwillState = createGame(SOL_CONFIG, 5)
    const goodwillBefore = goodwillState.producers.sol.resources.goodwill
    const afterGoodwill = applyAction(goodwillState, { kind: 'role', choice: 'goodwill' })
    expect(afterGoodwill.producers.sol.resources.goodwill).toBe(goodwillBefore + 2)
    expect(afterGoodwill.publicTrust).toBe(goodwillState.publicTrust)
    expect(validate(afterGoodwill)).toEqual([])
  })

  it("Ines's Second Opinion lets the player choose among every region with her Stall and Doubt, not just the first", () => {
    // SPEC 6: "remove 1 Doubt from a region with your Stall, at no cost" — previously auto-picked the
    // first eligible region in activeRegions order, denying the player a choice when two+ qualified.
    let state: GameState = createGame(SOL_CONFIG, 5)
    // Advance to Ines's turn (first player is Sol; use up her 3 actions with graft).
    state = applyAction(state, { kind: 'graft' })
    state = applyAction(state, { kind: 'graft' })
    state = applyAction(state, { kind: 'graft' })
    expect(state.activeProducer).toBe('ines')
    state = {
      ...state,
      doubtPool: state.doubtPool - 2, // both regions gain 1 Doubt each from the map's pool below
      regions: {
        ...state.regions,
        highmoor: { ...state.regions.highmoor, stalls: { ines: 1 }, doubt: 1 },
        rivermead: { ...state.regions.rivermead, stalls: { ines: 1 }, doubt: 1 },
      },
    }
    const legal = legalActions(state).filter((a) => a.kind === 'role')
    expect(legal.some((a) => a.targetRegion === 'highmoor')).toBe(true)
    expect(legal.some((a) => a.targetRegion === 'rivermead')).toBe(true)

    const next = applyAction(state, { kind: 'role', targetRegion: 'highmoor' })
    expect(next.regions.highmoor.doubt).toBe(0)
    expect(next.regions.rivermead.doubt).toBe(1) // the other eligible region is untouched
    expect(validate(next)).toEqual([])
  })
})
