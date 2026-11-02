import { describe, expect, it } from 'vitest'
import { gardenPlots, gardenVisitor, GARDEN_SIZE } from '../games/runnel/src/garden'

const r = (taps: number) => ({ number: 1, timeMs: 1000, taps, par: 10 })

describe('runnel garden', () => {
  it('grows crops with age and marks par wins gold', () => {
    const plots = gardenPlots({ '2026-10-01': r(10), '2026-10-28': r(12), '2026-10-30': r(9) }, '2026-10-30')
    expect(plots.map((p) => p.stage)).toEqual(['ripe', 'growing', 'sprout'])
    expect(plots.map((p) => p.gold)).toEqual([true, false, true])
  })
  it('keeps only the newest plots and is deterministic', () => {
    const res: Record<string, ReturnType<typeof r>> = {}
    for (let i = 1; i <= 28; i++) res[`2026-09-${String(i).padStart(2, '0')}`] = r(10)
    for (let i = 1; i <= 20; i++) res[`2026-10-${String(i).padStart(2, '0')}`] = r(10)
    const a = gardenPlots(res, '2026-10-30')
    expect(a).toHaveLength(GARDEN_SIZE)
    expect(gardenPlots(res, '2026-10-30')).toEqual(a)
  })
  it('a visitor arrives once there are three crops', () => {
    expect(gardenVisitor('autumn', [])).toBeNull()
    const three = gardenPlots({ '2026-10-01': r(9), '2026-10-02': r(9), '2026-10-03': r(9) }, '2026-10-30')
    expect(gardenVisitor('autumn', three)?.line).toMatch(/hedgehog/)
  })
})

describe('runnel garden art (plan item 37)', () => {
  it('draws every crop in three distinct stages, with the plot\'s own crop', async () => {
    const { CROP_IDS, cropStages, cropSvg, STAGES } = await import('../games/runnel/src/gardenart')
    for (const crop of CROP_IDS) {
      const stages = cropStages(crop)
      expect(new Set(stages).size, crop).toBe(3)
      for (const st of STAGES) expect(cropSvg(crop, st)).toMatch(/^<svg class="ga ga-/)
    }
    const plots = gardenPlots({ '2026-10-01': r(10) }, '2026-10-30')
    expect(CROP_IDS).toContain(plots[0]!.crop)
  })
  it('uses no platform emoji in the garden, its visitors or the event crops', async () => {
    const art = await import('../games/runnel/src/gardenart')
    const { eventCrops } = await import('../games/runnel/src/events')
    const all = [
      ...art.CROP_IDS.flatMap((c) => art.STAGES.map((s) => art.cropSvg(c, s))),
      ...(['lamb', 'butterfly', 'hedgehog', 'robin'] as const).map((v) => art.visitorSvg(v)),
      art.eventCropSvg('blossom'),
      art.eventCropSvg('giantPumpkin'),
      JSON.stringify(eventCrops(['spring-2026', 'autumn-2026'])),
      JSON.stringify(gardenVisitor('spring', gardenPlots({ a: r(1), b: r(1), c: r(1) } as never, '2026-10-30'))),
    ].join('')
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u)
  })
})
