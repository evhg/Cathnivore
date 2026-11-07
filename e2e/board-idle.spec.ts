import { test, expect, type Page } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 249: every tile kind on the board keeps a small idle life (`data-idle`): a grazing sheep on pasture, wheat
// leaning on crop, boats riding the swell on the coast, the capital's clock and pennant. Staggered per region,
// paused while the tab is hidden, and still under reduced motion.
async function start(page: Page) {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await fillSeed(page, '7')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.map .region-hex').first().waitFor()
}
const idle = (page: Page) => page.evaluate(() => [...document.querySelectorAll<SVGElement>('.map [data-idle]')].map((e) => ({
  kind: e.dataset.idle!, anim: getComputedStyle(e).animationName, delay: getComputedStyle(e).animationDelay,
  type: e.closest('[data-region-type]')?.getAttribute('data-region-type') ?? null,
})))

test('every tile kind has an idle life, staggered', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop')
  await page.setViewportSize({ width: 1440, height: 900 })
  await start(page)
  const all = await idle(page)
  for (const kind of ['sheep', 'wheat', 'boat', 'clock', 'pennant']) {
    const of = all.filter((i) => i.kind === kind)
    expect(of.length, kind).toBeGreaterThan(0)
    for (const i of of) expect(i.anim, kind).not.toBe('none')
  }
  // Not all in step: more than one start offset across the board.
  expect(new Set(all.map((i) => i.delay)).size).toBeGreaterThan(1)
})

test('the idle life is still under reduced motion', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await start(page)
  const all = await idle(page)
  expect(all.length).toBeGreaterThan(0)
  for (const i of all) expect(i.anim, i.kind).toBe('none')
})
