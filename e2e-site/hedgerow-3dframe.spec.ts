import { expect, test } from '@playwright/test'

// Plan item 78: in 3D the camera is fitted to the field, so the field's projected box (at the fitted view, before
// any zoom or pan) fills at least 65% of the canvas on a phone and on a desktop.
type HG = { game(): unknown; fieldShare(): number | null }
for (const level of [13, 21]) {
  test(`the 3D field fills its frame (level ${level})`, async ({ page }) => {
    await page.goto('/hedgerow/?sandbox=1')
    await page.evaluate((l) => {
      const stars: Record<string, number> = {}
      for (let i = 1; i < l; i++) stars[String(i)] = 3
      localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { [String(l)]: true }, seen: {}, tips: { all: true } }))
    }, level)
    await page.goto(`/hedgerow/?sandbox=1&level=${level}`)
    await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 60_000 })
    const share = await expect
      .poll(() => page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.fieldShare()), { timeout: 60_000 })
      .not.toBeNull()
      .then(() => page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.fieldShare()))
    expect(share!).toBeGreaterThanOrEqual(0.65)
  })
}
