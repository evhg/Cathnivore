import { describe, expect, it } from 'vitest'
import { computeFlow, tapsToSolve } from '../games/runnel/src/engine'
import { LESSON_STEPS, lessonPuzzle, lessonTap } from '../games/runnel/src/lesson'

describe('Runnel lesson (plan item 22)', () => {
  it('starts unsolved, with every asked-for tile one tap away and nothing else to turn', () => {
    const p = lessonPuzzle()
    expect(computeFlow(p.cells).solved).toBe(false)
    for (const s of LESSON_STEPS) expect(tapsToSolve(p.cells[s.target]!)).toBe(1)
    const others = p.cells.filter((_, i) => !LESSON_STEPS.some((s) => s.target === i))
    for (const c of others) expect(c.fixed || tapsToSolve(c) === 0).toBe(true)
  })

  it('is solved by exactly the three asked-for taps, each one moving the water on', () => {
    const p = lessonPuzzle()
    let step = 0
    let wet = computeFlow(p.cells).wet.size
    LESSON_STEPS.forEach((s, i) => {
      const r = lessonTap(p.cells, step, s.target)
      expect(r.accepted).toBe(true)
      expect(r.step).toBe(i + 1)
      const now = computeFlow(p.cells).wet.size
      expect(now).toBeGreaterThan(wet)
      wet = now
      step = r.step
      expect(r.solved).toBe(i === LESSON_STEPS.length - 1)
    })
  })

  it('ignores taps on any other tile', () => {
    const p = lessonPuzzle()
    const before = p.cells.map((c) => c.rot)
    for (const i of [0, 2, 3, 9]) expect(lessonTap(p.cells, 0, i).accepted).toBe(false)
    expect(p.cells.map((c) => c.rot)).toEqual(before)
  })

  it('keeps every line to three short sentences at most', () => {
    for (const s of LESSON_STEPS) expect(s.ask.split(/[.!?](\s|$)/).filter((x) => x.trim().length > 1).length).toBeLessThanOrEqual(3)
  })
})
