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
