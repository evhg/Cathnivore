import { test, expect } from '@playwright/test'

// Plan item 121: the map's SQUEEZE/EXPAND badges were about 7 px on a phone. They now scale with the hex on screen
// as far as the stalls' 24 px allows, and stay clear of the tile's pieces.
test('threat badges read at 11 px or more on a desktop, grow on a phone, and keep off the pieces', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.game')).toBeVisible()
  const badges = page.locator('.threat-badge')
  await expect(badges.first()).toBeAttached({ timeout: 10_000 })
  const m = await badges.evaluateAll((els) =>
    els.map((b) => {
      const t = b.querySelector('text')!.getBoundingClientRect()
      const r = b.getBoundingClientRect()
      const hex = b.closest('.region-hex')!
      const pieces = [...hex.querySelectorAll('.piece-tray .piece-slot')].map((p) => p.getBoundingClientRect()).filter((p) => p.width > 0)
      const hit = pieces.some((p) => p.left < r.right - 2 && r.left + 2 < p.right && p.top < r.bottom - 2 && r.top + 2 < p.bottom)
      return { h: t.height, hit }
    }),
  )
  expect(m.length).toBeGreaterThan(0)
  for (const b of m) {
    // A text box is about 1.15x its font size. On a phone the badge grows only while the stalls keep their 24 px
    // (item 2), so it reaches about 8 px on a 64 px hex (it was 7); 11 px there is item 121's open design call.
    expect(b.h / 1.15, JSON.stringify(m)).toBeGreaterThanOrEqual(testInfo.project.name === 'phone' ? 7.5 : 10.5)
    expect(b.hit, JSON.stringify(m)).toBe(false)
  }
})
