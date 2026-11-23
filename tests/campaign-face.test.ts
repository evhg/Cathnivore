import { describe, expect, it } from 'vitest'
import { CAMPAIGN_LINES, campaignFace } from '../src/content/campaignLines'

// Plan item 669: Cath's face on the Campaign follows the chapter's state as well as its line.
describe('campaignFace', () => {
  const line = CAMPAIGN_LINES['growing-season']!
  it('is proud of a chapter won', () => expect(campaignFace('done', line)).toBe('delighted'))
  it('winks at one not open yet', () => expect(campaignFace('locked', line)).toBe('wink'))
  it("wears the line's own face for the next one", () => expect(campaignFace('current', line)).toBe(line.expression))
  it('gives three different faces for a chapter whose line is not delighted or a wink', () => {
    const faces = new Set((['done', 'current', 'locked'] as const).map((s) => campaignFace(s, line)))
    expect(faces.size).toBe(3)
  })
})
