import { test, expect, type Page } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 489: the producers talk back at the table. After Cath's line settles, the producer the turn touched
// answers from their seat: at a desktop table above their head, on an upright phone over her dock line. It never
// meets a hex, the hand or her own bubble, and reads at 14 px or more.
type Box = { x: number; y: number; width: number; height: number }
const meets = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

async function liberate(page: Page) {
  await page.goto('/?e2eMoment=1')
  await page.getByText('Quick Game').click()
  await fillSeed(page, '7')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.waitForFunction(() => typeof (window as unknown as { cathnivoreMoment?: unknown }).cathnivoreMoment === 'function')
  await page.evaluate(() => (window as unknown as { cathnivoreMoment: (k: string, r: string) => void }).cathnivoreMoment('liberate', 'kingsmarket'))
  const line = page.locator('[data-producer-line][data-beat=liberated]')
  await expect(line).toBeVisible({ timeout: 5000 })
  // its entrance settled
  await page.waitForTimeout(500)
  return line
}

const sizes: Array<[number, number]> = [[1280, 800], [1440, 900]]
for (const [width, height] of sizes) {
  test(`a producer answers a liberation from their seat, clear of the board (${width}x${height})`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the desktop table')
    await page.setViewportSize({ width, height })
    const line = await liberate(page)
    const box = (await line.boundingBox())!
    expect(await line.evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(14)
    for (const hex of await page.locator('.region-hex').all()) {
      const h = (await hex.locator('polygon').first().boundingBox())!
      expect(meets(box, h), `${await hex.getAttribute('data-region')}`).toBe(false)
    }
    for (const card of await page.locator('.action-item[data-hand-card]').all()) {
      const c = await card.boundingBox()
      if (c) expect(meets(box, c), 'a hand card').toBe(false)
    }
    const cath = await page.locator('.table-cath-line').boundingBox()
    if (cath) expect(meets(box, cath), 'her bubble').toBe(false)
    const map = (await page.locator('.map-wrap').boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(map.x)
    expect(box.x + box.width).toBeLessThanOrEqual(map.x + map.width + 1)
    // it leaves after 3.5 s
    await expect(page.locator('[data-producer-line]')).toHaveCount(0, { timeout: 5000 })
  })
}

test('on a phone the reply lies over her settled dock line, beside the busts', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'the phone counter')
  const line = await liberate(page)
  const box = (await line.boundingBox())!
  const dock = (await page.locator('.cath-dock-line').boundingBox())!
  expect(Math.abs(box.x - dock.x)).toBeLessThanOrEqual(2)
  expect(Math.abs(box.y - dock.y)).toBeLessThanOrEqual(2)
  expect(await line.evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(14)
  for (const hex of await page.locator('.region-hex').all()) {
    const h = (await hex.locator('polygon').first().boundingBox())!
    expect(meets(box, h), `${await hex.getAttribute('data-region')}`).toBe(false)
  }
  for (const card of await page.locator('.action-item[data-hand-card]').all()) {
    const c = await card.boundingBox()
    if (c) expect(meets(box, c), 'a hand card').toBe(false)
  }
  // the text fits its box
  expect(await line.evaluate((e) => e.scrollHeight <= e.clientHeight + 1)).toBe(true)
})

test('under reduced motion the reply only fades in', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'one size is enough')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const line = await liberate(page)
  expect(await line.evaluate((e) => getComputedStyle(e).animationName)).toBe('producer-line-fade')
})
