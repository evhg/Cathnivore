import { describe, expect, it } from 'vitest'
import { splitTarget } from '../src/ui/planTarget'

describe('splitTarget (plan item 100)', () => {
  it('marks each region name and drops the separators between chips', () => {
    expect(splitTarget('Rivermead · Oakvale', ['Rivermead', 'Oakvale'])).toEqual([
      { text: 'Rivermead', region: true },
      { text: ' ', sep: true },
      { text: 'Oakvale', region: true },
    ])
  })
  it('keeps the words around a chip', () => {
    expect(splitTarget('Expands next round: Brindle Hills, Highmoor', ['Highmoor', 'Brindle Hills'])).toEqual([
      { text: 'Expands next round: ' },
      { text: 'Brindle Hills', region: true },
      { text: ' ', sep: true },
      { text: 'Highmoor', region: true },
    ])
    expect(splitTarget('Rivermead +Buyout · Oakvale +Doubt', ['Rivermead', 'Oakvale'])).toEqual([
      { text: 'Rivermead', region: true },
      { text: ' +Buyout · ' },
      { text: 'Oakvale', region: true },
      { text: ' +Doubt' },
    ])
  })
  it('leaves a line with no regions whole', () => {
    expect(splitTarget('Arms next round', [])).toEqual([{ text: 'Arms next round' }])
    expect(splitTarget('Rivermead +2 more', ['Rivermead'])).toEqual([{ text: 'Rivermead', region: true }, { text: ' +2 more' }])
  })
})
