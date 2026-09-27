import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  loadGame,
  saveGame,
  SAVE_KEY,
  loadCampaign,
  markChapterComplete,
  recordGrowingSeasonCarryOver,
  recordChapterLoss,
  clearChapterLossCount,
  preloadNativeStorage,
} from '../src/platform/storage'
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

  // SPEC 8.1/11.3: a campaign chapter save carries `chapterId` so a reload can resume back into the
  // `chapterGame` screen (App.tsx's `resume()`) instead of silently downgrading to a plain Quick Game that
  // can never call `onChapterEnd`/`markChapterComplete` for that playthrough again.
  it('round-trips chapterId for a campaign save', () => {
    saveGame({ version: 1, config: CONFIG, seed: 7, actions: [], chapterId: 'fresh-meat' })
    const result = loadGame()
    expect(result.save?.chapterId).toBe('fresh-meat')
  })

  it('omits chapterId for a plain Quick Game save', () => {
    saveGame({ version: 1, config: CONFIG, seed: 7, actions: [] })
    const result = loadGame()
    expect(result.save?.chapterId).toBeUndefined()
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

// SPEC 8.1: "Losing a chapter: offer Retry (same shuffle), Retry (new shuffle) and Play on Easy. After 2
// losses, also offer Skip Chapter." `recordChapterLoss`/`clearChapterLossCount` are the storage half of
// that: counting consecutive losses per chapter so the UI knows when to reveal Skip Chapter.
describe('chapter loss counts (SPEC 8.1, campaign storage)', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: fakeLocalStorage() })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts at 0 (undefined) for a chapter with no recorded loss', () => {
    expect(loadCampaign().chapterLossCounts?.['fresh-meat']).toBeUndefined()
  })

  it('increments on each recorded loss and returns the running total', () => {
    expect(recordChapterLoss('fresh-meat')).toBe(1)
    expect(recordChapterLoss('fresh-meat')).toBe(2)
    expect(recordChapterLoss('fresh-meat')).toBe(3)
    expect(loadCampaign().chapterLossCounts?.['fresh-meat']).toBe(3)
  })

  it('tracks each chapter independently', () => {
    recordChapterLoss('fresh-meat')
    recordChapterLoss('fresh-meat')
    recordChapterLoss('word-of-mouth')
    const counts = loadCampaign().chapterLossCounts
    expect(counts?.['fresh-meat']).toBe(2)
    expect(counts?.['word-of-mouth']).toBe(1)
  })

  it('clearChapterLossCount resets a chapter back to 0 without touching others', () => {
    recordChapterLoss('fresh-meat')
    recordChapterLoss('fresh-meat')
    recordChapterLoss('word-of-mouth')
    clearChapterLossCount('fresh-meat')
    const counts = loadCampaign().chapterLossCounts
    expect(counts?.['fresh-meat']).toBeUndefined()
    expect(counts?.['word-of-mouth']).toBe(1)
  })

  it('does not clobber chapter-completion or carry-over progress, and vice versa', () => {
    markChapterComplete('fresh-meat')
    recordChapterLoss('word-of-mouth')
    recordGrowingSeasonCarryOver(1)
    const progress = loadCampaign()
    expect(progress.completed).toEqual(['fresh-meat'])
    expect(progress.chapterLossCounts?.['word-of-mouth']).toBe(1)
    expect(progress.growingSeasonContractsSurviving).toBe(1)
  })
})

// SPEC 11.3: "On iPhone it uses Capacitor Preferences." `preloadNativeStorage` warms the in-memory cache
// the native half of `storage.ts` reads synchronously from — but which backend `storage` itself resolved
// to was already decided at module-load time (off-native, in this Vitest/Node environment, same as every
// other test above), so this only exercises the off-native no-op path, mirroring `tests/haptics.test.ts`'s
// and `tests/native.test.ts`'s precedent: the real Capacitor Preferences half has no meaningful surface to
// unit-test without a DOM + a Capacitor global, and is exercised for real by the iOS build (gate 9).
describe('preloadNativeStorage (SPEC 11.3)', () => {
  it('resolves immediately and does nothing off a native platform', async () => {
    await expect(preloadNativeStorage()).resolves.toBeUndefined()
  })
})
