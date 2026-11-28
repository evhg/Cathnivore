// Plan item 63: a tile's piece tray never overlaps itself and its counts stay readable at every hex size.
import { describe, expect, it } from 'vitest'
import { ENEMY_ART_H, ENEMY_MAX_PX, MIN_COUNT_PX, ORNAMENT_PX, pieceLayout, rectsOverlap, TILE_R } from '../src/ui/pieceLayout'

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

  // Plan item 740: Hollowell's pieces are badges under the producers: never past ENEMY_MAX_PX of art on screen, a
  // stall's slot 1.2x+ an Outlet's on a shared hex, and no Outlet grown past the other stacks (item 733's boost gone).
  it('keeps Hollowell\'s stacks smaller than the producers and the landmark', () => {
    for (const px of [60, 69, 90, 124])
      for (const [outlets, buyouts, doubt, producers] of [[3, 1, 0, 1], [1, 0, 0, 2], [2, 1, 1, 3], [4, 0, 0, 0]] as const) {
        const t = pieceLayout({ outlets, buyouts, doubt, producers, scheme: false, labelWidth: label('Saltmarsh') }, px)
        const o = t.rects.find((x) => x.kind === 'outlets')!
        expect(t.outletBoost ?? 1).toBe(1)
        expect(t.enemyScale * ENEMY_ART_H * (px / TILE_R)).toBeLessThanOrEqual(ENEMY_MAX_PX + 1e-6)
        // The 1.2x is the desktop board's (a phone keeps its stacks at the chunky-token floor, ENEMY_MIN_PX).
        if (producers && px >= 90) {
          const p = t.rects.find((x) => x.kind === 'producer')!
          expect(((p.x1 - p.x0) * (p.y1 - p.y0)) / ((o.x1 - o.x0) * (o.y1 - o.y0)), `${px} ${outlets}/${producers}`).toBeGreaterThanOrEqual(1.2)
        }
      }
  })

  it('drops ornaments on a small hex before it shrinks the pieces', () => {
    const input = { outlets: 3, buyouts: 1, doubt: 0, producers: 2, scheme: false, labelWidth: label('Rivermead') }
    expect(pieceLayout(input, ORNAMENT_PX - 1).ornaments).toBe(false)
    const big = pieceLayout(input, 90)
    expect(big.ornaments).toBe(true)
    // Plan item 740: the landmark's larger floor may take the pieces to 0.95 (LANDMARK_TIERS' middle step).
    expect(big.scale).toBeGreaterThanOrEqual(0.95)
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
