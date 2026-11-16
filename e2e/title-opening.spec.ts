import { expect, test } from '@playwright/test'

// Plan item 453: the tall phone's title opens once a day on a short scene (the awning unrolls, Cath steps in and
// waves, the tags drop, the vans start): over within 1200 ms, a tap skips it, reduced motion fades. Under webdriver
// it plays only with `?opening`.
const opening = (page: import('@playwright/test').Page) => page.evaluate(() => document.querySelector<HTMLElement>('.title-screen')?.dataset.opening ?? null)

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'the upright phone')
  await page.setViewportSize({ width: 390, height: 844 })
})

test('the opening plays, ends by 1200 ms and leaves the awning over Cath', async ({ page }) => {
  await page.goto('/?opening')
  await page.locator('.title-cath svg').waitFor()
  expect(await opening(page)).toBe('run')
  // the tags are still on their way down early on
  const early = await page.evaluate(() => Number(getComputedStyle(document.querySelector('.title-menu > .title-cta')!).opacity))
  expect(early).toBeLessThan(1)
  await expect.poll(() => opening(page), { timeout: 2500 }).toBe('done')
  const awning = (await page.locator('.title-awning').boundingBox())!
  const line = (await page.locator('.title-cath-line').boundingBox())!
  expect(awning.width).toBeGreaterThanOrEqual(388)
  expect(awning.y + awning.height).toBeLessThanOrEqual(line.y + 2)
})

test('a tap skips the opening and everything rests in place', async ({ page }) => {
  await page.goto('/?opening')
  await page.locator('.title-cath svg').waitFor()
  expect(await opening(page)).toBe('run')
  await page.mouse.click(195, 90)
  expect(await opening(page)).toBe('done')
  const m = await page.evaluate(() => ({
    cath: getComputedStyle(document.querySelector('.title-art .title-cath')!).animationName,
    tags: [...document.querySelectorAll('.title-menu > *')].map((e) => Number(getComputedStyle(e).opacity)),
  }))
  expect(m.cath).toBe('none')
  for (const o of m.tags) expect(o).toBe(1)
})

test('specs and later loads open straight on the menu', async ({ page }) => {
  await page.goto('/')
  await page.locator('.title-cath svg').waitFor()
  expect(await opening(page)).toBeNull()
})

test('reduced motion gets a fade, not the scene', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?opening')
  await page.locator('.title-cath svg').waitFor()
  const m = await page.evaluate(() => ({
    hero: getComputedStyle(document.querySelector('.title-hero')!).animationName,
    cath: getComputedStyle(document.querySelector('.title-art .title-cath')!).animationName,
  }))
  expect(m.hero).toBe('title-opening-fade')
  expect(m.cath).not.toBe('title-cath-step')
})
