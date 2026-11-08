import { test, expect } from '@playwright/test'

// Plan item 38: on a phone the portfolio hero leads with Cath in front of the games' prints (item 303: a swiped
// strip, was one print cross-fading) (she's at least 40% of the width); she's in the page from the first paint (built in, not drawn
// by the script); reduced motion keeps the first print still.
test('the phone hero shows Cath at 40% or more of the width, in front of a strip of the four prints', async ({ page }) => {
  const vw = page.viewportSize()!.width
  await page.goto('/')
  const cath = page.locator('#hero-cath')
  await expect(cath.locator('svg')).toHaveCount(1)
  const box = (await cath.boundingBox())!
  if (vw < 1100) {
    expect(box.width / vw).toBeGreaterThanOrEqual(0.4)
    // Above the headline, inside the first screen.
    const h1 = (await page.locator('#hero-title').boundingBox())!
    expect(box.y).toBeLessThan(h1.y)
    expect(box.y).toBeGreaterThanOrEqual(0)
    // Plan item 303: the four prints are a swiped strip, each labelled, and every one scrolls into view.
    const strip = page.locator('.hero-show .show-strip')
    expect(await strip.evaluate((el) => getComputedStyle(el).scrollSnapType)).toContain('x')
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
