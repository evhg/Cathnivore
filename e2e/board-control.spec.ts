import { test, expect } from '@playwright/test'

// Plan item 417: who holds each region shows on the land. Every region carries `data-control` (held, contested or
// free); a freed region draws 2+ stalls; a change cross-fades in 400-1200 ms. Plan item 525: held ground keeps its
// colour under Hollowell's shrink-wrap (item 417 greyed it).
test('held land is wrapped in plastic, freed land warms and holds stalls', async ({ page }) => {
  await page.goto('/?e2eAutoplay=1&e2eAutoplayUntil=5')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect
    .poll(() => page.evaluate(() => (document.querySelector('.end-screen') ? 99 : Number(document.querySelector('.map-wrap svg.map[data-round]')?.getAttribute('data-round') ?? 0))), { timeout: 90_000 })
    .toBeGreaterThanOrEqual(5)
  test.skip(await page.locator('.end-screen').isVisible(), 'the game ended early')
  // Plan item 418's bug: no why-not ever asks for a negative amount (a Sell strip read 'Need -2 more Produce' while a
  // decision was pending).
  expect(await page.evaluate(() => /Need\s*[-\u2212]\d/.test(document.body.innerText))).toBe(false)
  const hexes = page.locator('.map-wrap .region-hex')
  await expect.poll(() => hexes.count()).toBeGreaterThanOrEqual(7)
  const controls = await hexes.evaluateAll((gs) => gs.map((g) => g.getAttribute('data-control')))
  for (const c of controls) expect(['held', 'contested', 'free']).toContain(c)
  // The cross-fade: the ground layers' filter transition, 400-1200 ms.
  const dur = await page.locator('.map-wrap .region-hex .land-layer').first().evaluate((e) => {
    const cs = getComputedStyle(e)
    const i = cs.transitionProperty.split(',').map((s) => s.trim()).indexOf('filter')
    return i < 0 ? 0 : parseFloat(cs.transitionDuration.split(',')[i]!) * 1000
  })
  expect(dur).toBeGreaterThanOrEqual(400)
  expect(dur).toBeLessThanOrEqual(1200)
  test.skip(!controls.includes('held') || !controls.includes('free'), `no held and freed pair this game: ${controls}`)
  // A freed region's stalls.
  for (const g of await page.locator('.map-wrap .region-hex[data-control="free"]').all()) {
    expect(await g.locator('.free-stall').count()).toBeGreaterThanOrEqual(2)
  }
  // Plan item 550: held ground carries no H signboard (the region's status disc, in Hollowell's orange, says it).
  expect(await page.locator('.map-wrap .region-hex[data-control="held"] .held-sign').count()).toBe(0)
  for (const s of await page.locator('.map-wrap .region-status[data-region-status="held"]').all()) await expect(s).toHaveAttribute('aria-label', /held by Hollowell/)
  // Plan item 525 (replacing item 417's grey): held land keeps its warm palette at full strength (no filter greys it)
  // and Hollowell's hold is shrink-wrap laid over it, which reads by its highlights in greyscale; freed land wears none.
  const sats = await page.locator('.map-wrap .region-hex .land-layer').evaluateAll((es) =>
    es.map((e) => {
      const m = /saturate\(([\d.]+)\)/.exec(getComputedStyle(e).filter)
      return m ? Number(m[1]) : 1
    }),
  )
  for (const v of sats) expect(v).toBeGreaterThanOrEqual(1)
  for (const g of await page.locator('.map-wrap .region-hex[data-control="held"]').all()) {
    await expect(g.locator('.shrink-wrap[data-wrap="tight"] .wrap-glint').first()).toBeAttached()
  }
  for (const g of await page.locator('.map-wrap .region-hex[data-control="free"]').all()) {
    expect(await g.locator('.shrink-wrap').count()).toBe(0)
  }
})
