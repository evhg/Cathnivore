import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { IMPROVEMENTS } from '../src/content/improvements'
import { SCHEMES } from '../src/content/schemes'
import Vignette from '../src/ui/Vignette'
import { VIGNETTE_KINDS, vignetteFor } from '../src/ui/vignetteKind'

// Plan item 36: every Improvement and every Scheme has a drawn vignette, and each kind draws a scene.
describe('card vignettes', () => {
  it('every improvement and scheme maps to a drawn vignette', () => {
    for (const card of [...IMPROVEMENTS, ...SCHEMES]) {
      const kind = vignetteFor(card)
      expect(VIGNETTE_KINDS).toContain(kind)
      const svg = renderToStaticMarkup(createElement(Vignette, { kind, seed: card.id }))
      expect(svg).toContain(`data-vignette="${kind}"`)
      expect((svg.match(/<(path|ellipse|circle)/g) ?? []).length).toBeGreaterThanOrEqual(4)
    }
  })
  it('improvement tags each have their own scene', () => {
    const kinds = new Set(IMPROVEMENTS.map((c) => vignetteFor(c)))
    for (const tag of ['pasture', 'crop', 'coast', 'community', 'media', 'science']) expect(kinds).toContain(tag)
  })
})
