// SPEC 9.2: "AI teammate: MCTSBot running in a Web Worker so the screen never freezes." This is the
// Worker's entry point (built as its own bundle by Vite's `new Worker(new URL(...))` pattern — see
// `src/ui/Game.tsx`). It does one thing: take a game state and RNG state, run `AI_TEAMMATE_BOT`
// (`src/ai/mcts.ts`'s `createMCTSBot(600, 2, 400)`, matching SPEC 9.2's "up to 600 simulations or 400ms
// per decision, whichever comes first" — now enforced for real by `deadlineMs`, see DECISIONS.md) and
// post back the chosen action and the advanced RNG state. `GameState`/`Action`/`RngState` are all plain
// JSON-shaped data (SPEC 9.1), so they cross the worker boundary via structured clone with no special
// handling needed.
import { AI_TEAMMATE_BOT } from './mcts'
import { reasonForAction } from './reason'
import type { Action, GameState } from '../engine/types'
import type { RngState } from '../engine/rng'

export interface AIWorkerRequest {
  state: GameState
  rng: RngState
}

export interface AIWorkerResponse {
  action: Action
  rng: RngState
  // SPEC 9.2: "Each AI action shows a one-line reason in the log." Computed here, against the state the
  // decision was actually made from, rather than in `Game.tsx` after the fact.
  reason: string
}

// `self` in a module worker's scope is a `DedicatedWorkerGlobalScope`, not the `Window` the project's DOM
// lib types it as elsewhere — this file only runs inside the worker, never imported by UI code, so the
// cast is safe and confined to this one entry point.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<AIWorkerRequest>) => void) | null
  postMessage(message: AIWorkerResponse): void
}

scope.onmessage = (event) => {
  const { state, rng } = event.data
  const [action, nextRng] = AI_TEAMMATE_BOT.chooseAction(state, rng)
  scope.postMessage({ action, rng: nextRng, reason: reasonForAction(state, action) })
}
