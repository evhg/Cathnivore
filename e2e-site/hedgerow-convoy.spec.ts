import { expect, test } from '@playwright/test'

// Plan item 511: the round's vehicles are a convoy: every type in the round in one line inside its ticket (no name
// wrapping alone onto a second line), each with its count and its name as its accessible name, its sprite 48 px (28 beside Cath's plate) or
// more at D and 20 px or more on a phone held sideways. Level 21's first round has three types. Driven in 2D (the
// panel is the same DOM in 3D; the 3D column was measured by hand: 214 px, all three on one line).
for (const [w, h] of [[1440, 900], [1280, 800], [844, 390]] as const) {
  test(`the round's convoy at ${w}x${h}`, async ({ page, hasTouch }) => {
    test.skip(hasTouch, 'sizes are set here; one project is enough')
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/hedgerow/?sandbox=1&2d')
    await page.evaluate(() => {
      const stars = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(i + 1), 3]))
      localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { 21: true }, tips: { all: true } }))
    })
    await page.goto('/hedgerow/?sandbox=1&2d&level=21')
    await page.waitForFunction(() => !!(window as unknown as { hedgerow?: { game(): unknown } }).hedgerow?.game(), null, { timeout: 60_000 })
    const chips = page.locator('.ticket-chips .preview-chip')
    await expect(chips.first()).toBeVisible()
    const r = await page.evaluate(() => {
      const row = document.querySelector('.ticket-chips')!
      const ticket = (row.closest('.round-ticket') ?? row.parentElement!).getBoundingClientRect()
      return {
        chips: [...row.querySelectorAll<HTMLElement>('.preview-chip')].map((li) => {
          const b = li.getBoundingClientRect()
          return { label: li.getAttribute('aria-label') ?? '', top: b.top, right: b.right, icon: li.querySelector('.chip-icon')!.getBoundingClientRect().width }
        }),
        // plan item 692: with Cath's plate in the column the convoy stays a compact row of 28 px sprites
        plate: !!document.querySelector('.round-group > .cath-plate:not([hidden])'),
        right: ticket.right,
        scrolls: row.scrollWidth > row.clientWidth + 1,
      }
    })
    expect(r.chips.length).toBeGreaterThanOrEqual(3)
    for (const c of r.chips) {
      expect(c.label, 'a count and a name').toMatch(/^\d+ \S.+/)
      expect(c.top, `${c.label} on the first one's line`).toBeCloseTo(r.chips[0]!.top, 0)
      expect(c.right, `${c.label} inside the ticket`).toBeLessThanOrEqual(r.right)
      expect(c.icon, `${c.label} sprite`).toBeGreaterThanOrEqual(w < 900 ? 20 : r.plate ? 28 : 48)
    }
    if (w >= 900) {
      expect(r.scrolls).toBe(false)
      // on keyboard focus a segment says its vehicle's name
      await chips.first().focus()
      await page.keyboard.press('Tab')
      await page.keyboard.press('Shift+Tab')
      const shown = await page.evaluate(() => (document.activeElement?.querySelector('.chip-name') as HTMLElement | null)?.getBoundingClientRect().width ?? 0)
      expect(shown, 'the focused segment shows its name').toBeGreaterThan(30)
    }
  })
}
