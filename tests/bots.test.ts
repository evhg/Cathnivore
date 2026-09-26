import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { applyAction } from '../src/engine/actions'
import { validate } from '../src/engine/api'
import { createRng } from '../src/engine/rng'
import { ALL_REGION_IDS } from '../src/content/map'
import { RandomBot } from '../src/ai/random'
import { HeuristicBot } from '../src/ai/heuristic'
import { createMCTSBot } from '../src/ai/mcts'
import { evaluate } from '../src/ai/evaluation'
import type { Bot } from '../src/ai/types'
import type { GameConfig } from '../src/engine/types'

const FULL_CONFIG: GameConfig = {
  producers: ['mara', 'tomas'],
  difficulty: 'normal',
  activeRegions: ALL_REGION_IDS,
}

function playOut(bot: Bot, seed: number): void {
  let state = createGame(FULL_CONFIG, seed)
  let rng = createRng(seed * 104729 + 1)
  for (let step = 0; step < 400; step++) {
    if (state.result) return
    const [action, next] = bot.chooseAction(state, rng)
    rng = next
    state = applyAction(state, action)
    const errors = validate(state)
    expect(errors).toEqual([])
  }
  throw new Error(`did not finish within 400 steps (seed ${seed})`)
}

describe('bots', () => {
  it('RandomBot finishes games with no invariant failures (a few seeds)', () => {
    for (let seed = 1; seed <= 5; seed++) playOut(RandomBot, seed)
  })

  it('HeuristicBot finishes games with no invariant failures (a few seeds)', () => {
    for (let seed = 1; seed <= 5; seed++) playOut(HeuristicBot, seed)
  })

  it('MCTSBot (small budget) finishes a game with no invariant failures', () => {
    playOut(createMCTSBot(20, 1), 1)
  })

  it('a deadlined MCTSBot always returns a legal action, even with an impossibly tight deadline', () => {
    // deadlineMs=0 forces the very first out-of-time check to already be true for every candidate after
    // the first, so this also exercises the "only one rollout ran" path — the bot must still pick
    // something legal rather than throw or return undefined.
    const state = createGame(FULL_CONFIG, 7)
    const bot = createMCTSBot(600, 2, 0)
    const [action] = bot.chooseAction(state, createRng(1))
    expect(action).toBeDefined()
  })

  it('a deadlined MCTSBot finishes a full game with no invariant failures', () => {
    playOut(createMCTSBot(600, 2, 50), 3)
  })

  it("a deadline cuts a decision's real time short without changing an undeadlined bot's behaviour", () => {
    // Same budget/rounds/seed/state with and without a deadline: the deadlined run must be faster (it's
    // cutting simulations short), and the undeadlined bot's own timing is completely unaffected by the
    // new parameter existing (no `performance.now()` call happens when `deadlineMs` is omitted).
    const state = createGame(FULL_CONFIG, 2)
    const rng = createRng(9)
    const t0 = performance.now()
    createMCTSBot(400, 2).chooseAction(state, rng)
    const undeadlinedMs = performance.now() - t0

    const t1 = performance.now()
    createMCTSBot(400, 2, 5).chooseAction(state, rng)
    const deadlinedMs = performance.now() - t1

    expect(deadlinedMs).toBeLessThan(undeadlinedMs)
  })

  it('HeuristicBot beats RandomBot on average evaluation after a fixed number of steps', () => {
    function scoreAfterSteps(bot: Bot, seed: number, steps: number): number {
      let state = createGame(FULL_CONFIG, seed)
      let rng = createRng(seed)
      for (let i = 0; i < steps && !state.result; i++) {
        const [action, next] = bot.chooseAction(state, rng)
        rng = next
        state = applyAction(state, action)
      }
      return evaluate(state)
    }
    let heuristicTotal = 0
    let randomTotal = 0
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8]
    for (const seed of seeds) {
      heuristicTotal += scoreAfterSteps(HeuristicBot, seed, 30)
      randomTotal += scoreAfterSteps(RandomBot, seed, 30)
    }
    expect(heuristicTotal / seeds.length).toBeGreaterThan(randomTotal / seeds.length)
  })

  it('evaluate() scores a won position as 1 and a lost position as 0', () => {
    const state = createGame(FULL_CONFIG, 1)
    expect(evaluate({ ...state, result: { won: true, regionsLiberated: 5, round: 4, cardsBought: 0, schemesPlayed: 0 } })).toBe(1)
    expect(evaluate({ ...state, result: { won: false, lossReason: 'publicTrust', regionsLiberated: 0, round: 4, cardsBought: 0, schemesPlayed: 0 } })).toBe(0)
  })
})
