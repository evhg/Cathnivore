import { test, expect } from '@playwright/test'

// Plan item 123: on a phone each playable hand card's face is its picture (56 px, or 40 on a card whose name is too
// long to sit beside it; 34 since item 164 raised the tight name to 14 px), its name 14 px or more, and nothing spills
// out of the card.
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
        return { name: b.getAttribute('aria-label') ?? b.textContent, pick: !!b.querySelector('.action-pick'), tight: b.hasAttribute('data-tight'), art: art ? Math.min(art.width, art.height) : 0, font: label ? parseFloat(getComputedStyle(label).fontSize) : 0, out }
      }),
    )
    expect(cards.length).toBeGreaterThan(3)
    for (const c of cards) {
      expect(c.art, c.name ?? '').toBeGreaterThanOrEqual(c.tight ? 34 : 56)
      expect(c.font, c.name ?? '').toBeGreaterThanOrEqual(14)
      expect(c.out, c.name ?? '').toBe(false)
    }
    // Most cards keep the full-size picture (a card that still needs a region carries a second line, 'Pick a
    // region' or 'in Brindle Hills', since item 164, so it isn't counted).
    const plain = cards.filter((c) => !c.pick)
    expect(plain.filter((c) => !c.tight).length).toBeGreaterThan(plain.length / 2)
  })
}
