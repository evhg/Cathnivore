import { describe, expect, it } from 'vitest'
import { todayBoard } from '../site/src/cards'
import { dayOf } from '../games/hedgerow/src/dailyrule'

// Plan item 452: today's market board reads each game's own save defensively.
const store = (m: Record<string, unknown>) => ({ getItem: (k: string) => (k in m ? (typeof m[k] === 'string' ? (m[k] as string) : JSON.stringify(m[k])) : null) })
const now = new Date('2026-11-16T15:00:00Z')

describe('todayBoard (plan item 452)', () => {
  it('a first visit has nothing to remember', () => {
    const b = todayBoard(store({}), now)
    expect(b.any).toBe(false)
    expect(b.tags.map((t) => t.done)).toEqual([false, false, false, false])
    expect(b.streak).toBe(0)
  })
  it('corrupt and odd saves read as empty', () => {
    const b = todayBoard(store({ 'runnel:v1': '{not json', 'hedgerow:v1': [], 'cathnivore:daily': 'null', 'cathode.save': { jobsDone: 'x' } }), now)
    expect(b.any).toBe(false)
    expect(b.tags[3]!.label).toBe('0 of 5 names crossed off')
  })
  it('ticks today per game and counts a streak across games, with a pennant at three', () => {
    const hgToday = dayOf(Date.parse('2026-11-16T12:00:00Z'))
    const b = todayBoard(
      store({
        'runnel:v1': { results: { '2026-11-16': { taps: 31 }, '2026-11-14': { taps: 40 } } },
        'hedgerow:v1': { daily: { [String(hgToday - 1)]: 1200 } },
        'cathnivore:daily': { results: { '2026-11-13': { won: true } } },
      }),
      now,
    )
    expect(b.tags[0]).toMatchObject({ game: 'runnel', done: true, label: 'Solved in 31' })
    expect(b.tags[1]!.done).toBe(false)
    expect(b.week).toEqual([false, false, false, true, true, true, true])
    expect(b.streak).toBe(4)
    expect(b.pennant).toBe(true)
  })
  it('an open today keeps yesterday\'s streak', () => {
    const b = todayBoard(store({ 'runnel:v1': { results: { '2026-11-15': {}, '2026-11-14': {} } } }), now)
    expect(b.streak).toBe(2)
    expect(b.pennant).toBe(false)
    expect(b.any).toBe(true)
  })
})
