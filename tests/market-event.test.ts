import { describe, expect, it } from 'vitest'
import { eventDiscount, marketEventFor, MARKET_EVENTS } from '../src/engine/marketEvent'
import { investCost } from '../src/engine/actions'
import { createGame } from '../src/engine/api'
import { ALL_REGION_IDS } from '../src/content/map'

describe('Marrow Market events', () => {
  it('rotates by week and is stable within one', () => {
    const a = marketEventFor(new Date('2026-10-26T00:00:00Z'))
    expect(marketEventFor(new Date('2026-11-01T23:00:00Z')).id).toBe(a.id)
    const ids = new Set([0, 7, 14].map((d) => marketEventFor(new Date(Date.UTC(2026, 9, 26 + d))).id))
    expect(ids.size).toBe(3)
  })
  it('cheapens matching tags by 1, floor 1', () => {
    expect(eventDiscount('glut', ['crop'])).toBe(1)
    expect(eventDiscount('glut', ['media'])).toBe(0)
    expect(eventDiscount(undefined, ['crop'])).toBe(0)
    const base = { producers: ['mara', 'tomas'] as const, difficulty: 'normal' as const, activeRegions: ALL_REGION_IDS }
    const plain = createGame({ ...base, producers: [...base.producers] }, 1)
    const fest = createGame({ ...base, producers: [...base.producers], marketEvent: 'festival' }, 1)
    const card = { cost: 3, tags: MARKET_EVENTS.festival.cheap }
    expect(investCost(fest, 'mara', card)).toBe(investCost(plain, 'mara', card) - 1)
    expect(investCost(fest, 'mara', { cost: 1, tags: ['media'] })).toBe(1)
  })
})
