import { expect, test } from '@playwright/test'

// Plan item 496: the act map's banners live a little: on an open water act a flock, a cloud's shadow and glints run
// (3+ `[data-ambient]` animating while it's on screen); under reduced motion none runs.
for (const reduce of [false, true]) {
  test(`act banners: ambient loops${reduce ? ' (reduced motion: none)' : ''}`, async ({ page }) => {
    if (reduce) await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/hedgerow/?2d')
    await page.evaluate(() => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [String(i + 1), 3])), tips: { all: true } })))
    await page.goto('/hedgerow/?2d')
    const head = page.locator('.act-head').nth(2)
    await head.scrollIntoViewIfNeeded()
    const running = () => head.evaluate((e) => [...e.querySelectorAll<HTMLElement>('[data-ambient]')].filter((a) => a.getClientRects().length > 0 && [a, ...a.children].some((x) => getComputedStyle(x).animationName !== 'none' && getComputedStyle(x).animationPlayState === 'running')).length)
    if (reduce) {
      await page.waitForTimeout(800)
      expect(await running()).toBe(0)
      return
    }
    await expect.poll(running, { timeout: 10_000 }).toBeGreaterThanOrEqual(3)
  })
}
