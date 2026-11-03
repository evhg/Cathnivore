import { expect, test } from '@playwright/test'

// Plan item 61: water you can watch. A tap that joins a tile to the river fills it within 600 ms (`data-wet`,
// set when the water really arrives), and a tap that cuts the river drains what lay past the cut.
test('a joining tap fills the tile within 600 ms', async ({ page }) => {
  await page.goto('/runnel/?nohelp&practice')
  await page.waitForSelector('#board .tiles > g.cell')
  await page.evaluate(() => (window as unknown as { runnelTest: { nearlySolve: () => void } }).runnelTest.nearlySolve())
  const last = page.locator('#board [data-last]')
  await expect(last).not.toHaveAttribute('data-wet', '1')
  await last.click()
  await expect(last).toHaveAttribute('data-wet', '1', { timeout: 600 })
})

test('a tap that cuts the river drains it', async ({ page }) => {
  await page.goto('/runnel/?nohelp')
  await page.waitForSelector('#board .tiles > g.cell')
  const wet = page.locator('#board .tiles > g.cell[data-wet]')
  await expect.poll(() => wet.count(), { timeout: 3_000 }).toBeGreaterThan(1)
  // Turn tiles on the river until one turn leaves fewer tiles watered; what lay past the cut drains.
  const candidates = await page.locator('#board .tiles > g.cell.wet:not(.spring):not(.fixed):not(.locked):not(.reservoir)').evaluateAll((gs) =>
    gs.map((g) => [...g.parentElement!.children].indexOf(g)),
  )
  let drained = false
  for (const i of candidates.slice(0, 6)) {
    const before = await wet.count()
    await page.locator('#board .tiles > g.cell').nth(i).click()
    await page.waitForTimeout(450)
    if ((await wet.count()) < before) {
      drained = true
      break
    }
  }
  expect(drained).toBe(true)
})
