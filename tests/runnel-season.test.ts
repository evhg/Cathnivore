import { describe, expect, it } from 'vitest'
import { postcard, seasonOf, weatherMarkup } from '../games/runnel/src/season'

describe('runnel seasons', () => {
  it('maps months to seasons', () => {
    expect(seasonOf('2026-03-01')).toBe('spring')
    expect(seasonOf('2026-07-15')).toBe('summer')
    expect(seasonOf('2026-10-29')).toBe('autumn')
    expect(seasonOf('2026-12-31')).toBe('winter')
    expect(seasonOf('2026-02-28')).toBe('winter')
  })
  it('has a postcard and weather per season', () => {
    for (const s of ['spring', 'summer', 'autumn', 'winter'] as const) expect(postcard(s)).toMatch(/Bea/)
    expect(weatherMarkup('winter')).toContain('circle')
    expect(weatherMarkup('summer')).toBe('')
  })
})
