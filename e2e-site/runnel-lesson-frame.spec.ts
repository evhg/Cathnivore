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
  // Plan item 122: one Cath. At D the valley figure speaks the lesson (the portrait goes) and points at the
  // glowing tile. Plan item 165: a phone's one Cath stands in the valley (the card's portrait goes).
  if (hasTouch) {
    await expect(page.locator('#valley-cath[data-cath-figure] svg')).toBeVisible()
    await expect(page.locator('#host-face')).toBeHidden()
  } else {
    await expect(page.locator('#valley-cath svg')).toBeVisible()
    await expect(page.locator('#valley-say')).toBeVisible()
    await expect(page.locator('#valley-cath')).toHaveAttribute('data-pose', 'point')
    const off = await page.evaluate(() => {
      const cath = document.getElementById('valley-cath')!
      const m = cath.querySelector('svg')!.getScreenCTM()!
      const s = new DOMPoint(266, 300).matrixTransform(m)
      const t = document.querySelector('.tiles > g.cell.lesson-target')!.getBoundingClientRect()
      const want = (Math.atan2(t.top + t.height / 2 - s.y, t.left + t.width / 2 - s.x) * 180) / Math.PI
      return Math.abs(want - parseFloat(cath.dataset.aim!))
    })
    expect(off).toBeLessThanOrEqual(20)
  }
  expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= innerHeight + 1)).toBe(true)
  if (!hasTouch) {
    await expect(page.locator('.lc-next svg')).toBeVisible()
    // The left column: no blank band over 100 px between its blocks, from the header to the hint.
    const gaps = await page.evaluate(() => {
      const sel = ['.top', '#lesson-card', '.foot']
      if (document.querySelector<HTMLElement>('.app')!.dataset.valleySay === undefined) sel.splice(1, 0, '.host')
      const els = sel.map((s) => document.querySelector(s)!.getBoundingClientRect())
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
