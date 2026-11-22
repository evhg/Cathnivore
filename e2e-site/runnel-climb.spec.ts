import { expect, test, type Page } from '@playwright/test'
import { climbPuzzle } from '../games/runnel/src/climb'
import { tapsToSolve } from '../games/runnel/src/engine'

// Plan item 653: a new player's first week climbs to the daily. After the lesson a fresh save gets three short
// fields that grow (7, 12, 18 tiles), each with Cath's line and a bloom, then the daily; a reload resumes the climb; a
// save with a daily result goes straight to the daily.
async function solveClimbBoard(page: Page, i: number): Promise<void> {
  const p = climbPuzzle(i)
  await expect(page.locator('#hud-title')).toContainText(`First fields · ${i + 1} of 3`, { timeout: 10_000 })
  await expect(page.locator('.tiles > g.cell')).toHaveCount(p.cells.length)
  await page.waitForTimeout(900) // the board flies in
  for (const [k, c] of p.cells.entries()) {
    for (let n = tapsToSolve(c); n > 0; n--) {
      await page.locator('.tiles > g.cell').nth(k).click({ force: true })
    }
  }
}

test('a fresh save climbs three growing fields after the lesson, then plays the daily', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/runnel/')
  for (let i = 0; i < 3; i++) await page.locator('.tiles > g.cell.lesson-target').click({ force: true })
  await expect(page.locator('#host-line')).toContainText('Three small fields')
  await expect(page.locator('#btn-climb-skip')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('#host-line')).toContainText('Follow the water out from the spring')
  await solveClimbBoard(page, 0)
  await expect(page.locator('#host-line')).toContainText('A bit bigger now')
  // a reload resumes the climb where it reached
  await expect(page.locator('#hud-title')).toContainText('2 of 3', { timeout: 10_000 })
  await page.reload()
  await expect(page.locator('.tiles > g.cell.lesson-target')).toHaveCount(0)
  await expect(page.locator('#host-line')).toContainText("Stones don't turn")
  await solveClimbBoard(page, 1)
  await expect(page.locator('#host-line')).toContainText('Hold it to pin it', { timeout: 10_000 })
  await solveClimbBoard(page, 2)
  await expect(page.locator('#hud-title')).toContainText('Daily #', { timeout: 10_000 })
  await expect(page.locator('#host-line')).toContainText('Warmed up')
  await expect(page.locator('#btn-climb-skip')).toBeHidden()
  // it doesn't come back
  await page.reload()
  await expect(page.locator('#hud-title')).toContainText('Daily #')
})

test('a save with a daily result goes straight to the daily', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('runnel:v1')) return
    localStorage.setItem('runnel:v1', JSON.stringify({ version: 1, daily: {}, practice: {}, results: { '2026-11-01': { number: 40, timeMs: 90000, taps: 20, par: 18 } }, bestPractice: {}, practiceSolved: 0, seenHelp: true, climb: 0 }))
  })
  await page.goto('/runnel/')
  await expect(page.locator('#hud-title')).toContainText('Daily #')
  await expect(page.locator('#btn-climb-skip')).toBeHidden()
})
