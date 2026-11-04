import { describe, expect, it } from 'vitest'
import { leakDebrief, weakStretch } from '../games/hedgerow/src/debrief'

const lane: Array<[number, number]> = Array.from({ length: 10 }, (_, i) => [i, 2])

describe('Hedgerow leak debrief (plan item 135)', () => {
  it('finds the longest bare stretch of lane', () => {
    // A tower at column 1 reaches columns 0-2; one at column 8 reaches 7-9: the bare run is 3-6.
    const s = weakStretch(lane, [{ col: 1, row: 2, range: 1.2 }, { col: 8, row: 2, range: 1.2 }])
    expect(s).toEqual([[3, 2], [4, 2], [5, 2], [6, 2]])
  })
  it('falls back to the least covered run when every cell is reached', () => {
    const s = weakStretch(lane, [{ col: 4, row: 2, range: 20 }, { col: 0, row: 2, range: 3.1 }])
    expect(s[0]).toEqual([4, 2])
    expect(s.at(-1)).toEqual([9, 2])
  })
  it('suggests the free plot nearest the stretch middle', () => {
    const free = (c: number, r: number) => r === 1 && (c === 0 || c === 5)
    const d = leakDebrief([lane], [{ col: 1, row: 2, range: 1.2 }, { col: 8, row: 2, range: 1.2 }], free, 10, 4)
    expect(d.plot).toEqual({ col: 5, row: 1 })
  })
  it('has no plot to suggest on a full field', () => {
    expect(leakDebrief([lane], [], () => false, 10, 4).plot).toBeNull()
  })
})
