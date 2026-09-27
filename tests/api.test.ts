import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { legalActions, applyAction } from '../src/engine/actions'
import { deserialize, isOver, replay, result, serialize, validate } from '../src/engine/api'
import { createRng, nextInt } from '../src/engine/rng'
import { ALL_REGION_IDS } from '../src/content/map'
import { HeuristicBot } from '../src/ai/heuristic'
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

// Plays a full game to its end screen (round 10 or a liberation/loss result) using HeuristicBot, which
// greedily buys Improvements whenever that scores best — the realistic worst case for serialized size,
// since `state.log`/`state.actionHistory` (SPEC 9.1's engine invariants, `pieces.ts`'s end-screen stats)
// grow for the whole game and never get trimmed, and a full tableau of owned Improvements is the biggest
// per-producer payload. A safety cap guards against a bot bug hanging the test instead of ending the game.
function playFullGame(seed: number) {
  let state = createGame(FULL_CONFIG, seed)
  let rng = createRng(seed * 104729 + 1)
  for (let step = 0; step < 2000 && !state.result; step++) {
    const [action, next] = HeuristicBot.chooseAction(state, rng)
    rng = next
    state = applyAction(state, action)
  }
  return state
}

describe('serialize/deserialize', () => {
  it('round-trips to an identical state', () => {
    const { state } = playSomeActions(21, 40)
    const json = serialize(state)
    expect(deserialize(json)).toEqual(state)
  })

  it('stays under 50KB (SPEC 9.1) for a full 10-round game with a maxed-out Improvement tableau', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const state = playFullGame(seed)
      expect(state.result).not.toBeNull()
      expect(state.round).toBeLessThanOrEqual(10)

      // Sanity-check this is a real worst case, not a trivially short/empty game: HeuristicBot buys
      // Improvements greedily, so a full game should leave a substantial tableau and a long log/history.
      // Threshold lowered from 5 (see DECISIONS.md): converting 4 filler Improvements to pure ongoing-
      // ability cards for SPEC 7's effect-mix target shifted HeuristicBot's per-seed purchase counts
      // (its legal-action list/order changed), and the lowest observed across seeds 1-10 dropped to 4 —
      // still a real, substantial tableau, not a degenerate game.
      const improvementsOwned = Object.values(state.producers).reduce((n, p) => n + p.improvements.length, 0)
      expect(improvementsOwned).toBeGreaterThan(2)
      expect(state.log.length).toBeGreaterThan(50)

      const json = serialize(state)
      expect(json.length).toBeLessThan(50 * 1024)
    }
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
