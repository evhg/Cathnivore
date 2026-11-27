// Plan item 63: a tile's piece tray never overlaps itself and its counts stay readable at every hex size.
import { describe, expect, it } from 'vitest'
import { MIN_COUNT_PX, ORNAMENT_PX, OUTLET_BOOST, pieceLayout, rectsOverlap, TILE_R } from '../src/ui/pieceLayout'

const label = (name: string) => name.length * 8.6 + 16

describe('pieceLayout', () => {
  for (const px of [40, 60, 90, 130])
    it(`keeps 0-6 Outlets, 2 producers and a scheme apart and inside the tile at ${px} px`, () => {
      for (let outlets = 0; outlets <= 6; outlets++)
        for (const buyouts of [0, 1])
          for (const doubt of [0, 2]) {
            const tray = pieceLayout({ outlets, buyouts, doubt, producers: 2, scheme: true, labelWidth: label('Kingsmarket') }, px)
            const r = tray.rects
            for (let a = 0; a < r.length; a++)
              for (let b = a + 1; b < r.length; b++) expect(rectsOverlap(r[a]!, r[b]!), `${outlets}/${buyouts}/${doubt}: ${r[a]!.kind} ${r[b]!.kind}`).toBe(false)
            expect(tray.countR * 1.25 * (px / TILE_R)).toBeGreaterThanOrEqual(MIN_COUNT_PX - 1e-9)
            expect(r.filter((x) => x.kind === 'producer')).toHaveLength(2)
            expect(r.some((x) => x.kind === 'outlets')).toBe(outlets > 0)
          }
    })

  // Plan item 733: Hollowell's storefront leads its pieces: where the tile has room the Outlet's slot grows past the
  // Buyout's (up to OUTLET_BOOST), standing on the same ground line, and never past it.
  it('grows the Outlet past the other stacks where the tile has room', () => {
    const input = { outlets: 3, buyouts: 1, doubt: 0, producers: 1, scheme: false, labelWidth: label('Saltmarsh') }
    const t = pieceLayout(input, 90)
    const o = t.rects.find((x) => x.kind === 'outlets')!
    const b = t.rects.find((x) => x.kind === 'buyouts')!
    expect(t.outletBoost ?? 1).toBeGreaterThan(1)
    expect(t.outletBoost ?? 1).toBeLessThanOrEqual(OUTLET_BOOST + 1e-9)
    expect(o.x1 - o.x0).toBeGreaterThan(b.x1 - b.x0)
    expect(o.y1).toBeCloseTo(b.y1, 6)
  })

  it('drops ornaments on a small hex before it shrinks the pieces', () => {
    const input = { outlets: 3, buyouts: 1, doubt: 0, producers: 2, scheme: false, labelWidth: label('Rivermead') }
    expect(pieceLayout(input, ORNAMENT_PX - 1).ornaments).toBe(false)
    const big = pieceLayout(input, 90)
    expect(big.ornaments).toBe(true)
    expect(big.scale).toBeGreaterThanOrEqual(1)
  })

  it('keeps a threat badge clear of the stacks and grows the pieces on a roomy hex', () => {
    const input = { outlets: 4, buyouts: 2, doubt: 1, producers: 3, scheme: false, labelWidth: label('Saltmarsh'), badge: true }
    for (const px of [45, 63, 90, 125]) {
      const r = pieceLayout(input, px).rects
      const badge = r.find((x) => x.kind === 'badge')!
      for (const o of r) if (o !== badge) expect(rectsOverlap(o, badge), `${px}: ${o.kind}`).toBe(false)
    }
    expect(pieceLayout({ ...input, badge: false, outlets: 1, buyouts: 0, doubt: 0, producers: 1 }, 125).scale).toBeGreaterThan(1)
  })

  it('is the same every time', () => {
    const input = { outlets: 2, buyouts: 1, doubt: 1, producers: 3, scheme: true, labelWidth: label('Shingle Bay') }
    expect(pieceLayout(input, 60)).toEqual(pieceLayout({ ...input }, 60))
  })
})
