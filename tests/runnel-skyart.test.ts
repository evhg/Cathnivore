import { describe, expect, it } from 'vitest'
import { skyArt, skyFor } from '../games/runnel/src/sky'

// Plan item 70: the day card paints the board's own sky: the hour's sun (a moon at dusk) and the day's weather.
describe('Runnel sky art', () => {
  it('draws a moon at dusk and a sun otherwise', () => {
    expect(skyArt({ time: 'dusk', weather: 'clear', label: '' })).toContain('sk-moon')
    expect(skyArt({ time: 'noon', weather: 'clear', label: '' })).toContain('sk-sun')
  })
  it('draws the weather it names', () => {
    expect(skyArt({ time: 'morning', weather: 'drizzle', label: '' })).toContain('sk-rain')
    expect(skyArt({ time: 'morning', weather: 'clouds', label: '' })).toContain('sk-cloud')
    expect(skyArt({ time: 'morning', weather: 'breeze', label: '' })).toContain('sk-breeze')
    expect(skyArt({ time: 'morning', weather: 'clear', label: '' })).not.toMatch(/sk-(rain|cloud|breeze)/)
  })
  it("matches the board's sky for a seed", () => {
    const sky = skyFor('daily-2026-11-08')
    const art = skyArt(sky)
    expect(art).toContain(`data-time="${sky.time}"`)
    expect(art).toContain(`data-weather="${sky.weather}"`)
  })
})
