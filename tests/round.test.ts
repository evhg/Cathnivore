import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { applyAction } from '../src/engine/actions'
import { ALL_REGION_IDS } from '../src/content/map'
import type { GameConfig, GameState } from '../src/engine/types'

const FULL_CONFIG: GameConfig = {
  producers: ['mara', 'tomas'],
  difficulty: 'normal',
  activeRegions: ALL_REGION_IDS,
}

const ONE_PRODUCER_CONFIG: GameConfig = {
  producers: ['mara'],
  difficulty: 'normal',
  activeRegions: ALL_REGION_IDS,
}

// Drives one producer's turn forward with Graft (SPEC 4.6.7: always legal), resolving any pending
// decision (e.g. a home-region Squeeze production loss) with its first option so an unlucky enemy
// turn can never stall the driver mid-round.
function grindOneAction(state: GameState): GameState {
  if (state.pendingDecisions.length > 0) {
    const d = state.pendingDecisions[0]!
    return applyAction(state, { kind: 'decide', decisionId: d.id, choice: d.options[0]! })
  }
  return applyAction(state, { kind: 'graft' })
}

describe('SPEC 4.3/4.5.2/4.5.4: first player at setup, alternation, and turn order', () => {
  it('makes config.producers[0] the first player and activeProducer from round 1 (SPEC 4.3 step 6)', () => {
    const state = createGame(FULL_CONFIG, 1)
    expect(state.firstPlayer).toBe('mara')
    expect(state.activeProducer).toBe('mara')
    expect(state.round).toBe(1)
  })

  it('alternates the first player every round for a 2-producer game (SPEC 4.5.2/4.5.4)', () => {
    let state = createGame(FULL_CONFIG, 1)
    const seenByRound: Record<number, string> = { 1: state.firstPlayer }
    // Grind rounds 1-4 forward: 3 actions each producer per round (6 total), some of which may be
    // absorbed by an interleaved forced decision, which `grindOneAction` resolves transparently.
    for (let round = 1; round <= 4 && !state.result; round++) {
      // Keep taking actions until the round actually advances (cleanup runs once both producers'
      // actionsLeft hit 0 and the enemy turn resolves), rather than assuming exactly 6 calls.
      const startRound = state.round
      let guard = 0
      while (state.round === startRound && !state.result && guard < 50) {
        state = grindOneAction(state)
        guard++
      }
      if (!state.result) seenByRound[state.round] = state.firstPlayer
    }
    // Round 1: mara. Round 2: tomas. Round 3: mara. Round 4: tomas. Strictly alternating, never
    // fixed and never skipping a round.
    expect(seenByRound[1]).toBe('mara')
    if (seenByRound[2]) expect(seenByRound[2]).toBe('tomas')
    if (seenByRound[3]) expect(seenByRound[3]).toBe('mara')
    if (seenByRound[4]) expect(seenByRound[4]).toBe('tomas')
  })

  it('gives the first player all 3 actions before the second player acts at all (SPEC 4.5.2)', () => {
    let state = createGame(FULL_CONFIG, 1)
    expect(state.activeProducer).toBe('mara')
    state = grindOneAction(state)
    expect(state.activeProducer).toBe('mara')
    expect(state.actionsLeft).toBe(2)
    state = grindOneAction(state)
    expect(state.activeProducer).toBe('mara')
    expect(state.actionsLeft).toBe(1)
    state = grindOneAction(state)
    // Third action exhausts mara's turn and switches straight to tomas with a full 3 actions —
    // never interleaved, never a partial handoff.
    expect(state.activeProducer).toBe('tomas')
    expect(state.actionsLeft).toBe(3)
  })

  it('never introduces a second-player turn for a 1-producer config (campaign chapters 1-3)', () => {
    let state = createGame(ONE_PRODUCER_CONFIG, 1)
    expect(state.firstPlayer).toBe('mara')
    expect(state.activeProducer).toBe('mara')
    for (let i = 0; i < 3; i++) {
      state = grindOneAction(state)
      expect(state.activeProducer).toBe('mara')
    }
    // The single producer's 3rd action ends their turn and, since there is no second producer to
    // hand off to, goes straight into the enemy turn/cleanup and round 2 — still with mara as both
    // firstPlayer and activeProducer.
    expect(state.round).toBe(2)
    expect(state.firstPlayer).toBe('mara')
    expect(state.activeProducer).toBe('mara')
  })
})
