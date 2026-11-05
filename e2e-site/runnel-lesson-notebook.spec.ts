import { expect, test } from '@playwright/test'

// Plan item 176: at D the lesson panel is a field-notebook page: each legend tile an inked glyph (28 px or more),
// a finished step ticked (data-ticked), Up next pinned with the daily's weekday, and the page never scrolls.
test('the lesson panel is a notebook page', async ({ page }) => {
  test.skip(page.viewportSize()!.width < 1100, 'the notebook is the desktop column')
  await page.goto('/runnel/?lesson')
  await page.waitForSelector('#board .tiles > g.cell.lesson-target')
  const panel = page.locator('.lesson-panel[data-notebook]')
  await expect(panel).toBeVisible()
  const glyphs = panel.locator('.lc-legend li .lc-ink')
  await expect(glyphs).toHaveCount(3)
  for (const g of await glyphs.all()) {
    const b = (await g.boundingBox())!
    expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(28)
  }
  await expect(panel.locator('.lc-steps li[data-ticked]')).toHaveCount(0)
  await page.locator('#board .tiles > g.cell.lesson-target').click()
  await expect(panel.locator('.lc-steps li[data-ticked]')).toHaveCount(1)
  await expect(panel.locator('.lc-steps li').first()).toHaveAttribute('data-ticked', '')
  if (page.viewportSize()!.height >= 880) await expect(panel.locator('.lc-next small')).toContainText(/day$/i)
  const scrolls = await page.evaluate(() => document.scrollingElement!.scrollHeight > innerHeight + 1)
  expect(scrolls).toBe(false)
})
