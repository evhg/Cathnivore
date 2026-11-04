import { expect, test } from '@playwright/test'

// Plan item 31: the tray is an almanac. Each card names its tower with a role glyph and range and damage pips, and
// hovering a card draws that tower's range ring on the field before it is placed.
const URL = '/hedgerow/?2d&sandbox=1'
type Ring = { range: number; px: number; cell: number } | null
type HG = { game(): unknown; ring(): Ring }

test('plan item 31: hovering a tray card draws a ring the size of the tower\'s range', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'hover is a desktop pointer')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(URL)
  await page.evaluate(() => {
    const stars: Record<string, number> = {}
    for (let i = 1; i < 12; i++) stars[String(i)] = 3
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { '12': true }, seen: {}, tips: { all: true } }))
  })
  await page.goto(`${URL}&level=12`)
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 30000 })
  const cards = page.locator('.tray-tower')
  expect(await cards.count()).toBeGreaterThan(2)
  // Every card: a name, a role glyph and two pip rows.
  for (let i = 0; i < (await cards.count()); i++) {
    const c = cards.nth(i)
    await expect(c.locator('.tray-name')).not.toBeEmpty()
    await expect(c.locator('.tray-role svg')).toHaveCount(1)
    await expect(c.locator('.pip-row')).toHaveCount(2)
  }
  expect(await page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.ring())).toBeNull()
  for (const kind of ['scarecrow', 'beehive']) {
    const card = page.locator(`.tray-tower[data-kind="${kind}"]`)
    if (!(await card.count())) continue
    await card.hover()
    await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.ring()?.range ?? 0)).toBeGreaterThan(0)
    const ring = (await page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.ring()))!
    // The range in cells is the tower's tier-1 range from the same stats the build menu uses.
    const range = await page.locator(`.tray-tower[data-kind="${kind}"]`).getAttribute('aria-label')
    const m = /range (\d+(?:\.\d+)?)/.exec(range ?? '')
    expect(m).not.toBeNull()
    expect(ring.range).toBeCloseTo(Number(m![1]), 1)
    expect(ring.px).toBeCloseTo(ring.range * ring.cell, 3)
    // Leaving the card takes the ring away.
    await page.mouse.move(5, 5)
    await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.ring())).toBeNull()
  }
})

/** The tallest empty stretch down the side panel: between its children, and from the last one to its foot. */
async function emptyBand(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    const p = document.querySelector<HTMLElement>('.play .panel')!
    const pr = p.getBoundingClientRect()
    const kids = [...p.children]
      .filter((k) => getComputedStyle(k).display !== 'none' && getComputedStyle(k).position !== 'absolute')
      .map((k) => k.getBoundingClientRect())
      .filter((r) => r.height > 0)
      .sort((a, b) => a.top - b.top)
    let y = pr.top
    let gap = 0
    for (const r of kids) {
      gap = Math.max(gap, r.top - y)
      y = Math.max(y, r.bottom)
    }
    return Math.max(gap, Math.min(pr.bottom, pr.top + p.clientHeight) - y)
  })
}

// Plan item 31: Cath's field notebook fills the desktop side column (no empty band over 120 px) with a page on
// the tower last looked at and a sketch of the next new vehicle; on a phone it waits in the drawer.
test('plan item 31: the side column ends on Cath\'s notebook, never an empty band', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the side column is a desktop layout')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(URL)
  await page.evaluate(() => {
    const stars: Record<string, number> = {}
    for (let i = 1; i < 6; i++) stars[String(i)] = 3
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { '6': true }, seen: {}, tips: { all: true } }))
  })
  for (const level of [6, 12]) {
    await page.goto(`${URL}&level=${level}`)
    await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 30000 })
    const nb = page.locator('.panel .field-notebook')
    // Plan item 87: on levels with Coming up the notebook is the card's second tab.
    const tab = page.getByRole('tab', { name: 'Notebook' })
    if (await tab.count()) await tab.click()
    await expect(nb).toBeVisible()
    // Plan item 72: with nothing planted, Cath's advice for the round says what to build (it replaced the empty
    // page). Plan items 95 and 103: she says it beside her on the field (hedgerow-threat.spec), and the notebook
    // lists what answers it.
    await expect(nb.locator('.nb-advice-line')).toHaveText(/Answered by|Nothing in this kit/)
    await expect(nb.locator('.nb-enemy .nb-name')).not.toBeEmpty()
    expect(await emptyBand(page)).toBeLessThanOrEqual(120)
    // Plant one: its page names it, its stand and what it sells for.
    await page.evaluate(() => {
      const hg = (window as unknown as { hedgerow: { game(): { level: { cols: number; rows: number } }; place(g: unknown, k: string, c: number, r: number): { ok: boolean }; refresh(): void } }).hedgerow
      const g = hg.game()
      for (let r = 0; r < g.level.rows; r++) for (let c = 0; c < g.level.cols; c++) if (hg.place(g, 'scarecrow', c, r).ok) return hg.refresh()
    })
    if (await tab.count()) await tab.click()
    await expect(nb.locator('.nb-tower .nb-name')).toHaveText(/Scarecrow/)
    await expect(nb.locator('.nb-sell')).toHaveText(/Sells \d+/)
    await expect(nb.locator('.nb-stand')).toHaveAttribute('aria-label', /tier 1 of 3/)
    expect(await emptyBand(page)).toBeLessThanOrEqual(120)
  }
})

