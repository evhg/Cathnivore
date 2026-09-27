import { describe, expect, it } from 'vitest'
import { unshuffledPressureDeck } from '../src/content/pressure'

// SPEC 4.7: "Stage I: Pasture, Crop and Coast, shuffled (3 cards). Stage II: Pasture, Crop, Coast and
// Capital, shuffled (4 cards). Stage III: Pasture+Crop, Crop+Coast and Coast+Pasture, shuffled (3 cards).
// Stack them with Stage I on top and Stage III at the bottom." `unshuffledPressureDeck()` is the
// pre-shuffle source `buildPressureDeck` (src/engine/state.ts) draws from, so this checks the deck's
// fixed structure directly, before any RNG is involved.
describe('unshuffledPressureDeck', () => {
  const deck = unshuffledPressureDeck()

  it('has exactly 10 cards, ordered Stage I, then II, then III', () => {
    expect(deck).toHaveLength(10)
    const stages = deck.map((c) => c.stage)
    expect(stages).toEqual([1, 1, 1, 2, 2, 2, 2, 3, 3, 3])
  })

  it('Stage I has one single-type card each for Pasture, Crop and Coast', () => {
    const stageI = deck.filter((c) => c.stage === 1)
    expect(stageI).toHaveLength(3)
    for (const card of stageI) expect(card.regionTypes).toHaveLength(1)
    expect(stageI.map((c) => c.regionTypes[0]).sort()).toEqual(['coast', 'crop', 'pasture'])
  })

  it('Stage II adds Capital to the three Stage I types, one single-type card each', () => {
    const stageII = deck.filter((c) => c.stage === 2)
    expect(stageII).toHaveLength(4)
    for (const card of stageII) expect(card.regionTypes).toHaveLength(1)
    expect(stageII.map((c) => c.regionTypes[0]).sort()).toEqual(['capital', 'coast', 'crop', 'pasture'])
  })

  it('the Capital card appears exactly once, and only in Stage II', () => {
    const capitalCards = deck.filter((c) => c.regionTypes.includes('capital'))
    expect(capitalCards).toHaveLength(1)
    expect(capitalCards[0]!.stage).toBe(2)
  })

  it('Stage III has the three two-type pairings, none repeated', () => {
    const stageIII = deck.filter((c) => c.stage === 3)
    expect(stageIII).toHaveLength(3)
    const pairings = stageIII.map((c) => [...c.regionTypes].sort().join('+'))
    expect(pairings.sort()).toEqual(['coast+crop', 'coast+pasture', 'crop+pasture'])
    expect(new Set(pairings).size).toBe(3)
  })

  it('every card has a unique id', () => {
    expect(new Set(deck.map((c) => c.id)).size).toBe(deck.length)
  })
})
