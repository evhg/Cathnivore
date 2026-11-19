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
  // The deal's own beat (round 1's pair opener, 1.2 s after the table opens) replaces a reply staged before it: let
  // the opening speak first (on 2026-11-19's market the staged reply lost that race every time).
  await page.waitForTimeout(2500)
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
    // Plan item 495: one voice at a time: her line steps back while the producer speaks, and comes back after.
    await expect(page.locator('.table-cath-line[data-hushed]')).toHaveCount(1)
    // Item 512: it steps back in ink (--ink-muted, about 5.9:1 on the bubble), not opacity, so it still reads at AA.
    expect(await page.locator('.table-cath-line').evaluate((e) => getComputedStyle(e).color)).toBe('rgb(110, 98, 90)')
    const map = (await page.locator('.map-wrap').boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(map.x)
    expect(box.x + box.width).toBeLessThanOrEqual(map.x + map.width + 1)
    // it leaves after 3.5 s
    await expect(page.locator('[data-producer-line]')).toHaveCount(0, { timeout: 5000 })
    await expect(page.locator('.table-cath-line[data-hushed]')).toHaveCount(0)
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
