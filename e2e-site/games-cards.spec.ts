import { expect, test } from '@playwright/test'
import { dailyPuzzle, utcDateString } from '../games/runnel/src/engine'

// Plan item 13: the games page cards carry key art that holds still until hovered or focused, a status line
// for today, and a continue chip read from each game's save.

test.describe('games page cards', () => {
  test('a first visit gets status lines, no continue chips, and still art', async ({ page }) => {
    await page.goto('/games/')
    const par = dailyPuzzle(utcDateString(new Date())).par
    await expect(page.locator('#status-runnel')).toHaveText(`Today's Runnel: ${par} taps par`)
    await expect(page.locator('#status-hedgerow')).toContainText("Today's daily:")
    for (const g of ['cathnivore', 'runnel', 'hedgerow', 'nightshift']) await expect(page.locator(`#continue-${g}`)).toBeHidden()
    const state = await page.locator('.art-runnel .rn-flow').evaluate((el) => getComputedStyle(el).animationPlayState)
    expect(state).toBe('paused')
  })

  test('saves show continue chips, and a hovered card plays its loop', async ({ page, hasTouch }) => {
    await page.addInitScript(() => {
      const d = new Date().toISOString().slice(0, 10)
      localStorage.setItem('runnel:v1', JSON.stringify({ results: { [d]: { number: 1, timeMs: 1, taps: 21, par: 20 } } }))
      localStorage.setItem('hedgerow:v1', JSON.stringify({ stars: { 1: 3, 2: 2 } }))
      localStorage.setItem('cathode.save', JSON.stringify({ jobsDone: [], checkpoint: { jobId: 'a' } }))
    })
    await page.goto('/games/')
    await expect(page.locator('#continue-runnel')).toHaveText('Solved today in 21 taps')
    await expect(page.locator('#continue-hedgerow')).toHaveText('Continue · level 3 · 5 stars')
    await expect(page.locator('#continue-nightshift')).toHaveText('Continue the job')
    await expect(page.locator('#continue-cathnivore')).toBeHidden()
    if (!hasTouch) {
      const card = page.locator('a.card[href="/hedgerow/"]')
      await card.scrollIntoViewIfNeeded()
      await card.hover()
      await expect.poll(() => page.locator('.art-hedgerow .hg-sails').evaluate((el) => getComputedStyle(el).animationPlayState)).toBe('running')
    }
  })

  test("Cath's week is three goal tiles, each a link with a count", async ({ page }) => {
    await page.goto('/games/')
    const tiles = page.locator('#week-goals .week-goal a')
    await expect(tiles).toHaveCount(3)
    await expect(tiles.first().locator('.wg-count')).toHaveText(/of \d|Done/)
  })
})
