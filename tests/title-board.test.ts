import { describe, expect, it } from 'vitest'
import { titleBoardState } from '../src/ui/titleBoard'

// Plan item 60: the title's table shows the player's campaign.
describe('titleBoardState', () => {
  it('a fresh save: Hollowell holds every region', () => {
    const s = titleBoardState([])
    for (const r of Object.values(s.regions).filter((r) => s.config.activeRegions.includes(r.id))) {
      expect(r.liberated).toBe(false)
      expect(r.outlets).toBeGreaterThan(0)
    }
  })
  it('two chapters won free their home regions', () => {
    const s = titleBoardState(['fresh-meat'])
    const freed = s.config.activeRegions.filter((id) => s.regions[id].liberated).sort()
    expect(freed).toEqual(['brindleHills', 'highmoor'])
    expect(s.regions.brindleHills.outlets).toBe(0)
    expect(s.regions.kingsmarket.outlets).toBeGreaterThan(0)
  })
  it('a finished campaign frees all of Marrow', () => {
    const s = titleBoardState(['fresh-meat', 'word-of-mouth', 'growing-season', 'the-plan', 'friends-in-low-places', 'kingsmarket'])
    expect(s.config.activeRegions.every((id) => s.regions[id].liberated)).toBe(true)
  })
  it('is the same for the same save', () => {
    expect(titleBoardState(['fresh-meat'])).toEqual(titleBoardState(['fresh-meat']))
  })
})
