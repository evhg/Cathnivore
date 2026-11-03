import { describe, expect, it } from 'vitest'
import { atTheEdge, gripStage, squeezedLastTurn } from '../src/ui/grip'
import type { GameEvent } from '../src/engine/types'

const r = (outlets: number, buyouts = 0, doubt = 0, liberated = false) => ({ outlets, buyouts, doubt, liberated })

// Plan item 55: Hollowell's grip in three stages, from the region's pieces.
describe('gripStage', () => {
  it('rises with Outlets', () => {
    expect([0, 1, 2, 3, 4].map((n) => gripStage(r(n)))).toEqual([0, 1, 2, 2, 3])
  })
  it('a Buyout weighs two', () => {
    expect(gripStage(r(0, 1))).toBe(2)
    expect(gripStage(r(2, 1))).toBe(3)
  })
  it('falls back as Doubt pushes them out', () => {
    expect(gripStage(r(3, 0, 1))).toBe(2)
    expect(gripStage(r(2, 0, 1))).toBe(1)
    expect(gripStage(r(1, 0, 2))).toBe(0)
  })
  it('a liberated region shows none', () => {
    expect(gripStage(r(4, 1, 0, true))).toBe(0)
  })
})

describe('atTheEdge', () => {
  it('flags damage equal to the stalls defending', () => {
    expect(atTheEdge({ outlets: 2, buyouts: 0, stalls: { mara: 2 }, liberated: false })).toBe(true)
    expect(atTheEdge({ outlets: 1, buyouts: 0, stalls: { mara: 2 }, liberated: false })).toBe(false)
    expect(atTheEdge({ outlets: 0, buyouts: 0, stalls: {}, liberated: false })).toBe(false)
  })
})

describe('squeezedLastTurn', () => {
  const sq = (region: string): GameEvent => ({ type: 'squeeze', region, lostLand: false, stallRemoved: false, trustLoss: 0 }) as GameEvent
  const act = { type: 'action', producer: 'mara', action: { kind: 'pass' } } as unknown as GameEvent
  it('reads the last enemy turn only', () => {
    expect([...squeezedLastTurn({ log: [sq('highmoor'), act, sq('saltmarsh'), sq('oakvale')] })].sort()).toEqual(['oakvale', 'saltmarsh'])
  })
  it('still counts the last enemy turn after the players have acted', () => {
    expect([...squeezedLastTurn({ log: [sq('highmoor'), act, act] })]).toEqual(['highmoor'])
  })
  it('is empty before any Squeeze', () => {
    expect(squeezedLastTurn({ log: [act] }).size).toBe(0)
  })
})
