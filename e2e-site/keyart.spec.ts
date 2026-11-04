import { expect, test, type Page } from '@playwright/test'

// Plan item 116: the site's posters are shot from each game's `?keyart` frame (scripts/keyart.mjs): the scene
// alone, with nothing a player reads or presses. NIGHT SHIFT's poster comes from its own HUD-free keyart stage
// (scripts/cathode-keyart.mjs, C14).
test.use({ viewport: { width: 1440, height: 900 } })
test.skip(({ isMobile, hasTouch }) => !!isMobile || !!hasTouch, 'key art is shot at 1440x900')

/** Every visible control, header or HUD element on the page (a board's own tiles, drawn in its SVG, are the scene). */
async function chrome(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('button, header, [role="button"], a[href], .hud, .rail, .panel, .controls, .desktop-col, .market-board, .action-tray')]
      .filter((e) => {
        if (e.closest('svg')) return false
        const r = e.getBoundingClientRect()
        const s = getComputedStyle(e)
        return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && Number(s.opacity) > 0.05 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight
      })
      .map((e) => `${e.tagName.toLowerCase()}#${e.id}.${String(e.className)}`),
  )
}

test('Cathnivore ?keyart shows the table alone', async ({ page }) => {
  await page.goto('/cathnivore/?keyart')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('svg.map').first().waitFor()
  await page.waitForTimeout(800)
  expect(await chrome(page)).toEqual([])
  const map = await page.locator('.map-wrap').boundingBox()
  expect(map?.width).toBeGreaterThanOrEqual(1400)
})

test('Runnel ?keyart shows the valley and board alone', async ({ page }) => {
  await page.goto('/runnel/?keyart&nohelp')
  await page.locator('#board path, #board g').first().waitFor({ state: 'attached' })
  await page.waitForTimeout(500)
  expect(await chrome(page)).toEqual([])
  const board = await page.locator('#board').boundingBox()
  expect(board?.height).toBeGreaterThanOrEqual(700)
})

test('Hedgerow ?keyart shows the field alone', async ({ page }) => {
  await page.goto('/hedgerow/?keyart&sandbox=1&2d&level=3')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: { game(): unknown } }).hedgerow?.game(), null, { timeout: 60_000 })
  await page.waitForTimeout(800)
  expect(await chrome(page)).toEqual([])
  const stage = await page.locator('#stage').boundingBox()
  expect(stage?.width).toBeGreaterThanOrEqual(1400)
})
