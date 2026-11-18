// Plan item 485: the day's phase across a level, and the light it drives (sunlight.ts).
import { describe, expect, it } from 'vitest'
import { dayAzFor, dayLamps, dayPhase, dayShadowDir, dayShadowLength, daySunRgb, dayWarmth, DAY_SWING, sunAzFor, sunRgbFor } from '../games/hedgerow/src/sunlight'

describe('dayPhase', () => {
  it('runs from 0 on the first round to 1 on the last, never backwards', () => {
    for (const rounds of [2, 5, 13, 26, 40]) {
      expect(dayPhase(1, rounds)).toBe(0)
      expect(dayPhase(rounds, rounds)).toBe(1)
      let last = -1
      for (let r = 1; r <= rounds; r++) {
        const p = dayPhase(r, rounds)
        expect(p).toBeGreaterThan(last)
        expect(p).toBeGreaterThanOrEqual(0)
        expect(p).toBeLessThanOrEqual(1)
        last = p
      }
    }
  })
  it('holds at the ends and on a one-round level', () => {
    expect(dayPhase(0, 10)).toBe(0)
    expect(dayPhase(12, 10)).toBe(1)
    expect(dayPhase(1, 1)).toBe(0)
    expect(dayPhase(1, 0)).toBe(0)
  })
})

describe('the day light', () => {
  it('swings the sun about the act noon by DAY_SWING either way, 2*DAY_SWING across the day', () => {
    for (const id of [1, 21, 34, 95]) {
      expect(dayAzFor(id, 0.5)).toBe(sunAzFor(id))
      expect(dayAzFor(id, 1) - dayAzFor(id, 0)).toBe(2 * DAY_SWING)
      const a = dayShadowDir(id, 0)
      const b = dayShadowDir(id, 1)
      const turn = (Math.acos(a.x * b.x + a.y * b.y) * 180) / Math.PI
      expect(turn).toBeGreaterThanOrEqual(30)
    }
  })
  it('lengthens shadows toward the ends of the day', () => {
    expect(dayShadowLength(0.5)).toBe(1)
    expect(dayShadowLength(0)).toBeCloseTo(1.8)
    expect(dayShadowLength(1)).toBeCloseTo(1.8)
  })
  it('warms only after noon, fully at dusk, and lights the lamps in the last third', () => {
    expect(dayWarmth(0)).toBe(0)
    expect(dayWarmth(0.5)).toBe(0)
    expect(dayWarmth(1)).toBe(1)
    expect(dayLamps(0.6)).toBe(false)
    expect(dayLamps(0.7)).toBe(true)
    expect(daySunRgb(21, 0)).toBe(sunRgbFor(21))
    expect(daySunRgb(21, 1)).not.toBe(sunRgbFor(21))
  })
})

describe("the 3D dusk lamps (plan item 485)", () => {
  it("lights the farmhouse windows and the depot's neon from day to dusk, and back", async () => {
    const { duskLamps, setDuskLamps } = await import("../games/hedgerow/src/render3d/palette");
    setDuskLamps(0);
    const day = [duskLamps.windows.emissiveIntensity, duskLamps.neon.emissiveIntensity];
    setDuskLamps(1);
    expect(duskLamps.windows.emissiveIntensity).toBeGreaterThan(day[0]! * 2);
    expect(duskLamps.neon.emissiveIntensity).toBeGreaterThan(day[1]! * 3);
    setDuskLamps(0);
    expect([duskLamps.windows.emissiveIntensity, duskLamps.neon.emissiveIntensity]).toEqual(day);
  });
});
