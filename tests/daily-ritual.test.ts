import { describe, expect, it } from 'vitest'
import { countdownText, dailyRitual, MAX_PENNANTS } from '../src/content/dailyRitual'
import type { DailyRecord, DailyResult } from '../src/content/daily'

const now = new Date('2026-11-05T18:30:00Z')
const day = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString().slice(0, 10)
const won: DailyResult = { won: true, rounds: 9, regions: 5, trust: 7 }
const lost: DailyResult = { won: false, rounds: 12, regions: 3, trust: 2 }
const rec = (entries: Array<[number, DailyResult]>): DailyRecord => ({ results: Object.fromEntries(entries.map(([n, r]) => [day(n), r])) })

describe('the Daily Market ritual (plan item 133)', () => {
  it('a player who never played has no receipt, no pennants and no streak line', () => {
    const r = dailyRitual(now, { results: {} })
    expect(r.last).toBeNull()
    expect(r.pennants).toBe(0)
    expect(r.status).toBe('none')
    expect(r.line).toBeNull()
  })
  it('a 3-day streak shows 3 pennants and yesterday on the receipt', () => {
    const r = dailyRitual(now, rec([[1, won], [2, won], [3, won]]))
    expect(r.pennants).toBe(3)
    expect(r.status).toBe('kept')
    expect(r.last?.date).toBe(day(1))
    expect(r.last?.today).toBe(false)
    expect(r.expression).toBe('delighted')
    expect(r.line).toMatch(/3 days running/)
  })
  it("today's result goes on the receipt once played", () => {
    const r = dailyRitual(now, rec([[0, won], [1, won]]))
    expect(r.last?.today).toBe(true)
    expect(r.streak).toBe(2)
  })
  it('the first Daily ever has its own line', () => {
    const r = dailyRitual(now, rec([[1, won]]))
    expect(r.status).toBe('first')
    expect(r.line).toMatch(/first Daily/)
  })
  it('a lost or missed day breaks the streak and worries her', () => {
    const lostDay = dailyRitual(now, rec([[1, lost], [2, won]]))
    expect(lostDay.status).toBe('broken')
    expect(lostDay.expression).toBe('worried')
    const missed = dailyRitual(now, rec([[3, won], [4, won]]))
    expect(missed.status).toBe('broken')
    expect(missed.line).toMatch(/missed/)
  })
  it('a long streak caps the bunting and counts the rest', () => {
    const r = dailyRitual(now, rec(Array.from({ length: 14 }, (_, i) => [i + 1, won] as [number, DailyResult])))
    expect(r.pennants).toBe(MAX_PENNANTS)
    expect(r.more).toBe(4)
  })
  it('counts down to the next Daily at 00:00 UTC', () => {
    const r = dailyRitual(now, { results: {} })
    expect(r.nextInMs).toBe(5.5 * 3_600_000)
    expect(countdownText(r.nextInMs)).toBe('5h 30m')
    expect(countdownText(59_000)).toBe('1m')
  })
})
