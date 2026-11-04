import { describe, expect, it } from 'vitest'
import { liftKeyframes } from '../src/ui/playLift'

// Plan item 83: a played card lifts, then sets down at its target; under reduced motion it only fades.
describe('liftKeyframes', () => {
  const card = { x: 20, y: 700, width: 150, height: 96 }
  it('rises first, then ends on the target, shrunk and faded', () => {
    const k = liftKeyframes(card, { x: 195, y: 300 }, false)
    expect(k).toHaveLength(3)
    expect(k[1]!.transform).toMatch(/scale\(1\.06\)/)
    // centre (95, 748) to (195, 300): dx 100, dy -448
    expect(k[2]!.transform).toContain('translate(100px, -448px)')
    expect(k[2]!.opacity).toBe(0)
    // the lift goes up from the card before it travels
    const mid = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(String(k[1]!.transform))!
    expect(Number(mid[2])).toBeLessThan(-448 * 0.3)
  })
  it('fades in place under reduced motion or with no target', () => {
    for (const k of [liftKeyframes(card, { x: 0, y: 0 }, true), liftKeyframes(card, null, false)]) {
      expect(k).toHaveLength(2)
      expect(k.every((f) => !String(f.transform).includes('scale'))).toBe(true)
      expect(k[1]!.opacity).toBe(0)
    }
  })
})
