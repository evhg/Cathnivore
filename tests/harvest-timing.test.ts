import { describe, expect, it } from 'vitest'
import { bigHauls, HARVEST_CUE, harvestTiming } from '../src/ui/harvestTiming'

describe('harvestTiming (plan item 476)', () => {
  it('keeps the whole moment between 900 and 1600 ms for any haul', () => {
    for (let n = 1; n <= 40; n++) {
      const t = harvestTiming(n)
      expect(t.total).toBeGreaterThanOrEqual(900)
      expect(t.total).toBeLessThanOrEqual(1600)
      expect(t.flight).toBeGreaterThanOrEqual(700)
    }
  })
})

describe('bigHauls (plan item 476)', () => {
  it('names each producer with 3+ goods at its last good, and no one else', () => {
    const goods = ['mara', 'tomas', 'mara', 'ines', 'mara', 'tomas', 'mara'].map((producer) => ({ producer }))
    expect([...bigHauls(goods)]).toEqual([['mara', 6]])
    expect([...bigHauls(goods, 2)].sort()).toEqual([['mara', 6], ['tomas', 5]])
    expect(bigHauls([]).size).toBe(0)
  })
  it('gives each good a landing cue from the table set', () => {
    expect(HARVEST_CUE).toEqual({ produce: 'woodClack', marks: 'coinOne', goodwill: 'paperFlip' })
  })
})
