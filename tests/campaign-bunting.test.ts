import { describe, expect, it } from 'vitest'
import { CHAPTERS } from '../src/content/chapters'
import { buntingFlags, chaptersWon } from '../src/ui/campaignBunting'

// Plan item 556: the desktop campaign's bunting matches the campaign's progress, one flag a chapter.
describe('campaign progress bunting', () => {
  it('has one plain flag per chapter before any win', () => {
    const flags = buntingFlags(CHAPTERS, [])
    expect(flags).toHaveLength(CHAPTERS.length)
    expect(flags.every((f) => !f.won && f.dye === undefined)).toBe(true)
    expect(flags.map((f) => f.n)).toEqual(CHAPTERS.map((_, i) => i + 1))
    expect(chaptersWon(CHAPTERS, [])).toBe(0)
  })

  it('dyes exactly the won chapters, in any order of winning', () => {
    const won = [CHAPTERS[0]!.id, CHAPTERS[2]!.id, 'not-a-chapter']
    const flags = buntingFlags(CHAPTERS, won)
    expect(flags.filter((f) => f.won).map((f) => f.id)).toEqual([CHAPTERS[0]!.id, CHAPTERS[2]!.id])
    expect(flags.filter((f) => f.won).every((f) => f.dye)).toBe(true)
    expect(chaptersWon(CHAPTERS, won)).toBe(2)
    expect(flags[0]!.label).toContain(CHAPTERS[0]!.title)
    expect(flags[0]!.label).toMatch(/: won$/)
    expect(flags[1]!.label).toMatch(/not yet won$/)
  })

  it('fills every flag when the campaign is won', () => {
    const all = CHAPTERS.map((c) => c.id)
    expect(buntingFlags(CHAPTERS, all).every((f) => f.won)).toBe(true)
    expect(chaptersWon(CHAPTERS, all)).toBe(CHAPTERS.length)
  })
})
