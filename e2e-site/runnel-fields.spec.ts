import { expect, test } from '@playwright/test'

// Plan item 277: the fields answer the water: a watered field sprouts (in waves after the water reaches it) and a dry
// one shows its cracks, which the water closes.
test('a watered field sprouts and a dry one is cracked', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-03T10:00:00Z'))
  await page.goto('/runnel/?nohelp')
  await expect(page.locator('.tiles > g.cell').first()).toBeVisible()
  // Before any water: every field is dry and cracked, with no shoots.
  const dry = page.locator('.cell.ground-field:not(.wet)').first()
  await expect(dry.locator('.field-cracks')).toHaveCSS('opacity', /^0\.5/)
  await expect(dry.locator('.sprout').first()).toHaveCSS('opacity', '0')
  await page.evaluate(() => (window as unknown as { runnelTest: { nearlySolve: () => void } }).runnelTest.nearlySolve())
  const wet = page.locator('.cell.wet.ground-field[data-wet]').first()
  await expect(wet).toBeVisible()
  // The third wave is up a second after the water: every shoot shows, and the cracks have closed.
  await expect.poll(async () => wet.locator('.sprout').evaluateAll((s) => s.filter((e) => Number(getComputedStyle(e).opacity) > 0.9).length), { timeout: 5000 }).toBe(12)
  await expect(wet.locator('.field-cracks')).toHaveCSS('opacity', '0')
})
