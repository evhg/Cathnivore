import { describe, expect, it } from 'vitest'
import { briefDifficulty, briefExpression } from '../games/hedgerow/src/brief'
import { LEVELS } from '../games/hedgerow/src/levels'

// Plan item 624: Cath's face on the level card follows the level's difficulty.
describe('Hedgerow briefing expression', () => {
  it('reads delighted on a first stop, smirks on a plain lane, determined for one complication, worried for a boss', () => {
    expect(briefExpression({ id: 1 })).toBe('delighted')
    expect(briefExpression({ id: 7 })).toBe('smirk')
    expect(briefExpression({ id: 7, twists: ['fog'] as never })).toBe('determined')
    expect(briefExpression({ id: 7, path2: [[0, 0]] })).toBe('determined')
    expect(briefExpression({ id: 7, twists: ['fog'] as never, path2: [[0, 0]] })).toBe('worried')
    expect(briefExpression({ id: 20 })).toBe('worried')
  })
  it('never eases off at a boss, across the campaign', () => {
    for (const lv of LEVELS) if (lv.id % 10 === 0) expect(briefDifficulty(lv)).toBe(3)
    expect(new Set(LEVELS.map((l) => briefExpression(l))).size).toBeGreaterThanOrEqual(3)
  })
})
