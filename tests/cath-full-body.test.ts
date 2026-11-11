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

  // Plan item 305: the full figure carries the bust's proportions: her head (hair crown at 60 to the chin at 228) is a
  // sixth or more of her height, she has a ground shadow in every pose, and her default trousers aren't near-black.
  it('her head is 15% or more of her height', () => {
    const soles = 878
    expect((228 - 60) / (soles - 60)).toBeGreaterThanOrEqual(0.15)
  })
  for (const pose of ['clasped', 'point', 'cheer', 'walk'] as const)
    it(`stands on a ground shadow in the '${pose}' pose`, () => expect(cathSvg({ framing: 'full', pose })).toContain('class="cath-ground"'))
  it('her default trousers are a light tailored cream, not near-black', () => {
    const s = cathSvg({ framing: 'full' })
    const fill = s.match(/class="cath-lower">[\s\S]*?<path fill="(#[0-9A-Fa-f]{6})"/)![1]!
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(fill.slice(i, i + 2), 16))
    expect(0.2126 * r! + 0.7152 * g! + 0.0722 * b!).toBeGreaterThan(150)
  })
})
