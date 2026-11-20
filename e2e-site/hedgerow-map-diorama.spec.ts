import { expect, test } from '@playwright/test'

// Plan item 471: on a desktop 860 px tall or more every stop is a diorama of its landmark 110 px wide or more, no two
// stops side by side share a landmark, and act 1's ten stops (their names too) stay inside a 1440x900 window.
test('at 1440x900 each stop is a 110 px landmark, no neighbours alike, the act inside the window', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the desktop map')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/hedgerow/?2d')
  await page.evaluate(() => {
    const stars: Record<number, number> = { 1: 3, 2: 3, 3: 3 }
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { 1: true, 2: true, 3: true, 4: true }, seen: {}, tips: { all: true }, bank: {} }))
  })
  await page.goto('/hedgerow/?2d')
  await page.waitForSelector('#screen-select .node.next .you')
  await page.waitForTimeout(1200)
  const r = await page.evaluate(() => {
    const act = document.querySelector('#screen-select .node.next')!.closest('li.act')!
    const nodes = [...act.querySelectorAll<HTMLElement>('.node')]
    return nodes.map((n) => {
      const c = n.querySelector('.level-num')!.getBoundingClientRect()
      const name = n.querySelector('.level-name')!.getBoundingClientRect()
      return { landmark: n.dataset.landmark ?? '', w: c.width, nameBottom: name.bottom + scrollY }
    })
  })
  expect(r.length).toBe(10)
  for (const [i, s] of r.entries()) {
    expect(s.w, `stop ${i + 1}`).toBeGreaterThanOrEqual(110)
    expect(s.landmark, `stop ${i + 1}`).not.toBe('')
    if (i) expect(s.landmark, `stop ${i + 1}`).not.toBe(r[i - 1]!.landmark)
    expect(s.nameBottom, `stop ${i + 1}`).toBeLessThanOrEqual(900)
  }
})
