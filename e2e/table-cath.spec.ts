import { test, expect } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 118 (slice 1): on a desktop Cath stands at the table's left edge in play, half-length, 260 px or more,
// clear of every region hex and of the action column, her face following the game's events. Slice 2: her line in
// a bubble over her head, so the header no longer carries a second Cath.
test('Cath stands at the table during play at D', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop only; the phone keeps the strip portrait')
  for (const [width, height] of [[1440, 900], [1280, 800]] as const) {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await fillSeed(page, '7')
    await page.getByRole('button', { name: 'Start' }).click()
    const cath = page.locator('.table-cath')
    await expect(cath).toBeVisible()
    const box = (await cath.boundingBox())!
    expect((await cath.locator('.table-cath-figure').boundingBox())!.height, `${width}x${height}`).toBeGreaterThanOrEqual(260)
    // Her line is a bubble over her head (15 px or more), not a second Cath in the header.
    const line = cath.locator('.table-cath-line')
    await expect(line).not.toBeEmpty()
    expect(await line.evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(15)
    await expect(page.locator('.table-head .cath-companion')).toHaveCount(0)
    const overlap = (a: { x: number; y: number; width: number; height: number }) =>
      a.x < box.x + box.width && box.x < a.x + a.width && a.y < box.y + box.height && box.y < a.y + a.height
    for (const hex of await page.locator('.region-hex').all()) {
      const h = (await hex.locator('polygon').first().boundingBox())!
      expect(overlap(h), `${width}x${height} ${await hex.getAttribute('data-region')}`).toBe(false)
    }
    expect(overlap((await page.locator('.actions').first().boundingBox())!)).toBe(false)
    // Inside the table, and no page scroll added.
    const map = (await page.locator('.map-wrap').boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(map.x)
    expect(box.y + box.height).toBeLessThanOrEqual(map.y + map.height + 1)
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(height)
    await expect(cath).toHaveAttribute('data-expression', 'smirk')
  }
})

test('her expression follows the round at D', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop only')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await fillSeed(page, '7')
  await page.getByRole('button', { name: 'Start' }).click()
  const cath = page.locator('.table-cath')
  await expect(cath).toHaveAttribute('data-expression', 'smirk')
  // Spend the turn; the round's end brings Hollowell's moves and her reaction to them.
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: /^Sell 1 Produce/ }).click()
    await page.locator('.actions').waitFor()
  }
  await expect(cath).not.toHaveAttribute('data-expression', 'smirk', { timeout: 30_000 })
})

// Plan item 131: on an upright phone 830 px tall and up she stands at the table's lower-left corner, 96 px, and her
// line is a bubble beside her; the header strip goes. Neither meets a hex or a name plate, the hexes take 88% or more
// of the frame's width, and nothing scrolls. Shorter phones keep the strip (the board already runs under the tray).
// Plan item 171 (was item 131's figure on the cloth): on an upright phone her line docks above the hand beside a
// 64 px bust, off the board: it meets no hex, says who's speaking (role=status), and folds away on a tap.
test('Cath speaks from a dock above the hand on a phone', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'phone only')
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await fillSeed(page, '7')
    await page.getByRole('button', { name: 'Start' }).click()
    const dock = page.locator('.cath-dock')
    await expect(dock).toBeVisible()
    await expect(page.locator('.table-cath')).toHaveCount(0)
    await expect(page.locator('.table-head .cath-companion')).toHaveCount(0)
    const bust = (await dock.locator('.cath-dock-bust').boundingBox())!
    expect(bust.width).toBeGreaterThanOrEqual(64)
    expect(bust.height).toBeGreaterThanOrEqual(64)
    const lineEl = dock.locator('.cath-dock-line')
    await expect(lineEl).toHaveAttribute('role', 'status')
    await expect(lineEl).not.toBeEmpty()
    const line = (await lineEl.boundingBox())!
    type B = { x: number; y: number; width: number; height: number }
    const meets = (a: B, b: B) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
    const map = (await page.locator('.map-wrap').boundingBox())!
    let x0 = Infinity, x1 = -Infinity
    for (const hex of await page.locator('.region-hex').all()) {
      const h = (await hex.locator('polygon').first().boundingBox())!
      x0 = Math.min(x0, h.x)
      x1 = Math.max(x1, h.x + h.width)
      expect(meets(h, line), `${scheme} line meets ${await hex.getAttribute('data-region')}`).toBe(false)
      expect(meets(h, bust), scheme).toBe(false)
    }
    // Off the board, above the producer's row and the hand.
    expect(line.y, scheme).toBeGreaterThanOrEqual(map.y + map.height)
    const mat = (await page.locator('.action-tray .active-producer').boundingBox())!
    expect(line.y + line.height, scheme).toBeLessThanOrEqual(mat.y + 1)
    expect((x1 - x0) / map.width, scheme).toBeGreaterThanOrEqual(0.88)
    // The event ticket clears the top plaques.
    const ticket = page.locator('.event-ticket')
    if (await ticket.count()) {
      const t = (await ticket.boundingBox())!
      for (const plate of await page.locator('.map .region-plaque').all()) expect(meets(t, (await plate.boundingBox())!), scheme).toBe(false)
    }
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(844)
    // A tap folds the line away; the dock keeps its height, so the board doesn't move.
    const before = (await dock.boundingBox())!.height
    await lineEl.click()
    await expect(dock).toHaveAttribute('data-folded', '')
    await expect(lineEl).toBeHidden()
    expect((await dock.boundingBox())!.height).toBeCloseTo(before, 0)
    await dock.locator('.cath-dock-btn').click()
    await expect(lineEl).toBeVisible()
  }
  // A shorter phone keeps the header strip.
  await page.setViewportSize({ width: 375, height: 667 })
  await expect(page.locator('.cath-dock')).toHaveCount(0)
  await expect(page.locator('.table-head .cath-companion')).toHaveCount(1)
})
