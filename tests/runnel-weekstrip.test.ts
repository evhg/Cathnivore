import { describe, expect, it } from 'vitest'
import { dailyPuzzle } from '../games/runnel/src/engine'
import { cropFor } from '../games/runnel/src/garden'
import { miniBoardSvg, weekBeds, weekDays, weekStrip } from '../games/runnel/src/weekstrip'

// Plan item 50: the rail's week of small boards and Bea's week of beds.
const res = (n: number) => ({ number: n, timeMs: 60000, taps: 40, par: 41 })

describe('Runnel week strip', () => {
  it('runs Monday to Sunday around today, with what the player did each day', () => {
    const w = weekDays('2026-11-05', { '2026-11-02': res(37), '2026-11-05': res(40) })
    expect(w.map((d) => d.short)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    expect(w.map((d) => d.state)).toEqual(['solved', 'missed', 'missed', 'solved', 'ahead', 'ahead', 'ahead'])
    expect(w[0]!.day).toBe('2026-11-02')
    expect(weekDays('2026-11-08', {})[6]).toMatchObject({ day: '2026-11-08', state: 'today' })
    expect(weekDays('2026-11-02', {})[0]).toMatchObject({ day: '2026-11-02', state: 'today', arc: 'Gentle' })
  })
  it("draws each past day's board in little, and a blank hex for days ahead", () => {
    const s = weekStrip('2026-11-04', { '2026-11-02': res(37) })
    expect(s[0]!.svg).toContain('data-state="solved"')
    expect(s[3]!.svg).toContain('data-state="ahead"')
    const p = dailyPuzzle('2026-11-02')
    expect((miniBoardSvg(p, 'solved').match(/wk-tile/g) ?? []).length).toBe(p.cells.length)
  })
  it("plants a solved day's crop in its bed, and leaves the rest as mounds", () => {
    const b = weekBeds('2026-11-04', { '2026-11-02': res(37) })
    expect(b).toHaveLength(7)
    expect(b[0]!.plot?.stage).toBe('ripe')
    expect(b.slice(1).every((x) => x.plot === null)).toBe(true)
    expect(b[2]!.state).toBe('today')
  })
  it('plants exactly one crop per solved daily of the week, each its own plant (plan item 623)', () => {
    const r = { '2026-11-16': res(1), '2026-11-18': res(3), '2026-11-20': res(5), '2026-11-21': res(6), '2026-11-14': res(0) }
    const b = weekBeds('2026-11-21', r)
    expect(b.filter((x) => x.plot).map((x) => x.day)).toEqual(['2026-11-16', '2026-11-18', '2026-11-20', '2026-11-21'])
    expect(b.map((x) => x.plot?.stage ?? null)).toEqual(['ripe', null, 'ripe', null, 'growing', 'growing', null])
    expect(b.every((x) => !x.plot || x.plot.crop === cropFor(x.day))).toBe(true)
    // A new solve adds one plant and changes no other bed.
    const after = weekBeds('2026-11-21', { ...r, '2026-11-19': res(4) })
    expect(after.filter((x) => x.plot)).toHaveLength(5)
    expect(after[3]!.plot?.crop).toBe(cropFor('2026-11-19'))
  })
})
