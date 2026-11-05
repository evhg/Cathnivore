import { test, expect, type Page } from '@playwright/test'

// Plan item 133: the Daily Market as a ritual on the title table. From a fixture save: the last Daily's receipt
// pinned to the table (120 px or more wide at D, 90 at P), inside the viewport and meeting no menu button; a
// 3-day streak hangs 3 pennants (D); tomorrow's card counts down (D); a broken streak changes Cath's face.
type Box = { x: number; y: number; width: number; height: number }
const meet = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

async function seed(page: Page, kind: 'none' | 'broken' | number) {
  await page.goto('/')
  await page.evaluate((k) => {
    const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)
    const results: Record<string, unknown> = {}
    if (k === 'broken') {
      results[day(2)] = { won: true, rounds: 9, regions: 5, trust: 7 }
      results[day(1)] = { won: false, rounds: 12, regions: 3, trust: 2 }
    } else if (typeof k === 'number') for (let i = 1; i <= k; i++) results[day(i)] = { won: true, rounds: 9, regions: 5, trust: 7 }
    localStorage.setItem('cathnivore:daily', JSON.stringify({ results }))
  }, kind)
  await page.reload()
  await expect(page.locator('.title-daily')).toBeVisible()
  // the title's entrance animations
  await page.waitForTimeout(1600)
}

const visibleRitual = (page: Page) => page.locator('.daily-ritual:visible')

test("yesterday's receipt is pinned to the table, clear of the menu", async ({ page }) => {
  await seed(page, 3)
  const ritual = visibleRitual(page)
  await expect(ritual).toHaveCount(1)
  const receipt = ritual.locator('.ritual-receipt')
  await expect(receipt).toContainText('Yesterday')
  await expect(receipt.locator('.ritual-stamp')).toHaveText(/sold/i)
  const vp = page.viewportSize()!
  const b = (await receipt.boundingBox())!
  expect(b.width).toBeGreaterThanOrEqual(vp.width >= 1024 ? 120 : 90)
  expect(b.x).toBeGreaterThanOrEqual(0)
  expect(b.y).toBeGreaterThanOrEqual(0)
  expect(b.x + b.width).toBeLessThanOrEqual(vp.width)
  expect(b.y + b.height).toBeLessThanOrEqual(vp.height)
  for (const btn of await page.locator('.title-menu button').all()) {
    const m = await btn.boundingBox()
    if (m) expect(meet(b, m), `receipt meets ${await btn.textContent()}`).toBe(false)
  }
  // the footer's links stay readable beside it
  for (const a of await page.locator('.title-footer a').all()) {
    const m = await a.boundingBox()
    if (m) expect(meet(b, m)).toBe(false)
  }
  // no scroll was added
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true)
  // one pennant a day: the table's string at D, a row on the receipt on a phone
  await expect(ritual.locator('[data-pennant]')).toHaveCount(3)
  if (vp.width >= 1024) {
    await expect(ritual.locator('.ritual-card-in')).toHaveText(/^in (\d+h )?\d+m$/)
    const card = (await ritual.locator('.ritual-card').boundingBox())!
    expect(card.x + card.width).toBeLessThanOrEqual(vp.width)
    expect(meet(b, card)).toBe(false)
  }
})

test('a broken streak changes her face and her line; a kept one names the days', async ({ page }) => {
  await seed(page, 3)
  const cath = page.locator('.title-cath')
  await expect(cath).toHaveAttribute('data-expression', 'delighted')
  await expect(page.locator('.title-cath-line')).toContainText('3 days running')
  await seed(page, 'broken')
  await expect(cath).toHaveAttribute('data-expression', 'worried')
  await expect(visibleRitual(page).locator('.ritual-stamp')).toHaveText(/held/i)
  if (page.viewportSize()!.width >= 1024) await expect(visibleRitual(page).locator('.ritual-pennant')).toHaveCount(0)
})

test('a player who never played the Daily keeps the campaign line and sees a blank receipt', async ({ page }) => {
  await seed(page, 'none')
  await expect(page.locator('.title-cath-line')).toContainText('Brindle Hills')
  await expect(visibleRitual(page).locator('.ritual-receipt.is-blank')).toBeVisible()
})

test("tomorrow's card flips face up as the new Daily opens at 00:00 UTC", async ({ page }) => {
  test.skip(page.viewportSize()!.width < 1024, 'the card is on the desktop table')
  await page.clock.install({ time: new Date('2026-11-05T23:59:00Z') })
  await seed(page, 3)
  const card = visibleRitual(page).locator('.ritual-card')
  await expect(card.locator('.ritual-card-in')).toHaveText('in 1m')
  await expect(card).not.toHaveAttribute('data-flipped', /.*/)
  const next = await card.locator('.ritual-card-down .ritual-card-no').textContent()
  await page.clock.fastForward('02:00')
  await expect(card).toHaveAttribute('data-flipped', 'true')
  await expect(card.locator('.ritual-card-up .ritual-card-no')).toHaveText(next!)
  await expect(card.locator('.ritual-card-event')).not.toBeEmpty()
})
