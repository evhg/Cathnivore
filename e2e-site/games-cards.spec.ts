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
    // Plan item 38: each tile says what a tap does and nudges with what's left; it opens the goal's mode.
    await expect(tiles.locator('.wg-cta')).toHaveCount(3)
    await expect(tiles.first().locator('.wg-nudge')).toHaveText(/\d to go/)
    await expect(tiles.first()).toHaveAttribute('href', '/runnel/?mode=daily')
    // Each tile wears its own game's colour (NIGHT SHIFT's used to miss it).
    expect(await page.locator('#week-goals .week-goal').evaluateAll((els) => els.map((e) => e.getAttribute('data-game')))).toEqual(['runnel', 'hedgerow', 'nightshift'])
  })

  // Plan item 74: at D every card's name is above the fold; Cath's plank spans her, not past her, and never
  // sits on the first card; the market stall stands on its turf, below the horizon line of the hero text.
  test('the hero leaves the card names in view and its plank and stall sit right', async ({ page }) => {
    await page.goto('/games/')
    await page.waitForTimeout(2600)
    const vp = page.viewportSize()!
    const box = async (sel: string) => (await page.locator(sel).first().boundingBox())!
    const cath = await box('#hero-cath')
    const plank = await page.locator('#hero-cath').evaluate((el) => {
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el, '::after')
      return { left: r.left + parseFloat(s.left), right: r.right - parseFloat(s.right), bottom: r.bottom }
    })
    expect(plank.left).toBeGreaterThanOrEqual(cath.x)
    expect(plank.right).toBeLessThanOrEqual(cath.x + cath.width)
    const card = await box('.games a.card')
    expect(plank.bottom).toBeLessThanOrEqual(card.y)
    if (vp.width >= 1200) {
      // Plan item 85: the four games' names on the first screen are the hero strip's (the section's cards follow).
      for (const t of await page.locator('.hero-games .hero-game-name').all()) {
        const b = (await t.boundingBox())!
        expect(b.y + b.height).toBeLessThanOrEqual(vp.height)
      }
      const stall = await box('.hero-stall')
      const cta = await box('.cta-row')
      expect(stall.y + stall.height).toBeGreaterThan(cta.y + cta.height)
      expect(stall.x + stall.width).toBeLessThanOrEqual(vp.width)
    }
  })
})

// Plan item 85: all four games on the first screen: four hero cards wholly inside 1440x900, at least two inside
// 390x844, none over Cath.
test('the hero shows the four games on the first screen, clear of Cath', async ({ page }) => {
  for (const [vp, need] of [[{ width: 1440, height: 900 }, 4], [{ width: 390, height: 844 }, 2]] as const) {
    await page.setViewportSize(vp)
    await page.goto('/games/')
    const links = page.locator('.hero-games .hero-game')
    await expect(links).toHaveCount(4)
    await expect(links.first()).toBeVisible()
    const m = await page.evaluate(() => {
      const r = (e: Element) => e.getBoundingClientRect()
      return { cards: [...document.querySelectorAll('.hero-game')].map(r).map((b) => ({ l: b.left, t: b.top, r: b.right, b: b.bottom })), cath: (({ left, top, right, bottom }) => ({ l: left, t: top, r: right, b: bottom }))(r(document.querySelector('#hero-cath')!)) }
    })
    const inside = m.cards.filter((c) => c.l >= 0 && c.t >= 0 && c.r <= vp.width && c.b <= vp.height)
    expect(inside.length, `${vp.width}: ${JSON.stringify(m.cards)}`).toBeGreaterThanOrEqual(need)
    for (const c of m.cards) expect(c.l < m.cath.r && c.r > m.cath.l && c.t < m.cath.b && c.b > m.cath.t, `a card over Cath at ${vp.width}`).toBe(false)
    await expect(links.nth(3)).toHaveAttribute('href', '/nightshift/')
  }
})
