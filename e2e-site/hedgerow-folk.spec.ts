import { expect, test } from '@playwright/test'

// Plan item 143: Bea, the farmhands, the dog and the hens work the farm in the build phase: four or more of them,
// never on a lane cell, some walking; after a leak (the debrief hook) they all run for the farmhouse within 500 ms.
type F = { kind: string; x: number; y: number; mode: string; moving: boolean; onLane: boolean }
type HG = { game(): unknown; folk(): F[]; debrief(kind: string): void }

for (const level of [21, 34]) {
  test(`level ${level}: the farmfolk keep off the lanes and run for the farmhouse on a leak`, async ({ page }) => {
    await page.goto('/hedgerow/?2d&sandbox=1')
    await page.evaluate((l) => {
      const stars = Object.fromEntries(Array.from({ length: l - 1 }, (_, i) => [String(i + 1), 3]))
      localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { [l]: true }, seen: {}, tips: { all: true } }))
    }, level)
    await page.goto(`/hedgerow/?2d&sandbox=1&level=${level}`)
    await page.waitForFunction(() => ((window as unknown as { hedgerow?: HG }).hedgerow?.folk().length ?? 0) > 0, null, { timeout: 60_000 })
    const folk = () => page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.folk())
    const first = await folk()
    expect(first.length).toBeGreaterThanOrEqual(4)
    expect(new Set(first.map((f) => f.kind))).toEqual(new Set(['bea', 'hand', 'dog', 'hen']))
    // A few seconds of the build phase: never on a lane, and someone walks.
    let walked = false
    for (let i = 0; i < 12; i++) {
      const now = await folk()
      expect(now.filter((f) => f.onLane)).toEqual([])
      if (now.some((f, j) => Math.hypot(f.x - first[j]!.x, f.y - first[j]!.y) > 0.3)) walked = true
      await page.waitForTimeout(250)
    }
    expect(walked).toBe(true)
    // A leak: within 500 ms every one of them is running (or already home).
    await page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.debrief('van'))
    await page.waitForTimeout(500)
    const fled = await folk()
    expect(fled.every((f) => f.mode === 'flee' || f.mode === 'home')).toBe(true)
    expect(fled.filter((f) => f.onLane)).toEqual([])
  })
}
