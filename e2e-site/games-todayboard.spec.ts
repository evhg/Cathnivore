import { expect, test } from '@playwright/test'

// Plan item 452: a returning visitor's /games/ chalks today's market board in place of the 'Free · No ads' line:
// a tick for each daily played today, the week's dots and the run (a pennant at three days); a first visit has none.
// The wardrobe (shown once a second outfit is earned) no longer pushes the posters below the fold at D.
test('a first visit has no board', async ({ page }) => {
  await page.goto('/games/')
  await expect(page.locator('.hero-meta')).toBeVisible()
  await expect(page.locator('.today-board')).toHaveCount(0)
})

test('seeded saves tick today, chalk the week and fly the pennant, and the posters stay on the first screen', async ({ page }) => {
  await page.goto('/games/')
  await page.evaluate(() => {
    const d = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)
    localStorage.setItem('runnel:v1', JSON.stringify({ results: { [d(0)]: { taps: 31 }, [d(1)]: { taps: 40 } } }))
    localStorage.setItem('cathnivore:daily', JSON.stringify({ results: { [d(2)]: { won: true } } }))
    localStorage.setItem('cathode.save', JSON.stringify({ jobsDone: ['a', 'b'] }))
  })
  await page.reload()
  const board = page.locator('.today-board')
  await expect(board).toBeVisible()
  await expect(board.locator('.today-tag[data-game="runnel"][data-done]')).toContainText('Solved in 31')
  await expect(board.locator('.today-tag[data-done]')).toHaveCount(1)
  await expect(board.locator('.today-dots i[data-on]')).toHaveCount(3)
  await expect(board.locator('.today-pennant')).toHaveText('3-day run')
  const vh = page.viewportSize()!.height
  const poster = await page.locator('.hero-game').first().boundingBox()
  expect(poster!.y).toBeLessThan(vh)
})
