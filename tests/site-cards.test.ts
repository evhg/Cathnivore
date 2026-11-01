import { describe, expect, it } from 'vitest'
import { cardLines, runnelStreak } from '../site/src/cards'
import { dailyRule, dayOf } from '../games/hedgerow/src/daily'

const store = (o: Record<string, unknown>) => ({ getItem: (k: string) => (k in o ? (typeof o[k] === 'string' ? (o[k] as string) : JSON.stringify(o[k])) : null) })
const now = new Date('2026-11-01T12:00:00Z')

describe('games page card lines (plan item 13)', () => {
  it('a first visit gets status lines and no continue chips', () => {
    const l = cardLines(store({}), now, 42)
    expect(l.runnel.status).toBe("Today's Runnel: 42 taps par")
    expect(l.hedgerow.status).toBe(`Today's daily: ${dailyRule(dayOf(now.getTime())).name}`)
    expect(l.cathnivore.status).toBe('6 story chapters · Solo or co-op')
    expect(l.nightshift.status).toBe('Five names on The List')
    for (const g of Object.values(l)) expect(g.resume).toBe('')
  })

  it('reads each save for a continue chip', () => {
    const l = cardLines(
      store({
        'cathnivore:save:v1': { version: 1, actions: [{}], chapterId: 'ch2' },
        'cathnivore:campaign:v1': { completed: ['ch1'] },
        'runnel:v1': { results: { '2026-11-01': { taps: 30 }, '2026-10-31': { taps: 9 } } },
        'hedgerow:v1': { stars: { 1: 3, 2: 2, 7: 1 }, daily: { [String(dayOf(now.getTime()))]: 84 } },
        'cathode.save': { jobsDone: ['a'], checkpoint: { jobId: 'b' } },
      }),
      now,
    )
    expect(l.cathnivore).toEqual({ status: 'Story: chapter 2 of 6 next', resume: 'Continue your chapter' })
    expect(l.runnel.resume).toBe('Solved today in 30 taps · 2-day streak')
    expect(l.runnel.status).toBe("Today's Runnel is ready")
    expect(l.hedgerow.resume).toBe('Continue · level 8 · 6 stars')
    expect(l.hedgerow.status).toMatch(/· your best 84$/)
    expect(l.nightshift).toEqual({ status: '1 job done · Five names on The List', resume: 'Continue the job' })
  })

  it('survives malformed saves', () => {
    const l = cardLines(store({ 'runnel:v1': '{nope', 'hedgerow:v1': { stars: 'x' }, 'cathode.save': [1] }), now)
    for (const g of Object.values(l)) expect(g.resume).toBe('')
  })

  it('counts a streak that ends yesterday', () => {
    expect(runnelStreak({ '2026-10-31': 1, '2026-10-30': 1, '2026-10-28': 1 }, '2026-11-01')).toBe(2)
    expect(runnelStreak({ '2026-10-29': 1 }, '2026-11-01')).toBe(0)
  })
})
