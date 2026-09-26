import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { applyStatusBarStyle } from '../src/platform/statusBar'
import { hideSplashScreen } from '../src/platform/splash'

// Both functions no-op entirely off `Capacitor.isNativePlatform()` (absent in this test environment), same
// precedent as `tests/haptics.test.ts` — the native half has no meaningful unit-testable surface without a
// real Capacitor plugin + iOS runtime.
describe('applyStatusBarStyle / hideSplashScreen off native', () => {
  beforeEach(() => {
    vi.stubGlobal('Capacitor', null)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does nothing for every theme preference', async () => {
    await expect(applyStatusBarStyle('system')).resolves.toBeUndefined()
    await expect(applyStatusBarStyle('light')).resolves.toBeUndefined()
    await expect(applyStatusBarStyle('dark')).resolves.toBeUndefined()
  })

  it('hideSplashScreen does nothing', async () => {
    await expect(hideSplashScreen()).resolves.toBeUndefined()
  })
})