test('plan item 31: on a phone the notebook opens in the round drawer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(URL)
  await page.evaluate(() => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: { '1': 3, '2': 3, '3': 3, '4': 3, '5': 3 }, seenBefore: { '6': true }, seen: {}, tips: { all: true } })))
  await page.goto(`${URL}&level=6`)
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 30000 })
  const nb = page.locator('.panel .field-notebook')
  await expect(nb).toBeHidden()
  await page.locator('.drawer-handle').click()
  await expect(nb).toBeVisible()
  await expect(nb.locator('.nb-enemy .nb-name')).not.toBeEmpty()
})

test('plan items 69 and 84: at D the whole roster fits the tray: no packet past its edge, no more-tab, nothing cut', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the desktop side column')
  for (const [width, height, level] of [[1440, 900, 12], [1280, 800, 12], [1440, 900, 21], [1440, 900, 40]] as const) {
    await page.setViewportSize({ width, height })
    await page.goto(URL)
    await page.evaluate((l) => {
      const stars: Record<string, number> = {}
      for (let i = 1; i < l; i++) stars[String(i)] = 3
      localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { [String(l)]: true }, seen: {}, tips: { all: true } }))
    }, level)
    await page.goto(`${URL}&level=${level}`)
    await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 30000 })
    await page.waitForTimeout(300)
    const r = await page.evaluate(() => {
      const t = document.querySelector('.tray')!.getBoundingClientRect()
      const bad = [...document.querySelectorAll<HTMLElement>('.tray-tower')].filter((c) => {
        const b = c.getBoundingClientRect()
        const cut = [...c.querySelectorAll<HTMLElement>('.tray-name, .build-cost')].some((e) => e.offsetParent && e.scrollWidth > e.clientWidth + 1)
        return b.left < t.left - 1 || b.right > t.right + 1 || cut
      }).map((c) => c.dataset.kind)
      return { n: document.querySelectorAll('.tray-tower').length, bad, more: !!document.querySelector('.tray-more:not([hidden])'), titled: [...document.querySelectorAll<HTMLElement>('.tray-tower')].every((c) => /Marks/.test(c.title)) }
    })
    expect(r.n).toBeGreaterThanOrEqual(5)
    expect(r.bad, `${width}x${height} level ${level}`).toEqual([])
    expect(r.more).toBe(false)
    expect(r.titled).toBe(true)
  }
})

// Plan items 84 and 87: Coming up (the tabbed card's first tab) runs to the column's foot, its rounds ahead as tiles
// that fill the card, so it never ends on a blank band.
test('plan item 84: Coming up fills its card to the foot', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the side column is a desktop layout')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(URL)
  await page.evaluate(() => {
    const stars: Record<string, number> = {}
    for (let i = 1; i < 38; i++) stars[String(i)] = 3
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { '21': true }, seen: {}, tips: { all: true } }))
  })
  await page.goto(`${URL}&level=21`)
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 30000 })
  await expect(page.locator('.panel .field-intel .intel-timeline li').first()).toBeVisible()
  const m = await page.evaluate(() => {
    const card = document.querySelector('.panel .field-intel')!.getBoundingClientRect()
    const tiles = [...document.querySelectorAll('.panel .field-intel .intel-timeline li')].map((l) => l.getBoundingClientRect().bottom)
    return { gap: card.bottom - Math.max(...tiles) }
  })
  expect(m.gap).toBeLessThanOrEqual(24)
  expect(m.gap).toBeGreaterThanOrEqual(0)
})

// Plan item 87: the shop as seed packets: 90 px tall or more at D (90 wide up to nine towers, 70 with ten or more),
// 56x64 or more at P, each with its name showing and its price in its accessible name; too dear reads by shape.
test('plan item 87: the tower shop is seed packets with names', async ({ page, hasTouch }) => {
  const sizes: Array<[number, number, number]> = hasTouch ? [[390, 844, 12]] : [[1440, 900, 6], [1440, 900, 12], [1440, 900, 30]]
  for (const [width, height, level] of sizes) {
    await page.setViewportSize({ width, height })
    await page.goto(URL)
    await page.evaluate((l) => {
      const stars: Record<string, number> = {}
      for (let i = 1; i < 40; i++) stars[String(i)] = 3
      localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { [String(l)]: true }, seen: {}, tips: { all: true } }))
    }, level)
    await page.goto(`${URL}&level=${level}`)
    await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 30000 })
    await page.waitForTimeout(300)
    const r = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.tray-tower')].map((b) => {
        const box = b.getBoundingClientRect()
        const name = b.querySelector<HTMLElement>('.tray-name')!
        return { w: box.width, h: box.height, named: name.getClientRects().length > 0 && name.offsetHeight > 6, aria: b.getAttribute('aria-label') ?? '' }
      }),
    )
    const many = r.length >= 10
    for (const p of r) {
      expect(p.h, `${width} level ${level}`).toBeGreaterThanOrEqual(hasTouch ? 64 : 90)
      expect(p.w, `${width} level ${level}`).toBeGreaterThanOrEqual(hasTouch ? 56 : many ? 70 : 90)
      expect(p.named).toBe(true)
      expect(p.aria).toMatch(/\d+ Marks/)
    }
  }
  if (hasTouch) return
  // Too dear: a dashed packet and a struck price, not colour alone.
  await page.evaluate(() => {
    const hg = (window as unknown as { hedgerow: { game(): { marks: number }; refresh(): void } }).hedgerow
    hg.game().marks = 150
    hg.refresh()
  })
  const dear = page.locator('.tray-tower:disabled').first()
  await expect(dear).toBeVisible()
  expect(await dear.evaluate((b) => [getComputedStyle(b).outlineStyle, getComputedStyle(b.querySelector('.build-cost')!).textDecorationLine])).toEqual(['dashed', 'line-through'])
})

