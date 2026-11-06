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
