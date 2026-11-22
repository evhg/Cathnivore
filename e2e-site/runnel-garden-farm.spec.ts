import { test, expect, type Page } from '@playwright/test'

// Plan item 106: the spring house, the stream and Bea's garden are in the farm on a phone as on a desktop, with
// no bare band under the board; the stream's fill rises as fields are watered, and a solve waters the garden
// (`data-watered`), at P and D.

async function seen(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (localStorage.getItem('runnel:v1')) return
    localStorage.setItem('runnel:v1', JSON.stringify({ version: 1, daily: {}, practice: {}, results: {}, bestPractice: {}, practiceSolved: 3, seenHelp: true }))
  })
}

async function farm(page: Page) {
  return page.evaluate(() => {
    const box = (sel: string) => {
      const r = document.querySelector(sel)!.getBoundingClientRect()
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width, h: r.height }
    }
    const tiles = [...document.querySelectorAll('#board polygon.tile')].map((t) => t.getBoundingClientRect().bottom)
    // Plan item 407: on an upright phone Cath's dock (.host) stands between the board and the foot.
    const host = document.querySelector('.app > .host')
    const hb = host && host.getClientRects().length ? host.getBoundingClientRect() : null
    const foot = box('.foot')
    return { spring: box('.spring-house'), garden: box('.bea-garden'), crops: box('#bea-crops'), foot, hostBottom: hb && hb.bottom <= foot.top + 1 ? hb.bottom : 0, tilesBottom: Math.max(...tiles), vh: innerHeight }
  })
}

for (const where of ['the lesson', "today's daily"]) {
  test(`the spring house and Bea's garden are in view on ${where}, with no bare band under the board`, async ({ page }) => {
    if (where !== 'the lesson') await seen(page)
    await page.goto('/runnel/')
    await expect(page.locator('#board polygon.tile').first()).toBeVisible()
    await page.waitForTimeout(400)
    const f = await farm(page)
    for (const [name, b] of [['spring house', f.spring], ['garden', f.garden]] as const) {
      expect(b.w, `${name} drawn`).toBeGreaterThan(40)
      expect(b.top, `${name} top`).toBeGreaterThanOrEqual(0)
      expect(b.bottom, `${name} bottom`).toBeLessThanOrEqual(f.vh)
    }
    // The garden's beds are a plot you can see: at least 140 px wide and 20 px tall; where the board reaches its
    // corner (plan item 661) it keeps to the clear strip beside the tiles, 60 px+, and meets no tile.
    const fit = await page.evaluate(() => (() => {
      // plan item 661: a board that reaches the garden's corner leaves it the strip beside the tiles (data-tight)
      const g = document.querySelector('.bea-garden')!, r = g.getBoundingClientRect()
      let hits = 0
      for (let y = r.top + 2; y < r.bottom - 2; y += 4) for (let x = r.left + 2; x < r.right - 2; x += 4) if (document.elementsFromPoint(x, y).some((e) => e.matches('#board polygon.tile'))) hits++
      return { tight: g.hasAttribute('data-tight'), hits }
    })())
    expect(fit.hits).toBe(0)
    expect(f.crops.w).toBeGreaterThanOrEqual(fit.tight ? 60 : 140)
    expect(f.crops.h).toBeGreaterThanOrEqual(20)
    // Whatever is lowest of the board, the garden and (on a phone) Cath's dock under them, the foot follows within 80 px.
    expect(f.foot.top - Math.max(f.tilesBottom, f.garden.bottom, f.hostBottom)).toBeLessThanOrEqual(80)
  })
}

test('the stream rises as fields are watered, and a solve waters the garden', async ({ page }) => {
  await seen(page)
  await page.goto('/runnel/?shotsolve')
  await expect(page.locator('[data-last]')).toBeVisible()
  const wet = () => page.locator('#valley-water').evaluate((el) => parseFloat(el.style.getPropertyValue('--wet')) || 0)
  const garden = page.locator('.bea-garden')
  await expect(garden).toHaveAttribute('data-watered', 'false')
  const soil = () => page.locator('#bea-crops').evaluate((el) => getComputedStyle(el).backgroundColor)
  const drySoil = await soil()
  const before = await wet()
  expect(before).toBeLessThan(1)
  await page.locator('[data-last]').click()
  await expect.poll(wet).toBe(1)
  await expect(garden).toHaveAttribute('data-watered', 'true')
  // The plot's soil goes dark and wet once the water arrives.
  await expect.poll(soil, { timeout: 3000 }).not.toBe(drySoil)
  const lum = (c: string) => {
    const [r, g, b] = c.match(/[\d.]+/g)!.map(Number)
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
  }
  await page.waitForTimeout(1000)
  expect(lum(await soil())).toBeLessThan(lum(drySoil))
})

// Plan item 411: the field's ditch runs on to Bea's garden; on a solve its water runs down it (dry, then full within
// 1.2 s), its end in the garden, and Cath is delighted.
test('a solve sends the water down the ditch into Bea’s garden, and Cath is delighted', async ({ page }) => {
  await seen(page)
  await page.goto('/runnel/?shotsolve')
  await expect(page.locator('[data-last]')).toBeVisible()
  const ditch = page.locator('[data-outflow]')
  await expect(ditch).toBeAttached()
  await expect(ditch).not.toHaveAttribute('data-full', '')
  const r = await page.evaluate(() => {
    const p = document.querySelector<SVGPathElement>('[data-outflow] .runnel-ditch')!
    const end = p.getPointAtLength(p.getTotalLength())
    const m = p.getScreenCTM()!
    const at = { x: end.x * m.a + end.y * m.c + m.e, y: end.x * m.b + end.y * m.d + m.f }
    const g = document.querySelector('.bea-garden')!.getBoundingClientRect()
    return { inGarden: at.x >= g.left - 4 && at.x <= g.right + 4 && at.y >= g.top - 4 && at.y <= g.bottom + 4 }
  })
  expect(r.inGarden, 'the ditch ends in the garden').toBe(true)
  await page.locator('[data-last]').click()
  await expect(ditch).toHaveAttribute('data-full', '', { timeout: 2500 })
  await expect(page.locator('#host-face')).toHaveAttribute('data-expression', 'delighted')
})
