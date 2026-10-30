import { describe, expect, it } from 'vitest'
import { scrapbookPages } from '../shared/cath/scrapbook'

describe("Cath's scrapbook", () => {
  it('is empty for a first-time visitor', () => {
    expect(scrapbookPages({ hedgerowLevels: 0, runnelDays: 0, nightJobs: 0 }, { hedgerowStars: 0 })).toEqual([])
  })
  it('fills one page per game played, then the wardrobe', () => {
    const pages = scrapbookPages({ hedgerowLevels: 1, runnelDays: 6, nightJobs: 0 }, { hedgerowStars: 3 })
    expect(pages.map((p) => p.id)).toEqual(['hedgerow', 'runnel', 'wardrobe'])
    expect(pages[0]!.line).toBe('1 level held and 3 stars pinned to the page.')
    expect(pages[2]!.line).toBe('2 of 6 outfits found so far.')
  })
})
