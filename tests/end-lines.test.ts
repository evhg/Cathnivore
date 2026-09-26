import { describe, expect, it } from 'vitest'
import { WIN_LINE, LOSS_LINE } from '../src/content/endLines'

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
})
