import { describe, expect, it } from 'vitest'
import { hueSat, luminance, oklch, sceneLight, valleyLayers } from '../games/runnel/src/valley'

// Plan item 77: the valley is lit by the board's time and weather, so the caption and the picture agree.
describe('Runnel valley light', () => {
  const noon = sceneLight({ time: 'noon', weather: 'clear' })
  const dusk = sceneLight({ time: 'dusk', weather: 'clear' })
  it('dusk is darker than midday on the ground and in the sky', () => {
    expect(luminance(noon.meadow) - luminance(dusk.meadow)).toBeGreaterThan(0.15)
    expect(luminance(noon.skyTop) - luminance(dusk.skyTop)).toBeGreaterThan(0.25)
  })
  it('dusk has a different hue: a violet sky over a blue-grey field, not a blue sky over green', () => {
    expect(Math.abs(hueSat(dusk.skyTop).hue - hueSat(noon.skyTop).hue)).toBeGreaterThan(40)
    expect(hueSat(dusk.meadow).sat).toBeLessThan(hueSat(noon.meadow).sat - 0.2)
  })
  it('golden hour is warmer than morning', () => {
    const golden = sceneLight({ time: 'golden', weather: 'clear' })
    const morning = sceneLight({ time: 'morning', weather: 'clear' })
    expect(hueSat(golden.skyTop).hue).toBeLessThan(60)
    expect(hueSat(morning.skyTop).hue).toBeGreaterThan(180)
  })
  it('rain greys the scene and dims it; clouds less so', () => {
    for (const time of ['morning', 'noon', 'golden', 'dusk'] as const) {
      const clear = sceneLight({ time, weather: 'clear' })
      const rain = sceneLight({ time, weather: 'drizzle' })
      const clouds = sceneLight({ time, weather: 'clouds' })
      expect(hueSat(rain.meadow).sat).toBeLessThan(hueSat(clouds.meadow).sat)
      expect(hueSat(clouds.meadow).sat).toBeLessThan(hueSat(clear.meadow).sat)
      expect(luminance(rain.skyTop)).toBeLessThan(luminance(clear.skyTop) + 0.01)
      expect(hueSat(rain.skyTop).sat).toBeLessThan(hueSat(clear.skyTop).sat * 0.5)
    }
  })
})

describe('Runnel valley layers', () => {
  it('paints a patchwork with hedges, trees and the trail, seeded per board', () => {
    const a = valleyLayers('daily-2026-11-04', 'clear')
    expect((a.match(/class="vl-f /g) ?? []).length).toBeGreaterThanOrEqual(15)
    expect(a).toContain('vl-hedge')
    expect(a).toContain('vl-trail')
    expect(a).toContain('vl-tree')
    expect(a).not.toContain('class="vl-rain"')
    expect(valleyLayers('daily-2026-11-05', 'clear')).not.toBe(a)
    expect(valleyLayers('daily-2026-11-04', 'clear')).toBe(a)
  })
  it('draws rain on a drizzly day', () => {
    expect(valleyLayers('x', 'drizzle')).toContain('class="vl-rain"')
  })
  it('a rain day leaves puddles in the near fields; a clear day none', () => {
    expect((valleyLayers('daily-2026-11-07', 'drizzle').match(/class="vl-puddle"/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect(valleyLayers('daily-2026-11-07', 'clear')).not.toContain('class="vl-puddle"')
  })
})

// Plan item 229: whatever the hour and weather the valley stays a picture: its fields keep colour (mean OKLCH chroma
// 0.04 or more) and light (mean L 0.45 or more), and the hedges and trees never sink to a dark hole (L 0.4 or more).
describe('Runnel valley colour floor', () => {
  it('every time and weather keeps chroma and light', () => {
    for (const time of ['morning', 'noon', 'golden', 'dusk'] as const)
      for (const weather of ['clear', 'breeze', 'clouds', 'drizzle'] as const) {
        const l = sceneLight({ time, weather })
        const ks = ['meadow', 'meadowLow', 'crop', 'wheat', 'fallow', 'near'] as const
        const L = ks.reduce((a, k) => a + oklch(l[k]).L, 0) / ks.length
        const C = ks.reduce((a, k) => a + oklch(l[k]).C, 0) / ks.length
        expect(C, `${time} ${weather} chroma`).toBeGreaterThanOrEqual(0.04)
        expect(L, `${time} ${weather} light`).toBeGreaterThanOrEqual(0.45)
        expect(oklch(l.hedge).L, `${time} ${weather} hedge`).toBeGreaterThanOrEqual(0.4)
      }
  })
})
