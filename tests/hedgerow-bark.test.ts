import { describe, expect, it } from 'vitest'
import { BARK_GAP, BarkGate, COMBO_KNOCKS, barkCorner, barkLine } from '../games/hedgerow/src/bark'

// Plan item 713: Cath's battle lines: at most one every 8 s, a combo is a run of knocks, the corner keeps off the
// lane and never sits on the rack, Go or a plate.
type Box = { x: number; y: number; w: number; h: number }
const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

describe('BarkGate', () => {
  it('speaks at most once every 8 s', () => {
    const g = new BarkGate()
    expect(g.speak('leak', 10)).not.toBeNull()
    expect(g.speak('boss', 10 + BARK_GAP - 0.1)).toBeNull()
    expect(g.speak('boss', 10 + BARK_GAP)).not.toBeNull()
  })
  it('does not repeat the same line for the same moment twice running', () => {
    const g = new BarkGate()
    const a = g.speak('combo', 0)!
    const b = g.speak('combo', BARK_GAP)!
    expect(a.text).not.toBe(b.text)
    expect(a.face).toBe('delighted')
  })
  it('counts a combo once for a run of knocks in the window', () => {
    const g = new BarkGate()
    const hits = Array.from({ length: COMBO_KNOCKS }, (_, i) => g.knock(i * 0.2))
    expect(hits.filter(Boolean)).toHaveLength(1)
    expect(hits.at(-1)).toBe(true)
    // Slow knocks never make one.
    const slow = new BarkGate()
    expect(Array.from({ length: 10 }, (_, i) => slow.knock(i * 2)).some(Boolean)).toBe(false)
  })
  it('a leak is worried, a boss determined', () => {
    expect(barkLine('leak', 0).face).toBe('worried')
    expect(barkLine('boss', 7).face).toBe('determined')
  })
})

describe('barkCorner', () => {
  const field = { x: 0, y: 0, w: 1000, h: 800 }
  const size = { w: 260, h: 60 }
  it('takes the corner clear of the lane', () => {
    // The lane fills the top band and the left column.
    const lane: Box[] = []
    for (let x = 0; x < 1000; x += 50) lane.push({ x, y: 0, w: 50, h: 120 })
    for (let y = 0; y < 800; y += 50) lane.push({ x: 0, y, w: 300, h: 50 })
    const b = barkCorner(field, size, lane, [])
    for (const l of lane) expect(hit(b, l), JSON.stringify({ b, l })).toBe(false)
    expect(b.x).toBeGreaterThan(300)
  })
  it('never sits on a hard box even when that costs lane', () => {
    const lane: Box[] = [{ x: 0, y: 0, w: 1000, h: 100 }]
    // The rack along the bottom.
    const rack = { x: 0, y: 680, w: 1000, h: 120 }
    const b = barkCorner(field, size, lane, [rack])
    expect(hit(b, rack)).toBe(false)
  })
  it('stays inside the field with its inset', () => {
    const b = barkCorner({ x: 100, y: 50, w: 390, h: 500 }, { w: 300, h: 56 }, [], [])
    expect(b.x).toBeGreaterThanOrEqual(108)
    expect(b.x + b.w).toBeLessThanOrEqual(482)
    expect(b.y).toBeGreaterThanOrEqual(58)
  })
})
