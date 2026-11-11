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

// Plan item 310: between rounds, while her line advises a plot, she points out over the field again every few seconds.
test('between rounds she points again while her line advises a plot', async ({ page }) => {
  test.setTimeout(240_000)
  await page.goto('/hedgerow/?sandbox=1&level=21')
  await page.waitForFunction(() => !!(window as unknown as W).hedgerow?.game(), null, { timeout: 90_000 })
  const stage = page.locator('#stage')
  await expect(stage).toHaveAttribute('data-cath-pose', 'point', { timeout: 60_000 })
  await expect(stage).toHaveAttribute('data-cath-pose', /rest|plant/, { timeout: 60_000 })
  await expect(stage).toHaveAttribute('data-cath-pose', 'point', { timeout: 90_000 })
})

// Plan item 255: the 3D people drawn to the 2D field's standard: Cath inked on her largest parts, and every
// farmfolk mesh toon-shaded (their ink is baked into the same geometry).
test('Cath and the farmfolk are inked and toon-shaded in 3D', async ({ page }) => {
  test.setTimeout(150_000)
  await page.goto('/hedgerow/?sandbox=1&level=21')
  type P = { hedgerow?: { game: () => unknown; people3d?: () => { cathInk: number; folkToon: number; folkPlain: number } | null } }
  await page.waitForFunction(() => {
    const p = (window as unknown as P).hedgerow?.people3d?.()
    return !!p && p.folkToon > 0
  }, null, { timeout: 120_000 })
  const p = await page.evaluate(() => (window as unknown as P).hedgerow!.people3d!()!)
  expect(p.cathInk).toBeGreaterThanOrEqual(6)
  expect(p.folkPlain).toBe(0)
})

// Plan item 255: standing, she turns to the camera, her face within 30 deg of it seen from above (an upright phone's
// lens looked from her side, 44-120 deg off; the turn eases in, slowly at SwiftShader's few frames a second).
test('her face is turned toward the camera', async ({ page }) => {
  test.setTimeout(150_000)
  await page.goto('/hedgerow/?sandbox=1&level=21')
  type F = { hedgerow?: { game: () => unknown; camSettled?: () => boolean; faceToCamera?: () => number | null } }
  await page.waitForFunction(() => !!(window as unknown as F).hedgerow?.game() && !!(window as unknown as F).hedgerow!.camSettled?.(), null, { timeout: 120_000 })
  await expect.poll(() => page.evaluate(() => (window as unknown as F).hedgerow!.faceToCamera!() ?? 999), { timeout: 40_000 }).toBeLessThanOrEqual(30)
})
