import { test, expect } from '@playwright/test'

// Plan item 417: who holds each region shows in the land itself. Every region carries `data-control` (held,
// contested or free); held ground (Hollowell dug in) is greyed toward tarmac, at least 30% less saturated than freed
// ground (sampled from the pixels with the pieces hidden); a freed region draws 2+ stalls; a change cross-fades in
// 400-1200 ms.
test('held land greys, freed land warms and holds stalls', async ({ page }) => {
  await page.goto('/?e2eAutoplay=1&e2eAutoplayUntil=5')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect
    .poll(() => page.evaluate(() => (document.querySelector('.end-screen') ? 99 : Number(document.querySelector('.map-wrap svg.map[data-round]')?.getAttribute('data-round') ?? 0))), { timeout: 90_000 })
    .toBeGreaterThanOrEqual(5)
  test.skip(await page.locator('.end-screen').isVisible(), 'the game ended early')
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
  // Held ground carries Hollowell's signboard where the pieces leave room (a crowded tile may have none).
  expect(await page.locator('.map-wrap .region-hex[data-control="held"] .held-sign').count()).toBeGreaterThanOrEqual(1)
  await page.addStyleTag({
    content:
      '*, *::before, *::after { animation: none !important; transition: none !important; } .piece-tray, .board-landmark, .pressure-ring, .threat-badge, .liberated-life, .free-stalls, .region-label, .map-wrap text, .map-wrap .region-hex > g:not(.land-layer):not(.held-sheen), .table-producer, .table-cath, .cath-bubble { visibility: hidden !important; }',
  })
  await page.waitForTimeout(300)
  const sat = async (control: string) => {
    const vals: number[] = []
    for (const g of await page.locator(`.map-wrap .region-hex[data-control="${control}"]`).all()) {
      const b = (await g.locator('polygon').first().boundingBox())!
      // The middle of the tile: its face, inside the frame and the name plate.
      const clip = { x: b.x + b.width * 0.25, y: b.y + b.height * 0.3, width: b.width * 0.5, height: b.height * 0.45 }
      const png = await page.screenshot({ clip })
      vals.push(
        await page.evaluate(async (b64) => {
          const img = new Image()
          img.src = `data:image/png;base64,${b64}`
          await img.decode()
          const c = document.createElement('canvas')
          c.width = img.width
          c.height = img.height
          const x = c.getContext('2d')!
          x.drawImage(img, 0, 0)
          const d = x.getImageData(0, 0, c.width, c.height).data
          let s = 0
          for (let i = 0; i < d.length; i += 4) {
            const mx = Math.max(d[i]!, d[i + 1]!, d[i + 2]!)
            const mn = Math.min(d[i]!, d[i + 1]!, d[i + 2]!)
            s += mx === 0 ? 0 : (mx - mn) / mx
          }
          return s / (d.length / 4)
        }, png.toString('base64')),
      )
    }
    return vals.reduce((a, v) => a + v, 0) / vals.length
  }
  const held = await sat("held")

  const free = await sat('free')
  expect(held, `held ${held.toFixed(3)} vs free ${free.toFixed(3)}`).toBeLessThanOrEqual(free * 0.7)
})
