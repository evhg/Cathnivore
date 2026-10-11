// AAA UI: WCAG ratios for every declared text-on-fill pair (shared/ui/contrast-pairs.ts).
import { describe, expect, it } from 'vitest'
import { CONTRAST_PAIRS, contrastRatio } from '../shared/ui/contrast-pairs'

describe('declared colour pairs meet WCAG AA', () => {
  it('computes known ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5)
  })
  for (const [game, pairs] of Object.entries(CONTRAST_PAIRS)) {
    describe(game, () => {
      for (const p of pairs) {
        const need = p.large || p.ui ? 3 : 4.5
        it(`${p.label} reaches ${need}:1`, () => {
          expect(contrastRatio(p.fg, p.bg)).toBeGreaterThanOrEqual(need)
        })
      }
    })
  }
})
