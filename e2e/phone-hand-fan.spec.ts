import { test, expect } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 164: on a phone the hand is a fanned deck of whole cards. Every card's name fits (no scrollWidth
// overflow, no '…' after it), at 14 px or more, and a touched (focused) card rises 12 px or more within 200 ms.
for (const seed of ['103', '2103']) {
  test(`phone hand: whole names, 14 px, a touched card rises (seed ${seed})`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone', 'the fanned hand is the phone layout')
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await fillSeed(page, seed)
    await page.getByRole('button', { name: 'Start' }).click()
    await page.locator('.action-tray [data-hand-card]').first().waitFor()
    await page.waitForTimeout(600)
    const cards = await page.evaluate(() =>
      [...document.querySelectorAll('.action-tray .action-item > button:first-child .action-label')].map((el) => ({
        name: el.textContent?.trim() ?? '',
        over: el.scrollWidth - el.clientWidth,
        fs: parseFloat(getComputedStyle(el).fontSize),
        dots: [...el.querySelectorAll('.action-more')].some((d) => getComputedStyle(d).display !== 'none'),
      })),
    )
    expect(cards.length).toBeGreaterThan(2)
    for (const c of cards) {
      expect(c.over, `${c.name} overflows`).toBeLessThanOrEqual(1)
      expect(c.fs, `${c.name} font size`).toBeGreaterThanOrEqual(14)
      expect(c.dots, `${c.name} ends in a bare '…'`).toBe(false)
    }
    const rise = await page.evaluate(async () => {
      const card = [...document.querySelectorAll<HTMLElement>('.action-tray [data-hand-card]')].find((c) => {
        const r = c.getBoundingClientRect()
        return r.left >= 0 && r.right <= innerWidth
      })!
      const y0 = card.getBoundingClientRect().top
      card.querySelector('button')!.focus({ preventScroll: true })
      await new Promise((r) => setTimeout(r, 200))
      return y0 - card.getBoundingClientRect().top
    })
    expect(rise).toBeGreaterThanOrEqual(12)
  })
}
