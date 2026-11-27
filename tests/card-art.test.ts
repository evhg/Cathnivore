import { describe, expect, it } from 'vitest'
import { CAMPAIGN_IMPROVEMENTS, IMPROVEMENTS as BASE } from '../src/content/improvements'
import { CARD_ART } from '../src/ui/cardArt'

// Plan item 722: every Improvement card has its own painted picture, not its tag's stock scene.
const IMPROVEMENTS = [...BASE, ...CAMPAIGN_IMPROVEMENTS]

describe('card art', () => {
  it('every Improvement has a painted scene', () => {
    const missing = IMPROVEMENTS.filter((c) => !CARD_ART[c.id]).map((c) => c.id)
    expect(missing).toEqual([])
  })
  it('names no card that does not exist', () => {
    const ids = new Set(IMPROVEMENTS.map((c) => c.id))
    expect(Object.keys(CARD_ART).filter((id) => !ids.has(id))).toEqual([])
  })
})
