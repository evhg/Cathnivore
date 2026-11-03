import { expect, test } from '@playwright/test'

// Plan item 71: the title table lives. Cath stands large beside it (360 px or more at D, 160 px on a phone) and
// never over the menu; Hollowell's vans drive its roads; under reduced motion nothing on the table moves; the
// board's marks are 12 px or more, or left off; Cath's face follows the menu entry under the pointer or focus.
test('Cath is large beside the table and clear of the menu', async ({ page }, testInfo) => {
  test.skip(!['phone', 'desktop-chromium'].includes(testInfo.project.name), 'P and D')
  await page.goto('/')
  await page.locator('.title-cath svg').waitFor()
  const cath = (await page.locator('.title-cath svg').boundingBox())!
  const menu = (await page.locator('.title-menu').boundingBox())!
  const min = testInfo.project.name === 'phone' ? 160 : 360
  expect(cath.height).toBeGreaterThanOrEqual(min)
  const overlapX = Math.min(cath.x + cath.width, menu.x + menu.width) - Math.max(cath.x, menu.x)
  const overlapY = Math.min(cath.y + cath.height, menu.y + menu.height) - Math.max(cath.y, menu.y)
  expect(overlapX <= 0 || overlapY <= 0).toBe(true)
  // Every visible board label is 12 px or more.
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<SVGTextElement>('.title-board .map text')]
      .filter((t) => t.getClientRects().length && getComputedStyle(t).display !== 'none' && (t.closest('g') as Element | null)?.getClientRects().length)
      .filter((t) => getComputedStyle(t).visibility !== 'hidden' && t.getBoundingClientRect().width > 0)
      .map((t) => ({ t: t.textContent, px: parseFloat(getComputedStyle(t).fontSize) * (t.getScreenCTM()?.a ?? 1) }))
      .filter((x) => x.px < 11.95 && !/^\d$|^\?$/.test(x.t ?? '')),
  )
  expect(small).toEqual([])
})

test('the vans drive the roads, and reduced motion parks them', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'once')
  await page.goto('/')
  await expect(page.locator('.title-movers .title-van')).toHaveCount(2)
  expect(await page.locator('.title-movers animateMotion').count()).toBe(2)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('.title-movers .title-van')).toHaveCount(2)
  expect(await page.locator('.title-movers animateMotion').count()).toBe(0)
  // Nothing on the table runs a CSS animation either.
  const running = await page.evaluate(() => document.getAnimations().filter((a) => {
    const t = (a.effect as KeyframeEffect | null)?.target as Element | null
    return !!t?.closest('.title-table') && a.playState === 'running'
  }).length)
  expect(running).toBe(0)
})

test('Cath\'s face follows the menu', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'a pointer and a keyboard')
  await page.goto('/')
  await expect(page.locator('.title-cath svg.cath-smirk')).toHaveCount(1)
  await page.getByRole('button', { name: /^Campaign/ }).hover()
  await expect(page.locator('.title-cath svg.cath-determined')).toHaveCount(1)
  await page.getByRole('button', { name: /^Quick Game/ }).focus()
  await expect(page.locator('.title-cath svg.cath-delighted')).toHaveCount(1)
})
