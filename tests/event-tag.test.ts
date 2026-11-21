import { describe, expect, it } from 'vitest'
import { eventDiscount, MARKET_EVENTS, type MarketEventId } from '../src/engine/marketEvent'
import { investCost } from '../src/engine/actions'
import { createGame } from '../src/engine/api'
import { ALL_REGION_IDS } from '../src/content/map'
import { IMPROVEMENTS } from '../src/content/improvements'
import { eventWasPrice } from '../src/ui/eventTag'

// Plan item 616: every Improvement the week's event cheapens wears a sale tag (its price without the event, struck),
// and no other card does: the tag follows the engine's own `investCost` and `eventDiscount`.
describe("the market event's sale tags", () => {
  const base = { producers: ['mara', 'tomas'] as ('mara' | 'tomas')[], difficulty: 'normal' as const, activeRegions: ALL_REGION_IDS }
  for (const id of Object.keys(MARKET_EVENTS) as MarketEventId[]) {
    it(`${id}: a tag on exactly the discounted cards, showing the price without the event`, () => {
      const state = createGame({ ...base, producers: [...base.producers], marketEvent: id }, 1)
      const plain = createGame({ ...base, producers: [...base.producers] }, 1)
      let tagged = 0
      for (const card of IMPROVEMENTS) {
        const was = eventWasPrice(state, card.id)
        const cheaper = eventDiscount(id, card.tags) > 0 && investCost(state, state.activeProducer, card) < investCost(plain, plain.activeProducer, card)
        if (cheaper) {
          tagged++
          expect(was, card.id).toBe(investCost(plain, plain.activeProducer, card))
        } else expect(was, card.id).toBeUndefined()
      }
      expect(tagged).toBeGreaterThan(0)
    })
  }
  it('no event, no tags', () => {
    const state = createGame({ ...base, producers: [...base.producers] }, 1)
    for (const card of IMPROVEMENTS) expect(eventWasPrice(state, card.id)).toBeUndefined()
  })
})
