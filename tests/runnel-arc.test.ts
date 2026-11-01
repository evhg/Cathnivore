import { describe, expect, it } from 'vitest'
import {
  ARC_FROM,
  arcLabel,
  bridgesFor,
  dailyPuzzle,
  DAILY_RADIUS,
  generatePuzzle,
  reservoirsFor,
  sluicesFor,
} from '../games/runnel/src/engine'

const day = (offset: number) => new Date(Date.parse(`${ARC_FROM}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10)

describe('Runnel weekday difficulty arc', () => {
  it('leaves dailies before the arc unchanged (they are in players saves)', () => {
    for (const d of ['2026-10-01', '2026-10-25', '2026-11-01']) {
      const old = generatePuzzle(`daily-${d}`, {
        radius: DAILY_RADIUS,
        fixedCount: sluicesFor(d),
        reservoirCount: reservoirsFor(d),
        bridgeCount: bridgesFor(d),
      })
      expect(dailyPuzzle(d)).toEqual(old)
      expect(arcLabel(d)).toBeNull()
    }
  })

  it('starts the week small and ends it on the full board', () => {
    expect(new Date(`${ARC_FROM}T00:00:00Z`).getUTCDay()).toBe(1)
    expect(dailyPuzzle(day(0)).radius).toBe(2)
    expect(dailyPuzzle(day(6)).radius).toBe(3)
    expect(arcLabel(day(0))).toBe('Gentle')
    expect(arcLabel(day(6))).toBe('Hardest')
  })

  it('raises the median par from Monday to Sunday', () => {
    const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!
    const byDay = Array.from({ length: 7 }, (_, k) => median(Array.from({ length: 12 }, (_, w) => dailyPuzzle(day(w * 7 + k)).par)))
    expect(byDay[0]!).toBeLessThan(byDay[3]!)
    expect(byDay[3]!).toBeLessThan(byDay[6]!)
    expect(byDay[0]!).toBeLessThanOrEqual(45)
  })
})
