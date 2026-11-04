import { test, expect, type Page } from '@playwright/test'

// Plan item 106: the spring house, the stream and Bea's garden are in the farm on a phone as on a desktop, with
// no bare band under the board; the stream's fill rises as fields are watered, and a solve waters the garden
// (`data-watered`), at P and D.

async function seen(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (localStorage.getItem('runnel:v1')) return
    localStorage.setItem('runnel:v1', JSON.stringify({ version: 1, daily: {}, practice: {}, results: {}, bestPractice: {}, practiceSolved: 3, seenHelp: true }))
  })
}

async function farm(page: Page) {
  return page.evaluate(() => {
    const box = (sel: string) => {
      const r = document.querySelector(sel)!.getBoundingClientRect()
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width, h: r.height }
    }
    const tiles = [...document.querySelectorAll('#board polygon.tile')].map((t) => t.getBoundingClientRect().bottom)
    return { spring: box('.spring-house'), garden: box('.bea-garden'), crops: box('#bea-crops'), foot: box('.foot'), tilesBottom: Math.max(...tiles), vh: innerHeight }
  })
}

for (const where of ['the lesson', "today's daily"]) {
  test(`the spring house and Bea's garden are in view on ${where}, with no bare band under the board`, async ({ page }) => {
    if (where !== 'the lesson') await seen(page)
    await page.goto('/runnel/')
    await expect(page.locator('#board polygon.tile').first()).toBeVisible()
    await page.waitForTimeout(400)
    const f = await farm(page)
    for (const [name, b] of [['spring house', f.spring], ['garden', f.garden]] as const) {
      expect(b.w, `${name} drawn`).toBeGreaterThan(40)
      expect(b.top, `${name} top`).toBeGreaterThanOrEqual(0)
      expect(b.bottom, `${name} bottom`).toBeLessThanOrEqual(f.vh)
    }
    // The garden's beds are a plot you can see: at least 140 px wide and 20 px tall.
    expect(f.crops.w).toBeGreaterThanOrEqual(140)
    expect(f.crops.h).toBeGreaterThanOrEqual(20)
    // Whatever is lowest of the board and the garden, the foot follows within 80 px.
    expect(f.foot.top - Math.max(f.tilesBottom, f.garden.bottom)).toBeLessThanOrEqual(80)
  })
}

test('the stream rises as fields are watered, and a solve waters the garden', async ({ page }) => {
  await seen(page)
  await page.goto('/runnel/?shotsolve')
  await expect(page.locator('[data-last]')).toBeVisible()
  const wet = () => page.locator('#valley-water').evaluate((el) => parseFloat(el.style.getPropertyValue('--wet')) || 0)
  const garden = page.locator('.bea-garden')
  await expect(garden).toHaveAttribute('data-watered', 'false')
  const soil = () => page.locator('#bea-crops').evaluate((el) => getComputedStyle(el).backgroundColor)
  const drySoil = await soil()
  const before = await wet()
  expect(before).toBeLessThan(1)
  await page.locator('[data-last]').click()
  await expect.poll(wet).toBe(1)
  await expect(garden).toHaveAttribute('data-watered', 'true')
  // The plot's soil goes dark and wet once the water arrives.
  await expect.poll(soil, { timeout: 3000 }).not.toBe(drySoil)
  const lum = (c: string) => {
    const [r, g, b] = c.match(/[\d.]+/g)!.map(Number)
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
  }
  await page.waitForTimeout(1000)
  expect(lum(await soil())).toBeLessThan(lum(drySoil))
})
