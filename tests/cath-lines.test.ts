import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CATH_POSES, cathSvg, type CathExpression, type CathFraming, type CathOutfit } from '../shared/cath/cath'
import { cathLod, cathScale } from '../shared/cath/lines'
import { PINS } from '../shared/cath/pins'

// Plan item 442: her line weight holds at small sizes. Every stroke width she draws between 1 and 3.9 units has a
// floor rule in cath.css (sub-unit and dashed strokes drop out, 4+ are shapes), so at 96 px tall no line is thinner
// than 0.75 px.
const css = readFileSync(new URL('../shared/cath/cath.css', import.meta.url), 'utf8')
const outfits: CathOutfit[] = ['field', 'market', 'wax', 'pinny', 'gown', 'trench']
const framings: CathFraming[] = ['face', 'bust', 'half', 'full']
const expressions: CathExpression[] = ['smirk', 'delighted', 'determined', 'worried', 'wink']

describe("Cath's lines at small sizes (plan item 442)", () => {
  it('every 1-3.9 unit stroke width has a floor rule', () => {
    const widths = new Set<string>()
    const pins = Object.keys(PINS) as (keyof typeof PINS)[]
    for (const outfit of outfits)
      for (const framing of framings)
        for (const pose of [...CATH_POSES, 'walk' as const])
          for (const expression of expressions) {
            const svg = cathSvg({ outfit, framing, pose, expression, pin: pins[(outfit.length + pose.length) % pins.length] })
            for (const m of svg.matchAll(/<(\w+)[^>]*?stroke-width="([0-9.]+)"[^>]*>/g)) {
              if (/stroke-dasharray/.test(m[0])) continue
              const w = Number(m[2])
              if (w >= 1 && w <= 3.9) widths.add(m[2]!)
              expect(w < 1 || w <= 3.9 || w >= 4, `stroke-width ${w} falls between the floored lines and the shapes`).toBe(true)
            }
          }
    expect(widths.size).toBeGreaterThan(5)
    for (const w of widths) expect(css, `no floor rule for stroke-width ${w}`).toContain(`[stroke-width='${w}']`)
  })

  it('the scale is screen px per viewBox unit, letterboxed', () => {
    expect(cathScale(40, 96, '20 20 360 870')).toBeCloseTo(96 / 870)
    expect(cathScale(400, 96, '20 20 360 870')).toBeCloseTo(96 / 870)
    expect(cathScale(0, 96, '20 20 360 870')).toBe(0)
    expect(cathScale(10, 10, 'bad')).toBe(0)
  })

  it('a 96 px full figure is small; a 400 px bust is drawn as authored', () => {
    expect(cathLod(cathScale(40, 96, '20 20 360 870'))).toBe('small')
    expect(cathLod(cathScale(333, 400, '80 36 240 288'))).toBe('full')
    expect(cathLod(0)).toBe('full')
  })

  it('at the floor no line drawn at 96 px is under 0.75 px', () => {
    const s = cathScale(40, 96, '20 20 360 870')
    for (const m of css.matchAll(/max\(calc\(([0-9.]+)px \* var\(--cath-s, 1\)\), ([0-9.]+)px\)/g))
      expect(Math.max(Number(m[1]) * s, Number(m[2]))).toBeGreaterThanOrEqual(0.75)
  })
})
