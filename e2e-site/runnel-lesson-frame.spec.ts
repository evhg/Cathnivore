import { expect, test } from '@playwright/test'

// Plan item 77: the first-visit lesson fills the valley too. Its four tiles span at least 60% of the frame's
// shorter side, the lesson card ticks off the taps, the left column at D has no blank band over 100 px, Cath is
// on screen, and the page never scrolls.

const tileSpan = () => {
  const boxes = [...document.querySelectorAll('#board polygon.tile')].map((t) => t.getBoundingClientRect())
  const w = Math.max(...boxes.map((b) => b.right)) - Math.min(...boxes.map((b) => b.left))
  const h = Math.max(...boxes.map((b) => b.bottom)) - Math.min(...boxes.map((b) => b.top))
  const st = document.querySelector('.stage')!.getBoundingClientRect()
  return Math.max(w, h) / Math.min(st.width, st.height)
}

test('the lesson board fills its frame, with the lesson card and Cath beside it', async ({ page, hasTouch }) => {
  await page.goto('/runnel/?lesson')
  await expect(page.locator('#lesson-card')).toBeVisible()
  expect(await page.evaluate(tileSpan)).toBeGreaterThanOrEqual(0.6)
  await expect(page.locator('.lc-steps li.now')).toHaveAttribute('data-i', '0')
  await expect(page.locator('#host-face')).toBeVisible()
  expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= innerHeight + 1)).toBe(true)
  if (!hasTouch) {
    await expect(page.locator('#valley-cath svg')).toBeVisible()
    await expect(page.locator('.lc-next svg')).toBeVisible()
    // The left column: no blank band over 100 px between its blocks, from the header to the hint.
    const gaps = await page.evaluate(() => {
      const els = ['.top', '.host', '#lesson-card', '.foot'].map((s) => document.querySelector(s)!.getBoundingClientRect())
      els.sort((a, b) => a.top - b.top)
      return els.slice(1).map((b, i) => b.top - els[i]!.bottom)
    })
    for (const g of gaps) expect(g).toBeLessThanOrEqual(100)
  }
  // A tap on the glowing tile ticks step 1 and lights step 2.
  await page.locator('.tiles > g.cell.lesson-target').click()
  await expect(page.locator('.lc-steps li[data-i="0"]')).toHaveClass(/done/)
  await expect(page.locator('.lc-steps li.now')).toHaveAttribute('data-i', '1')
})

test('the lesson column fits a 1280x800 screen without scrolling', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'desktop size')
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/runnel/?lesson')
  await expect(page.locator('#lesson-card')).toBeVisible()
  expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= innerHeight + 1)).toBe(true)
  const card = (await page.locator('#lesson-card').boundingBox())!
  const foot = (await page.locator('.foot').boundingBox())!
  expect(card.y + card.height).toBeLessThanOrEqual(foot.y + 1)
})
