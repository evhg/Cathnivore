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
  test('the hero leaves the card names in view, Cath grounded and the stall sitting right', async ({ page }) => {
    await page.goto('/games/')
    await page.waitForTimeout(2600)
    const vp = page.viewportSize()!
    const box = async (sel: string) => (await page.locator(sel).first().boundingBox())!
    const cath = await box('#hero-cath')
    // Plan item 85: she stands head to boots in the diorama (no plank), her feet on the first screen and above the cards.
    const plank = await page.locator('#hero-cath').evaluate((el) => getComputedStyle(el, '::after').display)
    expect(plank).toBe('none')
    const card = await box('.games a.card')
    expect(cath.y + cath.height).toBeLessThanOrEqual(card.y)
    // Plan item 96: on a phone the posters (each with Cath in that game's dress) take the first screen and her full
    // figure follows them; at D she stands on it whole.
    if (vp.width >= 900) expect(cath.y + cath.height).toBeLessThanOrEqual(vp.height)
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

// Plan item 85: the hero's words hold 4.5:1 or more against what is behind them (the 90th-percentile brightest
// pixel behind each line's box, with the words made transparent), at P and D.
test('the hero text reads at 4.5:1 or more against the sunset', async ({ page }) => {
  for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(vp)
    await page.goto('/games/')
    await page.waitForTimeout(3200)
    for (const sel of ['.hero .kicker', '.hero .lede', '.hero-meta', '.btn-cta-glass']) {
      const el = page.locator(sel).first()
      const box = (await el.boundingBox())!
      const ink = await el.evaluate((e) => getComputedStyle(e).color)
      await el.evaluate((e) => ((e as HTMLElement).style.color = 'transparent'))
      await page.addStyleTag({ content: `${sel} * { color: transparent !important; }` })
      const shot = (await page.screenshot({ clip: box })).toString('base64')
      await el.evaluate((e) => ((e as HTMLElement).style.color = ''))
      const ratio = await page.evaluate(async ([png, fill]) => {
        const img = new Image()
        img.src = `data:image/png;base64,${png}`
        await img.decode()
        const c = document.createElement('canvas')
        c.width = img.width
        c.height = img.height
        const x = c.getContext('2d')!
        x.drawImage(img, 0, 0)
        const d = x.getImageData(0, 0, c.width, c.height).data
        const lin = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4)
        const lum = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
        const ls: number[] = []
        for (let i = 0; i < d.length; i += 4) ls.push(lum(d[i]!, d[i + 1]!, d[i + 2]!))
        ls.sort((a, b) => a - b)
        const [r, g, b, a = 1] = fill.match(/[\d.]+/g)!.map(Number)
        const bg = ls[Math.floor(ls.length * 0.9)]!
        // A translucent ink is blended over the background it sits on.
        const text = lum(r!, g!, b!) * a + bg * (1 - a)
        return (Math.max(text, bg) + 0.05) / (Math.min(text, bg) + 0.05)
      }, [shot, ink] as const)
      expect(ratio, `${sel} at ${vp.width}`).toBeGreaterThanOrEqual(4.5)
    }
  }
})

// Plan item 96: each game a key-art poster: art 240 px wide or more at D, 160 at P, all four in the first viewport
// at D, no sideways scroll at P, copy 14 px or more, Cath on every poster.
test('the four games are posters on the first screen', async ({ page }) => {
  for (const [vp, art] of [[{ width: 1440, height: 900 }, 240], [{ width: 390, height: 844 }, 160]] as const) {
    await page.setViewportSize(vp)
    await page.goto('/games/')
    const posters = page.locator('.hero-games .hero-game')
    await expect(posters).toHaveCount(4)
    const m = await page.evaluate(() => ({
      art: [...document.querySelectorAll('.hero-game-art')].map((e) => e.getBoundingClientRect().width),
      boxes: [...document.querySelectorAll('.hero-game')].map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom] }),
      copy: [...document.querySelectorAll('.hero-game-hook, .hero-game-play')].map((e) => parseFloat(getComputedStyle(e).fontSize)),
      caths: [...document.querySelectorAll('.hero-game-cath svg')].length,
      scroll: document.documentElement.scrollWidth - innerWidth,
    }))
    for (const w of m.art) expect(w).toBeGreaterThanOrEqual(art)
    for (const f of m.copy) expect(f).toBeGreaterThanOrEqual(14)
    expect(m.caths).toBe(4)
    expect(m.scroll).toBeLessThanOrEqual(0)
    if (vp.width >= 900) for (const [l, t, r, b] of m.boxes) expect(l >= 0 && t >= 0 && r <= vp.width && b <= vp.height).toBe(true)
  }
})
