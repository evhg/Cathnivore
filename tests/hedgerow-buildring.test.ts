import { describe, expect, it } from 'vitest'
import { boxesMeet, ringLayout, type Box } from '../games/hedgerow/src/buildring'

// Plan item 156: the build ring's packets round a tapped plot.
const SIZE = 52
const box = (p: { x: number; y: number }): Box => ({ x: p.x - SIZE / 2, y: p.y - SIZE / 2, w: SIZE, h: SIZE })
const within = (b: Box, o: Box) => b.x >= o.x && b.y >= o.y && b.x + b.w <= o.x + o.w && b.y + b.h <= o.y + o.h

function check(at: { x: number; y: number }, half: number, n: number, bounds: Box) {
  const lay = ringLayout(at, half, n, SIZE, bounds)
  const plot = { x: at.x - half, y: at.y - half, w: half * 2, h: half * 2 }
  expect(lay.spots).toHaveLength(n)
  for (const [i, p] of lay.spots.entries()) {
    expect(within(box(p), bounds)).toBe(true)
    expect(boxesMeet(box(p), plot)).toBe(false)
    for (const q of lay.spots.slice(i + 1)) expect(boxesMeet(box(p), box(q))).toBe(false)
  }
  return lay
}

describe('build ring layout', () => {
  const phone = { x: 0, y: 60, w: 390, h: 560 }
  it('is a full circle in open ground', () => {
    const lay = check({ x: 195, y: 340 }, 18, 6, phone)
    expect(lay.span).toBeCloseTo(Math.PI * 2)
  })
  it('turns inward at every edge and corner of a phone field, nine packets', () => {
    for (const at of [
      { x: 20, y: 340 }, { x: 370, y: 340 }, { x: 195, y: 80 }, { x: 195, y: 600 },
      { x: 20, y: 80 }, { x: 370, y: 600 }, { x: 20, y: 600 }, { x: 370, y: 80 },
    ]) {
      const lay = check(at, 18, 9, phone)
      expect(lay.span).toBeLessThan(Math.PI * 2)
      // It faces into the field.
      const mx = phone.x + phone.w / 2 - at.x, my = phone.y + phone.h / 2 - at.y
      expect(Math.cos(lay.facing) * mx + Math.sin(lay.facing) * my).toBeGreaterThan(0)
    }
  })
  it('keeps a desktop plot clear with big cells', () => {
    check({ x: 700, y: 450 }, 40, 9, { x: 0, y: 0, w: 1080, h: 860 })
    check({ x: 40, y: 40 }, 40, 9, { x: 0, y: 0, w: 1080, h: 860 })
  })
})
