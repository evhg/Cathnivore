import type { GameState, RulesEnabled } from './types'

// The full game (SPEC 8.1: "the full game is simply every rule switched on").
export const DEFAULT_RULES: RulesEnabled = {
  agenda: true,
  squeeze: true,
  expand: true,
  rebut: true,
  sell: true,
  improvements: true,
  schemes: true,
  roles: true,
}

export function resolveRules(state: GameState): RulesEnabled {
  return state.config.rulesEnabled ?? DEFAULT_RULES
}
