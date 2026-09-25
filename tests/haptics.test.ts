import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { playHapticsFor } from '../src/platform/haptics'
import type { GameEvent } from '../src/engine/types'

// STYLE.md 11: "a light tap when placing, a medium tap on liberation, and a warning buzz on Lost Land and
// loss." `playHapticsFor` no-ops entirely off `Capacitor.isNativePlatform()`, which is absent in this test
// environment, so these tests only check that it never throws for each event shape — the actual native
// dispatch has no meaningful unit-testable surface (it's a thin wrapper around a Capacitor plugin call).
describe('playHapticsFor', () => {
  beforeEach(() => {
    vi.stubGlobal('Capacitor', null)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does nothing off a native platform for an openStall action', () => {
    expect(() => playHapticsFor({ kind: 'openStall', region: 'highmoor' }, [], null)).not.toThrow()
  })

  it('does nothing off a native platform for a liberation event', () => {
    const events: GameEvent[] = [{ type: 'liberated', region: 'highmoor', producer: 'mara' }]
    expect(() => playHapticsFor(null, events, null)).not.toThrow()
  })

  it('does nothing off a native platform for a Lost Land squeeze event', () => {
    const events: GameEvent[] = [{ type: 'squeeze', region: 'highmoor', lostLand: true, stallRemoved: false, trustLoss: 0 }]
    expect(() => playHapticsFor(null, events, null)).not.toThrow()
  })

  it('does nothing off a native platform on a loss', () => {
    expect(() =>
      playHapticsFor(null, [], { won: false, lossReason: 'publicTrust', round: 5, regionsLiberated: 0 }),
    ).not.toThrow()
  })
})
