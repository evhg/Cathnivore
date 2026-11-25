import { expect, test, type Page } from './own-gpu'

// Plan item 690: the case briefing is a staged case board, not a loading page. No percentage; every box on the
// survey sheet named; the next name, the objective and Cath each a pinned card (200 px+ at D); on an upright phone
// the three stack down the screen with nothing clipped.

type Box = { x: number; y: number; width: number; height: number }

async function open(page: Page, vp: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(vp)
  await page.addInitScript(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await page.goto('/nightshift/?front=loading&shot')
  await expect(page.locator('#loading:not([hidden]) .ld-name')).toHaveText('Julian Crisp', { timeout: 120_000 })
}

const inside = (b: Box, w: number, h: number) => b.x >= 0 && b.y >= 0 && b.x + b.width <= w + 1 && b.y + b.height <= h + 1

test('at D the briefing is three pinned cards and a labelled sheet, with no percentage', async ({ page }) => {
  test.setTimeout(180_000)
  await open(page, { width: 1440, height: 900 })
  await expect(page.locator('#loading.has-map')).toHaveCount(1, { timeout: 60_000 })
  expect(await page.locator('#loading').evaluate((e) => /%/.test(e.textContent ?? ''))).toBe(false)
  for (const sel of ['.ld-still', '.ld-obj', '.ld-print']) {
    const card = page.locator(`#loading ${sel}`)
    const b = (await card.boundingBox())!
    expect(b.width, sel).toBeGreaterThanOrEqual(200)
    expect(inside(b, 1440, 900), sel).toBe(true)
    await expect(card.locator('.ld-pin').first()).toBeVisible()
  }
  await expect(page.locator('#loading .ld-obj')).toContainText('Objective')
  // every box drawn on the sheet that is not a block of buildings (the flyover deck, wings) carries a name over it
  const unnamed = await page.locator('#loading .ld-map svg').evaluate((svg) => {
    const texts = [...svg.querySelectorAll('.dmap-labels .dmap-t')].filter((t) => getComputedStyle(t).display !== 'none').map((t) => t.getBoundingClientRect())
    return [...svg.querySelectorAll('.dmap-flyover, .dmap-wing')].filter((r) => {
      const b = r.getBoundingClientRect()
      return !texts.some((t) => t.left >= b.left - 1 && t.right <= b.right + 1 && t.top >= b.top - 1 && t.bottom <= b.bottom + 1)
    }).map((r) => r.getAttribute('class'))
  })
  expect(unnamed).toEqual([])
  // the load is the pencil route on the sheet (drawn as far as the held share), and the string runs through the pins
  expect(await page.locator('#loading .ld-route').count()).toBe(1)
  expect(await page.locator('#loading .ld-string-red').getAttribute('d')).toMatch(/M.*Q.*M.*Q/)
})

test('on an upright phone the still, the objective and Cath stack down the screen, none clipped', async ({ page }) => {
  test.setTimeout(180_000)
  await open(page, { width: 390, height: 844 })
  expect(await page.locator('#loading').evaluate((e) => /%/.test(e.textContent ?? ''))).toBe(false)
  const box = async (sel: string) => (await page.locator(`#loading ${sel}`).boundingBox())!
  const still = await box('.ld-still')
  const obj = await box('.ld-obj')
  const print = await box('.ld-print')
  const name = await box('.ld-name')
  for (const [sel, b] of [['still', still], ['objective', obj], ['print', print]] as const) expect(inside(b, 390, 844), sel).toBe(true)
  // the objective under the still, clear of her photograph, and all three above the name
  expect(obj.y).toBeGreaterThan(still.y + still.height * 0.8)
  expect(obj.x + obj.width).toBeLessThanOrEqual(print.x + 2)
  for (const b of [still, obj, print]) expect(b.y + b.height).toBeLessThanOrEqual(name.y)
  // her line reads whole (typed in; a still frame shows all of it)
  await expect(page.locator('#loading .ld-lore')).toHaveAttribute('aria-label', /I mean to be there first/)
})
