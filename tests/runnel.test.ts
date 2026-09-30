import { describe, expect, it } from 'vitest'
import {
  bitCount,
  computeFlow,
  currentMask,
  dailyNumber,
  dropsFor,
  dailyPuzzle,
  generatePuzzle,
  rotateCell,
  rotateMask,
  rotationalPeriod,
  sluicesFor,
  reservoirsFor,
  tapsToSolve,
  type Puzzle,
} from '../games/runnel/src/engine'

function solve(puzzle: Puzzle): void {
  for (const c of puzzle.cells) c.rot = (c.rot + tapsToSolve(c)) % 6
}

describe('Runnel masks', () => {
  it('rotates clockwise and wraps', () => {
    expect(rotateMask(0b000001, 1)).toBe(0b000010)
    expect(rotateMask(0b100000, 1)).toBe(0b000001)
    expect(rotateMask(0b000011, 6)).toBe(0b000011)
    expect(rotateMask(0b000011, -1)).toBe(0b100001)
  })

  it('finds rotational periods', () => {
    expect(rotationalPeriod(0b001001)).toBe(3) // straight
    expect(rotationalPeriod(0b010101)).toBe(2) // three-way star
    expect(rotationalPeriod(0b000001)).toBe(6) // dead end
  })
})

describe('Runnel generation', () => {
  const seeds = Array.from({ length: 200 }, (_, i) => `test-${i}`)

  it('is deterministic for a seed', () => {
    const a = generatePuzzle('same', { radius: 3 })
    const b = generatePuzzle('same', { radius: 3 })
    expect(a).toEqual(b)
    expect(generatePuzzle('other', { radius: 3 })).not.toEqual(a)
  })

  it.each([2, 3, 4])('always builds a solvable, unsolved radius-%i puzzle', (radius) => {
    for (const seed of seeds) {
      const p = generatePuzzle(seed, { radius })
      const playable = p.cells.filter((c) => c.kind !== 'stone')
      expect(p.cells.filter((c) => c.kind === 'spring')).toHaveLength(1)
      // A spanning tree: openings pair up into exactly (cells - 1) channels.
      const openings = playable.reduce((n, c) => n + bitCount(c.solved), 0)
      expect(openings).toBe(2 * (playable.length - 1))
      expect(computeFlow(p.cells).solved).toBe(false)
      solve(p)
      expect(computeFlow(p.cells).solved).toBe(true)
    }
  })

  it('marks dead ends as fields and keeps junctions to 3 openings or fewer', () => {
    for (const seed of seeds) {
      const p = generatePuzzle(seed, { radius: 3 })
      for (const c of p.cells) {
        if (c.kind === 'field') expect(bitCount(c.solved)).toBe(1)
        if (c.kind === 'channel') {
          expect(bitCount(c.solved)).toBeGreaterThanOrEqual(2)
          expect(bitCount(c.solved)).toBeLessThanOrEqual(3)
        }
        if (c.kind === 'spring') expect(bitCount(c.solved)).toBeLessThanOrEqual(3)
      }
    }
  })

  it('reports par as the taps back to the solution', () => {
    const p = generatePuzzle('par', { radius: 3 })
    let taps = 0
    for (let i = 0; i < p.cells.length; i++) {
      const n = tapsToSolve(p.cells[i]!)
      for (let t = 0; t < n; t++) rotateCell(p.cells, i)
      taps += n
    }
    expect(taps).toBe(p.par)
    expect(computeFlow(p.cells).solved).toBe(true)
  })
})

