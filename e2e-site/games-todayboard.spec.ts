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
  // Plan item 640: at D the stall's slate carries the board (ticks, the week's dots, the run) and the words' own folds
  const booth = await page.locator('.stall-slate').isVisible()
  if (booth) {
    await expect(page.locator('.today-board')).toBeHidden()
    const slate = page.locator('.stall-slate')
    await expect(slate.locator('a[data-game="runnel"][data-done]')).toContainText('Solved in 31')
    await expect(slate.locator('a[data-done]')).toHaveCount(1)
    await expect(slate.locator('.slate-week i[data-on]')).toHaveCount(3)
    await expect(slate.locator('.slate-streak[data-pennant]')).toHaveText('3-day run')
    const vh = page.viewportSize()!.height
    expect((await page.locator('.hero-game').first().boundingBox())!.y).toBeLessThan(vh)
    // the wardrobe (two jobs earn a second outfit) hangs in the sky clear of the awning's board and its kicker
    const wardrobe = page.locator('#wardrobe')
    if (await wardrobe.isVisible()) {
      const w = (await wardrobe.boundingBox())!
      const words = (await page.locator('.hero-text').boundingBox())!
      const cath = (await page.locator('#hero-cath svg').boundingBox())!
      expect(w.x + w.width).toBeLessThanOrEqual(Math.min(words.x, cath.x))
    }
    return
  }
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

// Plan item 674: the slate is a chalked board, not a form list: each line its game's own sign (20 px+, no ring
// bullets), a 44 px+ link, and a solved Runnel daily chalks a gold tick over its sign.
test("the slate chalks each game's sign and ticks a solved daily", async ({ page }) => {
  await page.goto('/games/')
  await page.evaluate(() => {
    const d = new Date().toISOString().slice(0, 10)
    localStorage.setItem('runnel:v1', JSON.stringify({ results: { [d]: { taps: 31 } } }))
  })
  await page.reload()
  const slate = page.locator('.stall-slate')
  test.skip(!(await slate.isVisible()), 'the desktop stall')
  await expect(slate.locator('a')).toHaveCount(4)
  const m = await slate.evaluate((s) =>
    [...s.querySelectorAll('a')].map((a) => ({
      game: a.dataset.game,
      h: a.getBoundingClientRect().height,
      icon: a.querySelector('.slate-icon')?.getBoundingClientRect().width ?? 0,
      ring: /[○◯]/.test(a.textContent ?? ''),
      tick: !!a.querySelector('.slate-tick'),
    })),
  )
  for (const l of m) {
    expect(l.h, l.game).toBeGreaterThanOrEqual(44)
    expect(l.icon, l.game).toBeGreaterThanOrEqual(20)
    expect(l.ring, l.game).toBe(false)
    expect(l.tick, l.game).toBe(l.game === 'runnel')
  }
})
