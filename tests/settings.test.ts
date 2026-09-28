import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { DEFAULT_SETTINGS, loadSettings, saveSettings, applyThemeSetting, AI_SPEED_DELAY_MS } from '../src/platform/settings'

// `src/platform/storage.ts`'s web implementation reads/writes `window.localStorage` directly (SPEC 11.3);
// Vitest runs in plain Node with no `window` at all, so it silently no-ops there (by design — a failed
// save should never crash the app). Stub in a minimal in-memory `localStorage` so these tests exercise the
// real read/write path instead of always hitting that no-op fallback.
function fakeLocalStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  }
}

describe('settings', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: fakeLocalStorage() })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('defaults to animations on, colour-blind patterns off, normal AI speed', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('round-trips a saved settings object', () => {
    saveSettings({ version: 1, animations: false, sound: false, colourBlindPatterns: true, aiSpeed: 'fast', theme: 'dark' })
    expect(loadSettings()).toEqual({
      version: 1,
      animations: false,
      sound: false,
      colourBlindPatterns: true,
      aiSpeed: 'fast',
      theme: 'dark',
    })
  })

  it('falls back to defaults for a corrupt value', () => {
    ;(window as unknown as { localStorage: ReturnType<typeof fakeLocalStorage> }).localStorage.setItem(
      'cathnivore:settings:v1',
      'not json',
    )
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('applyThemeSetting no-ops without throwing when there is no document (Vitest runs in Node)', () => {
    expect(() => applyThemeSetting('dark')).not.toThrow()
    expect(() => applyThemeSetting('system')).not.toThrow()
  })

  it('every AI speed has a positive delay, ordered slow > normal > fast', () => {
    expect(AI_SPEED_DELAY_MS.slow).toBeGreaterThan(AI_SPEED_DELAY_MS.normal)
    expect(AI_SPEED_DELAY_MS.normal).toBeGreaterThan(AI_SPEED_DELAY_MS.fast)
    expect(AI_SPEED_DELAY_MS.fast).toBeGreaterThan(0)
  })
})