describe('Runnel play', () => {
  it('does not turn stones or locked cells', () => {
    const p = generatePuzzle('locks', { radius: 3 })
    const channel = p.cells.findIndex((c) => c.kind === 'channel')
    p.cells[channel]!.locked = true
    expect(rotateCell(p.cells, channel)).toBe(false)
    const stone = p.cells.findIndex((c) => c.kind === 'stone')
    if (stone >= 0) expect(rotateCell(p.cells, stone)).toBe(false)
  })

  it('six turns bring a piece back', () => {
    const p = generatePuzzle('six', { radius: 2 })
    const i = p.cells.findIndex((c) => c.kind === 'channel')
    const before = currentMask(p.cells[i]!)
    for (let t = 0; t < 6; t++) rotateCell(p.cells, i)
    expect(currentMask(p.cells[i]!)).toBe(before)
    rotateCell(p.cells, i, true)
    rotateCell(p.cells, i, false)
    expect(currentMask(p.cells[i]!)).toBe(before)
  })

  it('reports leaks on wet cells that open onto nothing', () => {
    const p = generatePuzzle('leak', { radius: 2 })
    solve(p)
    const field = p.cells.findIndex((c) => c.kind === 'field' && rotationalPeriod(c.solved) > 1)
    rotateCell(p.cells, field)
    const flow = computeFlow(p.cells)
    expect(flow.solved).toBe(false)
    expect(flow.leaks.size).toBeGreaterThan(0)
  })
})

describe('Runnel daily', () => {
  it('numbers days from the epoch', () => {
    expect(dailyNumber('2026-09-27')).toBe(1)
    expect(dailyNumber('2026-10-27')).toBe(31)
  })

  it('gives everyone the same puzzle on a day', () => {
    expect(dailyPuzzle('2026-10-01')).toEqual(dailyPuzzle('2026-10-01'))
    expect(dailyPuzzle('2026-10-01')).not.toEqual(dailyPuzzle('2026-10-02'))
  })
})

describe('Runnel drops', () => {
  it('gives slack around par that scales with puzzle size', () => {
    expect(dropsFor(10, 10)).toBe(3)
    expect(dropsFor(12, 10)).toBe(3)
    expect(dropsFor(13, 10)).toBe(2)
    expect(dropsFor(14, 10)).toBe(2)
    expect(dropsFor(15, 10)).toBe(2)
    expect(dropsFor(40, 10)).toBe(1)
    expect(dropsFor(44, 40)).toBe(3)
    expect(dropsFor(45, 40)).toBe(2)
    expect(dropsFor(3, 10)).toBe(3)
  })
})

describe('sluices (fixed tiles)', () => {
  it('generates fixed, pre-solved, unturnable pieces that stay out of par', () => {
    const p = generatePuzzle('sluice', { radius: 3, fixedCount: 3 })
    const fixed = p.cells.filter((c) => c.fixed)
    expect(fixed).toHaveLength(3)
    for (const c of fixed) {
      expect(c.rot).toBe(0)
      expect(c.locked).toBe(true)
      expect(rotateCell(p.cells, p.cells.indexOf(c))).toBe(false)
    }
    expect(computeFlow(p.cells).solved).toBe(false)
  })

  it('stays solvable: turning every piece to its solved rotation wins', () => {
    for (const seed of ['a', 'b', 'c', 'd']) {
      const p = generatePuzzle(seed, { radius: 3, fixedCount: 4 })
      solve(p)
      expect(computeFlow(p.cells).solved).toBe(true)
    }
  })

  it('introduces sluices by weekday and never before the start date', () => {
    expect(sluicesFor('2026-09-30')).toBe(0)
    expect(sluicesFor('2026-10-01')).toBe(0) // Thursday
    expect(sluicesFor('2026-10-02')).toBe(3) // Friday
    expect(sluicesFor('2026-10-03')).toBe(4) // Saturday
    expect(sluicesFor('2026-10-07')).toBe(2) // Wednesday
  })
})

describe('reservoirs', () => {
  it('are fixed dead-end ponds that take water from any side without spilling', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const p = generatePuzzle(seed, { radius: 3, fixedCount: 2, reservoirCount: 2 })
      expect(p.cells.filter((c) => c.reservoir)).toHaveLength(2)
      for (const c of p.cells.filter((c) => c.reservoir)) {
        expect(c.fixed).toBe(true)
        expect(rotateCell(p.cells, p.cells.indexOf(c))).toBe(false)
      }
      solve(p)
      expect(computeFlow(p.cells).solved).toBe(true)
    }
  })

  it('appear only from the start date, by weekday', () => {
    expect(reservoirsFor('2026-10-01')).toBe(0)
    expect(reservoirsFor('2026-10-06')).toBe(1) // Tuesday
    expect(reservoirsFor('2026-10-04')).toBe(2) // Sunday
    expect(reservoirsFor('2026-10-05')).toBe(0)
  })
})
