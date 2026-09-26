import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { loadGame, saveGame, SAVE_KEY } from '../src/platform/storage'
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
