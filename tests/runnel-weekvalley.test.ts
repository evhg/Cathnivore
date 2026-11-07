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

// Plan item 252: the valley's props are varied and never a row of the same patch.
import { propSvg, valleyProps } from '../games/runnel/src/weekvalley'
describe('Runnel valley props (plan item 252)', () => {
  it('gives distinct kinds per board, varying with the seed, over 30 seeds', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 30; i++) {
      const p = valleyProps(`daily-2026-11-${String(i + 1).padStart(2, '0')}`, 4)
      expect(new Set(p).size).toBe(p.length)
      expect(p).toHaveLength(4)
      for (const k of p) seen.add(k)
    }
    expect(seen.size).toBeGreaterThanOrEqual(5)
    for (const k of ['hayrick', 'trough', 'stile', 'beehive', 'churn', 'barrow'] as const) expect(propSvg(k)).toMatch(/^<svg/)
  })
  it('a first visit shows no fallow, and at most two fallow plots ever show', () => {
    expect(weekFeatures('2026-11-07', {})).toEqual([])
    const f = weekFeatures('2026-11-07', { '2026-10-20': r(20) })
    expect(f.filter((x) => x.kind === 'fallow').length).toBeLessThanOrEqual(2)
  })
})
