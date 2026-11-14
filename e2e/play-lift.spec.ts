import { test, expect } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 83: a played card lifts off the hand and sets down toward the board in 250 ms; its flying copy
// takes no clicks, is hidden from assistive tech and is gone once it lands. Under webdriver only with `?lift`.
for (const reduced of [false, true]) {
  test(`a played card lifts toward the board${reduced ? ' (reduced motion: a fade)' : ''}`, async ({ page }, testInfo) => {
    if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/?lift')
    await page.getByText('Quick Game').click()
    await fillSeed(page, '1')
    await page.getByRole('button', { name: 'Start' }).click()
    await page.locator('.game').waitFor()
    const scope = testInfo.project.name === 'phone' ? '.action-tray .actions' : '.table-hand'
    const sell = page.locator(`${scope} .action-sell > button:first-child`).first()
    await sell.scrollIntoViewIfNeeded()
    // Plan item 149: a desktop hand card lifts out of the fan under the pointer; measure it there, as it's clicked.
    await sell.hover()
    await page.waitForTimeout(250)
    const from = (await sell.boundingBox())!
    // Watch for the flying layer inside the page: the flight is shorter than a Playwright round trip.
    await page.evaluate(() => {
      const w = window as unknown as { liftSeen?: { hidden: string | null; classed: number; x: number; y: number }[] }
      w.liftSeen = []
      new MutationObserver((records) => {
        for (const r of records)
          for (const n of r.addedNodes) {
            if (!(n instanceof HTMLElement) || !n.classList.contains('play-lift')) continue
            setTimeout(() => {
              const b = n.getBoundingClientRect()
              w.liftSeen!.push({ hidden: n.getAttribute('aria-hidden'), classed: n.querySelectorAll('[class]').length, x: b.x + b.width / 2, y: b.y + b.height / 2 })
            }, 110)
          }
      }).observe(document.body, { childList: true })
    })
    await sell.click()
    await expect.poll(() => page.evaluate(() => (window as unknown as { liftSeen: unknown[] }).liftSeen.length)).toBe(1)
    const mid = await page.evaluate(() => (window as unknown as { liftSeen: { hidden: string | null; classed: number; x: number; y: number }[] }).liftSeen[0]!)
    expect(mid.hidden).toBe('true')
    expect(mid.classed).toBe(0)
    if (!reduced) {
      // On its way toward the board (above the hand at P, right of it at D).
      const moved = Math.hypot(mid.x - (from.x + from.width / 2), mid.y - (from.y + from.height / 2))
      expect(moved).toBeGreaterThan(8)
    } else {
      expect(Math.abs(mid.x - (from.x + from.width / 2))).toBeLessThan(2)
    }
    const lift = page.locator('.play-lift')
    await expect(lift).toHaveCount(0, { timeout: 2000 })
  })
}
