import { describe, expect, it } from 'vitest'
import { cathSceneSvg, momentForResult, MOMENTS, type CathMoment } from '../shared/cath/scene'

describe('cath scene', () => {
  it('every moment renders an svg with its expression and motion', () => {
    for (const m of Object.keys(MOMENTS) as CathMoment[]) {
      const svg = cathSceneSvg(m)
      expect(svg).toContain(`cath-${MOMENTS[m].expression}`)
      expect(svg).toContain(`cath-move-${MOMENTS[m].motion}`)
    }
  })
  it('maps results to moments', () => {
    expect(momentForResult(false)).toBe('lose')
    expect(momentForResult(true, 2)).toBe('win')
    expect(momentForResult(true, 3)).toBe('perfect')
  })
})
