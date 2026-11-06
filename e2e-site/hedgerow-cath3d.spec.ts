import { expect, test } from '@playwright/test'

// Plan item 162: Cath a readable hero on the 3D field. Her face shows (24 px or more on a phone, 40 at D), it is
// lit lighter than her hair, and her pose follows the round: worried when a vehicle gets through.
type W = {
  hedgerow?: {
    game: () => { events: Array<Record<string, unknown>> } | null
    faceBox: () => { w: number; h: number } | null
    faceTone: () => { face: number; hair: number } | null
  }
}

test('her face reads in 3D, lighter than her hair, and she worries at a leak', async ({ page, hasTouch }) => {
  test.setTimeout(150_000)
  await page.goto('/hedgerow/?sandbox=1&level=21')
  await page.waitForFunction(() => !!(window as unknown as W).hedgerow?.game() && !!(window as unknown as W).hedgerow!.faceBox(), null, { timeout: 90_000 })
  await page.waitForTimeout(3000)
  const m = await page.evaluate(() => {
    const h = (window as unknown as W).hedgerow!
    return { box: h.faceBox()!, tone: h.faceTone()! }
  })
  expect(Math.min(m.box.w, m.box.h)).toBeGreaterThanOrEqual(hasTouch ? 24 : 40)
  expect(m.tone.face).toBeGreaterThan(m.tone.hair)
  await expect(page.locator('#stage')).toHaveAttribute('data-cath-pose', /rest|plant/, { timeout: 30_000 })
  await page.evaluate(() => (window as unknown as W).hedgerow!.game()!.events.push({ type: 'leak', x: 1, y: 1, lost: 1 }))
  await expect(page.locator('#stage')).toHaveAttribute('data-cath-pose', 'worried', { timeout: 30_000 })
})

// Plan item 208: as she gives a line on the field she points out over it with her free hand, then goes back to rest.
test('she points as she gives a hint', async ({ page }) => {
  test.setTimeout(150_000)
  await page.goto('/hedgerow/?sandbox=1&level=21')
  await page.waitForFunction(() => !!(window as unknown as W).hedgerow?.game(), null, { timeout: 90_000 })
  await expect(page.locator('#stage')).toHaveAttribute('data-cath-pose', 'point', { timeout: 60_000 })
  await expect(page.locator('#stage')).toHaveAttribute('data-cath-pose', /rest|plant/, { timeout: 60_000 })
})
