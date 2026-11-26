import { expect, test } from '@playwright/test'

// Plan item 720: progress you can read on the map. Each stop carries its state (won / next / held: done, next,
// locked); a cleared stop wears its stars (12 px+) and a string of bunting; the lane is trodden (darker, rutted) up to
// Next and a pale track beyond; a tap on a locked stop names the stop that opens it.
test('the map shows how far you have come', async ({ page }) => {
  await page.goto('/hedgerow/?2d')
  await page.evaluate(() => {
    const seenBefore: Record<string, boolean> = {}
    for (let i = 1; i <= 40; i++) seenBefore[i] = true
    const stars = { 1: 3, 2: 2, 3: 3, 4: 1, 5: 2, 6: 3 }
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore, seen: {}, tips: { all: true }, bank: {} }))
  })
  await page.goto('/hedgerow/?2d')
  const stop = (id: number) => page.locator(`#screen-select .stop:has(> .node[data-level="${id}"])`)
  await expect(stop(1)).toHaveAttribute('data-state', 'won')
  await expect(stop(6)).toHaveAttribute('data-state', 'won')
  await expect(stop(7)).toHaveAttribute('data-state', 'next')
  await expect(stop(8)).toHaveAttribute('data-state', 'held')

  // Cleared: stars a readable size, and bunting; the next and locked stops have none.
  for (const id of [1, 4, 6]) {
    await expect(stop(id).locator('.stop-bunting')).toBeVisible()
    const px = await stop(id).locator('.level-stars i').first().evaluate((e) => e.getBoundingClientRect().height)
    expect(px).toBeGreaterThanOrEqual(12)
  }
  await expect(stop(7).locator('.stop-bunting')).toHaveCount(0)
  await expect(stop(8).locator('.stop-bunting')).toHaveCount(0)

  // The lane: the trodden stretch and its ruts end at Next; the bed runs on beyond it, paler than the trodden road.
  const lane = await page.evaluate(() => {
    const svg = document.querySelector('#screen-select .act .trail-path')!
    const len = (cls: string) => (svg.querySelector(`.${cls}`) as SVGPathElement).getTotalLength()
    const lum = (cls: string) => {
      // color-mix() computes to color(srgb r g b) in 0-1; rgb() in 0-255
      const s = getComputedStyle(svg.querySelector(`.${cls}`)!).stroke
      const m = s.replace(/^color\(srgb/, '').match(/[\d.]+/g)!.map(Number).map((v) => (s.startsWith('color(') ? v * 255 : v))
      return 0.2126 * m[0]! + 0.7152 * m[1]! + 0.0722 * m[2]!
    }
    return { walked: len('lane-walked'), ruts: len('lane-ruts'), bed: len('lane-bed'), walkedLum: lum('lane-walked'), bedLum: lum('lane-bed') }
  })
  expect(lane.walked).toBeGreaterThan(0)
  expect(Math.abs(lane.ruts - lane.walked)).toBeLessThan(1)
  expect(lane.bed).toBeGreaterThan(lane.walked * 1.2)
  expect(lane.bedLum - lane.walkedLum).toBeGreaterThan(40)

  // A locked stop says what opens it.
  const held = stop(8)
  await held.scrollIntoViewIfNeeded()
  await held.locator('.level-num').click({ force: true })
  await expect(held.locator('.locked-say')).toHaveText(`Clear ${await stop(7).locator('.level-name').evaluate((e) => e.firstChild?.textContent ?? '')} first`)
})
