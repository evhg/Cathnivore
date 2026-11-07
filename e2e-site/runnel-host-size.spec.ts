import { expect, test } from '@playwright/test'

// Plan item 268: at D Cath stands as large as the valley's corner allows while her line still finds room beside her
// (she was fixed at 104-128 px wide, her face about 35 px). In the lesson's sparse board she stands 200 px wide.
for (const [q, min] of [['?lesson', 190], ['?nohelp', 128]] as const) {
  test(`desktop host at ${q}: large, clear of the tiles, her line beside her`, async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1100, 'the desktop valley figure')
    await page.goto(`/runnel/${q}`)
    const cath = page.locator('#valley-cath')
    await expect(cath).toBeVisible()
    await page.waitForTimeout(1200)
    const m = await page.evaluate(() => {
      const c = document.getElementById('valley-cath')!.getBoundingClientRect()
      return { w: c.width, say: document.querySelector<HTMLElement>('.app')!.dataset.valleySay, scroll: document.scrollingElement!.scrollHeight - innerHeight }
    })
    expect(m.w).toBeGreaterThanOrEqual(min)
    expect(m.say).not.toBe('side')
    expect(m.scroll).toBeLessThanOrEqual(0)
  })
}

// ...and on a short desktop (1280x800) a daily whose line comes back to the rail doesn't scroll the page.
test('1280x800 daily: no page scroll', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1100, 'the desktop valley figure')
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/runnel/?nohelp')
  await expect(page.locator('#valley-cath')).toBeVisible()
  await page.waitForTimeout(1200)
  expect(await page.evaluate(() => document.scrollingElement!.scrollHeight - innerHeight)).toBeLessThanOrEqual(0)
})
