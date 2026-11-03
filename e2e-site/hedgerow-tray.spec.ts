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
    await expect(nb).toBeVisible()
    // Plan item 72: with nothing planted, Cath's advice for the round says how to build (it replaced the empty page).
    await expect(nb.locator('.nb-advice-line')).toContainText('Tap a plot to build')
    await expect(nb.locator('.nb-enemy .nb-name')).not.toBeEmpty()
    expect(await emptyBand(page)).toBeLessThanOrEqual(120)
    // Plant one: its page names it, its stand and what it sells for.
    await page.evaluate(() => {
      const hg = (window as unknown as { hedgerow: { game(): { level: { cols: number; rows: number } }; place(g: unknown, k: string, c: number, r: number): { ok: boolean }; refresh(): void } }).hedgerow
      const g = hg.game()
      for (let r = 0; r < g.level.rows; r++) for (let c = 0; c < g.level.cols; c++) if (hg.place(g, 'scarecrow', c, r).ok) return hg.refresh()
    })
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

test('plan item 69: at D the whole roster fits the tray: no packet past its edge, no more-tab, nothing cut', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the desktop side column')
  for (const [width, height] of [[1440, 900], [1280, 800]]) {
    await page.setViewportSize({ width, height })
    await page.goto(URL)
    await page.evaluate(() => {
      const stars: Record<string, number> = {}
      for (let i = 1; i < 12; i++) stars[String(i)] = 3
      localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { '12': true }, seen: {}, tips: { all: true } }))
    })
    await page.goto(`${URL}&level=12`)
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
    expect(r.bad, `${width}x${height}`).toEqual([])
    expect(r.more).toBe(false)
    expect(r.titled).toBe(true)
  }
})
