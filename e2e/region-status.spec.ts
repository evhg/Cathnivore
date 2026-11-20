import { test, expect } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 550 slice 1: every region carries exactly one status on its name banner's end (free, contested or held,
// with Hollowell's piece count), labelled for screen readers, sitting on the banner and inside its hex's row.
test('each region has one labelled status on its name banner', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await fillSeed(page, '7')
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.map-wrap svg.map .region-sign').first()).toBeVisible()
  await page.waitForTimeout(600)
  const r = await page.evaluate(() =>
    [...document.querySelectorAll<SVGGElement>('.map-wrap svg.map .region-sign')].map((sign) => {
      const statuses = sign.querySelectorAll('[data-region-status]')
      const s = statuses[0]!
      const plate = sign.querySelector('.region-plaque')!.getBoundingClientRect()
      const b = s.getBoundingClientRect()
      return {
        region: sign.getAttribute('data-sign'),
        count: statuses.length,
        status: s.getAttribute('data-region-status'),
        label: s.getAttribute('aria-label') ?? '',
        n: Number(s.getAttribute('data-count')),
        // the disc overlaps the plaque's right end, centred on its height
        onEnd: b.left < plate.right && b.right > plate.right && Math.abs((b.top + b.bottom) / 2 - (plate.top + plate.bottom) / 2) < plate.height * 0.4,
        size: b.height,
      }
    }),
  )
  expect(r.length).toBeGreaterThan(0)
  for (const s of r) {
    expect(s.count, s.region!).toBe(1)
    expect(s.status).toMatch(/^(free|contested|held)$/)
    expect(s.label).toMatch(s.status === 'free' ? /: free$/ : new RegExp(`: (contested|held by Hollowell), ${s.n} Hollowell pieces?$`))
    expect(s.onEnd, JSON.stringify(s)).toBe(true)
    expect(s.size).toBeGreaterThanOrEqual(10)
  }
})
