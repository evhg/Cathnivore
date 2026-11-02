import { describe, expect, it } from 'vitest'
import { bearingTo, headingOf, tapeMarks, tapeTick, wrap } from '../games/cathode/src/ui/compass'

const deg = (r: number) => (r * 180) / Math.PI

describe('NIGHT SHIFT compass tape (plan item 29)', () => {
  it('wraps angles into (-PI, PI]', () => {
    expect(wrap(3 * Math.PI)).toBeCloseTo(Math.PI)
    expect(wrap(-Math.PI / 2)).toBeCloseTo(-Math.PI / 2)
    expect(wrap(2 * Math.PI + 0.1)).toBeCloseTo(0.1)
  })
  it('faces north at yaw 0 and turns the right way', () => {
    expect(headingOf(0)).toBe(0)
    // yaw +PI/2 faces -x (player.ts forward), which is west: 270 degrees, i.e. -90.
    expect(deg(headingOf(Math.PI / 2))).toBeCloseTo(-90)
    expect(deg(bearingTo({ x: 0, z: 0 }, { x: 0, z: -10 }))).toBeCloseTo(0)
    expect(deg(bearingTo({ x: 0, z: 0 }, { x: 10, z: 0 }))).toBeCloseTo(90)
    expect(deg(bearingTo({ x: 0, z: 0 }, { x: -10, z: 0 }))).toBeCloseTo(-90)
  })
  it('puts north in the middle facing north, east to the right', () => {
    const marks = tapeMarks(0)
    expect(marks.find((m) => m.label === 'N')!.x).toBeCloseTo(0)
    expect(marks.find((m) => m.label === 'NE')!.x).toBeGreaterThan(0)
    expect(marks.find((m) => m.label === 'S')).toBeUndefined()
  })
  it('ticks the objective within 5 degrees of its bearing, and pins it to an end when behind', () => {
    const t = tapeTick(headingOf(0), { x: 0, z: 0 }, { x: 3, z: -10 })
    expect(Math.abs(deg(t.rel) - deg(Math.atan2(3, 10)))).toBeLessThan(5)
    expect(t.off).toBe(false)
    const behind = tapeTick(headingOf(0), { x: 0, z: 0 }, { x: -1, z: 10 })
    expect(behind.off).toBe(true)
    expect(behind.x).toBe(-1)
  })
})
