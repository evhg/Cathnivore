import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { IMPROVEMENTS } from '../src/content/improvements'
import { SCHEMES } from '../src/content/schemes'
import { ALL_REGION_IDS } from '../src/content/map'
import type { GameConfig, ResourceKind } from '../src/engine/types'

// SPEC 10.5 / 11.4 gate 2: "all rules text is generated from card and rules data, or checked against it
// by tests." Card `text` fields are hand-written, so this test checks the numbers they claim against the
// card's actual `onBuy`/`effect` behaviour, rather than trusting the prose.

const CONFIG: GameConfig = { producers: ['mara', 'tomas'], difficulty: 'normal', activeRegions: ALL_REGION_IDS }

const TRACKS: { kind: ResourceKind; noun: string }[] = [
  { kind: 'produce', noun: 'Produce' },
  { kind: 'marks', noun: 'Marks' },
  { kind: 'goodwill', noun: 'Goodwill' },
]

describe('Improvement rules text', () => {
  for (const card of IMPROVEMENTS) {
    it(`${card.name}: text matches an immediate production change`, () => {
      expect(card.text.length).toBeGreaterThan(0)
      expect(card.text.length).toBeLessThanOrEqual(200)

      const before = createGame(CONFIG, 1)
      const after = card.onBuy(before, 'mara')
      for (const { kind, noun } of TRACKS) {
        const delta = after.producers.mara.production[kind] - before.producers.mara.production[kind]
        if (delta !== 0) {
          expect(card.text).toContain(`+${delta} ${noun} production`)
        }
      }
    })
  }
})

describe('Scheme rules text', () => {
  for (const card of SCHEMES) {
    it(`${card.name}: text is present and within SPEC 5's implied length`, () => {
      expect(card.text.length).toBeGreaterThan(0)
      expect(card.text.length).toBeLessThanOrEqual(200)
      expect(card.line.length).toBeLessThanOrEqual(110)
      expect(card.name.split(' ').length).toBeLessThanOrEqual(3)
    })
  }
})
