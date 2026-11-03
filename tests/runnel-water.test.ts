// Plan item 61: water runs tile by tile from the spring, so a longer river takes longer to fill, and each ditch's
// sunlit bank follows the day's light as the tile turns.
import { describe, expect, it } from 'vitest'
import { arrivalMs, bankSunlit, CASCADE_MS, waterFront } from '../games/runnel/src/water'

describe('waterFront', () => {
  const depths = new Map([
    [3, 2],
    [4, 3],
    [5, 4],
    [9, 6],
  ])
  it('fills the nearest newly joined tile first and one tile per cascade step', () => {
    expect([...waterFront(depths, 0)]).toEqual([3])
    expect([...waterFront(depths, CASCADE_MS)].sort()).toEqual([3, 4])
    expect([...waterFront(depths, 2 * CASCADE_MS)].sort()).toEqual([3, 4, 5])
    expect(waterFront(depths, 4 * CASCADE_MS).size).toBe(4)
  })
  it('waits for the turn to settle and scales with the path length', () => {
    expect(waterFront(depths, 100, 150).size).toBe(0)
    expect(arrivalMs(6, 2, 150)).toBe(150 + 4 * CASCADE_MS)
    expect(arrivalMs(12, 2)).toBeGreaterThan(arrivalMs(6, 2))
  })
  it('fills a joining tile next to the river well within 600 ms', () => {
    expect(arrivalMs(3, 2, 150)).toBeLessThan(600)
  })
})

describe('bankSunlit', () => {
  it('lights exactly one bank of every ditch', () => {
    for (const time of ['morning', 'noon', 'golden', 'dusk'] as const)
      for (let a = 0; a < 360; a += 60) expect(bankSunlit(a, 1, time)).not.toBe(bankSunlit(a, -1, time))
  })
  it('swaps the lit bank when a ditch turns half way round', () => {
    for (let a = 0; a < 180; a += 60) expect(bankSunlit(a, 1, 'golden')).toBe(bankSunlit(a + 180, -1, 'golden'))
  })
  it('lights the far bank from the light: at midday the bank below an east-west ditch', () => {
    // A ditch running east (0 deg): side +1 is its south bank (y down), which faces the overhead-north light.
    expect(bankSunlit(0, 1, 'noon')).toBe(true)
  })
})
