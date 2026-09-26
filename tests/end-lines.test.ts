import { describe, expect, it } from 'vitest'
import { WIN_LINE, LOSS_LINE, LOSS_REASON_LABEL } from '../src/content/endLines'

// SPEC 4.8's end-screen "short story line", in Cath's voice (section 3.2: short sentences, at most one
// exclamation mark). Same 160-character cap tests/story.test.ts already enforces for scene lines.
describe('end-of-game story lines', () => {
  const allLines = [WIN_LINE, ...Object.values(LOSS_LINE)]

  it('every line is at most 160 characters', () => {
    for (const line of allLines) {
      expect(line.length, line).toBeLessThanOrEqual(160)
    }
  })

  it('has at most one exclamation mark per line', () => {
    for (const line of allLines) {
      expect((line.match(/!/g) ?? []).length, line).toBeLessThanOrEqual(1)
    }
  })

  it('has a line for every LossReason', () => {
    expect(Object.keys(LOSS_LINE).sort()).toEqual(['lostLand', 'pressureDeckEmpty', 'publicTrust'])
  })

  // SPEC 10.5 "plain English": the end screen shows this label directly (Game.tsx: `Loss: ${...}`), so it
  // must not be a raw internal LossReason identifier (camelCase engine keys like `publicTrust` leaking
  // onto the screen — a real bug found by a gate-8 visual review screenshot).
  it('has a plain-English label, not a raw identifier, for every LossReason', () => {
    expect(Object.keys(LOSS_REASON_LABEL).sort()).toEqual(['lostLand', 'pressureDeckEmpty', 'publicTrust'])
    for (const [reason, label] of Object.entries(LOSS_REASON_LABEL)) {
      expect(label, reason).not.toEqual(reason)
      expect(label, reason).not.toMatch(/[a-z][A-Z]/)
    }
  })
})
