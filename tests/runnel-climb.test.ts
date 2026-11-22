import { describe, expect, it } from 'vitest'
import { CLIMB, climbDailyLine, climbDue, climbPuzzle } from '../games/runnel/src/climb'
import { computeFlow, rotateCell, tapsToSolve } from '../games/runnel/src/engine'
import { lessonPuzzle } from '../games/runnel/src/lesson'

// Plan item 653: after the four-tile lesson, three short fields that grow (about 7, 12 and 19 tiles), each solvable,
// then the daily; a player with a daily result skips the climb.
const playable = (i: number) => climbPuzzle(i).cells.filter((c) => c.kind !== 'stone').length

describe('the first-week climb', () => {
  it('three boards that grow from the lesson toward a daily', () => {
    expect(CLIMB).toHaveLength(3)
    const sizes = [0, 1, 2].map(playable)
    expect(sizes[0]).toBe(7)
    expect(sizes[1]).toBeGreaterThanOrEqual(10)
    expect(sizes[1]).toBeLessThanOrEqual(14)
    expect(sizes[2]).toBeGreaterThanOrEqual(17)
    expect(sizes[2]).toBeLessThanOrEqual(19)
    expect(sizes[0]).toBeGreaterThan(lessonPuzzle().cells.length)
    expect(sizes[0]! < sizes[1]! && sizes[1]! < sizes[2]!).toBe(true)
  })
  it('each board is the same every time, starts unsolved and solves by turning its tiles home', () => {
    for (let i = 0; i < CLIMB.length; i++) {
      expect(climbPuzzle(i)).toEqual(climbPuzzle(i))
      const p = climbPuzzle(i)
      expect(computeFlow(p.cells).solved, `board ${i} starts unsolved`).toBe(false)
      p.cells.forEach((c, k) => {
        for (let n = tapsToSolve(c); n > 0; n--) rotateCell(p.cells, k, true)
      })
      expect(computeFlow(p.cells).solved, `board ${i} solves`).toBe(true)
    }
  })
  it('each board has her one-line lesson', () => {
    for (const b of CLIMB) expect(b.ask.length).toBeGreaterThan(20)
  })
  it('runs for a new player only', () => {
    expect(climbDue({ results: {} })).toBe(true)
    expect(climbDue({ results: {}, climbDone: true })).toBe(false)
    expect(climbDue({ results: { '2026-11-20': { number: 55, timeMs: 1, taps: 3, par: 3 } } })).toBe(false)
  })
  it('hands over with how hard today is', () => {
    expect(climbDailyLine('Hardest')).toMatch(/hardest/)
    expect(climbDailyLine('Gentle')).toMatch(/a gentle one/)
    expect(climbDailyLine(null)).toMatch(/today's field/)
  })
})
