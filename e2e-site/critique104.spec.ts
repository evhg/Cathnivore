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

// Plan item 107: on a phone the NIGHT SHIFT poster's 18+ badge doesn't wrap onto a line of its own under the name.
test("the NIGHT SHIFT poster's 18+ badge has no line of its own", async ({ page }) => {
  await page.goto('/games/')
  await page.waitForTimeout(1200)
  const r = await page.evaluate(() => {
    const name = document.querySelector<HTMLElement>('.hero-game-nightshift .hero-game-name')!
    const badge = name.querySelector<HTMLElement>('.badge-adult')!.getBoundingClientRect()
    const art = document.querySelector<HTMLElement>('.hero-game-nightshift .hero-game-art')!.getBoundingClientRect()
    const range = document.createRange()
    range.selectNodeContents(name.firstChild!)
    const words = range.getBoundingClientRect()
    return { badge: [badge.top, badge.bottom, badge.left, badge.right], words: [words.top, words.bottom], art: [art.top, art.bottom, art.left, art.right], vw: innerWidth }
  })
  const [bt, bb, bl, br] = r.badge as [number, number, number, number]
  const besideName = bt < r.words[1]! && bb > r.words[0]!
  const onArt = bt >= r.art[0]! && bb <= r.art[1]! && bl >= r.art[2]! && br <= r.art[3]!
  expect(besideName || onArt).toBe(true)
  expect(br).toBeLessThanOrEqual(r.vw)
})
