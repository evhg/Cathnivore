import { expect, test } from '@playwright/test'

// Plan item 447: her coaching is one tap from done: a tap on Cath's tip (the desk panel's 'Cath says' plate) opens
// the build ring on the plot she means, the packet she names among it.
type HG = { game(): { towers: unknown[]; phase: string } | null }

test('a tap on her tip opens the build ring on the plot she means', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the desk panel plate')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/hedgerow/?2d&sandbox=1')
  await page.evaluate(() => {
    const stars: Record<string, number> = {}
    for (let i = 1; i <= 20; i++) stars[String(i)] = 3
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { '21': true }, seen: {}, tips: { all: true } }))
  })
  await page.goto('/hedgerow/?2d&sandbox=1&level=21')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 30_000 })
  const plate = page.locator('#cath-plate')
  await expect(plate).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.ring-packet').first()).toBeHidden()
  await plate.click()
  await expect(page.locator('.ring-packet').first()).toBeVisible({ timeout: 3_000 })
  expect(await page.locator('.ring-packet').count()).toBeGreaterThan(1)
  // the packet she names glows among them
  await expect(page.locator('.ring-packet[data-coached]')).toHaveCount(1)
})
