import { describe, expect, it } from 'vitest'
import { CHAPTERS } from '../src/content/chapters'
import { CHAPTER_HOMES, MAP_AXIAL, currentChapterIndex, liberatedRegions } from '../src/content/campaignMap'

// Plan item 35: every chapter is a place on the map, and between them they free all of Marrow.
describe('the campaign map', () => {
  const ids = CHAPTERS.map((c) => c.id)

  it('gives every chapter home regions it actually plays on', () => {
    for (const c of CHAPTERS) {
      const homes = CHAPTER_HOMES[c.id]
      expect(homes, c.id).toBeDefined()
      for (const r of homes!) expect(c.activeRegions, `${c.id} plays ${r}`).toContain(r)
    }
  })

  it('frees each of the seven regions exactly once over the campaign', () => {
    const all = Object.values(CHAPTER_HOMES).flat()
    expect(new Set(all).size).toBe(all.length)
    expect(new Set(all)).toEqual(new Set(Object.keys(MAP_AXIAL)))
    expect(liberatedRegions(ids).size).toBe(7)
    expect(liberatedRegions([]).size).toBe(0)
    expect([...liberatedRegions(['fresh-meat'])].sort()).toEqual(['brindleHills', 'highmoor'])
  })

  it('puts Cath at the first chapter not yet won, or the last once all are', () => {
    expect(currentChapterIndex(ids, [])).toBe(0)
    expect(currentChapterIndex(ids, ['fresh-meat'])).toBe(1)
    expect(currentChapterIndex(ids, ['word-of-mouth'])).toBe(0)
    expect(currentChapterIndex(ids, ids)).toBe(ids.length - 1)
  })
})
