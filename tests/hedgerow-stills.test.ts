import { existsSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LEVELS } from '../games/hedgerow/src/levels'

// Plan item 583: every level card has a 3D still of its level (scripts/hedgerow-stills.mjs bakes them).
describe('Hedgerow level stills', () => {
  it('has a still for every level', () => {
    const missing = LEVELS.filter((lv) => {
      const f = `games/hedgerow/public/stills/level-${lv.id}.webp`
      return !existsSync(f) || statSync(f).size < 4000
    }).map((lv) => lv.id)
    expect(missing).toEqual([])
  })
})
