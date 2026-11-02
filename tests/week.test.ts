import { describe, expect, it } from 'vitest'
import { loadWeek, pinPostcard, postcardFor, postcards, toGo, weekComplete, weekGoals, weekId } from '../shared/cath/week'

const mem = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}
const p = (h: number, r: number, n: number) => ({ hedgerowLevels: h, runnelDays: r, nightJobs: n })

describe("Cath's week", () => {
  it('names ISO weeks', () => {
    expect(weekId(new Date('2026-10-31T10:00:00Z'))).toBe('2026-W44')
    expect(weekId(new Date('2026-11-02T00:00:00Z'))).toBe('2026-W45')
    expect(weekId(new Date('2027-01-01T00:00:00Z'))).toBe('2026-W53')
  })
  it('counts growth since the baseline and completes at 3/3/1', () => {
    const g = weekGoals(p(14, 8, 2), p(10, 5, 2))
    expect(g.map((x) => x.done)).toEqual([3, 4, 0])
    expect(weekComplete(g)).toBe(false)
    expect(weekComplete(weekGoals(p(13, 8, 3), p(10, 5, 2)))).toBe(true)
  })
  it('keeps the baseline within a week and resets in the next', () => {
    const s = mem()
    const a = loadWeek(p(1, 1, 1), new Date('2026-10-26T09:00:00Z'), s)
    const b = loadWeek(p(9, 9, 9), new Date('2026-10-30T09:00:00Z'), s)
    expect(b.base).toEqual(a.base)
    expect(loadWeek(p(9, 9, 9), new Date('2026-11-02T09:00:00Z'), s).base).toEqual(p(9, 9, 9))
  })
  it('pins each postcard once', () => {
    const s = mem()
    pinPostcard('2026-W44', s)
    pinPostcard('2026-W44', s)
    expect(postcards(s)).toEqual(['2026-W44'])
    expect(postcardFor('2026-W44')).toBe(postcardFor('2026-W44'))
  })
})

describe("Cath's Week tiles (plan item 38)", () => {
  it('each goal names what a tap does, opening Runnel on the daily', () => {
    const goals = weekGoals(p(0, 0, 0), p(0, 0, 0))
    expect(goals.every((g) => g.cta.length > 0)).toBe(true)
    expect(goals.find((g) => g.id === 'runnel')!.href).toBe('/runnel/?mode=daily')
  })
  it('nudges with how many are left, and says nothing once done', () => {
    expect(toGo({ done: 2, need: 3 })).toBe('1 to go')
    expect(toGo({ done: 0, need: 1 })).toBe('1 to go')
    expect(toGo({ done: 0, need: 3 })).toBe('3 to go')
    expect(toGo({ done: 3, need: 3 })).toBeNull()
    expect(toGo({ done: 5, need: 3 })).toBeNull()
  })
})
