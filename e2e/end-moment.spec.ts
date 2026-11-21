import { expect, test } from '@playwright/test'

// Plan item 48: the end screen is a moment, with the result in view at once: Cath, the stamp, the headline, the
// final board (plan item 614; the chart too at D) and Play again all on screen without scrolling, and nothing of the chart under the sticky action bar.
test('the end screen shows Cath, the headline, the chart and Play again without scrolling', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/?e2eAutoplay=1')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.end-screen').waitFor({ timeout: 60_000 })
  await page.waitForTimeout(3000)
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  const vh = page.viewportSize()!.height
  const bar = (await page.locator('.end-actions').boundingBox())!
  // Plan item 614: the final board is the hero, so it (not the chart) stands above the bar on a phone.
  const vw = page.viewportSize()!.width
  const sels = ['.end-screen-cath', '.end-stamp', '.end-screen h1', '.end-screen-map']
  if (vw >= 1200) sels.push('.end-chart')
  for (const sel of sels) {
    const b = (await page.locator(sel).boundingBox())!
    expect(b.y, `${sel} top`).toBeGreaterThanOrEqual(0)
    expect(b.y + b.height, `${sel} clear of the action bar`).toBeLessThanOrEqual(bar.y + 1)
  }
  const board = (await page.locator('.end-screen-map').boundingBox())!
  if (vw < 600) expect(board.width, 'the board at P').toBeGreaterThanOrEqual(340)
  if (vw >= 1200) expect(board.width / vw, 'the board at D').toBeGreaterThanOrEqual(0.45)
  // The play of the game is pinned on its region on the board.
  const playRegion = await page.locator('.end-play').getAttribute('data-region')
  if (playRegion) await expect(page.locator(`.end-screen-map [data-featured="${playRegion}"]`)).toHaveCount(1)
  const play = (await page.getByRole('button', { name: /Play again/ }).boundingBox())!
  expect(play.y + play.height).toBeLessThanOrEqual(vh)
  // Cath stands in the pose for the result.
  const won = await page.locator('.end-screen.is-win').count()
  await expect(page.locator('.end-screen-cath svg')).toHaveAttribute('class', new RegExp(won ? 'cheer' : 'crossed'))
  // Plan item 614: the producers take the result beside the board (a cheer or a slump), standing in the rail at D.
  await expect(page.locator('.end-cast')).toHaveAttribute('data-end-cast', won ? 'cheer' : 'slump')
  expect(await page.locator('.end-cast [data-end-producer]').count()).toBeGreaterThan(0)
  if (vw >= 1200) {
    const cast = (await page.locator('.end-cast').boundingBox())!
    expect(cast.x, 'the cast in the rail, right of the board').toBeGreaterThanOrEqual(board.x + board.width - 1)
    expect(cast.y + cast.height, 'the cast clear of the action bar').toBeLessThanOrEqual(bar.y + 1)
  }
})

test('a tap skips the end screen sequence', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/?e2eAutoplay=1')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.end-screen').waitFor({ timeout: 60_000 })
  await page.locator('.end-screen h1').click()
  await expect(page.locator('.end-screen')).toHaveClass(/end-skip/)
  // The grade, stamped last (2.1 s in), is there at once.
  await expect.poll(() => page.locator('.end-grade').evaluate((e) => Number(getComputedStyle(e).opacity)), { timeout: 600 }).toBeGreaterThan(0.95)
})
