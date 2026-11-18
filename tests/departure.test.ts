import { describe, expect, it } from 'vitest'
import { departFrame, departureOn } from '../src/ui/departure'

// Plan item 483: the campaign's departure frames the chapter's homes and steps Cath toward them.
describe('departFrame', () => {
  const map = { left: 100, top: 50, width: 600, height: 500 }
  it('scales about the homes centre, in px from the map corner', () => {
    const f = departFrame([{ left: 300, top: 200, width: 100, height: 100 }], map)
    expect(f.x).toBe(250)
    expect(f.y).toBe(200)
    expect(f.scale).toBe(3)
    expect([f.dx, f.dy]).toEqual([35, 35])
  })
  it('keeps two far-apart homes in frame with a gentler zoom, never under 1.4', () => {
    const f = departFrame([{ left: 120, top: 60, width: 100, height: 100 }, { left: 560, top: 400, width: 100, height: 100 }], map)
    expect(f.scale).toBe(1.4)
    expect(f.x).toBe(290)
  })
  it('steps Cath toward the homes, at most 56 px', () => {
    const homes = [{ left: 600, top: 200, width: 80, height: 80 }]
    expect(departFrame(homes, map, { left: 0, top: 0, width: 100, height: 300 }).step).toBe(56)
    expect(departFrame(homes, map, { left: 640, top: 0, width: 20, height: 300 }).step).toBe(-2)
  })
  it('falls back to the map centre with no homes', () => {
    expect(departFrame([], map)).toEqual({ x: 300, y: 250, scale: 1.4, step: 0, dx: 0, dy: 0 })
  })
})

describe('departureOn', () => {
  it('plays for people, and for webdriver only with ?depart', () => {
    expect(departureOn('', false)).toBe(true)
    expect(departureOn('', true)).toBe(false)
    expect(departureOn('?depart', true)).toBe(true)
  })
})
