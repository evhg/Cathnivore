import { expect, test } from '@playwright/test'

// Plan item 478: a solve can be watched again on the real board from the win strip: Watch shows when the solve's turns
// were logged, plays its frames (`data-replay-step` counts them), and ends on the watered board with the strip and the
// board where they were.
test('Watch replays the solve on the board and ends where it was solved', async ({ page }) => {
  await page.goto('/runnel/?nohelp&shotsolve')
  await page.waitForSelector('#board .tiles > g.cell[data-last]')
  await page.locator('#board .tiles > g.cell[data-last]').click()
  const watch = page.locator('#strip-watch')
  await expect(watch).toBeVisible({ timeout: 10_000 })
  await expect(watch).toHaveAttribute('data-replay', '')
  await page.waitForTimeout(1200) // the strip's slide-in and the solve's bloom settle
  const solved = await page.evaluate(() => [...document.querySelectorAll<SVGGElement>('#board .tiles > g.cell .piece')].map((p) => p.style.transform))
  const box = async (sel: string) => (await page.locator(sel).boundingBox())!
  const [strip0, board0] = [await box('#win-strip'), await box('#board')]
  await watch.click()
  await expect(page.locator('body')).toHaveAttribute('data-replay', 'on')
  await expect(page.locator('body')).toHaveAttribute('data-replay-step', '1', { timeout: 8_000 })
  await expect(page.locator('body')).toHaveAttribute('data-replay', 'done', { timeout: 9_000 })
  // ends on the solved board: every tile's heading is where the solve left it (mod a full turn)
  const after = await page.evaluate(() => [...document.querySelectorAll<SVGGElement>('#board .tiles > g.cell .piece')].map((p) => p.style.transform))
  const deg = (t: string) => ((Number(/rotate\((-?[\d.]+)deg\)/.exec(t)?.[1] ?? 0) % 360) + 360) % 360
  expect(after.map(deg)).toEqual(solved.map(deg))
  const [strip1, board1] = [await box('#win-strip'), await box('#board')]
  expect(Math.abs(strip1.y - strip0.y), JSON.stringify({ strip0, strip1 })).toBeLessThanOrEqual(1)
  expect(Math.abs(board1.y - board0.y), JSON.stringify({ board0, board1 })).toBeLessThanOrEqual(1)
})

// A win with no logged turns (the shot hook's instant finish) offers no Watch.
test('no Watch without a logged solve', async ({ page }) => {
  await page.goto('/runnel/?nohelp&shotwin')
  await expect(page.locator('#strip-card')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('#strip-watch')).toBeHidden()
})
