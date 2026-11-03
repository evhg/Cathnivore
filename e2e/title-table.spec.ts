import { test, expect } from '@playwright/test'

// Plan item 60: the title opens on the real table. Cath stands beside the board, never over it; every menu entry is
// reachable from the keyboard; a save with chapter 1 won shows its two freed regions with bunting.
test('the title table: Cath beside the board, the menu by keyboard, freed regions with bunting', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cathnivore:campaign:v1', JSON.stringify({ version: 1, completed: ['fresh-meat'] })))
  await page.goto('/')
  const board = page.locator('.title-board svg.map')
  await expect(board).toBeVisible()
  const cath = (await page.locator('.title-cath svg').boundingBox())!
  const b = (await board.boundingBox())!
  expect(cath.x + cath.width <= b.x + 1 || cath.y + cath.height <= b.y + 1 || cath.y >= b.y + b.height - 1, 'Cath over the board').toBe(true)
  // Chapter 1 frees Brindle Hills and Highmoor: they fly bunting; Kingsmarket is still Hollowell's.
  for (const id of ['brindleHills', 'highmoor']) await expect(page.locator(`.title-board [data-region="${id}"] .bunting-flag`).first()).toBeAttached()
  await expect(page.locator('.title-board [data-region="kingsmarket"] .bunting-flag')).toHaveCount(0)
  // The keyboard reaches every menu entry.
  const want = ['Campaign', 'Quick Game', 'Daily Market', 'How to Play', 'Settings', 'Credits']
  const seen = new Set<string>()
  for (let i = 0; i < 20 && seen.size < want.length; i++) {
    await page.keyboard.press('Tab')
    const t = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.innerText ?? '')
    for (const w of want) if (t.includes(w)) seen.add(w)
  }
  expect([...seen].sort()).toEqual([...want].sort())
})
