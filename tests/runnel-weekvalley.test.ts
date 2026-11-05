import { describe, expect, it } from 'vitest'
import { SPOTS, featureSvg, firstSpot, weekFeatures } from '../games/runnel/src/weekvalley'

const r = (n: number) => ({ number: n, timeMs: 60_000, taps: 20, par: 20 })

describe('Runnel: a valley that remembers the week (plan item 142)', () => {
  it('leaves one keep per day solved this week and a fallow plot per day missed, up to today', () => {
    // 2026-11-05 is a Thursday: Mon 2 and Wed 4 solved, Tue 3 missed, today not yet.
    const f = weekFeatures('2026-11-05', { '2026-11-02': r(36), '2026-11-04': r(38) })
    expect(f.map((x) => x.day)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04'])
    expect(f[1]!.kind).toBe('fallow')
    expect(f.filter((x) => x.kind !== 'fallow')).toHaveLength(2)
  })
  it('starts again on Monday', () => {
    expect(weekFeatures('2026-11-09', { '2026-11-07': r(41), '2026-11-08': r(42) })).toEqual([])
  })
  it('picks the same feature and spot for a day every time', () => {
    const a = weekFeatures('2026-11-06', { '2026-11-05': r(40) })
    const b = weekFeatures('2026-11-07', { '2026-11-05': r(40) })
    expect(a.find((x) => x.day === '2026-11-05')).toEqual(b.find((x) => x.day === '2026-11-05'))
    expect(firstSpot('2026-11-05')).toBe(firstSpot('2026-11-05'))
    expect(firstSpot('2026-11-05')).toBeLessThan(SPOTS.length)
  })
  it('draws every kind', () => {
    for (const k of ['mill', 'footbridge', 'orchard', 'scarecrow', 'fallow'] as const) expect(featureSvg(k)).toMatch(/^<svg/)
  })
})
