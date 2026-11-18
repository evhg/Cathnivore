import { expect, test, type Page } from '@playwright/test'

// Plan item 502: the Setup draws the opening table you'll play (`[data-opening-preview]`): the game's own board dealt
// for the picks and the seed. At D it is 360 px+ wide beside the maps; a difficulty change redraws it within
// 250 ms; Start opens on the same pieces it showed.

async function previewPieces(page: Page): Promise<Record<string, string>> {
  return page.locator('[data-opening-preview] g.region-hex[data-region]').evaluateAll((gs) =>
    Object.fromEntries(gs.map((g) => [g.getAttribute('data-region')!, g.getAttribute('data-enemy-pieces')!])),
  )
}

test('desktop Setup draws the opening table, redraws it on a pick, and Start deals it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'the desktop table')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByText('Quick Game').click()
  const preview = page.locator('[data-opening-preview]')
  await expect(preview).toBeVisible()
  expect((await preview.boundingBox())!.width).toBeGreaterThanOrEqual(360)
  await expect(preview).toHaveAttribute('data-difficulty', 'normal')
  // A difficulty change redraws the board within 250 ms of the click (timed in the page, from the input event).
  const ms = await page.evaluate(
    () =>
      new Promise<number>((done) => {
        const el = document.querySelector('[data-opening-preview]')!
        const hard = document.querySelectorAll<HTMLInputElement>('input[name="difficulty"]')[2]!
        const t0 = performance.now()
        const tick = () => (el.isConnected && document.querySelector('[data-opening-preview]')!.getAttribute('data-difficulty') === 'hard' ? done(performance.now() - t0) : requestAnimationFrame(tick))
        hard.click()
        requestAnimationFrame(tick)
      }),
  )
  expect(ms).toBeLessThanOrEqual(250)
  // Hard puts a Doubt on every pasture, so the board changed, not just its label.
  await page.locator('.layout-tile[data-layout="delta"] input').check()
  await expect(preview).toHaveAttribute('data-layout', 'delta')
  const shown = await previewPieces(page)
  expect(Object.keys(shown).length).toBeGreaterThanOrEqual(7)
  expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= innerHeight + 1)).toBe(true)
  // Start deals the table it showed: every region opens with the same count of Hollowell's pieces.
  await page.locator('.setup-start').click()
  const board = page.locator('.game svg.map, main svg.map').first()
  await expect(board).toBeVisible({ timeout: 15_000 })
  const dealt = await board.locator('g.region-hex[data-region]').evaluateAll((gs) =>
    Object.fromEntries(gs.map((g) => [g.getAttribute('data-region')!, g.getAttribute('data-enemy-pieces')!])),
  )
  expect(dealt).toEqual(shown)
})

test('phone Setup shows the opening table on the map step', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'the phone steps')
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: /Next: Where you trade/ }).click()
  const preview = page.locator('.map-stage [data-opening-preview]')
  await expect(preview).toBeInViewport()
  expect((await preview.boundingBox())!.width).toBeGreaterThanOrEqual(200)
  await page.getByRole('button', { name: 'Next map' }).click()
  await expect(preview).toHaveAttribute('data-layout', 'coast')
})
