import { expect, test, type Page } from '@playwright/test'

// Plan item 215: an upright phone's 3D field opens on a closer frame round the lane's busy half (plots 44 px or
// more, vehicles 16 px or more); the Whole field button fits every plot and comes back. A desktop and ?2d keep
// the whole field with no button.
type Box = { x: number; y: number; w: number; h: number }
type HG = { game(): unknown; plotBoxes(): Box[]; vehicleBoxes(): Box[]; sendWave(g: unknown): unknown }

async function open(page: Page, query: string): Promise<void> {
  const level = 21
  const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true, move: true }
  const stars = Object.fromEntries(Array.from({ length: level - 1 }, (_, i) => [String(i + 1), 3]))
  await page.goto(`/hedgerow/?sandbox=1${query}`)
  await page.evaluate(([s, t, l]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { [l]: true }, tips: t })), [stars, tips, level] as const)
  await page.goto(`/hedgerow/?sandbox=1${query}&level=${level}`)
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 90_000 })
}

test('an upright phone opens close on the lane, and Whole field fits every plot', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 600, 'upright phone only')
  test.setTimeout(240_000)
  await open(page, '')
  const fit = page.locator('#btn-field-fit')
  await expect(fit).toBeVisible({ timeout: 30_000 })
  await expect(fit).toHaveText(/Whole field/i)
  const fb = (await fit.boundingBox())!
  expect(fb.height).toBeGreaterThanOrEqual(44)
  // Plots in view read at 44 px or more.
  const inView = await page.evaluate(() => {
    const c = document.getElementById('canvas')!.getBoundingClientRect()
    return (window as unknown as { hedgerow: HG }).hedgerow.plotBoxes().filter((b) => b.x >= c.left && b.y >= c.top && b.x + b.w <= c.right && b.y + b.h <= c.bottom).map((b) => Math.min(b.w, b.h))
  })
  expect(inView.length).toBeGreaterThan(4)
  expect(Math.min(...inView)).toBeGreaterThanOrEqual(44)
  // Vehicles on the lane read at 16 px or more.
  await page.evaluate(() => {
    const h = (window as unknown as { hedgerow: HG }).hedgerow
    h.sendWave(h.game())
  })
  await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.vehicleBoxes().length), { timeout: 120_000 }).toBeGreaterThan(0)
  const veh = await page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.vehicleBoxes().map((b) => Math.max(b.w, b.h)))
  expect(Math.min(...veh)).toBeGreaterThanOrEqual(16)
  // The whole field: every plot inside the canvas; then back.
  await fit.click()
  await expect(fit).toHaveText(/Closer/i)
  const all = await page.evaluate(() => {
    const c = document.getElementById('canvas')!.getBoundingClientRect()
    return (window as unknown as { hedgerow: HG }).hedgerow.plotBoxes().every((b) => b.x >= c.left - 1 && b.y >= c.top - 1 && b.x + b.w <= c.right + 1 && b.y + b.h <= c.bottom + 1)
  })
  expect(all).toBe(true)
  await fit.click()
  await expect(fit).toHaveText(/Whole field/i)
})

test('a desktop and ?2d keep the whole field with no button', async ({ page }) => {
  test.setTimeout(180_000)
  const phone = (page.viewportSize()?.width ?? 0) < 600
  if (!phone) {
    await open(page, '')
    await page.waitForTimeout(1500)
    await expect(page.locator('#btn-field-fit')).toBeHidden()
  }
  await open(page, '&2d')
  await page.waitForTimeout(1500)
  await expect(page.locator('#btn-field-fit')).toBeHidden()
})
