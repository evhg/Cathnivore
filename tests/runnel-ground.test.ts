import { describe, expect, it } from 'vitest'
import { boardHexes } from '../games/runnel/src/engine'
import { furrowAngle, groundFor } from '../games/runnel/src/ground'
import { boardSky } from '../games/runnel/src/sky'

// Plan item 50: dry tiles are farmland (fallow, meadow, field), fixed by the seed, and neighbours mostly differ.
describe('Runnel ground', () => {
  const hexes = boardHexes(3)
  it('is the same for the same seed and cell', () => {
    for (const h of hexes) expect(groundFor('2026-11-03', h.q, h.r)).toBe(groundFor('2026-11-03', h.q, h.r))
  })
  it('uses all three grounds, and most edge neighbours differ', () => {
    for (const seed of ['a', 'b', '2026-11-03', 'practice-7']) {
      const set = new Set(hexes.map((h) => groundFor(seed, h.q, h.r)))
      expect(set.size, seed).toBe(3)
      let same = 0
      let pairs = 0
      for (const a of hexes)
        for (const b of hexes)
          if (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r) === 2 && `${a.q},${a.r}` < `${b.q},${b.r}`) {
            pairs++
            if (groundFor(seed, a.q, a.r) === groundFor(seed, b.q, b.r)) same++
          }
      expect(same / pairs, seed).toBeLessThan(0.35)
    }
  })
  it('turns furrows only by whole hex turns', () => {
    for (const h of hexes) expect(furrowAngle('x', h.q, h.r) % 60).toBe(0)
  })
  it('reads a forced sky and words it to match', () => {
    expect(boardSky('x', '?sky=dusk,drizzle')).toMatchObject({ time: 'dusk', weather: 'drizzle', label: 'Dusk, light drizzle' })
    expect(boardSky('x', '?sky=bogus').time).toBe(boardSky('x', '').time)
  })
})
