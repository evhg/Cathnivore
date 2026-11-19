import { describe, expect, it } from 'vitest'
import { counterFor } from '../games/hedgerow/src/map'
import { LEVELS } from '../games/hedgerow/src/levels'
import { traitsOf } from '../games/hedgerow/src/intro'

// Plan item 521: the level card names, for each vehicle, a tower in the level's own kit that answers it.
describe('the level card counter line', () => {
  it('names a tower from the kit that reaches the vehicle, never a hedge or pond for what flies', () => {
    for (const lv of LEVELS) {
      for (const k of new Set(lv.waves.flat().map((g) => g.enemy))) {
        const c = counterFor(k, lv.towers)
        if (!c) continue
        expect(lv.towers, `level ${lv.id} ${k}`).toContain(c.tower)
        if (traitsOf(k).includes('flies')) expect(['hedgerow', 'pond'], `level ${lv.id} ${k}`).not.toContain(c.tower)
      }
    }
  })
  it('a fast ground vehicle gets a slowing tower, heavy plant the hardest hitter', () => {
    const lv = LEVELS.find((l) => l.id === 34)!
    expect(counterFor('pickup', lv.towers)?.verb).toBe('slows it')
    expect(counterFor('steel', lv.towers)?.verb).toBe('breaks it')
  })
})
