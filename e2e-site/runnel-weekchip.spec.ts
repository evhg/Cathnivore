import { expect, test } from '@playwright/test'

// Plan item 677: Cath's Week chip counts a solve at once (it read 'Solve 3 dailies (0/3)' over a solved daily while
// the rail read 1 solved: the chip was only built at load).
test("a solved daily counts on Cath's Week chip without a reload", async ({ page }) => {
  await page.goto('/runnel/')
  await page.evaluate(() => localStorage.setItem('runnel:v1', JSON.stringify({ version: 1, climbDone: true, seenHelp: true })))
  await page.goto('/runnel/?nohelp&mode=daily')
  await page.waitForSelector('#board .tiles > g.cell')
  const chip = page.locator('#week-slot a.week-chip')
  await expect(chip).toContainText('(0/3)')
  await page.evaluate(() => (window as unknown as { runnelTest: { nearlySolve: () => void } }).runnelTest.nearlySolve())
  await page.locator('#board [data-last]').click()
  await expect(chip).toContainText('(1/3)')
  await expect(page.locator('#week-slot a.week-chip')).toHaveCount(1)
})
