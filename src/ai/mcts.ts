import { applyAction, legalActions } from '../engine/actions'
import { nextInt, shuffle } from '../engine/rng'
import type { RngState } from '../engine/rng'
import type { Action, GameState } from '../engine/types'
import { evaluate } from './evaluation'
import type { Bot } from './types'

const ROLLOUT_STEP_CAP = 200 // safety valve; real games never need this many steps for 2 rounds

// Rollout steps used to call `HeuristicBot.chooseAction`, which itself does a full 1-ply lookahead
// (evaluate every legal action). Nested inside MCTS's own per-candidate rollouts, that made each
// top-level decision cost roughly (candidates) x (rollouts/candidate) x (rollout steps) x (actions
// evaluated per step) `applyAction`+`evaluate` calls -- profiled at ~400ms/decision at the sim harness's
// 200-simulation budget (see PROGRESS.md's M2 perf note / DECISIONS.md). SPEC 9.2 says simulations
// "follow HeuristicBot moves," which DECISIONS.md already read as "HeuristicBot-quality," not "literally
// call HeuristicBot recursively" -- so this samples a small, fixed number of candidate actions per
// rollout step (instead of all legal actions) and picks the best of those by the same evaluation
// function, cutting the per-step cost from O(legal actions) to O(1) without changing what's being
// optimized for.
const ROLLOUT_SAMPLE_SIZE = 6

function sampleRolloutAction(state: GameState, actions: Action[], rng: RngState): [Action, RngState] {
  if (actions.length <= ROLLOUT_SAMPLE_SIZE) {
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
  }

  const seen = new Set<number>()
  let r = rng
  let best = actions[0]!
  let bestScore = -Infinity
  while (seen.size < ROLLOUT_SAMPLE_SIZE) {
    const [i, r1] = nextInt(r, actions.length)
    r = r1
    if (seen.has(i)) continue
    seen.add(i)
    const action = actions[i]!
    const score = evaluate(applyAction(state, action))
    if (score > bestScore) {
      bestScore = score
      best = action
    }
  }
  return [best, r]
}

// SPEC 9.2: "Hidden deck orders are re-shuffled for each simulation so the bot never 'knows' the future."
// `GameState` keeps every deck visible to its caller (see DECISIONS.md), so an MCTS rollout that reused
// the real deck order would let the bot "see" cards it hasn't scouted yet. Reshuffling the undrawn
// portion of each deck before every simulation is what actually hides that information from it.
function reshuffleHiddenDecks(state: GameState, rng: RngState): [GameState, RngState] {
  const [pressureDeck, r1] = shuffle(state.pressureDeck, rng)
  const [agendaDeck, r2] = shuffle(state.agendaDeck, r1)
  const [schemeDeck, r3] = shuffle(state.schemeDeck, r2)
  const [improvementDeck, r4] = shuffle(state.improvementDeck, r3)
  return [{ ...state, pressureDeck, agendaDeck, schemeDeck, improvementDeck }, r4]
}

// Plays out `rounds` more rounds with HeuristicBot for both/all producers (SPEC 9.2: "the partner's
// moves inside simulations also use HeuristicBot"), then scores the result. Stops early if the game ends.
function rollout(state: GameState, rounds: number, rng: RngState): [GameState, RngState] {
  const targetRound = state.round + rounds
  let current = state
  let r = rng
  for (let step = 0; step < ROLLOUT_STEP_CAP; step++) {
    if (current.result || current.round >= targetRound) break
    const actions = legalActions(current)
    if (actions.length === 0) break
    const [action, next] = sampleRolloutAction(current, actions, r)
    r = next
    current = applyAction(current, action)
  }
  return [current, r]
}

// SPEC 9.2 MCTSBot: "simulates many possible futures for each candidate move and picks the move that
// leads to the best outcomes on average." Implemented as flat Monte Carlo rollout — evenly split a
// simulation budget across the candidate actions rather than growing a UCB tree — which matches that
// plain description and is cheap enough to run inside a Web Worker (SPEC 9.2's AI teammate) or the sim
// harness; revisit for a real UCB tree only if the balance loop (M4) shows this isn't strong enough.
export function createMCTSBot(budget = 200, rolloutRounds = 2): Bot {
  return {
    chooseAction(state, rng) {
      const actions = legalActions(state)
      if (actions.length <= 1) return [actions[0]!, rng]

      const perAction = Math.max(1, Math.floor(budget / actions.length))
      let best = actions[0]!
      let bestScore = -Infinity
      let r = rng

      for (const action of actions) {
        const afterAction = applyAction(state, action)
        let total = 0
        for (let i = 0; i < perAction; i++) {
          const [reshuffled, r1] = reshuffleHiddenDecks(afterAction, r)
          const [finished, r2] = rollout(reshuffled, rolloutRounds, r1)
          r = r2
          total += evaluate(finished)
        }
        const avg = total / perAction
        if (avg > bestScore) {
          bestScore = avg
          best = action
        }
      }
      return [best, r]
    },
  }
}

export const MCTSBot = createMCTSBot()
