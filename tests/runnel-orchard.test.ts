import { describe, expect, it } from 'vitest'
import { generatePuzzle } from '../games/runnel/src/engine'
import { ORCHARD_LEVELS, orchardOptions, orchardSeed, recordOrchard, totalDrops, unlockedLevel } from '../games/runnel/src/orchard'

describe('runnel orchard', () => {
  it('ramps board size and pieces', () => {
    expect(orchardOptions(1)).toMatchObject({ radius: 2, fixedCount: 0, reservoirCount: 0, bridgeCount: 0 })
    expect(orchardOptions(30).radius).toBe(4)
    expect(orchardOptions(30).bridgeCount).toBeGreaterThan(0)
  })
  it('every level generates the same board', () => {
    for (let n = 1; n <= ORCHARD_LEVELS; n++) {
      const a = generatePuzzle(orchardSeed(n), orchardOptions(n))
      const b = generatePuzzle(orchardSeed(n), orchardOptions(n))
      expect(a.cells.map((c) => c.rot)).toEqual(b.cells.map((c) => c.rot))
      expect(a.par).toBeGreaterThan(0)
    }
  })
  it('unlocks in order and keeps the best result', () => {
    const r = {}
    expect(unlockedLevel(r)).toBe(1)
    recordOrchard(r, 1, 30, 10, 1000)
    expect(unlockedLevel(r)).toBe(2)
    expect(recordOrchard(r, 1, 10, 10, 900).drops).toBe(3)
    expect(recordOrchard(r, 1, 30, 10, 900).drops).toBe(3)
    expect(totalDrops(r)).toBe(3)
  })
})
