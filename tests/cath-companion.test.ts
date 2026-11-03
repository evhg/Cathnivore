import { describe, expect, it } from 'vitest'
import { CATH_REACTION_EXPRESSION, cathLineForRegion, type CathReaction } from '../src/content/cathCompanionLines'

// Plan item 75: in game Cath's bust follows the round's events: a liberation delights her, a Squeeze that costs
// land worries her, and every reaction has a face and a line.
describe("Cath's in-game reactions", () => {
  it('maps the big events to the faces they deserve', () => {
    expect(CATH_REACTION_EXPRESSION.liberated).toBe('delighted')
    expect(CATH_REACTION_EXPRESSION.squeezeLostLand).toBe('worried')
    expect(CATH_REACTION_EXPRESSION.loss).toBe('worried')
    expect(CATH_REACTION_EXPRESSION.win).toBe('delighted')
    expect(CATH_REACTION_EXPRESSION.squeeze).not.toBe('delighted')
  })

  it('gives every reaction one of her five expressions', () => {
    const faces = new Set(['smirk', 'delighted', 'determined', 'worried', 'wink'])
    for (const [reaction, face] of Object.entries(CATH_REACTION_EXPRESSION)) expect(faces.has(face), reaction).toBe(true)
  })

  it('has a line for every region reaction', () => {
    for (const r of ['liberated', 'expand', 'squeeze', 'squeezeLostLand'] as CathReaction[]) expect(cathLineForRegion(r, 'kingsmarket').length).toBeGreaterThan(8)
  })
})
