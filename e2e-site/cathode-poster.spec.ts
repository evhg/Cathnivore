import { expect, test } from '@playwright/test'

// Plan item 65: the front door is a scene from the first frame. The baked poster of the street is showing within a
// second of load, with WebGL or without it; with WebGL it hands over to the live street (never a frame with neither).
for (const webgl of [false, true])
  test(`the poster shows at once ${webgl ? 'and hands over to the street' : 'without WebGL'}`, async ({ page, hasTouch }) => {
    test.skip(hasTouch && webgl, 'one live hand-over run is enough')
    test.setTimeout(300_000)
    await page.addInitScript((gl) => {
      localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' }))
      if (!gl) {
        const orig = HTMLCanvasElement.prototype.getContext
        HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
          return /webgl/.test(kind) ? null : (orig as (...a: unknown[]) => unknown).call(this, kind, ...rest)
        } as typeof orig
      }
    }, webgl)
    const t0 = Date.now()
    await page.goto('/nightshift/', { waitUntil: 'commit' })
    const img = page.locator('#front-poster img')
    await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0), { timeout: 5_000 }).toBe(true)
    await expect(page.locator('#front-fallback')).toBeVisible()
    expect(Date.now() - t0).toBeLessThan(webgl ? 8_000 : 5_000)
    if (!webgl) return
    // While the poster fades out the street must already be drawing.
    await page.waitForFunction(() => document.getElementById('front-fallback')?.classList.contains('is-off'), null, { timeout: 280_000 })
    expect(await page.evaluate(() => (window as unknown as { cathodeFront?: { scene(): { stats: { frames: number } } | null } }).cathodeFront?.scene()?.stats.frames ?? 0)).toBeGreaterThan(0)
  })
