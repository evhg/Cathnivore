import { test, expect } from '@playwright/test'

// Plan item 123: on a phone each playable hand card's face is its picture, its name 14 px or more, and nothing spills
// out of the card. Plan item 320: the picture is a painted window across the card's full width over half its face or
// more (it was a 56 px corner tile).
for (const [w, h] of [[390, 844], [375, 667]] as const) {
  test(`hand cards carry their art at ${w}x${h}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone', 'the phone hand')
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await page.getByRole('button', { name: 'Start' }).click()
    await expect(page.locator('.action-tray .action-item').first()).toBeVisible()
    await page.waitForTimeout(300)
    const cards = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.action-tray .actions .action-item > button:first-child:not(:disabled)')].map((b) => {
        const r = b.getBoundingClientRect()
        const art = b.querySelector('svg.action-art')?.getBoundingClientRect()
        const label = b.querySelector<HTMLElement>('.action-label')
        const out = [...b.querySelectorAll<HTMLElement>('.action-label, .action-cost')].some((c) => { const q = c.getBoundingClientRect(); return q.bottom > r.bottom + 1 || q.right > r.right + 1 })
        return { name: b.getAttribute('aria-label') ?? b.textContent, art: art ? (art.width * art.height) / (r.width * r.height) : 0, wide: art ? art.width / r.width : 0, font: label ? parseFloat(getComputedStyle(label).fontSize) : 0, out }
      }),
    )
    expect(cards.length).toBeGreaterThan(3)
    for (const c of cards) {
      expect(c.art, c.name ?? '').toBeGreaterThanOrEqual(0.5)
      expect(c.wide, c.name ?? '').toBeGreaterThanOrEqual(0.9)
      expect(c.font, c.name ?? '').toBeGreaterThanOrEqual(14)
      expect(c.out, c.name ?? '').toBe(false)
    }
  })
}
