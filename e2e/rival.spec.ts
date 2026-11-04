import { test, expect } from '@playwright/test'

// Plan item 92: Hollowell has a face. At D, Julian Crisp's bust sits at the end of the papers' row, opposite Cath,
// at least 80 px, clear of the papers and inside the table head, his mood the mirror of hers.
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
    expect(r.height, `${width}x${height}`).toBeGreaterThanOrEqual(80)
    const cath = (await page.locator('.cath-companion').boundingBox())!
    const papers = (await page.locator('.plan-strip').boundingBox())!
    // Opposite Cath: right of the papers, which are right of her, and on the same row.
    expect(papers.x + papers.width).toBeLessThanOrEqual(r.x + 1)
    expect(cath.x + cath.width).toBeLessThanOrEqual(papers.x + 1)
    expect(Math.abs(r.y + r.height / 2 - (papers.y + papers.height / 2))).toBeLessThan(40)
    expect(r.x + r.width).toBeLessThanOrEqual(width)
    expect(['smug', 'irritated', 'rattled']).toContain(await rival.getAttribute('data-face'))
    await expect(rival.getByRole('img', { name: /Julian Crisp/ })).toBeVisible()
  }
})
