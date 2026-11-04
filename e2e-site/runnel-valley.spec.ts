import { expect, test } from '@playwright/test'

// Plan items 70 and 77: the daily sits in a valley. The tiles fill the board's frame (60% of its shorter side or more), a
// stream bed runs from the spring house to Bea's garden and fills as fields are watered, and at D Cath stands in
// the corner the board leaves empty, never on a tile. No page scroll at P.

const tileBox = () => {
  const boxes = [...document.querySelectorAll('#board .tile')].map((t) => t.getBoundingClientRect())
  return {
    w: Math.max(...boxes.map((b) => b.right)) - Math.min(...boxes.map((b) => b.left)),
    h: Math.max(...boxes.map((b) => b.bottom)) - Math.min(...boxes.map((b) => b.top)),
  }
}

for (const date of ['2026-11-03', '2026-11-08']) {
  test(`the board fills its valley, with the stream and Cath clear of the tiles (${date})`, async ({ page, hasTouch }) => {
    await page.clock.setFixedTime(new Date(`${date}T10:00:00Z`))
    await page.goto('/runnel/?nohelp')
    await expect(page.locator('.tiles > g.cell').first()).toBeVisible()
    const frame = (await page.locator('.stage').boundingBox())!
    const tiles = await page.evaluate(tileBox)
    expect(Math.max(tiles.w, tiles.h) / Math.min(frame.width, frame.height)).toBeGreaterThanOrEqual(0.6)
    await expect(page.locator('.valley')).toBeVisible()
    // No blank band over 120 px between the tiles and the frame on either axis.
    const gaps = await page.evaluate(() => {
      const st = document.querySelector('.stage')!.getBoundingClientRect()
      const boxes = [...document.querySelectorAll('#board .tile')].map((t) => t.getBoundingClientRect())
      const l = Math.min(...boxes.map((b) => b.left)), r = Math.max(...boxes.map((b) => b.right))
      const t = Math.min(...boxes.map((b) => b.top)), b = Math.max(...boxes.map((b) => b.bottom))
      const bar = document.querySelector('.progress')!.getBoundingClientRect()
      return [l - st.left, st.right - r, t - st.top, Math.min(bar.top, st.bottom) - b]
    })
    for (const g of gaps) expect(g).toBeLessThanOrEqual(120)
    if (hasTouch) {
      expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= innerHeight + 1)).toBe(true)
      return
    }
    // The day card paints the board's sky beside the daily's name and numbers, on one line.
    await expect(page.locator('#hud-sky svg')).toBeVisible()
    const statsH = (await page.locator('.hud-stats').boundingBox())!.height
    expect(statsH).toBeLessThan(40)
    const cath = page.locator('#valley-cath')
    await expect(cath.locator('svg')).toBeVisible()
    const clash = await page.evaluate(() => {
      const r = document.getElementById('valley-cath')!.getBoundingClientRect()
      return [...document.querySelectorAll('#board polygon.tile')].some((t) => {
        const b = t.getBoundingClientRect()
        return b.left < r.right - 12 && r.left + 12 < b.right && b.top < r.bottom - 12 && r.top + 12 < b.bottom
      })
    })
    expect(clash).toBe(false)
  })
}

test('the stream fills to the garden at a solve, with Cath still in the valley', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'Cath stands in the valley at D')
  await page.goto('/runnel/?nohelp')
  await expect(page.locator('.tiles > g.cell').first()).toBeVisible()
  const wet = () => page.locator('#valley-water').evaluate((el) => parseFloat(getComputedStyle(el).getPropertyValue('--wet')) || 0)
  const before = await wet()
  expect(before).toBeLessThan(1)
  await page.goto('/runnel/?nohelp&shotsolve')
  // Today's seed packet in Bea's garden gives way to a sprout once play starts.
  await expect(page.locator('.bed-today .bed-sprout')).toBeHidden()
  // Six turns bring a hex tile back round, so the board stays one tap from solved.
  for (let k = 0; k < 6; k++) await page.locator('.tiles > g.cell:not(.stone):not(.fixed)').nth(2).click()
  await expect(page.locator('.bed-today .bed-sprout')).toBeVisible()
  await page.locator('[data-last]').click()
  await expect.poll(wet).toBe(1)
  await expect(page.locator('#valley-cath svg')).toBeVisible()
})
