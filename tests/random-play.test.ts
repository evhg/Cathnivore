import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { legalActions, applyAction } from '../src/engine/actions'
import { validate } from '../src/engine/api'
import { createRng, nextInt } from '../src/engine/rng'
import { ALL_REGION_IDS } from '../src/content/map'
import type { GameConfig } from '../src/engine/types'

const FULL_CONFIG: GameConfig = {
  producers: ['mara', 'tomas'],
  difficulty: 'normal',
  activeRegions: ALL_REGION_IDS,
}

// Plays uniformly-random legal actions until the game ends or a safety cap is hit, calling validate()
// after every step. This is the shape SPEC 11.4's fuzz gate runs at scale (10,000 games); here it's a
// handful, just to catch crashes and invariant failures early.
function playRandomGame(seed: number) {
  let state = createGame(FULL_CONFIG, seed)
  let rng = createRng(seed * 7919 + 1)
  for (let step = 0; step < 2000; step++) {
    if (state.result) return state
    const actions = legalActions(state)
    expect(actions.length).toBeGreaterThan(0)
    const [i, next] = nextInt(rng, actions.length)
    rng = next
    state = applyAction(state, actions[i]!)
    expect(validate(state)).toEqual([])
  }
  throw new Error(`Game did not end within the step cap (seed ${seed})`)
}

describe('random play', () => {
  it('never crashes, stays valid, and ends by round 10, for a range of seeds', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const state = playRandomGame(seed)
      expect(state.result).not.toBeNull()
      expect(state.round).toBeLessThanOrEqual(10)
    }
  })

  it('replaying the same seed and actions gives an identical state (determinism)', () => {
    const seed = 42
    let state = createGame(FULL_CONFIG, seed)
    const actions = []
    let rng = createRng(seed * 7919 + 1)
    for (let step = 0; step < 200 && !state.result; step++) {
      const legal = legalActions(state)
      const [i, next] = nextInt(rng, legal.length)
      rng = next
      const action = legal[i]!
      actions.push(action)
      state = applyAction(state, action)
    }

    let replay = createGame(FULL_CONFIG, seed)
    for (const action of actions) {
      replay = applyAction(replay, action)
    }
    expect(JSON.stringify(replay)).toBe(JSON.stringify(state))
  })
})
