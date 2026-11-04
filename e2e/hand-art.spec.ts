import { test, expect } from '@playwright/test'

// Plan item 123: on a phone each playable hand card's face is its picture (56 px, or 40 on a card whose name is too
// long to sit beside it), its name 12 px or more, and nothing spills out of the card.
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
        return { name: b.getAttribute('aria-label') ?? b.textContent, tight: b.hasAttribute('data-tight'), art: art ? Math.min(art.width, art.height) : 0, font: label ? parseFloat(getComputedStyle(label).fontSize) : 0, out }
      }),
    )
    expect(cards.length).toBeGreaterThan(3)
    for (const c of cards) {
      expect(c.art, c.name ?? '').toBeGreaterThanOrEqual(c.tight ? 40 : 56)
      expect(c.font, c.name ?? '').toBeGreaterThanOrEqual(12)
      expect(c.out, c.name ?? '').toBe(false)
    }
    // Most cards keep the full-size picture.
    expect(cards.filter((c) => !c.tight).length).toBeGreaterThan(cards.length / 2)
  })
}
