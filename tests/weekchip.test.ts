import { describe, expect, it } from 'vitest'
import { weekChipText } from '../shared/cath/weekchip'
import type { WeekGoal } from '../shared/cath/week'

const g = (game: string, need: number, done: number): WeekGoal => ({ id: 'runnel', game, text: 'Do it', need, done, href: '/' })

describe('weekChipText', () => {
  it('names the next open goal', () => {
    expect(weekChipText([g('A', 1, 1), g('B', 3, 1)])).toBe("Cath's Week 1/2 · B: do it")
  })
  it('says complete when all done', () => {
    expect(weekChipText([g('A', 1, 1), g('B', 3, 5)])).toContain('complete')
  })
})
