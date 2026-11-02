import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CHAPTERS, chapterConfig } from '../src/content/chapters'
import { CHAPTER_HOMES, CHAPTER_SEALS, MAP_AXIAL, currentChapterIndex, hasHardSeal, liberatedRegions, sealsEarned } from '../src/content/campaignMap'
import { createGame } from '../src/engine/api'
import { chapterSeals, loadCampaign, markChapterComplete, recordSeals } from '../src/platform/storage'
import type { GameState } from '../src/engine/types'

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

describe('the wax seals', () => {
  const won = (over: Partial<GameState>, result: Partial<NonNullable<GameState['result']>>) => {
    const s = createGame(chapterConfig(CHAPTERS[0]!), 1)
    return { ...s, ...over, result: { won: true, regionsLiberated: 2, round: 6, cardsBought: 0, schemesPlayed: 0, ...result } } as GameState
  }

  it('every chapter has a Hard seal and a feat, with chapter 1 swapping Hard for a swift win', () => {
    for (const c of CHAPTERS) expect(CHAPTER_SEALS[c.id], c.id).toBeDefined()
    expect(hasHardSeal('fresh-meat')).toBe(false)
    for (const c of CHAPTERS.slice(1)) expect(hasHardSeal(c.id), c.id).toBe(true)
  })

  it('a loss earns nothing; a win earns the win, plus Hard and the feat when they hold', () => {
    const lost = { ...won({}, {}), result: { won: false, regionsLiberated: 0, round: 6, cardsBought: 0, schemesPlayed: 0 } } as GameState
    expect(sealsEarned('word-of-mouth', lost)).toEqual([])
    expect(sealsEarned('word-of-mouth', won({}, { round: 6 }))).toEqual(['win'])
    expect(sealsEarned('word-of-mouth', won({}, { round: 5 }))).toEqual(['win', 'feat'])
    const hard = won({}, { round: 7 })
    expect(sealsEarned('word-of-mouth', { ...hard, config: { ...hard.config, difficulty: 'hard' } })).toEqual(['win', 'hard'])
    expect(sealsEarned('fresh-meat', won({}, { round: 3 }))).toEqual(['win', 'hard', 'feat'])
    expect(sealsEarned('kingsmarket', won({ publicTrust: 12 }, {}))).toEqual(['win', 'feat'])
  })
})

describe('seals in campaign storage', () => {
  const data = new Map<string, string>()
  beforeEach(() => {
    data.clear()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => void data.set(k, v),
        removeItem: (k: string) => void data.delete(k),
      },
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('merges seals across wins, and counts an older completed chapter as won', () => {
    expect(chapterSeals('the-plan')).toEqual([])
    recordSeals('the-plan', ['win', 'feat'])
    recordSeals('the-plan', ['win', 'hard'])
    expect(chapterSeals('the-plan')).toEqual(['win', 'hard', 'feat'])
    markChapterComplete('fresh-meat')
    expect(chapterSeals('fresh-meat')).toEqual(['win'])
    expect(loadCampaign().completed).toEqual(['fresh-meat'])
  })
})
