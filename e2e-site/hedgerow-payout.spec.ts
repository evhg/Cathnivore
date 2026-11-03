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
