import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { legalActions, applyAction } from '../src/engine/actions'
import { deserialize, isOver, replay, result, serialize, validate } from '../src/engine/api'
import { createRng, nextInt } from '../src/engine/rng'
import { ALL_REGION_IDS } from '../src/content/map'
import type { GameConfig } from '../src/engine/types'

const FULL_CONFIG: GameConfig = {
  producers: ['mara', 'tomas'],
  difficulty: 'normal',
  activeRegions: ALL_REGION_IDS,
}

function playSomeActions(seed: number, steps: number) {
  let state = createGame(FULL_CONFIG, seed)
  let rng = createRng(seed * 104729 + 1)
  const actions = []
  for (let i = 0; i < steps && !state.result; i++) {
    const legal = legalActions(state)
    const [idx, next] = nextInt(rng, legal.length)
    rng = next
    const action = legal[idx]!
    actions.push(action)
    state = applyAction(state, action)
  }
  return { state, actions }
}

describe('validate', () => {
  it('finds no errors on a fresh game', () => {
    const state = createGame(FULL_CONFIG, 11)
    expect(validate(state)).toEqual([])
  })

  it('finds no errors after a run of random actions', () => {
    const { state } = playSomeActions(11, 60)
    expect(validate(state)).toEqual([])
  })
})

describe('serialize/deserialize', () => {
  it('round-trips to an identical state and stays under 50KB', () => {
    const { state } = playSomeActions(21, 40)
    const json = serialize(state)
    expect(json.length).toBeLessThan(50 * 1024)
    expect(deserialize(json)).toEqual(state)
  })
})

describe('replay', () => {
  it('rebuilds the identical state from config, seed and actions', () => {
    const { state, actions } = playSomeActions(33, 40)
    const rebuilt = replay(FULL_CONFIG, 33, actions)
    expect(serialize(rebuilt)).toBe(serialize(state))
  })
})

describe('isOver/result', () => {
  it('is over only once a result exists', () => {
    const state = createGame(FULL_CONFIG, 1)
    expect(isOver(state)).toBe(false)
    expect(result(state)).toBeNull()
  })
})
