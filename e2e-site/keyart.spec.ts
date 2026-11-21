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

test('NIGHT SHIFT key art reads at card size: mean luma 0.2+, beside three bright posters', async ({ page }) => {
  // Plan item 585: the frame was mostly near-black (luma 0.17) with Cath a tenth of its height; the shoot now comes in
  // on her head and keeps the street's mid-tones.
  await page.goto('/')
  const luma = await page.evaluate(async () => {
    const img = new Image()
    img.src = '/work/games-nightshift-960.webp'
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    const g = c.getContext('2d')!
    g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, c.width, c.height).data
    let l = 0
    for (let i = 0; i < d.length; i += 4) l += (0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!) / 255
    return l / (d.length / 4)
  })
  expect(luma).toBeGreaterThanOrEqual(0.2)
})
