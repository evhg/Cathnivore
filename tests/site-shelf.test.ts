import { describe, expect, it } from 'vitest'
import { shelfIndex } from '../site/src/shelf'

// Plan item 530: the phone shelf's pager follows the nearest snapped poster.
describe('shelfIndex', () => {
  it('rounds to the nearest poster and clamps', () => {
    expect(shelfIndex(0, 358, 4)).toBe(0)
    expect(shelfIndex(170, 358, 4)).toBe(0)
    expect(shelfIndex(190, 358, 4)).toBe(1)
    expect(shelfIndex(5000, 358, 4)).toBe(3)
    expect(shelfIndex(-20, 358, 4)).toBe(0)
    expect(shelfIndex(100, 0, 4)).toBe(0)
  })
})
