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
  // The region is outlined on the board while its sheet is up.
  await expect(hex).toHaveClass(/inspected/)
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

// Plan item 109: an action that can target the region is offered in its sheet and goes to its confirm step.
test('the close-up offers this turn\'s actions on the region', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'phone layout only')
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.map').waitFor()
  // Try regions until one offers an action this turn (the opening turn can open a stall somewhere).
  const ids = await page.locator('.region-hex').evaluateAll((els) => els.map((e) => (e as SVGGElement).dataset.region!))
  for (const id of ids) {
    await page.locator(`.region-hex[data-region="${id}"] .region-inspect`).focus()
    await page.keyboard.press('Enter')
    const sheet = page.locator('.region-closeup')
    await expect(sheet).toBeVisible()
    const act = sheet.locator('.region-closeup-action')
    if ((await act.count()) > 0) {
      await act.first().click()
      await expect(sheet).toBeHidden()
      await expect(page.locator(`.region-hex[data-region="${id}"]`)).toHaveClass(/glow/)
      return
    }
    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
  }
  throw new Error('no region offered an action on the first turn')
})
