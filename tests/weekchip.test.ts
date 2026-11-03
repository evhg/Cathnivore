import { describe, expect, it } from 'vitest'
import { weekChipText } from '../shared/cath/weekchip'
import type { WeekGoal } from '../shared/cath/week'

const g = (game: string, need: number, done: number): WeekGoal => ({ id: 'runnel', game, text: 'Do it', need, done, href: '/', cta: 'Play' })

describe('weekChipText', () => {
  it('names the next open goal', () => {
    expect(weekChipText([g('A', 1, 1), g('B', 3, 1)])).toBe("Cath's Week 1/2 · B: do it")
  })
  it("inside a game names only that game's goal, or the count once it is met (plan item 47)", () => {
    const goals = [g('Runnel', 3, 1), g('Hedgerow', 3, 2)]
    expect(weekChipText(goals, 'Hedgerow')).toBe("Cath's Week 0/2 · Do it (2/3)")
    expect(weekChipText([g('Runnel', 3, 1), g('Hedgerow', 3, 3)], 'Hedgerow')).toBe("Cath's Week 1/2 · Hedgerow done ✓")
    expect(weekChipText(goals, 'Cathnivore')).toBe("Cath's Week 0/2")
  })
  it('says complete when all done', () => {
    expect(weekChipText([g('A', 1, 1), g('B', 3, 5)])).toContain('complete')
  })
})
