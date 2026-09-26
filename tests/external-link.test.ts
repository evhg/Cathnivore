import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { openExternalLink } from '../src/platform/externalLink'

// SPEC 11.6: "The only links out are Privacy and Support, which open in Safari." Off a native platform
// (the website), the same links stay in-app same-tab, same as every other in-app navigation.
describe('openExternalLink', () => {
  beforeEach(() => {
    vi.stubGlobal('Capacitor', null)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does nothing off a native platform in this window-less test environment (no throw)', () => {
    expect(() => openExternalLink('/privacy')).not.toThrow()
  })
})
