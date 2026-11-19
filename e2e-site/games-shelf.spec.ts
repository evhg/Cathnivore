import { test, expect } from '@playwright/test'

// Plan item 530: on a phone the four games are a swiped shelf of full-width posters: each 340 px+ across, the first
// one's Play whole on the first screen, a different Cath pose on each, hooks two lines at most, and the arrow keys and
// a swipe both move the shelf with the pager dots following.
test('the phone games shelf', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/games/')
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity))
  const m = await page.evaluate(() => ({
    widths: [...document.querySelectorAll('.hero-game')].map((e) => e.getBoundingClientRect().width),
    play: document.querySelector('.hero-game-play')!.getBoundingClientRect().bottom,
    poses: [...document.querySelectorAll('.hero-game-cath')].map((e) => (e as HTMLElement).dataset.pose),
    hooks: [...document.querySelectorAll('.hero-game-hook')].map((e) => Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight))),
    scroll: document.documentElement.scrollWidth - innerWidth,
  }))
  for (const w of m.widths) expect(w).toBeGreaterThanOrEqual(340)
  expect(m.play).toBeLessThanOrEqual(844)
  expect(new Set(m.poses).size).toBe(m.poses.length)
  for (const n of m.hooks) expect(n).toBeLessThanOrEqual(2)
  expect(m.scroll).toBeLessThanOrEqual(0)

  const dots = page.locator('#hero-dots i')
  await expect(dots).toHaveCount(4)
  await expect(dots.nth(0)).toHaveAttribute('data-on', '')
  await page.locator('.hero-game').first().focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.hero-game').nth(1)).toBeFocused()
  await expect(dots.nth(1)).toHaveAttribute('data-on', '')
  // a swipe: the shelf scrolled by hand to the last poster
  await page.locator('.hero-games').evaluate((el) => el.scrollTo({ left: el.scrollWidth, behavior: 'instant' }))
  await expect(dots.nth(3)).toHaveAttribute('data-on', '')
  await page.keyboard.press('ArrowLeft')
  await expect(page.locator('.hero-game').nth(0)).toBeFocused()
})
