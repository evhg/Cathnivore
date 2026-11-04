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

test('the fly-in traces the lanes in 3 s or less, then Cath names the threat', async ({ page, hasTouch }) => {
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
  // Her closing word comes from where she stands on the field, placed off the empty plots (item 120's bounds).
  await expect(page.locator('#cath-say')).toBeVisible()
  await expect(page.locator('#cath-say')).toContainText(/gate/i)
  const cover = await page.evaluate(() => {
    type B = { x: number; y: number; w: number; h: number }
    const s = (window as unknown as { hedgerow: { cathSay(): { box: B; empty: B[] } | null } }).hedgerow.cathSay()!
    const on = (a: B, p: B) => Math.max(0, Math.min(a.x + a.w, p.x + p.w) - Math.max(a.x, p.x)) * Math.max(0, Math.min(a.y + a.h, p.y + p.h) - Math.max(a.y, p.y))
    return s.empty.reduce((n, p) => n + on(s.box, p), 0) / (s.box.w * s.box.h)
  })
  expect(cover).toBeLessThanOrEqual(hasTouch ? 0.3 : 0.15)
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
