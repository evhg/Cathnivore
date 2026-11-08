import { describe, expect, it } from 'vitest'
import { cathSvg, CATH_POSES } from '../shared/cath/cath'

// Plan item 292: full-length Cath is a grown woman's figure: legs 45% or more of her height, standing on the ground,
// in every pose and outfit.
describe('Cath full-body figure (plan item 292)', () => {
  const svg = cathSvg({ framing: 'full' })
  const [, top, , h] = svg.match(/viewBox="([-\d. ]+)"/)![1]!.split(' ').map(Number) as [number, number, number, number]
  it('her legs are 45% or more of her height (hip line at 490 to the soles)', () => {
    const soles = Math.max(...[...svg.matchAll(/<ellipse cx="\d+" cy="(\d+)"/g)].map((m) => Number(m[1])))
    expect(soles).toBeLessThanOrEqual(top + h)
    expect((soles - 490) / (soles - top)).toBeGreaterThanOrEqual(0.45)
  })
  for (const pose of CATH_POSES)
    it(`draws legs and boots in the '${pose}' pose`, () => {
      const s = cathSvg({ framing: 'full', pose })
      expect(s).toContain('class="cath-lower"')
      expect((s.match(/<path fill="[^"]+" stroke="[^"]+" stroke-width="1\.8"/g) ?? []).length).toBeGreaterThanOrEqual(2)
    })
  it('the half framing has no legs', () => expect(cathSvg({ framing: 'half' })).not.toContain('cath-lower'))
})
