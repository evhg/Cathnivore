import { test, expect } from '@playwright/test'

// Plan item 454: at D Cath stands beside the wall of work at its height; pointing at or focusing a print plays it,
// and she turns to it, points, and names it in one line; a live line under the stats says when the release shipped.
test('Cath presents the print you point at', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1100, 'the desktop wall')
  await page.goto('/')
  await page.waitForTimeout(2000)
  const geo = await page.evaluate(() => {
    const r = (s: string) => document.querySelector(s)!.getBoundingClientRect()
    const cards = [...document.querySelectorAll('.hero-show .show-card')].map((e) => e.getBoundingClientRect())
    const top = Math.min(...cards.map((c) => c.top))
    const bottom = Math.max(...cards.map((c) => c.bottom))
    const right = Math.max(...cards.map((c) => c.right))
    const cath = r('#hero-cath')
    return { overlap: (Math.min(bottom, cath.bottom) - Math.max(top, cath.top)) / (bottom - top), clear: cath.left - right, scroll: document.documentElement.scrollWidth - innerWidth }
  })
  expect(geo.overlap, JSON.stringify(geo)).toBeGreaterThanOrEqual(0.6)
  expect(geo.clear).toBeGreaterThanOrEqual(0)
  expect(geo.scroll).toBeLessThanOrEqual(0)

  const say = page.locator('#show-say .show-say-text')
  await expect(say).toContainText('Hover one')
  await page.locator('.show-c').hover()
  await expect(page.locator('#hero-cath')).toHaveAttribute('data-facing', 'nightshift')
  await expect(say).toHaveText(/^NIGHT SHIFT:/)
  await expect(page.locator('#hero-cath svg.cath')).toHaveClass(/cath-pose-point/)
  // she faces the wall (mirrored, as she stands right of it)
  await expect.poll(() => page.locator('#hero-cath svg').evaluate((el) => getComputedStyle(el).transform)).toContain('matrix(-1')
  await page.mouse.move(5, 880)
  await expect(page.locator('#hero-cath')).not.toHaveAttribute('data-facing')
  await expect(say).toContainText('Hover one')
  // keyboard: focusing a print is the same as pointing at it, and it links to the game
  await page.locator('.show-a').focus()
  await expect(say).toHaveText(/^Cathnivore:/)
  await expect(page.locator('.show-a')).toHaveAttribute('href', '/cathnivore/')
})

test('the stats end on a live last-shipped line', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#shipped-text')).toHaveText(/^Live: last shipped .+ The next build session starts in \d+ min\.$/)
  const box = (await page.locator('#shipped').boundingBox())!
  const stats = (await page.locator('.hero .stats').boundingBox())!
  expect(box.y).toBeGreaterThanOrEqual(stats.y + stats.height - 1)
})
