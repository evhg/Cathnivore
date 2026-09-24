import type { RngState } from '../engine/rng'
import type { Action, GameState } from '../engine/types'

// SPEC 9.2: all bots (Random, Heuristic, MCTS) and the AI teammate share this shape. `chooseAction`
// is pure — it returns the advanced RNG state alongside the chosen action, same threading pattern as
// the engine's own RNG — so a bot never reaches for `Math.random` (SPEC 9.1).
export interface Bot {
  chooseAction(state: GameState, rng: RngState): [Action, RngState]
}
