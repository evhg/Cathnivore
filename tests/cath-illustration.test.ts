import { describe, expect, it } from 'vitest'
import { cathSvg, type CathOutfit } from '../shared/cath/cath'

// Plan item 442: Cath is illustrated, not flat avatar art: her hair is drawn in three or more fills (base, occluded
// edge, shine and glints) and her jacket in three or more (cloth, shade, lapels and seams), in every outfit.
const section = (svg: string, from: string, to: string): string => {
  const a = svg.indexOf(`class="${from}"`)
  const b = svg.indexOf(`class="${to}"`, a + 1)
  return svg.slice(a, b < 0 ? undefined : b)
}
const fills = (part: string): Set<string> =>
  new Set([...part.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]!).filter((f) => f !== 'none'))

describe('Cath is illustrated (plan item 442)', () => {
  for (const outfit of ['field', 'market', 'wax', 'pinny', 'gown', 'trench'] as CathOutfit[]) {
    const svg = cathSvg({ framing: 'full', outfit })
    it(`her hair has three or more fills (${outfit})`, () => {
      const hair = new Set([...fills(section(svg, 'cath-hair-back', 'cath-body')), ...fills(section(svg, 'cath-hair-front', 'cath-arms'))])
      expect(hair.size, [...hair].join(' ')).toBeGreaterThanOrEqual(3)
    })
    it(`her jacket has three or more fills (${outfit})`, () => {
      const body = fills(section(svg, 'cath-body', 'cath-head'))
      expect(body.size, [...body].join(' ')).toBeGreaterThanOrEqual(3)
    })
  }
  it('her standing boots have a heel, a sole and a polish highlight', () => {
    const lower = section(cathSvg({ framing: 'full' }), 'cath-lower', 'cath-hair-back')
    expect(lower).toMatch(/M181 868 L196 868/)
    expect(lower.match(/<ellipse[^>]+fill="#ffffff" opacity="0\.38"/g)?.length).toBe(2)
  })
})
