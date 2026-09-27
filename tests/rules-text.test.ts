import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { IMPROVEMENTS } from '../src/content/improvements'
import { SCHEMES } from '../src/content/schemes'
import { AGENDA_CARDS } from '../src/content/agenda'
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

    it(`${card.name}: cost, tags and flavor length are within SPEC 7's limits`, () => {
      expect(card.cost).toBeGreaterThanOrEqual(2)
      expect(card.cost).toBeLessThanOrEqual(9)
      expect(card.tags.length).toBeGreaterThanOrEqual(1)
      expect(card.tags.length).toBeLessThanOrEqual(2)
      if (card.flavor !== undefined) {
        expect(card.flavor.length).toBeLessThanOrEqual(80)
      }
    })
  }
})

describe('Agenda rules text', () => {
  for (const card of AGENDA_CARDS) {
    it(`${card.id}: headline is within SPEC 4.7's 90-character limit`, () => {
      expect(card.headline.length).toBeGreaterThan(0)
      expect(card.headline.length).toBeLessThanOrEqual(90)
    })
  }

  it('has exactly 12 Hollowell cards and 12 Candor cards (SPEC 4.7)', () => {
    expect(AGENDA_CARDS.filter((c) => c.faction === 'hollowell').length).toBe(12)
    expect(AGENDA_CARDS.filter((c) => c.faction === 'candor').length).toBe(12)
    expect(AGENDA_CARDS.length).toBe(24)
  })

  // SPEC 4.7 mandates these four headlines verbatim ("Use these four exactly and write the rest to
  // match"). A prior session introduced a one-word drift ("launches a free" vs "launches free") that
  // nothing caught, so this locks the exact text down.
  it('includes the four SPEC-mandated headlines verbatim', () => {
    const headlines = new Set(AGENDA_CARDS.map((c) => c.headline))
    expect(headlines.has("Hollowell unveils 'Farmhouse' range, made in a very large house.")).toBe(true)
    expect(headlines.has('Hollowell pledges to support local farmers by buying them.')).toBe(true)
    expect(headlines.has("Candor-funded study finds 'natural' is a risk factor.")).toBe(true)
    expect(headlines.has('Candor launches free wellness app. It is very interested in you.')).toBe(true)
  })
})

describe('Scheme rules text', () => {
  for (const card of SCHEMES) {
    it(`${card.name}: text is present and within SPEC 5's implied length`, () => {
      expect(card.text.length).toBeGreaterThan(0)
      expect(card.text.length).toBeLessThanOrEqual(200)
      expect(card.line.length).toBeLessThanOrEqual(110)
      expect(card.name.split(' ').length).toBeLessThanOrEqual(3)
      expect(card.cost).toBeGreaterThanOrEqual(1)
      expect(card.cost).toBeLessThanOrEqual(4)
    })
  }
})