// Plan item 87: at D Coming up and Cath's notebook share one card with two tabs; the notebook tab carries a dot
// until her advice has been read.
test('plan item 87: Coming up and the notebook are tabs of one card', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the side column is a desktop layout')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(URL)
  await page.evaluate(() => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: { '1': 3, '2': 3, '3': 3, '4': 3, '5': 3 }, seenBefore: { '6': true }, seen: {}, tips: { all: true } })))
  await page.goto(`${URL}&level=6`)
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 30000 })
  const intel = page.locator('.panel .field-intel')
  const nb = page.locator('.panel .field-notebook')
  const nbTab = page.getByRole('tab', { name: 'Notebook' })
  await expect(page.getByRole('tab', { name: 'Coming up' })).toHaveAttribute('aria-selected', 'true')
  await expect(intel).toBeVisible()
  await expect(nb).toBeHidden()
  await expect(nbTab).toHaveClass(/has-news/)
  await nbTab.click()
  await expect(nb).toBeVisible()
  await expect(intel).toBeHidden()
  await expect(nbTab).not.toHaveClass(/has-news/)
  // The arrow keys move between the tabs.
  await nbTab.press('ArrowLeft')
  await expect(intel).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Coming up' })).toBeFocused()
})

// Plan item 115: the locks still unanswered are 20 px or more, and a two-line vehicle pill keeps clear of the
// ticket's edge (level 21's 'x119 Lifestyle influencer').
test('plan item 115: lock icons read and the vehicle pills keep inside the ticket', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the side column is a desktop layout')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(URL)
  await page.evaluate(() => {
    const stars: Record<string, number> = {}
    for (let i = 1; i < 30; i++) stars[String(i)] = 3
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { '21': true }, seen: {}, tips: { all: true } }))
  })
  await page.goto(`${URL}&level=21`)
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 30000 })
  await expect(page.locator('.panel .intel-locks .prop-icon').first()).toBeVisible()
  const r = await page.evaluate(() => {
    const t = document.querySelector('.panel .round-ticket')!.getBoundingClientRect()
    return {
      icons: [...document.querySelectorAll('.panel .intel-locks .prop-icon')].map((i) => i.getBoundingClientRect().width),
      over: [...document.querySelectorAll('.panel .ticket-chips .preview-chip')].map((c) => c.getBoundingClientRect().right - (t.right - 4)),
    }
  })
  for (const w of r.icons) expect(w).toBeGreaterThanOrEqual(20)
  for (const o of r.over) expect(o).toBeLessThanOrEqual(0)
})

test('plan item 119: each packet shows its tower large, its name on a printed band, its price 13 px or more', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the desktop packets')
  for (const level of [12, 21, 40]) {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(URL)
    await page.evaluate((l) => {
      const stars: Record<string, number> = {}
      for (let i = 1; i < l; i++) stars[String(i)] = 3
      localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { [String(l)]: true }, seen: {}, tips: { all: true } }))
    }, level)
    await page.goto(`${URL}&level=${level}`)
    await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 30000 })
    await page.waitForTimeout(300)
    const r = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.tray-tower')].map((c) => {
        const art = c.querySelector('img')!.getBoundingClientRect()
        const name = c.querySelector<HTMLElement>('.tray-name')!
        return { art: Math.min(art.width, art.height), price: parseFloat(getComputedStyle(c.querySelector('.build-cost')!).fontSize), band: getComputedStyle(name).backgroundColor !== 'rgba(0, 0, 0, 0)' }
      }),
    )
    // 56 px for up to six packets, 52 for seven to nine, 44 for ten or more (item 87's column budget).
    const want = r.length >= 10 ? 44 : r.length >= 7 ? 52 : 56
    for (const p of r) {
      expect(p.art, `level ${level}`).toBeGreaterThanOrEqual(want)
      expect(p.price).toBeGreaterThanOrEqual(13)
      expect(p.band).toBe(true)
    }
  }
})
