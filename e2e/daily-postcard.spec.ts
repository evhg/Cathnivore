import { expect, test } from '@playwright/test'

// Plan item 484: a Daily ends with a market-day postcard (1200x630, drawn on the page, nothing fetched); with no
// Web Share its button saves the image instead. Shots with SHOTS=1.
test('a Daily ends with a postcard that saves as an image', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'share', { value: undefined, configurable: true })
    Object.defineProperty(Navigator.prototype, 'canShare', { value: undefined, configurable: true })
  })
  await page.goto('/?e2eAutoplay=1')
  await page.locator('.title-daily').click()
  await expect(page.locator('.end-screen')).toBeVisible({ timeout: 60_000 })
  const card = page.locator('[data-daily-postcard]')
  await expect(card).toBeVisible()
  const requests: string[] = []
  page.on('request', (r) => requests.push(r.url()))
  const size = await card.locator('canvas').evaluate((c: HTMLCanvasElement) => [c.width, c.height])
  expect(size).toEqual([1200, 630])
  // the card is drawn: its pixels aren't one flat colour
  const inked = await card.locator('canvas').evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
    const seen = new Set<number>()
    for (let i = 0; i < d.length; i += 4 * 97) seen.add((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!)
    return seen.size
  })
  expect(inked).toBeGreaterThan(8)
  await page.waitForTimeout(1500)
  if (process.env.SHOTS) await page.screenshot({ path: `e2e/screenshots/daily-postcard-${testInfo.project.name}.png`, fullPage: true })
  const save = card.getByRole('button', { name: 'Save image' })
  const download = page.waitForEvent('download')
  await save.click()
  expect((await download).suggestedFilename()).toMatch(/^cathnivore-daily-\d+\.png$/)
  await expect(card.locator('.daily-postcard-note')).toHaveText('Postcard saved')
  expect(requests.filter((u) => !u.startsWith('blob:') && !u.startsWith('data:'))).toEqual([])
})

