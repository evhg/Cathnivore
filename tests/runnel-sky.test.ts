import { describe, expect, it } from 'vitest'
import { skyFor } from '../games/runnel/src/sky'

describe('Runnel sky per board', () => {
  it('is the same for the same seed', () => {
    expect(skyFor('daily-2026-11-02')).toEqual(skyFor('daily-2026-11-02'))
  })

  it('gives every time of day and weather across a season of dailies, drizzle rarest', () => {
    const times = new Map<string, number>()
    const weathers = new Map<string, number>()
    for (let d = 0; d < 120; d++) {
      const date = new Date(Date.UTC(2026, 10, 2) + d * 86_400_000).toISOString().slice(0, 10)
      const s = skyFor(`daily-${date}`)
      times.set(s.time, (times.get(s.time) ?? 0) + 1)
      weathers.set(s.weather, (weathers.get(s.weather) ?? 0) + 1)
      expect(s.label.length).toBeGreaterThan(5)
    }
    expect(times.size).toBe(4)
    expect(weathers.size).toBe(4)
    expect(weathers.get('drizzle')!).toBeLessThan(weathers.get('clear')!)
  })
})
