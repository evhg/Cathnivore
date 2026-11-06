import { expect, test } from '@playwright/test'

// Plan item 193: the week's big valley. The Weekly tab opens a board 2-3x the daily's, the whole of it on the
// first screen with no page scroll; a turn survives a reload; a solve shows the win card.
test('the Weekly tab plays the big valley: whole board in view, progress kept, a win card', async ({ page }) => {
  await page.goto('/runnel/?nohelp')
  await page.waitForSelector('#board .tiles > g.cell')
  const daily = await page.locator('#board .tiles > g.cell').count()
  await page.locator('#tab-weekly').click()
  await expect(page.locator('#tab-weekly')).toHaveAttribute('aria-selected', 'true')
  const cells = page.locator('#board .tiles > g.cell')
  await expect.poll(() => cells.count()).toBeGreaterThanOrEqual(daily * 2)
  await page.waitForTimeout(500)
  const m = await page.evaluate(() => {
    const ts = [...document.querySelectorAll('#board polygon.tile')].map((t) => t.getBoundingClientRect())
    return {
      scroll: document.scrollingElement!.scrollHeight - innerHeight,
      top: Math.min(...ts.map((t) => t.top)),
      bottom: Math.max(...ts.map((t) => t.bottom)),
      left: Math.min(...ts.map((t) => t.left)),
      right: Math.max(...ts.map((t) => t.right)),
    }
  })
  const vp = page.viewportSize()!
  expect(m.scroll).toBeLessThanOrEqual(1)
  expect(m.top).toBeGreaterThanOrEqual(0)
  expect(m.left).toBeGreaterThanOrEqual(0)
  expect(m.bottom).toBeLessThanOrEqual(vp.height)
  expect(m.right).toBeLessThanOrEqual(vp.width)
  // A turn is kept across a reload.
  const free = page.locator('#board .tiles > g.cell:not(.spring):not(.fixed):not(.stone):not(.reservoir)').first()
  await free.click()
  await expect(page.locator('#hud-taps')).toHaveText('1')
  await page.goto('/runnel/?nohelp&mode=sunday')
  await page.waitForSelector('#board .tiles > g.cell')
  await expect(page.locator('#hud-taps')).toHaveText('1')
  // A solve shows the win card.
  await page.evaluate(() => (window as unknown as { runnelTest: { nearlySolve: () => void } }).runnelTest.nearlySolve())
  await page.locator('#board [data-last]').click()
  await expect(page.locator('#win-strip')).toBeVisible({ timeout: 8_000 })
  await expect(page.locator('#strip-eyebrow')).toContainText('big valley')
  await expect(page.locator('#tab-weekly')).toHaveAttribute('data-state', 'watered')
  // Its own line on the almanac's stats page.
  await page.locator('#btn-stats').click()
  await expect(page.locator('#stat-grid')).toContainText('big valley, watered')
})
