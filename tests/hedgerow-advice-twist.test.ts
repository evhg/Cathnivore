import { describe, expect, it } from 'vitest'
import { floodAdvice } from '../games/hedgerow/src/advice'

// Plan item 447: the flood outranks Cath's other tips: she warns a round ahead, and before the flood's round she
// counts the towers on its plots that will wash out (Duck Ponds hold there, so they never count).
describe('floodAdvice (plan item 447)', () => {
  const flood = { wave: 17, cells: [[3, 4], [4, 4]] as Array<[number, number]> }
  const kit = ['hedgerow', 'scarecrow', 'pond'] as const
  it('says nothing without a flood, or far from its round', () => {
    expect(floodAdvice(undefined, 17, [], [...kit])).toBeNull()
    expect(floodAdvice(flood, 10, [], [...kit])).toBeNull()
  })
  it('warns a round ahead', () => expect(floodAdvice(flood, 16, [], [...kit])).toMatch(/floods next round/))
  it('names the flood on its round and counts the towers it washes out, bar ponds', () => {
    const towers = [{ kind: 'scarecrow' as const, col: 3, row: 4 }, { kind: 'pond' as const, col: 4, row: 4 }, { kind: 'hedgerow' as const, col: 9, row: 9 }]
    const line = floodAdvice(flood, 17, towers, [...kit])!
    expect(line).toMatch(/river comes over the ford/)
    expect(line).toMatch(/one of your towers/)
    expect(line).toMatch(/Duck Ponds/)
    expect(floodAdvice(flood, 17, [], [...kit])).toMatch(/floods the ford this round/)
  })
  it('does not mention Duck Ponds when the kit has none', () => expect(floodAdvice(flood, 17, [], ['hedgerow'])).not.toMatch(/Duck Ponds/))
})
