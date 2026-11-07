import { expect, test } from '@playwright/test'

// Plan item 181: the /games/ landing as Cath's market stall: the hero holds Cath and today's Runnel on a slate
// ([data-cta="daily"]); her feet on the awning's rail (no floating figure); the posters 280 px or more at D, and a
// poster pointed at swings 3 degrees or less (none under reduced motion).
test('the landing is Cath\'s stall, the games hung from its awning', async ({ page }) => {
  await page.goto('/games/')
  const hero = page.locator('.stall-hero')
  await expect(hero).toBeVisible()
  await expect(hero.locator('[data-cta="daily"]')).toBeVisible()
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity))
  const vp = page.viewportSize()!
  const m = await page.evaluate(() => {
    const cath = document.getElementById(innerWidth < 600 ? 'hero-cath-mini' : 'hero-cath')!.getBoundingClientRect()
    const games = document.querySelector('.hero-games')!
    const rail = games.getBoundingClientRect().top + parseFloat(getComputedStyle(games, '::after').top)
    return { feet: cath.bottom, rail, widths: [...document.querySelectorAll('.hero-game')].map((e) => e.getBoundingClientRect().width) }
  })
  if (vp.width >= 900) {
    expect(Math.abs(m.feet - m.rail)).toBeLessThanOrEqual(10)
    for (const w of m.widths) expect(w).toBeGreaterThanOrEqual(280)
    const first = page.locator('.hero-game').first()
    await first.hover()
    await page.waitForTimeout(300)
    const deg = await first.evaluate((e) => parseFloat(getComputedStyle(e).rotate) || 0)
    expect(Math.abs(deg)).toBeGreaterThan(0)
    expect(Math.abs(deg)).toBeLessThanOrEqual(3)
  }
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })
  test('a poster pointed at stays still', async ({ page }) => {
    await page.goto('/games/')
    const first = page.locator('.hero-game').first()
    await expect(first).toBeVisible()
    await first.hover()
    expect(await first.evaluate((e) => getComputedStyle(e).rotate)).toBe('none')
  })
})

// Plan item 243: at D the hero is one scene, Cath working her stall: the stall spans 35% or more of the hero, its
// counter stands in front of her with its foot on the posters' awning rail, the words hang on its slate board.
for (const vp of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }]) {
  test(`at ${vp.width}x${vp.height} Cath stands behind her stall's counter`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('phone'), 'desktop')
    await page.setViewportSize(vp)
    await page.goto('/games/')
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity))
    await page.waitForTimeout(3400)
    const m = await page.evaluate(() => {
      const box = (svg: Element) => {
        const bs = [...svg.children].map((c) => c.getBoundingClientRect()).filter((b) => b.width && b.height)
        return { l: Math.min(...bs.map((b) => b.left)), t: Math.min(...bs.map((b) => b.top)), r: Math.max(...bs.map((b) => b.right)), b: Math.max(...bs.map((b) => b.bottom)) }
      }
      const hero = document.querySelector('.hero')!.getBoundingClientRect()
      const games = document.querySelector('.hero-games')!
      const rail = games.getBoundingClientRect().top + parseFloat(getComputedStyle(games, '::after').top)
      const cath = document.querySelector('#hero-cath')!.getBoundingClientRect()
      const btns = [...document.querySelectorAll('.cta-row > *')].map((e) => e.getBoundingClientRect())
      const words = { left: Math.min(...btns.map((b) => b.left)), right: Math.max(...btns.map((b) => b.right)), top: Math.min(...btns.map((b) => b.top)), bottom: Math.max(...btns.map((b) => b.bottom)) }
      const z = (s: string) => Number(getComputedStyle(document.querySelector(s)!).zIndex)
      return { hero: hero.width, back: box(document.querySelector('.hero-booth')!), counter: box(document.querySelector('.hero-counter')!), rail, cath: { l: cath.left, r: cath.right, t: cath.top, b: cath.bottom }, words: { l: words.left, r: words.right, t: words.top, b: words.bottom }, zc: z('#hero-cath'), zf: z('.hero-counter'), zb: z('.hero-booth') }
    })
    expect((m.back.r - m.back.l) / m.hero).toBeGreaterThanOrEqual(0.35)
    // the counter's foot on the rail, in front of Cath and over her lower body, clear of the buttons
    expect(Math.abs(m.counter.b - m.rail)).toBeLessThanOrEqual(4)
    expect(m.zb).toBeLessThan(m.zc)
    expect(m.zf).toBeGreaterThan(m.zc)
    expect(m.counter.t).toBeGreaterThan(m.cath.t + (m.cath.b - m.cath.t) * 0.45)
    expect(m.counter.l).toBeLessThan(m.cath.l)
    expect(m.counter.r).toBeGreaterThan(m.cath.r)
    expect(m.counter.r).toBeLessThan(m.words.l)
    // the stall frames the words: they sit inside its posts
    expect(m.back.l).toBeLessThan(m.cath.l)
    expect(m.back.r).toBeGreaterThan(m.words.r)
  })
}
