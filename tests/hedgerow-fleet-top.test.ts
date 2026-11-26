import { describe, expect, it } from 'vitest'
import { RUNGS } from '../games/hedgerow/src/fleet'
import { FLEET_TOP, drawnLen, enemyScale } from '../games/hedgerow/src/sprites'

// Plan item 707: the 2D Fleet rungs are drawn from above, one silhouette a class: each class's bounds differ by 20%+
// in aspect ratio from every other's, and their body hues stand 40 degrees+ apart (the white van, with no hue, is
// told apart by its lightness).
const hsl = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255) as [number, number, number]
  const mx = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  const l = (mx + mn) / 2
  const d = mx - mn
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  // chroma (max - min), so a near-white reads as no hue whatever its HSL saturation
  return { h: (h * 60 + 360) % 360, s: sat, c: d, l }
}
const kinds = Object.keys(FLEET_TOP) as Array<keyof typeof FLEET_TOP>

describe('Hedgerow 2D convoy sprites (plan item 707)', () => {
  it('covers the lane rungs', () => expect(kinds.sort()).toEqual(['courier', 'hatchback', 'lorry', 'pickup', 'sprinter', 'van']))
  for (const a of kinds)
    for (const b of kinds)
      if (a < b)
        it(`${a} and ${b} differ by 20%+ in aspect ratio`, () => {
          const ra = FLEET_TOP[a]!.len / FLEET_TOP[a]!.wid
          const rb = FLEET_TOP[b]!.len / FLEET_TOP[b]!.wid
          expect(Math.max(ra, rb) / Math.min(ra, rb)).toBeGreaterThanOrEqual(1.2)
        })
  it('body colours are the rungs\' own, hues 40 degrees+ apart', () => {
    const chroma = kinds.filter((k) => hsl(FLEET_TOP[k]!.body).c >= 0.15)
    expect(chroma.length).toBe(5)
    for (const k of kinds) expect(FLEET_TOP[k]!.body.toLowerCase()).toBe(RUNGS[k]!.colour.toLowerCase())
    for (const a of chroma)
      for (const b of chroma) {
        if (a >= b) continue
        const d = Math.abs(hsl(FLEET_TOP[a]!.body).h - hsl(FLEET_TOP[b]!.body).h)
        expect(Math.min(d, 360 - d), `${a}/${b}`).toBeGreaterThanOrEqual(40)
      }
    // The van: near-white, lighter than every other body by 0.2+.
    for (const k of chroma) expect(hsl(FLEET_TOP.van!.body).l - hsl(FLEET_TOP[k]!.body).l).toBeGreaterThanOrEqual(0.2)
  })
  it('a slot on the lane is the from-above body', () => {
    for (const k of kinds) expect(drawnLen(k)).toBeCloseTo(FLEET_TOP[k]!.len * enemyScale(k), 6)
  })
})
