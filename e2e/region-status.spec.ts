import { test, expect, type Page } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 550 slice 1: every region carries exactly one status on its name banner's end (free, contested or held,
// with Hollowell's piece count), labelled for screen readers, sitting on the banner and inside its hex's row.
test('each region has one labelled status on its name banner', async ({ page, hasTouch }) => {
  await checkStatuses(page, hasTouch)
})

// Plan item 550: on a 375 px phone Kingsmarket's disc meets a neighbour's plate at either end, so its sign slides
// within the gap Brindle Hills and Rivermead leave.
test('the statuses fit a 375 px phone', async ({ page, hasTouch }) => {
  test.skip(!hasTouch, 'phones only')
  await page.setViewportSize({ width: 375, height: 667 })
  await checkStatuses(page, hasTouch)
})

async function checkStatuses(page: Page, hasTouch: boolean) {
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
        // (plan item 550: on its left end where the right would meet the next region's plate)
        onEnd: (s.getAttribute('data-side') === 'left' ? b.left < plate.left && b.right > plate.left : b.left < plate.right && b.right > plate.right) && Math.abs((b.top + b.bottom) / 2 - (plate.top + plate.bottom) / 2) < plate.height * 0.4,
        // nor meets another region's plate
        others: [...document.querySelectorAll('.map-wrap svg.map .region-sign')].filter((o) => o !== sign).map((o) => o.querySelector('.region-plaque')!.getBoundingClientRect())
          .filter((o) => b.left < o.right && o.left < b.right && b.top < o.bottom && o.top < b.bottom).length,
        size: b.height,
        // plan item 550: the disc never covers the name's letters
        onName: (() => {
          const t = sign.querySelector('.region-name')!.getBoundingClientRect()
          return s.getAttribute('data-side') === 'left' ? b.right - t.left : t.right - b.left
        })(),
        // plan item 550: no piece or landmark prop meets the banner (plaque or disc)
        meets: [...document.querySelectorAll(`.map-wrap svg.map .region-hex[data-region="${sign.getAttribute('data-sign')}"] :is([data-piece], [data-grip-prop])`)]
          .map((g) => g.getBoundingClientRect())
          .filter((g) => g.width > 0 && [plate, b].some((o) => g.left < o.right && o.left < g.right && g.top < o.bottom && o.top < g.bottom)).length,
      }
    }),
  )
  expect(r.length).toBeGreaterThan(0)
  for (const s of r) {
    expect(s.count, s.region!).toBe(1)
    expect(s.status).toMatch(/^(free|contested|held)$/)
    expect(s.label).toMatch(s.status === 'free' ? /: free$/ : new RegExp(`: (contested|held by Hollowell), ${s.n} Hollowell pieces?$`))
    expect(s.onEnd, JSON.stringify(s)).toBe(true)
    // Plan item 550: 28 px across or more on a desktop, 22 on a phone.
    expect(s.size, s.region!).toBeGreaterThanOrEqual(hasTouch ? 22 : 28)
    expect(s.onName, `${s.region} disc over its name`).toBeLessThanOrEqual(1)
    expect(s.meets, `${s.region} pieces on its banner`).toBe(0)
    expect(s.others, `${s.region} status on another plate`).toBe(0)
  }
}
