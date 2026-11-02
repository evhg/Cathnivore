import { describe, expect, it } from 'vitest'
import { DAILY_KEY, dailyMarket, dailyRecord, dailyShareText, dailyStreak, recordDaily, type DailyRecord } from '../src/content/daily'
import { createGame } from '../src/engine/state'

// Plan item 15: the Daily Market. The date alone decides the whole setup; results and the streak are per day.

function memStore(): Pick<Storage, 'getItem' | 'setItem'> & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) }
}

describe('dailyMarket', () => {
  it('gives the same setup for the same date, whatever the time of day', () => {
    const a = dailyMarket(new Date('2026-11-05T00:00:01Z'))
    const b = dailyMarket(new Date('2026-11-05T23:59:59Z'))
    expect(b).toEqual(a)
    // And the same opening position.
    expect(createGame(b.config, b.seed)).toEqual(createGame(a.config, a.seed))
  })

  it('numbers days from 2 November 2026 and turns the map over day by day', () => {
    expect(dailyMarket(new Date('2026-11-02T12:00:00Z')).number).toBe(1)
    expect(dailyMarket(new Date('2026-11-03T12:00:00Z')).number).toBe(2)
    const week = Array.from({ length: 7 }, (_, i) => dailyMarket(new Date(Date.UTC(2026, 10, 2 + i, 9))))
    expect(new Set(week.map((d) => d.layout))).toEqual(new Set(['ring', 'coast', 'delta']))
    // Seeds differ from day to day.
    expect(new Set(week.map((d) => d.seed)).size).toBe(7)
  })

  it('fixes a producer pair and an event, and deals the ring fresh types', () => {
    const days = Array.from({ length: 30 }, (_, i) => dailyMarket(new Date(Date.UTC(2026, 10, 2 + i, 9))))
    for (const d of days) {
      expect(d.producers[0]).not.toBe(d.producers[1])
      expect(d.config.producers).toEqual(d.producers)
      expect(d.config.marketEvent).toBe(d.marketEvent)
      expect(d.config.daily).toBe(d.date)
      expect(d.config.regionTypes?.kingsmarket).toBe('capital')
    }
    expect(new Set(days.map((d) => d.producers.join('+'))).size).toBeGreaterThan(3)
    expect(new Set(days.map((d) => d.marketEvent)).size).toBe(3)
    // A daily ring is not always the printed board.
    const rings = days.filter((d) => d.layout === 'ring').map((d) => JSON.stringify(d.config.regionTypes))
    expect(new Set(rings).size).toBeGreaterThan(1)
  })
})

describe('daily results and streak', () => {
  it('records the first finish of a day only', () => {
    const s = memStore()
    expect(recordDaily('2026-11-02', { won: true, rounds: 8, regions: 5, trust: 4 }, s)).toBe(true)
    expect(recordDaily('2026-11-02', { won: false, rounds: 10, regions: 2, trust: 0 }, s)).toBe(false)
    expect(dailyRecord(s).results['2026-11-02']?.won).toBe(true)
  })

  it('counts wins in a row ending today or yesterday, broken by a loss or a gap', () => {
    const w = { won: true, rounds: 8, regions: 5, trust: 3 }
    const rec: DailyRecord = { results: { '2026-11-02': w, '2026-11-03': w, '2026-11-04': w } }
    expect(dailyStreak('2026-11-04', rec)).toBe(3)
    expect(dailyStreak('2026-11-05', rec)).toBe(3) // today not played yet
    expect(dailyStreak('2026-11-06', rec)).toBe(0) // a day missed
    rec.results['2026-11-05'] = { ...w, won: false }
    expect(dailyStreak('2026-11-05', rec)).toBe(0)
  })

  it('reads junk storage as no record', () => {
    const s = memStore()
    s.data.set(DAILY_KEY, '{"results":{"nope":1,"2026-11-02":{"won":"yes"}}}')
    expect(dailyRecord(s).results).toEqual({})
    s.data.set(DAILY_KEY, 'not json')
    expect(dailyRecord(s).results).toEqual({})
  })

  it('writes a share text with the day, the squares and the streak', () => {
    const t = dailyShareText({ number: 4, layout: 'delta' }, { won: true, rounds: 7, regions: 5, trust: 6 }, 3, 'The Delta')
    expect(t).toContain('Daily Market #4')
    expect(t).toContain('The Delta')
    expect(t).toContain('🟩🟩🟩🟩🟩')
    expect(t).toContain('liberated in 7 rounds')
    expect(t).toContain('streak 3')
    const l = dailyShareText({ number: 4, layout: 'ring' }, { won: false, rounds: 10, regions: 2, trust: 0 }, 0, 'The Ring')
    expect(l).toContain('🟩🟩⬜⬜⬜')
    expect(l).not.toContain('streak')
  })
})
