import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { loadGame, saveGame, SAVE_KEY, loadCampaign, markChapterComplete, recordGrowingSeasonCarryOver } from '../src/platform/storage'
import type { GameConfig } from '../src/engine/types'

// Same fake localStorage shape as tests/settings.test.ts — Vitest runs in plain Node with no `window`.
function fakeLocalStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  }
}

const CONFIG: GameConfig = { producers: ['mara', 'tomas'], difficulty: 'normal', activeRegions: ['brindleHills'] }

describe('loadGame (SPEC 11.3)', () => {
  let ls: ReturnType<typeof fakeLocalStorage>

  beforeEach(() => {
    ls = fakeLocalStorage()
    vi.stubGlobal('window', { localStorage: ls })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports no save when nothing is stored', () => {
    expect(loadGame()).toEqual({ save: null, incompatible: false })
  })

  it('loads a valid save as compatible', () => {
    saveGame({ version: 1, config: CONFIG, seed: 7, actions: [] })
    const result = loadGame()
    expect(result.incompatible).toBe(false)
    expect(result.save).toEqual({ version: 1, config: CONFIG, seed: 7, actions: [] })
  })

  it('flags a wrong-version save as incompatible but still returns it, for "Try Anyway"', () => {
    ls.setItem(SAVE_KEY, JSON.stringify({ version: 2, config: CONFIG, seed: 7, actions: [] }))
    const result = loadGame()
    expect(result.incompatible).toBe(true)
    expect(result.save?.seed).toBe(7)
  })

  it('flags unparseable JSON as incompatible with nothing to fall back on', () => {
    ls.setItem(SAVE_KEY, 'not json')
    expect(loadGame()).toEqual({ save: null, incompatible: true })
  })
})

// SPEC 8.2 ch3 carry-over: "Campaign progress and carry-over flags are saved separately from game saves."
describe('growing season carry-over (SPEC 8.2 ch3, campaign storage)', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: fakeLocalStorage() })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('defaults to undefined (read as 0 by chapter 4) when nothing has been recorded', () => {
    expect(loadCampaign().growingSeasonContractsSurviving).toBeUndefined()
  })

  it('records the surviving-contracts count for chapter 4 to read back', () => {
    recordGrowingSeasonCarryOver(1)
    expect(loadCampaign().growingSeasonContractsSurviving).toBe(1)
    recordGrowingSeasonCarryOver(2)
    expect(loadCampaign().growingSeasonContractsSurviving).toBe(2)
  })

  it('does not clobber chapter-completion progress, and vice versa', () => {
    markChapterComplete('growing-season')
    recordGrowingSeasonCarryOver(2)
    markChapterComplete('the-plan')
    const progress = loadCampaign()
    expect(progress.completed).toEqual(['growing-season', 'the-plan'])
    expect(progress.growingSeasonContractsSurviving).toBe(2)
  })
})
