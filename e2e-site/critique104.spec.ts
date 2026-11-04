import { expect, test } from '@playwright/test'

// Plan item 104: the bugs from the 2026-11-04 14:10 critique (e2e/screenshots/plan1104d), the site's share.

test('/games/ has landed by 1 s: the wordmark unblurred, the CTAs and the game posters opaque', async ({ page }) => {
  await page.goto('/games/')
  await page.waitForFunction(() => document.documentElement.classList.contains('ready'))
  await page.waitForTimeout(1000)
  const state = await page.evaluate(() => {
    const letters = [...document.querySelectorAll<HTMLElement>('.letter')]
    const reveals = [...document.querySelectorAll<HTMLElement>('.reveal')].filter((e) => e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().top < innerHeight)
    return {
      letters: letters.length,
      blurred: letters.filter((e) => getComputedStyle(e).filter !== 'none' || Number(getComputedStyle(e).opacity) < 0.99).length,
      faint: reveals.filter((e) => Number(getComputedStyle(e).opacity) < 0.99).map((e) => e.className),
    }
  })
  expect(state.letters).toBeGreaterThan(0)
  expect(state.blurred).toBe(0)
  expect(state.faint).toEqual([])
  await expect(page.getByRole('link', { name: /Play today/ }).first()).toBeInViewport()
})
