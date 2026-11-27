import { test, expect } from '@playwright/test'

// Plan item 733: Hollowell's colonised ground reads as Hollowell's. A region holding three or more Outlets carries the
// cold fluorescent wash (`data-corp-wash`), one holding fewer does not; the Outlet's moulded face is a gradient whose
// top stop is a highlight, lighter than its body.
test('a 3-Outlet region carries the corporate wash; Outlets are glossy', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/?e2eAutoplay=1&e2eAutoplayUntil=6')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect
    .poll(() => page.evaluate(() => (document.querySelector('.end-screen') ? 99 : Number(document.querySelector('.map-wrap svg.map[data-round]')?.getAttribute('data-round') ?? 0))), { timeout: 60_000 })
    .toBeGreaterThanOrEqual(6)
  test.skip(await page.locator('.end-screen').isVisible(), 'the game ended before round 6')
  await page.waitForTimeout(2500)
  const r = await page.evaluate(() => {
    const svg = document.querySelector<SVGSVGElement>('.map-wrap svg.map[data-round]')!
    const rows = Array.from(svg.querySelectorAll<SVGGElement>('.region-hex')).map((hex) => {
      const t = hex.querySelector('.enemy-stack-outlets title')?.textContent ?? '0'
      return { id: hex.dataset.region, outlets: parseInt(t, 10) || 0, wash: hex.querySelector('[data-corp-wash]') !== null, free: hex.querySelector('.liberate-bloom') !== null }
    })
    const lum = (c: string) => {
      // color-mix computes to `color(srgb r g b)` in 0..1, a plain colour to `rgb()` in 0..255
      const k = c.startsWith('color(') ? 255 : 1
      const [r, g, b] = (c.replace(/^color\(srgb/, '').match(/[\d.]+/g) ?? []).map((v) => Number(v) * k)
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
    }
    const stops = Array.from(svg.querySelectorAll('#hollowell-gloss stop')).map((s) => lum(getComputedStyle(s).stopColor))
    const face = svg.querySelector('.enemy-outlet .corp-face')?.getAttribute('fill')
    return { rows, stops, face }
  })
  expect(r.face).toBe('url(#hollowell-gloss)')
  expect(r.stops.length).toBeGreaterThanOrEqual(3)
  expect(r.stops[0]!).toBeGreaterThan(r.stops[1]! + 20)
  for (const row of r.rows) if (!row.free) expect(row.wash, `${row.id} with ${row.outlets} Outlets`).toBe(row.outlets >= 3)
  // the autoplayed game reaches round 6 with Hollowell well dug in somewhere
  expect(r.rows.some((x) => x.wash)).toBe(true)
})
