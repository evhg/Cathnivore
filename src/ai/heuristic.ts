import { applyAction, legalActions } from '../engine/actions'
import { evaluate } from './evaluation'
import type { Bot } from './types'

// SPEC 9.2: "greedy one-step lookahead using the evaluation function below, with simple rules such as
// protecting regions in the Squeeze and Expand slots and liberating whenever possible." Those simple
// rules fall out of the evaluation function's own liberated/squeeze-coverage terms under a 1-ply search,
// so this bot doesn't special-case them separately. Deterministic: `legalActions` has a fixed order and
// ties keep the first best action found, so the RNG passed in is returned untouched.
export const HeuristicBot: Bot = {
  chooseAction(state, rng) {
    const actions = legalActions(state)
    let best = actions[0]!
    let bestScore = -Infinity
    for (const action of actions) {
      const score = evaluate(applyAction(state, action))
      if (score > bestScore) {
        bestScore = score
        best = action
      }
    }
    return [best, rng]
  },
}
