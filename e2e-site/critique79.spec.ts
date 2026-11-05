import { expect, test } from '@playwright/test'

// Plan item 79: the bugs from the 2026-11-03 15:25 critique (e2e/screenshots/plan1103f), one case each.

test('Hedgerow D: a long vehicle name keeps its round-card pill inside the column', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the round card is the desktop side column')
  await page.goto('/hedgerow/?sandbox=1&2d')
  await page.evaluate(() => {
    const stars = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(i + 1), 3]))
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { 21: true }, tips: { all: true } }))
  })
  await page.goto('/hedgerow/?sandbox=1&2d&level=21')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: { game(): unknown } }).hedgerow?.game(), null, { timeout: 60_000 })
  const chips = page.locator('.panel .ticket-chips .preview-chip')
  await expect(chips.first()).toBeVisible()
  const out = await page.evaluate(() =>
    [...document.querySelectorAll('.panel .ticket-chips .preview-chip')].map((li) => {
      const r = li.getBoundingClientRect()
      const row = li.parentElement!.getBoundingClientRect()
      const name = li.querySelector('.chip-name')!.getBoundingClientRect()
      return { pill: r.right - row.right, name: name.right - r.right, text: li.textContent }
    }),
  )
  for (const o of out) {
    expect(o.pill, o.text ?? '').toBeLessThanOrEqual(0.5)
    expect(o.name, o.text ?? '').toBeLessThanOrEqual(0.5)
  }
})

type Box = { x: number; y: number; width: number; height: number }
const meets = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

test("Cathnivore title: Cath's line never meets Bea's drawing", async ({ page }) => {
  await page.goto('/cathnivore/')
  const line = await page.locator('.title-cath-line').boundingBox()
  const bea = await page.locator('.title-bea').boundingBox()
  expect(line && bea).toBeTruthy()
  expect(meets(line!, bea!)).toBe(false)
})

test('Cathnivore Setup P: no dead band pooled above Start', async ({ page, hasTouch }) => {
  test.skip(!hasTouch, 'the phone Setup')
  await page.goto('/cathnivore/')
  await page.getByText('Quick Game').click()
  await expect(page.getByRole('heading', { name: 'Quick Game' })).toBeVisible()
  const gap = await page.evaluate(() => {
    const start = document.querySelector('.setup > button.setup-start')!.getBoundingClientRect()
    const seed = document.querySelector('.setup .setup-seed')!.getBoundingClientRect()
    return start.top - seed.bottom
  })
  expect(gap).toBeLessThanOrEqual(32) // was about 50 px before item 79
})

test("Hedgerow map: her act's head opens under the header", async ({ page, hasTouch }) => {
  await page.goto('/hedgerow/?2d')
  await page.evaluate(() => {
    const stars = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(i + 1), 3]))
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { 21: true }, tips: { all: true } }))
  })
  await page.goto('/hedgerow/')
  await expect(page.locator('[data-level="21"]')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(300)
  const at = await page.evaluate(() => {
    const head = document.querySelector('[data-level="21"]')!.closest('li.act')!.querySelector('.act-head')!.getBoundingClientRect()
    const bar = document.querySelector('#screen-select > header, #screen-select .select-head')!.getBoundingClientRect()
    return { head: head.top, bar: bar.bottom }
  })
  expect(at.head).toBeGreaterThanOrEqual(at.bar - 1)
  expect(at.head - at.bar).toBeLessThanOrEqual(24)
  // Plan item 153 retired the glimpse strip at the map's foot (the next act is on the map in pencil), so the
  // 'card clears the nav' half of this test went with it.
  void hasTouch
})

test('NIGHT SHIFT title upright: resting menu entries near full ink, small lines at 13 px or more', async ({ page, hasTouch }) => {
  test.skip(!hasTouch, 'the upright phone title')
  await page.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await page.goto('/nightshift/')
  await expect(page.locator('#btn-cases')).toBeVisible({ timeout: 60_000 })
  const s = await page.evaluate(() => ({
    opacity: Number(getComputedStyle(document.querySelector('#btn-cases')!).opacity),
    hint: parseFloat(getComputedStyle(document.querySelector('.menu-hint')!).fontSize),
    listH: parseFloat(getComputedStyle(document.querySelector('.the-list-h')!).fontSize),
  }))
  expect(s.opacity).toBeGreaterThanOrEqual(0.9)
  expect(s.hint).toBeGreaterThanOrEqual(13)
  expect(s.listH).toBeGreaterThanOrEqual(13)
})

test("/games/: Cath's glow is drawn after her waist mask (no lit box behind her)", async ({ page }) => {
  await page.goto('/games/')
  const f = await page.evaluate(() => ({
    svg: getComputedStyle(document.querySelector('.hero-cath svg')!).filter,
    wrap: getComputedStyle(document.querySelector('.hero-cath')!).filter,
  }))
  expect(f.svg).toBe('none')
  expect(f.wrap).toContain('drop-shadow')
})

test("Cathnivore game D: a group heading with none of its rows above the fold hides behind the tab that names it", async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the desktop Actions frame')
  await page.goto('/cathnivore/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.actions .action-head').first()).toBeVisible()
  await page.waitForTimeout(500)
  const heads = await page.evaluate(() => {
    const el = document.querySelector('.actions')!
    const fold = el.getBoundingClientRect().bottom - 8
    const out: Array<{ name: string; hidden: boolean; orphan: boolean }> = []
    let cur: { name: string; hidden: boolean; orphan: boolean } | null = null
    let el0: Element | null = null
    for (const c of Array.from(el.children)) {
      if (c.matches('.action-head')) {
        el0 = c
        const r = c.getBoundingClientRect()
        cur = { name: c.textContent ?? '', hidden: getComputedStyle(c).visibility === 'hidden', orphan: r.top < fold }
        out.push(cur)
      } else if (cur && el0 && c.getBoundingClientRect().height > 0 && c.getBoundingClientRect().bottom <= fold) cur.orphan = false
    }
    return out
  })
  for (const h of heads) expect(h.hidden, h.name).toBe(h.orphan)
  await expect(page.locator('.actions-well')).toHaveAttribute('data-next', /.+/)
})
