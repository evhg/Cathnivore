import { describe, expect, it } from 'vitest'
import { boardHexes, neighbourTable } from '../games/runnel/src/engine'
import { emptyLayout, toggleEdge } from '../games/runnel/src/workshop'
import { wetDepths } from '../games/runnel/src/workshopui'

// Plan item 39: the workshop's water runs from the spring along joined channels only, one step per tile.
describe("Bea's workshop water", () => {
  it('reaches only tiles joined to the spring, with their distance in steps', () => {
    const l = emptyLayout(2)
    const hexes = boardHexes(2)
    const nb = neighbourTable(hexes)
    const centre = hexes.findIndex((h) => h.q === 0 && h.r === 0)
    expect([...wetDepths(l).entries()]).toEqual([[centre, 0]])
    toggleEdge(l, centre, 0)
    const a = nb[centre]![0]!
    toggleEdge(l, a, 0)
    const b = nb[a]![0]!
    // A channel drawn elsewhere, not joined to the spring, stays dry.
    const far = nb[centre]![3]!
    const farther = nb[far]![3]!
    toggleEdge(l, farther, 2)
    const wet = wetDepths(l)
    expect(wet.get(a)).toBe(1)
    expect(wet.get(b)).toBe(2)
    expect(wet.has(farther)).toBe(false)
    expect(wet.size).toBe(3)
  })
})
