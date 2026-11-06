import { expect, test } from '@playwright/test'

// Plan item 207: on an upright phone the header is a signboard with 44 px tokens, and Cath's line sits off the board.
test('the phone header is a signboard; her line clears the board', async ({ page }) => {
  test.skip(page.viewportSize()!.width > 600, 'the upright phone')
  await page.goto('/runnel/?nohelp')
  await page.waitForSelector('#board .tiles > g.cell')
  await page.waitForTimeout(600)
  await expect(page.locator('.top[data-signboard]')).toBeVisible()
  for (const id of ['#btn-sound', '#btn-stats', '#btn-help']) {
    const b = (await page.locator(id).boundingBox())!
    expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(44)
  }
  const line = await page.evaluate(() => {
    const say = [...document.querySelectorAll<HTMLElement>('#host-line, #valley-say')].find((e) => e.offsetWidth > 0 && getComputedStyle(e).visibility !== 'hidden')!
    const r = say.getBoundingClientRect()
    const tiles = [...document.querySelectorAll('#board polygon.tile')].map((t) => t.getBoundingClientRect())
    return { meets: tiles.some((t) => t.left < r.right && r.left < t.right && t.top < r.bottom && r.top < t.bottom), size: parseFloat(getComputedStyle(say).fontSize) }
  })
  expect(line.meets).toBe(false)
  expect(line.size).toBeGreaterThanOrEqual(14)
})

// Plan item 217: the wordmark kept 2 px from the sound token; it keeps 8 px or more from it and from Back.
test('the signboard wordmark clears Back and the sound token', async ({ page }) => {
  test.skip(page.viewportSize()!.width > 600, 'the upright phone')
  await page.goto('/runnel/?nohelp')
  await page.waitForSelector('#board .tiles > g.cell')
  await page.evaluate(() => document.fonts.ready)
  const r = await page.evaluate(() => {
    const box = (s: string) => document.querySelector(s)!.getBoundingClientRect()
    return { wm: box('.top .wordmark'), back: box('.top .back'), sound: box('#btn-sound') }
  })
  expect(r.sound.left - r.wm.right).toBeGreaterThanOrEqual(8)
  expect(r.wm.left - r.back.right).toBeGreaterThanOrEqual(8)
})
