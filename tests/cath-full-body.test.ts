import { describe, expect, it } from 'vitest'
import { cathSvg, CATH_POSES, LEG_K } from '../shared/cath/cath'

// Plan item 292: full-length Cath is a grown woman's figure: legs 45% or more of her height, standing on the ground,
// in every pose and outfit.
describe('Cath full-body figure (plan item 292)', () => {
  const svg = cathSvg({ framing: 'full' })
  const [, top, , h] = svg.match(/viewBox="([-\d. ]+)"/)![1]!.split(' ').map(Number) as [number, number, number, number]
  it('her legs are 45% or more of her height (hip line at 490 to the soles)', () => {
    const soles = 878 + (812 - 490) * (LEG_K - 1)
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
  // Plan item 442: at full length her head is drawn at FULL_HEAD about the collar (200, 262). Plan item 524: with the
  // legs stretched by LEG_K below the hip she is about 7.5 heads tall (13-15% of her height), a fashion figure (it
  // was 18%, a paper doll's).
  it('at full length her head is 13-15% of her height', async () => {
    const { FULL_HEAD, FULL_SOLES } = await import('../shared/cath/cath')
    const crown = 262 - (262 - 60) * FULL_HEAD
    const chin = 262 - (262 - 228) * FULL_HEAD
    const r = (chin - crown) / (FULL_SOLES - crown)
    expect(r).toBeGreaterThanOrEqual(0.13)
    expect(r).toBeLessThanOrEqual(0.15)
    expect(cathSvg({ framing: 'full' })).toContain(`scale(${FULL_HEAD})`)
    expect(cathSvg({ framing: 'half' })).not.toContain(`scale(${FULL_HEAD})`)
  })
  it('her soles stand inside the full viewBox', async () => {
    const { FULL_SOLES } = await import('../shared/cath/cath')
    expect(FULL_SOLES + 12).toBeLessThanOrEqual(top + h)
  })
  for (const pose of ['clasped', 'point', 'cheer', 'walk'] as const)
    it(`stands on a ground shadow in the '${pose}' pose`, () => expect(cathSvg({ framing: 'full', pose })).toContain('class="cath-ground"'))
  // Plan item 551: camel, a step darker than item 305's cream (lightness under 0.6, so the trouser parts from her
  // skin and the paper), still not near-black.
  it('her default trousers are a tailored camel, not cream and not near-black', () => {
    const s = cathSvg({ framing: 'full' })
    // (the boots draw first, under the hems: the trouser is the first fill with the 2-unit seam line)
    const fill = s.match(/class="cath-lower">[\s\S]*?<path fill="(#[0-9A-Fa-f]{6})" stroke="#[0-9A-Fa-f]{6}" stroke-width="2"/)![1]!
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(fill.slice(i, i + 2), 16)) as [number, number, number]
    expect(0.2126 * r + 0.7152 * g + 0.0722 * b).toBeGreaterThan(110)
    expect((Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255).toBeLessThan(0.6)
  })
  // Plan item 551: a straight-leg trouser at least 1.4x the old tapered leg's width at the knee (y 700: 29 and 25
  // units), and every full figure names its legwear.
  it('her trousers are straight-leg: 1.4x the old leg at the knee', () => {
    const s = cathSvg({ framing: 'full' })
    const legs = [...s.matchAll(/<path fill="#AE8A5C" stroke="#5E4428" stroke-width="2" stroke-linejoin="round" d="([^"]+)"/g)].map((m) => m[1]!)
    expect(legs.length).toBe(2)
    // the x extent of each leg's outline points between y 640 and 760 (the knee band)
    const width = (d: string) => {
      const nums = d.match(/-?[\d.]+/g)!.map(Number)
      const xs: number[] = []
      for (let i = 0; i + 1 < nums.length; i += 2) if (nums[i + 1]! >= 600 && nums[i + 1]! <= 760) xs.push(nums[i]!)
      return Math.max(...xs) - Math.min(...xs)
    }
    expect(width(legs[0]!)).toBeGreaterThanOrEqual(29 * 1.4)
    expect(width(legs[1]!)).toBeGreaterThanOrEqual(25 * 1.4)
  })
  for (const pose of CATH_POSES)
    it(`names its legwear in the '${pose}' pose`, () => expect(cathSvg({ framing: 'full', pose })).toMatch(/data-cath-legwear="(trousers|skirt)"/))
  it('the bust names no legwear', () => expect(cathSvg({ framing: 'bust' })).not.toContain('data-cath-legwear'))
})

// Plan item 524: every Cath carries her pose and framing on the root, so a screen's pose can be checked in e2e.
describe('pose attributes', () => {
  it('names the pose and framing on the svg', () => {
    const s = cathSvg({ framing: 'full', pose: 'wave' })
    expect(s).toContain('data-pose="wave"')
    expect(s).toContain('data-framing="full"')
    expect(cathSvg()).toContain('data-pose="clasped"')
  })
})

// Plan item 524: a hand-on-hip pose, and at full length the whole figure in one group the idle rocks about her soles.
describe('full-length stance', () => {
  it('has a hip pose with the elbow out past her coat', () => {
    const s = cathSvg({ framing: 'full', pose: 'hip' })
    expect(s).toContain('data-pose="hip"')
    expect(s).toContain('Q306 326 320 366')
  })
  it('wraps the full figure for the weight-shift idle; the bust has none', () => {
    expect(cathSvg({ framing: 'full', animate: true })).toContain('class="cath-figure"')
    expect(cathSvg({ framing: 'bust', animate: true })).not.toContain('cath-figure')
  })
})
