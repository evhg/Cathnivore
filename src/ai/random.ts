import { legalActions } from '../engine/actions'
import { nextInt } from '../engine/rng'
import type { Bot } from './types'

// SPEC 9.2: picks uniformly among legal actions. The balance-loop floor (RandomBot pairs must win under
// 5% on Easy) and the fuzz gate's 10,000-game sweep both use this bot.
export const RandomBot: Bot = {
  chooseAction(state, rng) {
    const actions = legalActions(state)
    const [i, next] = nextInt(rng, actions.length)
    return [actions[i]!, next]
  },
}
