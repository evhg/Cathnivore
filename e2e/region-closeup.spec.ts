import { test, expect } from '@playwright/test'

// Plan item 109: on a phone a tap on a region opens it up close (its hex 300 px or more, its pieces 32 px or more,
// in words), the board's names read at 12 px or more, and Close, Esc or a tap outside returns. Nothing at D.
test('a region tapped on a phone opens up close', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.map').waitFor()
  const phone = testInfo.project.name === 'phone'
  // Hollowell starts with pieces somewhere; open the region holding the most.
  const target = await page.evaluate(() => {
    const hexes = [...document.querySelectorAll<SVGGElement>('.region-hex')]
    hexes.sort((a, b) => Number(b.dataset.enemyPieces) - Number(a.dataset.enemyPieces))
    return hexes[0]!.dataset.region!
  })
  const hex = page.locator(`.region-hex[data-region="${target}"]`)
  if (!phone) {
    await expect(hex.locator('.region-inspect')).toHaveCount(0)
    return
  }
  // The board's region names: 12 px or more on screen.
  const sizes = await page.locator('.map .region-name').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))
  for (const h of sizes) expect(h).toBeGreaterThanOrEqual(12)
  const t0 = Date.now()
  await hex.locator('polygon').first().click({ force: true })
  const sheet = page.locator('.region-closeup')
  await expect(sheet).toBeVisible()
  expect(Date.now() - t0).toBeLessThan(1500)
  await expect(sheet).toHaveAttribute('data-region', target)
  expect((await sheet.locator('.region-closeup-hex').boundingBox())!.width).toBeGreaterThanOrEqual(300)
  const pieces = sheet.locator('.region-closeup-pieces li[data-piece] svg, .region-closeup-pieces li[data-piece] > span:first-child')
  const n = await pieces.count()
  expect(n).toBeGreaterThan(0)
  for (let i = 0; i < n; i++) expect((await pieces.nth(i).boundingBox())!.width).toBeGreaterThanOrEqual(32)
  await page.screenshot({ path: `e2e/screenshots/region-closeup-${testInfo.project.name}.png` })
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  // Keyboard: the region is a button.
  await hex.locator('.region-inspect').focus()
  await page.keyboard.press('Enter')
  await expect(sheet).toBeVisible()
  await sheet.getByRole('button', { name: 'Close' }).click()
  await expect(sheet).toBeHidden()
})
