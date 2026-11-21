// Plan item 616: the week's market event on the cards it cheapens. An Improvement the event discounts wears a
// hand-tied tag: its price without the event, struck, then the price paid. Pure, so the tag is tested against the
// engine's own pricing (`investCost`), never a second copy of the rule.
import { investCost } from '../engine/actions'
import { IMPROVEMENTS_BY_ID } from '../content/improvements'
import type { GameState } from '../engine/types'

/** The price this Improvement would cost the active producer without the week's event, when the event lowers it. */
export function eventWasPrice(state: GameState, improvementId: string): number | undefined {
  const card = IMPROVEMENTS_BY_ID.get(improvementId)
  if (!card || !state.config.marketEvent) return undefined
  const now = investCost(state, state.activeProducer, card)
  const without = investCost({ ...state, config: { ...state.config, marketEvent: undefined } }, state.activeProducer, card)
  return without > now ? without : undefined
}
