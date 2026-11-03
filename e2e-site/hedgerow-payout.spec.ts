import { expect, test } from '@playwright/test'

// Plan item 46: after a 3-star win the payout is on the card: the stars, the Seed Bank chip, the rosette ribbon and
// the Next card all stand inside the dialog and above its buttons, at P, L and D, with no scrolling.
for (const [name, w, h] of [['P', 390, 844], ['L', 844, 390], ['D', 1440, 900]] as const)
  test(`a 3-star win pays out on the card at ${name}`, async ({ browser }) => {
    test.setTimeout(120_000)
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' })
    const page = await ctx.newPage()
    await page.goto('/hedgerow/?sandbox=1&2d&level=3')
    await page.waitForFunction(() => !!(window as unknown as { hedgerow?: { game(): unknown } }).hedgerow?.game(), null, { timeout: 60_000 })
    for (let i = 0; i < 8 && !(await page.locator('#screen-play:visible').count()); i++) {
      await page.getByRole('button', { name: /next|skip|start|begin|continue/i }).first().click().catch(() => {})
      await page.waitForTimeout(300)
    }
    await page.evaluate(() => {
      ;(window as unknown as { hedgerow: { game(): { phase: string } } }).hedgerow.game().phase = 'won'
    })
    const dlg = page.locator('#dlg-result[open]')
    await expect(dlg).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(800)
    const scrolled = await dlg.evaluate((d) => d.scrollTop)
    expect(scrolled).toBe(0)
    const actions = await dlg.locator('.win-actions').boundingBox()
    const box = await dlg.boundingBox()
    for (const sel of ['#result-stars', '[data-payout="bank"]', '[data-payout="rosettes"]', '[data-payout="next"]']) {
      const b = await dlg.locator(sel).boundingBox()
      expect(b, sel).not.toBeNull()
      expect(b!.y, `${sel} top`).toBeGreaterThanOrEqual(box!.y - 1)
      // Above the buttons wherever it shares their column (at L the stars stand in the left column, beside them).
      const beside = b!.x + b!.width <= actions!.x + 1 || b!.x >= actions!.x + actions!.width - 1
      if (!beside) expect(b!.y + Math.min(b!.height, 40), `${sel} above the buttons`).toBeLessThanOrEqual(actions!.y + 1)
      expect(b!.y + Math.min(b!.height, 40), `${sel} on the card`).toBeLessThanOrEqual(box!.y + box!.height)
    }
    await page.screenshot({ path: `e2e/screenshots/payout46/win-${name}.png` })
    await ctx.close()
  })

// Plan item 46: a win that takes Cath to a talent level (5: three 3-star fields saved, then level 3 won with three)
// offers the two talents on the card, and the pick is in the save.
test('a level-up talent is chosen on the card and saved', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'one size is enough for the save')
  test.setTimeout(120_000)
  const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
  await page.goto('/hedgerow/?sandbox=1&2d')
  await page.evaluate((t) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: { 1: 3, 2: 3, 4: 3 }, seenBefore: { 3: true }, tips: t })), tips)
  await page.goto('/hedgerow/?sandbox=1&2d&level=3')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: { game(): unknown } }).hedgerow?.game(), null, { timeout: 60_000 })
  for (let i = 0; i < 8 && !(await page.locator('#screen-play:visible').count()); i++) {
    await page.getByRole('button', { name: /next|skip|start|begin|continue/i }).first().click().catch(() => {})
    await page.waitForTimeout(300)
  }
  await page.evaluate(() => {
    ;(window as unknown as { hedgerow: { game(): { phase: string } } }).hedgerow.game().phase = 'won'
  })
  const level = page.locator('#dlg-result[open] [data-payout="level"]')
  await expect(level).toContainText('Cath reached level 5')
  const first = level.locator('.payout-talents [data-talent="0"]')
  await expect(first).toBeVisible()
  await first.click()
  await expect(level.locator('.payout-picked')).toBeVisible()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('hedgerow:v1') ?? '{}').cath?.talents?.['5'])
  expect(saved).toBe(0)
  await page.waitForTimeout(2500)
  await level.scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'e2e/screenshots/payout46/talent-picked-D.png' })
})

// Plan item 46: a tap on the card skips the payout's sequence; every piece is there at once and the coins are banked.
test('a tap skips the payout', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'one size is enough')
  test.setTimeout(120_000)
  await page.goto('/hedgerow/?sandbox=1&2d&level=3')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: { game(): unknown } }).hedgerow?.game(), null, { timeout: 60_000 })
  for (let i = 0; i < 8 && !(await page.locator('#screen-play:visible').count()); i++) {
    await page.getByRole('button', { name: /next|skip|start|begin|continue/i }).first().click().catch(() => {})
    await page.waitForTimeout(300)
  }
  await page.evaluate(() => {
    ;(window as unknown as { hedgerow: { game(): { phase: string } } }).hedgerow.game().phase = 'won'
  })
  const dlg = page.locator('#dlg-result[open]')
  await expect(dlg).toBeVisible({ timeout: 15_000 })
  await dlg.locator('#result-title').click()
  await expect(dlg).toHaveClass(/payout-skip/)
  await expect(dlg.locator('[data-payout="next"]')).toBeVisible({ timeout: 1_000 })
  await expect(dlg.locator('[data-bank]')).toHaveText(/^\+3 ★/, { timeout: 2_000 })
})
