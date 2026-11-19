import { expect, test, type Page } from '@playwright/test'

// Plan item 535: at a desktop table Cath speaks from one place at a time (her bubble), and the rail's ledger carries
// figures and line items only: no sentence of hers on it. Each sell adds its line within 250 ms.
const cathLines = (page: Page) =>
  page.evaluate(() => {
    const shown = (el: Element) => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05
    }
    // Cath-written lines: her table bubble, the rail's suggestion when it isn't inside the bubble, her companion line.
    return [...document.querySelectorAll('.table-cath-line, .suggest-line, .cath-companion-line')].filter(
      (el) => shown(el) && !el.parentElement?.closest('.table-cath-line'),
    ).length
  })

for (const [width, height] of [
  [1440, 900],
  [1280, 800],
] as const)
  test(`desktop table at ${width}x${height}: one Cath line at a time, the ledger figures only, a sell inked within 250 ms`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'the desktop table')
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await page.getByRole('button', { name: 'Start' }).click()
    await page.locator('.game').waitFor()
    await page.waitForTimeout(500)
    expect(await cathLines(page)).toBeLessThanOrEqual(1)
    // The ledger shows where the rail has room for it (it hides outright rather than show as a sliver).
    const ledger = page.locator('.actions-sheet .round-ledger')
    const ledgerShown = await ledger.locator('.receipt[data-kind="opening"]').isVisible()
    if (width === 1440) expect(ledgerShown).toBe(true)
    const longest = async () =>
      Math.max(...(await ledger.locator('.receipt-why, .ledger-sketch-note').allTextContents()).map((t) => t.trim().split(/\s+/).filter(Boolean).length))
    expect(await longest()).toBeLessThanOrEqual(6)
    const lines = ledger.locator('.receipt[data-kind="action"]')
    await page.getByRole('button', { name: /^Sell 1 Produce/ }).first().click()
    const t0 = Date.now()
    await expect(lines).toHaveCount(1, { timeout: 2000 })
    expect(Date.now() - t0).toBeLessThanOrEqual(250)
    expect(await longest()).toBeLessThanOrEqual(6)
    expect(await cathLines(page)).toBeLessThanOrEqual(1)
  })
