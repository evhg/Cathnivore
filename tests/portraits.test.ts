import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { CHARACTERS, portraitKeyFor } from '../src/content/characters'

// STYLE.md 9: every named character gets a portrait; every story speaker must resolve to one.
describe('portraits', () => {
  const STYLE_CAST = ['cath', 'mara', 'tomas', 'ines', 'sol', 'pell', 'vane', 'crisp', 'pip']

  it('has a spec for every character STYLE.md 9 names', () => {
    for (const name of STYLE_CAST) expect(CHARACTERS[name], name).toBeTruthy()
  })

  it('gives each character 3-5 colours plus a skin tone', () => {
    for (const [name, spec] of Object.entries(CHARACTERS)) {
      const colours = new Set([spec.skin, spec.hair, spec.outfit, spec.outfitAccent])
      expect(colours.size, name).toBeGreaterThanOrEqual(3)
      expect(colours.size, name).toBeLessThanOrEqual(5)
    }
  })

  it('resolves every speaker used in the story content to a real portrait', () => {
    const storyDir = path.join(__dirname, '../src/content/story')
    const speakers = new Set<string>()
    for (const file of fs.readdirSync(storyDir)) {
      if (!file.endsWith('.ts') || file === 'types.ts') continue
      const text = fs.readFileSync(path.join(storyDir, file), 'utf8')
      for (const m of text.matchAll(/speaker:\s*'([^']*)'/g)) speakers.add(m[1]!)
    }
    expect(speakers.size).toBeGreaterThan(0)
    for (const speaker of speakers) {
      expect(portraitKeyFor(speaker), speaker).toBeDefined()
    }
  })

  it('portraitKeyFor is case-insensitive and ignores trailing punctuation', () => {
    expect(portraitKeyFor('Mara')).toBe('mara')
    expect(portraitKeyFor("cath's inner voice")).toBe('cath')
    expect(portraitKeyFor('Nobody')).toBeUndefined()
  })
})
