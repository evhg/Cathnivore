import { test, expect } from '@playwright/test'

// Plan item 20 (the board as a diorama): on desktop the board is the hero, at least 62% of the window's
// width, and the Market, Cath's Plan and the Log are a slim rail of drawer keys (SHOTS=1 saves the board
// and an open drawer to e2e/screenshots).
test('desktop board takes 62%+ of the width and the side sheets are drawers', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop layout only')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game').waitFor()

  const board = (await page.locator('.map-wrap').boundingBox())!
  expect(board.width / 1440).toBeGreaterThanOrEqual(0.62)

  // Closed drawers: no sheet on screen; each key opens its own, and a second press or Esc closes it.
  await expect(page.locator('.drawer-panel')).toHaveCount(0)
  const market = page.getByRole('button', { name: /^Market/ })
  await market.click()
  await expect(page.locator('.drawer-panel .market-sheet, .drawer-panel .card-sheet').first()).toBeVisible()
  await expect(market).toHaveAttribute('aria-expanded', 'true')
  if (process.env.SHOTS) await page.screenshot({ path: `e2e/screenshots/diorama-drawer-market-${testInfo.project.name}.png` })
  await page.keyboard.press('Escape')
  await expect(page.locator('.drawer-panel')).toHaveCount(0)

  // Keyboard: focus the Log key, Enter opens it, Enter again closes.
  const log = page.getByRole('button', { name: 'Log', exact: true })
  await log.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.drawer-panel .log-sheet')).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.locator('.drawer-panel')).toHaveCount(0)
})

// Shots only (SHOTS=1): a busy mid-game board on each map, to look at tokens and tiles under load.
for (const map of ['The Ring', 'The Long Coast', 'The Delta'])
  test(`mid-game board shot on ${map}`, async ({ page }, testInfo) => {
    test.skip(!process.env.SHOTS, 'shots only')
    await page.goto('/?e2eAutoplay=1')
    await page.getByText('Quick Game').click()
    await page.locator('.layout-tile', { hasText: map }).click()
    await page.getByRole('button', { name: 'Start' }).click()
    await page.waitForFunction(() => Number(document.querySelector<SVGSVGElement>('.map-wrap svg.map[data-round]')?.dataset.round ?? 0) >= 5, null, { timeout: 60_000 })
    await page.waitForTimeout(400)
    await page.screenshot({ path: `e2e/screenshots/diorama-mid-${map.split(' ').pop()!.toLowerCase()}-${testInfo.project.name}.png` })
  })
