import { describe, expect, it } from 'vitest'
import { barkSpot, reachOf } from '../games/hedgerow/src/cathsay'
import { gapAdvice } from '../games/hedgerow/src/advice'
import { LEVELS } from '../games/hedgerow/src/levels'
import { TOWERS } from '../games/hedgerow/src/engine'

// Plan item 95: Cath's advice bubble stays within reach of her and off the lane; her line names the gap first.
type Box = { x: number; y: number; w: number; h: number }
const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

describe('barkSpot', () => {
  const cath = { x: 300, y: 300, w: 40, h: 60 }
  const centre = { x: 320, y: 330 }
  const size = { w: 200, h: 64 }
  const field = { w: 1000, h: 800 }

  it('goes above her head when nothing is in the way, tail down', () => {
    const s = barkSpot(cath, size, field, [])
    expect(s.y + s.h).toBeLessThanOrEqual(cath.y)
    expect(s.side).toBe('bottom')
    expect(reachOf(s, centre)).toBeLessThanOrEqual(100)
  })

  it('moves off a lane that runs over her head when a clear spot is in reach', () => {
    // A horizontal lane band above her and a vertical one through her (she stands on the lane).
    const lanes: Box[] = []
    for (let x = 0; x < 1000; x += 64) lanes.push({ x, y: 200, w: 64, h: 64 })
    for (let y = 0; y < 800; y += 64) lanes.push({ x: 290, y, w: 64, h: 64 })
    const s = barkSpot(cath, size, field, lanes)
    for (const l of lanes) expect(hit(s, l), JSON.stringify({ s, l })).toBe(false)
    expect(reachOf(s, centre)).toBeLessThanOrEqual(100)
    expect(hit(s, cath)).toBe(false)
  })

  it('never leaves the field, even with Cath at its corner', () => {
    const s = barkSpot({ x: 2, y: 2, w: 30, h: 40 }, size, { w: 390, h: 600 }, [])
    expect(s.x).toBeGreaterThanOrEqual(6)
    expect(s.y).toBeGreaterThanOrEqual(6)
    expect(s.x + s.w).toBeLessThanOrEqual(390)
  })

  it('keeps off the gate queue before the lane, and off her figure', () => {
    const plate = { x: 200, y: 200, w: 240, h: 90 }
    // Lane tiles fill every spot in reach except over the queue: the bubble takes the lane, not the queue.
    const lanes: Box[] = []
    for (let x = 0; x < 1000; x += 64) for (let y = 0; y < 800; y += 64) lanes.push({ x, y, w: 64, h: 64 })
    const s = barkSpot(cath, size, field, lanes, [], [plate])
    expect(hit(s, plate)).toBe(false)
    expect(hit(s, cath)).toBe(false)
    expect(reachOf(s, centre)).toBeLessThanOrEqual(116)
  })
})

describe('gapAdvice', () => {
  const cost = (k: keyof typeof TOWERS) => TOWERS[k].cost

  it('is null when the field answers everything', () => {
    expect(gapAdvice([], ['scarecrow'], cost)).toBeNull()
  })

  it('names a tower in the kit that holds the key, in one short line', () => {
    const kit = LEVELS.find((l) => l.id === 21)!.towers
    const line = gapAdvice(['airborne'], kit, cost)!
    expect(line).toMatch(/air/)
    const named = kit.filter((k) => line.includes(TOWERS[k].name))
    expect(named.length).toBe(1)
    expect(line.split(/\s+/).length).toBeLessThanOrEqual(16)
  })

  it('says what to do when the kit has no key', () => {
    expect(gapAdvice(['airborne'], [], cost)).toMatch(/can't/)
  })
})
