import { test, expect } from '@playwright/test'

// Plan item 92: Hollowell has a face. At D, Graham Pell's bust sits at the end of the papers' row, opposite Cath,
// at least 80 px (56 since plan item 190's ticker), clear of the papers and inside the table head, his mood the mirror of hers.
test('Hollowell\'s rival bust docks opposite Cath at D', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop slice; the phone follows')
  for (const [width, height] of [[1440, 900], [1280, 800]] as const) {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await page.getByRole('button', { name: 'Start' }).click()
    const rival = page.locator('[data-rival]')
    await expect(rival).toBeVisible()
    const r = (await rival.locator('.rival-frame').boundingBox())!
    // Plan item 190: the papers fold into a one-line ticker at these sizes, and his medallion steps down to its height.
    expect(r.height, `${width}x${height}`).toBeGreaterThanOrEqual(56)
    // Plan item 118: at these sizes Cath stands at the table's left edge (her line over her head).
    const cath = (await page.locator('.table-cath').boundingBox())!
    const papers = (await page.locator('.plan-strip').boundingBox())!
    // Opposite Cath: right of the papers, and she is at the row's other end (plan item 118: at the table's left edge).
    expect(papers.x + papers.width).toBeLessThanOrEqual(r.x + 1)
    expect(cath.x + cath.width).toBeLessThan(papers.x + papers.width / 2)
    expect(Math.abs(r.y + r.height / 2 - (papers.y + papers.height / 2))).toBeLessThan(40)
    expect(r.x + r.width).toBeLessThanOrEqual(width)
    expect(['smug', 'gloat', 'rattled']).toContain(await rival.getAttribute('data-mood'))
    await expect(rival.getByRole('img', { name: /Graham Pell/ })).toBeVisible()
  }
})

// Plan item 92: tomorrow's papers are Hollowell's glossy memos, not the stall's paper: an orange letterhead band,
// clean-cut (no torn mask) and a background unlike the players' action cards.
test('the threat cards are styled as Hollowell memos', async ({ page }, testInfo) => {
  test.skip(!['phone', 'desktop-chromium'].includes(testInfo.project.name), 'P and D')
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.plan-strip-item > button').first()).toBeVisible()
  const s = await page.evaluate(() => {
    const memo = getComputedStyle(document.querySelector('.plan-strip-item > button')!)
    const card = getComputedStyle(document.querySelector('.action-item button, .action-item')!)
    return { memo: memo.backgroundImage, mask: memo.maskImage || memo.webkitMaskImage, card: card.backgroundImage + card.backgroundColor }
  })
  expect(s.memo).toContain('rgb(255, 122, 26)')
  expect(s.mask === 'none' || s.mask === '').toBe(true)
  expect(s.memo).not.toBe(s.card)
})
