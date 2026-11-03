import { describe, expect, it } from 'vitest'
import { ALL_PRODUCER_IDS } from '../src/content/producers'
import { pairLine } from '../src/content/pairLines'

// Plan item 54: every pair of producers has its own Cath line on the phone Setup, the same either way round.
describe('pair lines', () => {
  it('gives each unordered pair a distinct line', () => {
    const seen = new Set<string>()
    for (const a of ALL_PRODUCER_IDS)
      for (const b of ALL_PRODUCER_IDS) {
        if (a >= b) continue
        expect(pairLine(a, b)).toBe(pairLine(b, a))
        expect(pairLine(a, b)).not.toMatch(/Two good hands/)
        seen.add(pairLine(a, b))
      }
    expect(seen.size).toBe(6)
  })
})
