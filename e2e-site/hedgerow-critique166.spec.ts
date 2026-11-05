import { expect, test } from '@playwright/test'

// Plan item 166: the bugs from the 2026-11-05 16:05 critique (Hedgerow's share).
type W = { hedgerow?: { game: () => unknown } }

test("every depot's board shows a number, a quiet gate's '0 next' included", async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'level 34 has no margin for its depots on a phone')
  await page.goto('/hedgerow/?2d&sandbox=1&level=34')
  await page.waitForFunction(() => !!(window as unknown as W).hedgerow?.game(), null, { timeout: 30_000 })
  const boards = page.locator('[data-depot] .depot-board')
  await expect(boards.first()).toBeAttached()
  for (const t of await boards.allTextContents()) expect(t).toMatch(/^\d+ next$/)
})

test("a locked act's banner title is whole ink on a paper plate, not faded with its painting", async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'desktop banner')
  const stars = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(i + 1), 3]))
  await page.goto('/hedgerow/?2d')
  await page.evaluate((st) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: st, seenBefore: { 21: true } })), stars)
  await page.goto('/hedgerow/')
  const place = page.locator('.act-pencil .act-place').first()
  await expect(place).toBeVisible()
  const r = await place.evaluate((t) => {
    let masked = false
    for (let e: Element | null = t; e; e = e.parentElement) {
      const c = getComputedStyle(e)
      if (c.maskImage !== 'none' || Number(c.opacity) < 1) masked = true
    }
    return { masked, size: parseFloat(getComputedStyle(t).fontSize), bg: getComputedStyle(t.closest('.act-title')!).backgroundColor }
  })
  expect(r.masked).toBe(false)
  expect(r.size).toBeGreaterThanOrEqual(12)
  // A light plate (its red channel high), so the ink title reads.
  // (color-mix computes to `color(srgb r g b / a)` in 0-1, a plain colour to `rgb(...)` in 0-255.)
  const first = Number(r.bg.match(/[\d.]+/)![0])
  expect(r.bg.startsWith('color(') ? first * 255 : first).toBeGreaterThan(200)
})

test("on an upright phone the round grip straddles the tray's edge, and the packet under the 'more' tab fades", async ({ page, hasTouch }) => {
  test.skip(!hasTouch, 'phone layout')
  await page.goto('/hedgerow/?2d&sandbox=1&level=21')
  await page.waitForFunction(() => !!(window as unknown as W).hedgerow?.game(), null, { timeout: 30_000 })
  const handle = page.locator('.drawer-handle')
  await expect(handle).toBeVisible()
  const m = await page.evaluate(() => {
    const h = document.querySelector('.drawer-handle')!.getBoundingClientRect()
    const panel = document.querySelector('.drawer-handle')!.parentElement!.getBoundingClientRect()
    const wrap = document.querySelector('.tray-wrap')!
    return { above: panel.top - h.top, more: wrap.classList.contains('more-shown'), mask: getComputedStyle(wrap.querySelector('.tray')!).maskImage }
  })
  expect(m.above).toBeLessThanOrEqual(12)
  if (m.more) expect(m.mask).toContain('gradient')
})
