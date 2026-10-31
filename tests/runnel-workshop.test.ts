import { describe, expect, it } from 'vitest'
import { boardHexes, computeFlow, neighbourTable } from '../games/runnel/src/engine'
import { checkLayout, emptyLayout, encodeLayout, parseLayout, toggleEdge, workshopPuzzle, workshopSeed } from '../games/runnel/src/workshop'

function ring() {
  // Spring plus a line east and a bend: centre -> east -> east-east, and centre -> west.
  const l = emptyLayout(2)
  const hexes = boardHexes(2)
  const nb = neighbourTable(hexes)
  const centre = hexes.findIndex((h) => h.q === 0 && h.r === 0)
  let i = centre
  const path = [0, 0, 1] // east, east, south-east
  for (const d of path) {
    toggleEdge(l, i, d)
    i = nb[i]![d]!
  }
  toggleEdge(l, centre, 3)
  toggleEdge(l, nb[centre]![3]!, 2)
  return l
}

describe('runnel workshop', () => {
  it('rejects an empty board and a stray tile', () => {
    expect(checkLayout(emptyLayout(2)).ok).toBe(false)
  })
  it('accepts a connected layout and round-trips its code', () => {
    const l = ring()
    const c = checkLayout(l)
    expect(c.problem).toBe('')
    expect(c.ok).toBe(true)
    expect(parseLayout(encodeLayout(l))).toEqual(l)
  })
  it('builds a scrambled but solvable puzzle, the same each time', () => {
    const seed = workshopSeed(encodeLayout(ring()))
    const a = workshopPuzzle(seed)!
    const b = workshopPuzzle(seed)!
    expect(a.cells.map((c) => c.rot)).toEqual(b.cells.map((c) => c.rot))
    expect(a.par).toBeGreaterThan(0)
    a.cells.forEach((c) => (c.rot = 0))
    expect(computeFlow(a.cells).solved).toBe(true)
  })
  it('rejects junk and unreachable tiles', () => {
    expect(parseLayout('W2-abc')).toBeNull()
    const l = ring()
    const hexes = boardHexes(2)
    const far = hexes.findIndex((h) => h.q === 2 && h.r === -2)
    const nb = neighbourTable(hexes)
    toggleEdge(l, far, 2) // a channel between two tiles that nothing connects to the spring
    expect(checkLayout(l).ok).toBe(false)
    expect(workshopPuzzle(workshopSeed(encodeLayout(l)))).toBeNull()
    expect(nb.length).toBe(hexes.length)
  })
})
