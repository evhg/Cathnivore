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

// Plan item 98: the gate sign's town name read about 9 px at D and edge on from a phone's high camera. The board
// faces the camera and its letters stand 8.5 px or more (about 12 px type) at P and D.
type HGS = HG & { gateSigns(): Array<{ x: number; y: number; cap: number }> | null }
test('the 3D gate sign reads at 12 px type or more (level 21)', async ({ page }) => {
  await page.goto('/hedgerow/?sandbox=1')
  await page.evaluate(() => {
    const stars: Record<string, number> = {}
    for (let i = 1; i < 21; i++) stars[String(i)] = 3
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { '21': true }, seen: {}, tips: { all: true } }))
  })
  await page.goto('/hedgerow/?sandbox=1&level=21')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HGS }).hedgerow?.game(), null, { timeout: 60_000 })
  await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow: HGS }).hedgerow.gateSigns()?.length ?? 0), { timeout: 60_000 }).toBeGreaterThan(0)
  await page.waitForTimeout(1500)
  const signs = (await page.evaluate(() => (window as unknown as { hedgerow: HGS }).hedgerow.gateSigns()))!
  const vp = page.viewportSize()!
  const seen = signs.filter((s) => s.x >= 0 && s.x <= vp.width && s.y >= 0 && s.y <= vp.height)
  expect(seen.length).toBeGreaterThan(0)
  for (const s of seen) expect(s.cap).toBeGreaterThanOrEqual(8.4)
})
