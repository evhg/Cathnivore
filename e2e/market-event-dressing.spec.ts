import { test, expect } from '@playwright/test'

// Plan item 144: the week's market event dresses the board. The map carries data-event, and every region shows the
// event's dressing (produce heaped for the Great Glut, lanterns for the Harvest Festival, cracked earth for the Dry
// Spell), none of it meeting a piece. The event comes from the ISO week, so each is reached by a date in its week.
for (const [event, day, sel] of [
  ['glut', '2026-11-05', '.ev-heap'],
  ['festival', '2026-11-10', '.ev-lanterns'],
  ['drought', '2026-11-17', '.ev-cracks'],
] as const) {
  test(`the ${event} week dresses every region`, async ({ page }) => {
    await page.clock.setFixedTime(new Date(`${day}T10:00:00Z`))
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await page.getByRole('button', { name: 'Start' }).click()
    await expect(page.locator('svg.map')).toHaveAttribute('data-event', event)
    const regions = await page.locator('svg.map .region-hex').count()
    await expect(page.locator(`svg.map ${sel}`)).toHaveCount(regions)
    const hit = await page.evaluate((s) => {
      const pieces = [...document.querySelectorAll('.piece-tray .piece-slot')].map((e) => e.getBoundingClientRect())
      return [...document.querySelectorAll(s)].some((d) => {
        const a = d.getBoundingClientRect()
        return pieces.some((q) => q.left < a.right - 1 && a.left + 1 < q.right && q.top < a.bottom - 1 && a.top + 1 < q.bottom)
      })
    }, sel === '.ev-cracks' ? '.ev-none' : sel)
    expect(hit).toBe(false)
  })
}
