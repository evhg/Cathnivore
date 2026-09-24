import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { legalActions, applyAction } from '../src/engine/actions'
import { validate } from '../src/engine/api'
import { ALL_REGION_IDS } from '../src/content/map'
import type { GameConfig } from '../src/engine/types'

const FULL_CONFIG: GameConfig = {
  producers: ['mara', 'tomas'],
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
})
