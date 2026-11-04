import { expect, test, type Page } from '@playwright/test'

// Plan item 128: a level's first visit traces its lanes from the Hollowell gate to the farm (2D here; 3D shares it),
// in 3 s or less; a tap or a key skips it at once; it does not play again on a reload.
const seed = async (page: Page, lv: number) => {
  await page.goto('/hedgerow/?2d&sandbox=1')
  await page.evaluate((lv) => {
    const stars = Object.fromEntries(Array.from({ length: lv }, (_, i) => [String(i + 1), 3]))
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { [lv]: true }, seen: {}, tips: { all: true } }))
  }, lv)
}
const flying = (page: Page) => page.evaluate(() => !!document.querySelector('[data-flyin]'))

test('the fly-in traces the lanes in 3 s or less, then Cath names the threat', async ({ page }) => {
  await seed(page, 34)
  await page.goto('/hedgerow/?2d&sandbox=1&flyin=once&level=34')
  await page.waitForFunction(() => !!document.querySelector('[data-flyin]'), null, { timeout: 30_000 })
  expect(await page.locator('.flyin-trail').count()).toBe(2) // level 34 has two gates
  const ms = await page.evaluate(async () => {
    const t0 = performance.now()
    while (document.querySelector('[data-flyin]') && performance.now() - t0 < 6000) await new Promise((r) => setTimeout(r, 20))
    return performance.now() - t0
  })
  expect(ms).toBeLessThanOrEqual(3000)
  await expect(page.locator('#bubble')).toBeVisible()
  await expect(page.locator('#bubble')).toContainText(/gate/i)
  // Seen once: a reload starts the level without it.
  await page.reload()
  await page.waitForTimeout(1500)
  expect(await flying(page)).toBe(false)
})

for (const how of ['tap', 'key'] as const) {
  test(`a ${how} skips the fly-in at once`, async ({ page, hasTouch }) => {
    test.skip(how === 'key' && hasTouch, 'keys are a desktop thing')
    await seed(page, 21)
    await page.goto('/hedgerow/?2d&sandbox=1&flyin&level=21')
    await page.waitForFunction(() => !!document.querySelector('[data-flyin]'), null, { timeout: 30_000 })
    const t0 = Date.now()
    if (how === 'tap') await page.locator('.flyin').click({ position: { x: 40, y: 40 } })
    else await page.keyboard.press('Escape')
    await expect.poll(() => flying(page), { timeout: 150, intervals: [10] }).toBe(false)
    expect(Date.now() - t0).toBeLessThan(400)
  })
}
