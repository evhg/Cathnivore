import { describe, expect, it } from 'vitest'
import { isNativePlatform } from '../src/platform/native'

// Vitest runs in a plain Node environment (no `window`), so this only exercises the "not on native" path
// — the same path a real web visitor takes. The Capacitor-present branch is exercised by the iOS build
// itself (SPEC 11.4 gate 9) and isn't independently unit-testable without a DOM + a Capacitor global, which
// `tests/haptics.test.ts` already covers for the one caller that matters (no-throw across event shapes).
describe('isNativePlatform', () => {
  it('is false outside a browser/native runtime', () => {
    expect(isNativePlatform()).toBe(false)
  })
})
