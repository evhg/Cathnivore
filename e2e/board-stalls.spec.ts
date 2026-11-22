import { test, expect } from '@playwright/test'

// Plan item 645: the players' own wooden pieces on the board. At the start of a quick game the producers' market stalls
// (an awning on two posts over a counter) stand on two regions or more, matte wood with no plastic gloss, and no hex
// shows the same Outlet twice (one glossy piece a kind, its shape by its stage).
test('the players hold wooden stalls on the board from the first turn', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.map-wrap svg.map[data-round] .producer-mini').first()).toBeVisible()
  await page.waitForTimeout(800)
  const r = await page.evaluate(() => {
    const svg = document.querySelector('.map-wrap svg.map[data-round]')!
    const hexes = Array.from(svg.querySelectorAll<SVGGElement>('.region-hex'))
    const stalls = hexes.filter((h) => h.querySelector('.producer-mini .stall-awning') && h.querySelector('.producer-mini .stall-counter'))
    const minStall = Math.min(...Array.from(svg.querySelectorAll('.producer-mini .stall-piece')).map((e) => e.getBoundingClientRect().height))
    const glossyStall = svg.querySelectorAll('.producer-mini .corp-specular, .producer-mini [fill*="gloss"]').length
    const repeats = hexes.filter((h) => {
      const st = Array.from(h.querySelectorAll('.enemy-outlet')).map((e) => e.getAttribute('data-stage'))
      return new Set(st).size !== st.length
    }).map((h) => h.dataset.region)
    return { stalls: stalls.length, minStall, glossyStall, repeats }
  })
  expect(r.stalls, 'regions with a wooden stall').toBeGreaterThanOrEqual(2)
  expect(r.glossyStall).toBe(0)
  expect(r.repeats).toEqual([])
  expect(r.minStall, 'a stall reads at a glance').toBeGreaterThanOrEqual((page.viewportSize()?.width ?? 0) >= 1024 ? 40 : 20)
})
