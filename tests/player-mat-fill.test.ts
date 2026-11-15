import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MatCrate } from '../src/ui/PlayerMat'
import { MAT_CAP, matFill } from '../src/ui/matFill'

// Plan item 418: the stall's stores fill with their count: one piece a unit, so the fill is proportional to the
// count up to the store's cap (the figure beside it is exact past that).
describe('matFill', () => {
  for (const kind of Object.keys(MAT_CAP) as (keyof typeof MAT_CAP)[]) {
    it(`${kind}: proportional to the count, capped at ${MAT_CAP[kind]}`, () => {
      for (let n = 0; n <= MAT_CAP[kind]; n++) expect(matFill(kind, n) / MAT_CAP[kind]).toBeCloseTo(n / MAT_CAP[kind])
      expect(matFill(kind, MAT_CAP[kind] + 5)).toBe(MAT_CAP[kind])
      expect(matFill(kind, -1)).toBe(0)
    })
  }
  it('the crate draws one piece of veg a Produce', () => {
    for (const n of [0, 1, 4, 9, 14]) {
      const html = renderToStaticMarkup(createElement(MatCrate, { count: n }))
      expect((html.match(/r="6.2"/g) ?? []).length).toBe(matFill('crate', n))
    }
  })
})
