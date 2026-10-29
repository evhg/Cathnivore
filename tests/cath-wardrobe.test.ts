import { describe, expect, it } from 'vitest'
import { chosenOutfit, readProgress, unlockedOutfits } from '../shared/cath/wardrobe'

const store = (o: Record<string, string>) => ({ getItem: (k: string) => o[k] ?? null })

describe('shared Cath wardrobe', () => {
  it('starts with the blazer only', () => {
    expect(unlockedOutfits(readProgress(store({})))).toEqual(['field'])
  })
  it('reads each game save', () => {
    const p = readProgress(
      store({
        'hedgerow:v1': JSON.stringify({ stars: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), 3])) }),
        'runnel:v1': JSON.stringify({ results: { a: {}, b: {}, c: {}, d: {}, e: {} } }),
        'cathode.save': JSON.stringify({ jobsDone: ['x'] }),
      }),
    )
    expect(p).toEqual({ hedgerowLevels: 12, runnelDays: 5, nightJobs: 1 })
    expect(unlockedOutfits(p)).toEqual(['field', 'wax', 'pinny', 'market'])
  })
  it('survives garbage and ignores a locked choice', () => {
    expect(readProgress(store({ 'hedgerow:v1': '{nope' }))).toEqual({ hedgerowLevels: 0, runnelDays: 0, nightJobs: 0 })
    expect(chosenOutfit(store({ 'cath:outfit': 'gown' }))).toBe('field')
  })
})
