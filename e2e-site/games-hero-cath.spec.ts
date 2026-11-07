import { test, expect } from '@playwright/test'

// Plan item 130: on a phone /games/ has Cath in the hero, waving on the first screen, meeting no text or button.
// Plan item 238: she's the centrepiece, 200 px or more, the buttons under her; the first poster still starts on the
// first screen. She dresses for the
// poster in view and her wave settles after 3 s. At D the landscape figure stays and this one is hidden.
for (const [w, h] of [
  [390, 844],
  [375, 667],
] as const)
  test(`the phone hero has a waving Cath clear of the text at ${w}x${h}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'site-phone', 'phone layout')
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/games/')
    await page.waitForFunction(() => document.documentElement.classList.contains('ready'))
    await page.waitForTimeout(800)
    const m = await page.evaluate(() => {
      const cath = document.getElementById('hero-cath-mini')!
      const c = cath.getBoundingClientRect()
      const ov = (b: DOMRect) => b.width > 0 && c.left < b.right - 1 && b.left < c.right - 1 && c.top < b.bottom - 1 && b.top < c.bottom - 1
      // text boxes measured on their lines (a block's box spans the column), buttons whole
      const lines = (el: Element) => {
        const r = document.createRange()
        r.selectNodeContents(el)
        return [...r.getClientRects()]
      }
      const hits = [
        ...[...document.querySelectorAll('.hero-text .kicker, .hero-text .title, .hero-text .lede, .hero-text .hero-meta')].flatMap((e) =>
          lines(e).filter(ov).map(() => e.className),
        ),
        ...[...document.querySelectorAll('.hero-text a, .hero-text button')].filter((e) => ov(e.getBoundingClientRect())).map((e) => e.textContent),
      ]
      return {
        h: c.height,
        top: c.top,
        bottom: c.bottom,
        pose: cath.dataset.pose,
        drawn: !!cath.querySelector('svg.cath'),
        poster: document.querySelector('.hero-game')!.getBoundingClientRect().top,
        hits,
      }
    })
    expect(m.drawn).toBe(true)
    expect(m.pose).toBe('wave')
    expect(m.h).toBeGreaterThanOrEqual(200)
    expect(m.top).toBeGreaterThanOrEqual(0)
    expect(m.bottom).toBeLessThanOrEqual(h)
    expect(m.hits, JSON.stringify(m)).toEqual([])
    expect(m.poster).toBeLessThan(h)
    // she dresses for the poster in view: Cathnivore's first, Hedgerow's once its row is scrolled up, NIGHT SHIFT's
    // when its poster is focused
    await expect(page.locator('#hero-cath-mini')).toHaveAttribute('data-outfit', 'market')
    await page.evaluate(() => window.scrollTo(0, document.querySelector('.hero-game-hedgerow')!.getBoundingClientRect().top + scrollY - 200))
    await expect(page.locator('#hero-cath-mini')).toHaveAttribute('data-outfit', 'field', { timeout: 2000 })
    await page.locator('.hero-game-nightshift').focus()
    await expect(page.locator('#hero-cath-mini')).toHaveAttribute('data-outfit', 'trench', { timeout: 2000 })
    // and the wave settles
    await expect(page.locator('#hero-cath-mini')).toHaveAttribute('data-pose', 'clasped', { timeout: 4000 })
  })

test('at D the hero keeps its landscape Cath', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'site-desktop', 'desktop layout')
  await page.goto('/games/')
  await expect(page.locator('#hero-cath svg')).toBeVisible()
  await expect(page.locator('#hero-cath-mini')).toBeHidden()
})
