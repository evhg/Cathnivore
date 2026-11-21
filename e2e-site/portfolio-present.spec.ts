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
  await expect(say).toContainText('Pick one')
  await page.locator('.show-c').hover()
  await expect(page.locator('#hero-cath')).toHaveAttribute('data-facing', 'nightshift')
  await expect(say).toHaveText(/^NIGHT SHIFT:/)
  await expect(page.locator('#hero-cath svg.cath')).toHaveClass(/cath-pose-point/)
  // she faces the wall (mirrored, as she stands right of it)
  await expect.poll(() => page.locator('#hero-cath svg').evaluate((el) => getComputedStyle(el).transform)).toContain('matrix(-1')
  await page.mouse.move(5, 880)
  await expect(page.locator('#hero-cath')).not.toHaveAttribute('data-facing')
  await expect(say).toContainText('Pick one')
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
  // Plan item 509: on a phone it is the studio's pulse over the prints, above the fold.
  if (page.viewportSize()!.width <= 720) {
    // after its rise (from 1 s, 1 s long)
    await page.waitForTimeout(2300)
    const line = (await page.locator('#shipped').boundingBox())!
    const first = (await page.locator('.show-a').boundingBox())!
    expect(line.y + line.height).toBeLessThanOrEqual(first.y)
    expect(line.y + line.height).toBeLessThanOrEqual(page.viewportSize()!.height)
  } else expect(box.y).toBeGreaterThanOrEqual(stats.y + stats.height - 1)
})

// Plan item 601: her line's tail points at her head (at D it met her knees, 360 px from her face), on a phone too; the
// phone's prints are framed with a name plate, not a black caption bar.
test("Cath's line points at her head, and the phone's prints are framed", async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(2500)
  const m = await page.evaluate(() => {
    const vis = [...document.querySelectorAll('.show-say-text, .show-say-short')].find((e) => getComputedStyle(e).display !== 'none')!
    const tip = getComputedStyle(vis, '::after')
    const b = vis.getBoundingClientRect()
    const c = document.querySelector('#hero-cath')!.getBoundingClientRect()
    const tail = { x: b.right - parseFloat(tip.right) - parseFloat(tip.width) / 2, y: b.bottom - parseFloat(tip.bottom) }
    const head = { l: c.left, r: c.right, t: c.top, b: c.top + c.height * 0.22 }
    const d = Math.hypot(Math.max(head.l - tail.x, 0, tail.x - head.r), Math.max(head.t - tail.y, 0, tail.y - head.b))
    const card = document.querySelector('.show-a')!
    const label = document.querySelector('.show-a .show-label')!
    return { d, bottom: b.bottom, h: innerHeight, frame: parseFloat(getComputedStyle(card).paddingLeft), plate: getComputedStyle(label).backgroundImage, scroll: document.documentElement.scrollWidth - innerWidth }
  })
  expect(m.d, JSON.stringify(m)).toBeLessThanOrEqual(24)
  expect(m.bottom).toBeLessThanOrEqual(m.h)
  expect(m.scroll).toBeLessThanOrEqual(0)
  if (page.viewportSize()!.width <= 720) {
    expect(m.frame).toBeGreaterThanOrEqual(5)
    expect(m.plate).toContain('gradient')
  }
})
