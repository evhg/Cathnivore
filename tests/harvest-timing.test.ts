import { describe, expect, it } from 'vitest'
import { harvestTiming } from '../src/ui/harvestTiming'

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
