// Shared by `sim/run.ts` (single process entry point) and `sim/simWorker.ts` (one per worker thread):
// the actual "play N games and report metrics" logic, kept independent of how the games are distributed.
import { createGame } from '../src/engine/state'
import { applyAction, legalActions } from '../src/engine/actions'
import { validate } from '../src/engine/api'
import { createRng } from '../src/engine/rng'
import { RandomBot } from '../src/ai/random'
import { HeuristicBot } from '../src/ai/heuristic'
import { createMCTSBot } from '../src/ai/mcts'
import type { Bot } from '../src/ai/types'
import type { GameConfig, GameState, ProducerId } from '../src/engine/types'

// SPEC 9.3: "Simulations may use a lower budget (200 simulations per decision) to save time."
export const SIM_MCTS_BUDGET = 200
// Balance-loop iteration 5 (DECISIONS.md): a longer rollout horizon lets MCTS "see" more of the
// liberation payoff of a candidate action, since pressureDeckEmpty (games running out the 10-round
// Pressure deck before liberating 5 regions) has been the dominant loss reason since iteration 1.
// Iteration 8 tried pushing this further (3 -> 4) and reverted it (DECISIONS.md): a 200-game sanity
// run took 18 minutes (vs. ~87s for a 60-game run at rounds=3), making a 1,000-game confirmation
// impractical within one session, and the loss-reason mix just shifted (pressureDeckEmpty down,
// publicTrust up sharply) rather than clearly improving, with the win rate flat and the producer-pair
// spread worse. 3 is the value actually used.
export const SIM_MCTS_ROLLOUT_ROUNDS = 3
const STEP_CAP = 2000
const SETTLED_LIBERATED_THRESHOLD = 4

export const ALL_PAIRS: ProducerId[][] = [
  ['mara', 'tomas'],
  ['mara', 'ines'],
  ['mara', 'sol'],
  ['tomas', 'ines'],
  ['tomas', 'sol'],
  ['ines', 'sol'],
]

export type BotName = 'random' | 'heuristic' | 'mcts'
export type Difficulty = 'easy' | 'normal' | 'hard'

export function botFor(name: BotName): Bot {
  if (name === 'random') return RandomBot
  if (name === 'heuristic') return HeuristicBot
  return createMCTSBot(SIM_MCTS_BUDGET, SIM_MCTS_ROLLOUT_ROUNDS)
}

export interface GameOutcome {
  pair: string
  won: boolean
  lossReason: string | null
  rounds: number
  settledRound: number | null // first round the outcome looked decided (SPEC 9.3)
  improvementsBought: string[]
  schemesPlayed: string[]
  legalActionCounts: number[]
  crashed: boolean
  invariantFailure: string | null
}

// "the round at which the outcome became settled (4 or more regions liberated, or a loss track within 1
// of losing)" — checked once per round, right after Cleanup, using that round's ending state.
function isSettled(state: GameState): boolean {
  const liberated = Object.values(state.regions).filter((r) => r.liberated).length
  if (liberated >= SETTLED_LIBERATED_THRESHOLD) return true
  if (state.publicTrust <= 1) return true
  if (state.lostLandPool <= 1) return true
  if (state.pressureDeck.length <= 1) return true
  return false
}

export function playOneGame(
  bot: Bot,
  pair: ProducerId[],
  difficulty: Difficulty,
  seed: number,
  activeRegions: GameConfig['activeRegions'],
): GameOutcome {
  const config: GameConfig = { producers: pair, difficulty, activeRegions }
  const pairLabel = [...pair].sort().join('+')
  const outcome: GameOutcome = {
    pair: pairLabel,
    won: false,
    lossReason: null,
    rounds: 0,
    settledRound: null,
    improvementsBought: [],
    schemesPlayed: [],
    legalActionCounts: [],
    crashed: false,
    invariantFailure: null,
  }
  try {
    let state = createGame(config, seed)
    let rng = createRng(seed * 7919 + 1)
    let lastRound = state.round
    for (let step = 0; step < STEP_CAP; step++) {
      if (state.result) {
        outcome.won = state.result.won
        outcome.lossReason = state.result.lossReason ?? null
        outcome.rounds = state.round
        break
      }
      const actions = legalActions(state)
      outcome.legalActionCounts.push(actions.length)
      const [action, next] = bot.chooseAction(state, rng)
      rng = next
      state = applyAction(state, action)
      if (action.kind === 'invest') outcome.improvementsBought.push(action.improvementId)
      if (action.kind === 'scheme') outcome.schemesPlayed.push(action.schemeId)
      const errors = validate(state)
      if (errors.length > 0) {
        outcome.invariantFailure = errors.map((e) => e.message).join('; ')
        return outcome
      }
      // Cleanup (src/engine/round.ts) increments `state.round` to the *next* round right after computing
      // the state this check reads (liberated count, publicTrust, lostLandPool, pressureDeck.length are
      // all already final for the round that just ended and are unaffected by the increment). So once
      // `state.round` has changed, `lastRound` — not the already-incremented `state.round` — is the round
      // whose Cleanup this settled check is evaluating; using `state.round` here recorded the round *after*
      // the one that actually settled (an off-by-one that inflated every settledRound by 1, which in turn
      // undercounted "settled before round 7" in every past BALANCE.md run using this harness).
      if (state.round !== lastRound && outcome.settledRound === null && isSettled(state)) {
        outcome.settledRound = lastRound
      }
      lastRound = state.round
    }
    if (!state.result) {
      // The loop exhausted STEP_CAP without the engine ever reaching a win/loss result — a non-terminating
      // game is itself the most serious kind of engine failure SPEC 9.3's "crashes and invariant failures,
      // which must be 0" metric exists to catch (sim/fuzz.ts's sibling harness already treats this the same
      // way). Left unflagged, this would otherwise fall through as an ordinary loss with a misleading
      // `rounds: 0`/`lossReason: null`.
      outcome.invariantFailure = `did not reach a result within ${STEP_CAP} steps`
    }
  } catch (err) {
    outcome.crashed = true
    outcome.invariantFailure = err instanceof Error ? err.message : String(err)
  }
  return outcome
}
