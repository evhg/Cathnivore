import { expect, test } from '@playwright/test'

// Plan item 710: on level 27 the 3D depot stood off the canvas's left edge (D 205 px wide at x -36, P 78 px at x -37,
// half of it). The fitted view steps back until every depot stands whole inside the canvas, as item 591 does for its top.
type Box = { x: number; y: number; w: number; h: number }
type HG = { game(): unknown; depots3d(): Box[] }
for (const level of [27, 21]) {
  test(`every 3D depot stands whole in the fitted view (level ${level})`, async ({ page }) => {
    test.setTimeout(180_000)
    await page.goto('/hedgerow/?sandbox=1')
    await page.evaluate((l) => {
      const stars: Record<string, number> = {}
      for (let i = 1; i < l; i++) stars[String(i)] = 3
      localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { [String(l)]: true }, seen: {}, tips: { all: true } }))
    }, level)
    await page.goto(`/hedgerow/?sandbox=1&level=${level}`)
    await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 60_000 })
    await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.depots3d().length), { timeout: 60_000 }).toBeGreaterThan(0)
    await page.waitForTimeout(2500)
    const r = await page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>('#canvas')!
      return { depots: (window as unknown as { hedgerow: HG }).hedgerow.depots3d(), w: c.clientWidth }
    })
    await page.screenshot({ path: `e2e/screenshots/r710/l${level}-3d-${page.viewportSize()!.width < 600 ? 'P' : 'D'}.png` })
    for (const d of r.depots) {
      expect(d.x, `depot ${JSON.stringify(d)} left edge`).toBeGreaterThanOrEqual(-1)
      expect(d.x + d.w, `depot ${JSON.stringify(d)} right edge`).toBeLessThanOrEqual(r.w + 1)
    }
  })
}
