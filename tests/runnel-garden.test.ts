import { describe, expect, it } from 'vitest'
import { gardenPlots, gardenVisitor, GARDEN_SIZE } from '../games/runnel/src/garden'

const r = (taps: number) => ({ number: 1, timeMs: 1000, taps, par: 10 })

describe('runnel garden', () => {
  it('grows crops with age and marks par wins gold', () => {
    const plots = gardenPlots({ '2026-10-01': r(10), '2026-10-28': r(12), '2026-10-30': r(9) }, '2026-10-30')
    expect(plots.map((p) => p.stage)).toEqual(['ripe', 'growing', 'sprout'])
    expect(plots.map((p) => p.gold)).toEqual([true, false, true])
  })
  it('keeps only the newest plots and is deterministic', () => {
    const res: Record<string, ReturnType<typeof r>> = {}
    for (let i = 1; i <= 28; i++) res[`2026-09-${String(i).padStart(2, '0')}`] = r(10)
    for (let i = 1; i <= 20; i++) res[`2026-10-${String(i).padStart(2, '0')}`] = r(10)
    const a = gardenPlots(res, '2026-10-30')
    expect(a).toHaveLength(GARDEN_SIZE)
    expect(gardenPlots(res, '2026-10-30')).toEqual(a)
  })
  it('a visitor arrives once there are three crops', () => {
    expect(gardenVisitor('autumn', [])).toBeNull()
    const three = gardenPlots({ '2026-10-01': r(9), '2026-10-02': r(9), '2026-10-03': r(9) }, '2026-10-30')
    expect(gardenVisitor('autumn', three)?.line).toMatch(/hedgehog/)
  })
})
