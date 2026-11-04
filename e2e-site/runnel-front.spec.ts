import { expect, test } from '@playwright/test'

// Plan item 97: the water front you can follow. Spills are marked `[data-spill]`; a tap that opens a new spill
// lands it with a splash once the front gets there; reduced motion fills at once, with no splash.
const cells = '#board .tiles > g.cell'
const turnable = `${cells}:not(.spring):not(.fixed):not(.locked):not(.reservoir)`

test('a spill is marked, and a tap that opens one splashes', async ({ page }) => {
  await page.goto('/runnel/?nohelp')
  await page.waitForSelector(cells)
  await page.waitForTimeout(600)
  const all = await page.locator(turnable).evaluateAll((gs) => gs.map((g) => [...g.parentElement!.children].indexOf(g)))
  let splashed = false
  for (const i of all.slice(0, 24)) {
    await page.locator(cells).nth(i).click()
    if (await page.locator('#board .puddle.splash[data-spill]').count()) {
      splashed = true
      break
    }
  }
  expect(splashed).toBe(true)
  await expect(page.locator('#board [data-spill]').first()).toBeAttached()
})

test('under reduced motion a joining tap fills at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/runnel/?nohelp&practice')
  await page.waitForSelector(cells)
  await page.evaluate(() => (window as unknown as { runnelTest: { nearlySolve: () => void } }).runnelTest.nearlySolve())
  const last = page.locator('#board [data-last]')
  await last.click()
  await expect(last).toHaveAttribute('data-wet', '1', { timeout: 100 })
  await expect(page.locator('#board .splash-ring')).toHaveCount(0)
})
