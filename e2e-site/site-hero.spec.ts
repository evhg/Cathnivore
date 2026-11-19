import { test, expect } from '@playwright/test'

// Plan item 38: on a phone the portfolio hero shows Cath with the games' prints (item 303: a swiped strip); she's in the
// page from the first paint (built in, not drawn by the script); reduced motion keeps the first print still. Plan item
// 404: the headline leads (its top under y=200), then Cath standing behind a full-width row of prints, none clipped by her.
test('the phone hero leads with the headline, then Cath behind a strip of the four prints', async ({ page }) => {
  const vw = page.viewportSize()!.width
  await page.goto('/')
  const cath = page.locator('#hero-cath')
  await expect(cath.locator('svg')).toHaveCount(1)
  const box = (await cath.boundingBox())!
  if (vw < 1100) {
    const h1 = (await page.locator('#hero-title').boundingBox())!
    expect(h1.y).toBeLessThan(200)
    if (vw <= 720) {
      // Plan item 509: on a phone she stands whole beside the headline and the lede (180 px+, feet and all), nothing
      // over her, and the first row of prints starts under her, from y 560 or above.
      const lede = (await page.locator('.hero .lede').boundingBox())!
      const first = (await page.locator('.show-a').boundingBox())!
      expect(box.height).toBeGreaterThanOrEqual(180)
      expect(box.x).toBeGreaterThanOrEqual(lede.x + lede.width)
      expect(box.x + box.width).toBeLessThanOrEqual(vw)
      expect(box.y + box.height).toBeLessThanOrEqual(first.y)
      if (page.viewportSize()!.height >= 844) expect(first.y).toBeLessThanOrEqual(560)
    } else expect(box.y).toBeGreaterThan(h1.y + h1.height)
    // she stands behind the prints: the strip draws over her (it is above her in the stacking order)
    const over = await page.evaluate(() => {
      const strip = document.querySelector('.hero-show .show-strip')!
      const c = document.getElementById('hero-cath')!.getBoundingClientRect()
      const s = strip.getBoundingClientRect()
      const y = Math.max(s.top + 10, Math.min(c.bottom - 10, s.bottom - 10))
      const hit = document.elementFromPoint(c.left + c.width / 2, y)
      return { overlaps: c.bottom > s.top, strip: !!hit && strip.contains(hit) }
    })
    if (over.overlaps) expect(over.strip).toBe(true)
    // Plan item 303: the four prints are a swiped strip, each labelled, and every one scrolls into view (plan item
    // 445: a phone of 720 px or less lays them out as a 2x2 mosaic instead, every one in the screen's width).
    const strip = page.locator('.hero-show .show-strip')
    if (vw > 720) expect(await strip.evaluate((el) => getComputedStyle(el).scrollSnapType)).toContain('x')
    else expect(await strip.evaluate((el) => getComputedStyle(el).display)).toBe('grid')
    await expect(page.locator('.hero-show .show-label')).toHaveText(['Cathnivore', 'Runnel', 'NIGHT SHIFT', 'Hedgerow'])
    for (const card of await page.locator('.hero-show .show-card').all()) {
      await card.evaluate((el) => el.scrollIntoView({ inline: 'start', block: 'nearest' }))
      const r = (await card.boundingBox())!
      expect(r.x).toBeGreaterThanOrEqual(-1)
      expect(r.x + r.width).toBeLessThanOrEqual(vw + 1)
    }
  }
  // Phone-sized prints are offered.
  expect(await page.locator('.show-a img').getAttribute('srcset')).toContain('640w')
})

test('Cath is in the hero before any script runs', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false })
  const page = await ctx.newPage()
  await page.goto('/')
  await expect(page.locator('#hero-cath svg')).toHaveCount(1)
  await ctx.close()
})

test('reduced motion keeps every print showing on a phone', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  if (page.viewportSize()!.width >= 1100) return
  const ops = await page.locator('.hero-show .show-card').evaluateAll((els) => els.map((e) => getComputedStyle(e).opacity))
  expect(ops).toEqual(['1', '1', '1', '1'])
})

/** Plan item 98: the stats row's labels and numerals read at AA on the hero once its entrance has run. */
test('the portfolio stats row is at 4.5:1 or more', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  await page.goto('/')
  await expect(page.locator('.stats dt').first()).toBeVisible()
  const ratios = await page.evaluate(() => {
    const rgba = (c: string): number[] => (c.match(/[\d.]+/g) ?? []).map(Number)
    const ch = (v: number): number => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 }
    const lum = (c: number[]): number => 0.2126 * ch(c[0] ?? 0) + 0.7152 * ch(c[1] ?? 0) + 0.0722 * ch(c[2] ?? 0)
    const bg = rgba(getComputedStyle(document.body).backgroundColor)
    return [...document.querySelectorAll('.stats dt, .stats dd')].map((el) => {
      const fgRaw = rgba(getComputedStyle(el).color)
      const a = fgRaw[3] ?? 1
      const fg = [0, 1, 2].map((i) => (fgRaw[i] ?? 0) * a + (bg[i] ?? 0) * (1 - a))
      const l1 = lum(fg), l2 = lum(bg)
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
    })
  })
  expect(ratios.length).toBe(8)
  for (const r of ratios) expect(r).toBeGreaterThanOrEqual(4.5)
  await ctx.close()
})
