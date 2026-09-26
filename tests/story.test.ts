import { describe, expect, it } from 'vitest'
import { SCENES as FRESH_MEAT } from '../src/content/story/fresh-meat'
import { SCENES as WORD_OF_MOUTH } from '../src/content/story/word-of-mouth'
import { SCENES as GROWING_SEASON } from '../src/content/story/growing-season'
import { SCENES as THE_PLAN } from '../src/content/story/the-plan'
import { SCENES as FRIENDS_IN_LOW_PLACES } from '../src/content/story/friends-in-low-places'
import { SCENES as KINGSMARKET } from '../src/content/story/kingsmarket'
import type { Scene } from '../src/content/story/types'

// SPEC 8.3: "All scenes live as data in `src/content/story/`. Keep the total under 4,000 words, at most 12
// lines per scene and at most 160 characters per line." SPEC 3.2 (Cath's voice): "At most one exclamation
// mark per chapter." None of these were previously checked by a test — the constraints lived only as a
// comment in `types.ts` and in each session's own care while writing the lines.
const CHAPTERS: Record<string, Record<string, Scene>> = {
  'fresh-meat': FRESH_MEAT,
  'word-of-mouth': WORD_OF_MOUTH,
  'growing-season': GROWING_SEASON,
  'the-plan': THE_PLAN,
  'friends-in-low-places': FRIENDS_IN_LOW_PLACES,
  kingsmarket: KINGSMARKET,
}

describe('story content (SPEC 8.3, SPEC 3.2)', () => {
  it('every scene has at most 12 lines', () => {
    for (const [chapterId, scenes] of Object.entries(CHAPTERS)) {
      for (const [sceneId, scene] of Object.entries(scenes)) {
        expect(scene.lines.length, `${chapterId}/${sceneId}`).toBeLessThanOrEqual(12)
      }
    }
  })

  it('every line is at most 160 characters', () => {
    for (const [chapterId, scenes] of Object.entries(CHAPTERS)) {
      for (const [sceneId, scene] of Object.entries(scenes)) {
        scene.lines.forEach((l, i) => {
          expect(l.line.length, `${chapterId}/${sceneId} line ${i}: "${l.line}"`).toBeLessThanOrEqual(160)
        })
      }
    }
  })

  it('the whole campaign stays under 4,000 words', () => {
    let words = 0
    for (const scenes of Object.values(CHAPTERS)) {
      for (const scene of Object.values(scenes)) {
        for (const l of scene.lines) {
          words += l.line.trim().split(/\s+/).filter(Boolean).length
        }
      }
    }
    expect(words).toBeLessThan(4000)
  })

  it("Cath has at most one exclamation mark per chapter", () => {
    for (const [chapterId, scenes] of Object.entries(CHAPTERS)) {
      let exclamations = 0
      for (const scene of Object.values(scenes)) {
        for (const l of scene.lines) {
          if (l.speaker === 'Cath') exclamations += (l.line.match(/!/g) ?? []).length
        }
      }
      expect(exclamations, chapterId).toBeLessThanOrEqual(1)
    }
  })

  it('every scene has at least one line', () => {
    for (const [chapterId, scenes] of Object.entries(CHAPTERS)) {
      for (const [sceneId, scene] of Object.entries(scenes)) {
        expect(scene.lines.length, `${chapterId}/${sceneId}`).toBeGreaterThan(0)
      }
    }
  })
})
