import { test, expect } from '@playwright/test'

// Plan item 80: the producers' faces follow the game. In an autoplayed game, the active producer's cameo swaps to
// a worried face after a Squeeze lands on one of their Stalls, or a delighted one when their ability fires.
test('the active producer reacts to the turn', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/?e2eAutoplay=1')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.producer-cameo svg.producer-art').first()).toBeVisible()
  const seen = new Set<string>()
  const deadline = Date.now() + 70_000
  const board = new Set<string>()
  while (Date.now() < deadline && !((seen.has('worried') || seen.has('delighted')) && board.size > 0)) {
    const face = await page.locator('.producer-cameo svg.producer-art').first().getAttribute('data-face').catch(() => null)
    if (face) seen.add(face)
    // The board's miniatures react with them: the art drawn inside a standee swaps its face.
    for (const f of await page.locator('.producer-mini svg.producer-art').evaluateAll((els) => els.map((e) => e.getAttribute('data-face')))) if (f && f !== 'neutral') board.add(f)
    await page.waitForTimeout(60)
  }
  expect(seen.has('worried') || seen.has('delighted'), `faces seen: ${[...seen].join(', ')}`).toBe(true)
  expect([...board].every((f) => f === 'worried' || f === 'delighted') && board.size > 0, `board faces: ${[...board].join(', ')}`).toBe(true)
})

// Plan item 80: the Setup draws the producers big: each card's portrait at D, the picked pair's at P, at least
// 120 px tall, with the page still not scrolling.
test('Setup producer portraits are at least 120 px tall', async ({ page }, testInfo) => {
  test.skip(!['phone', 'desktop-chromium'].includes(testInfo.project.name), 'P and D')
  const sizes: Array<[number, number]> = testInfo.project.name === 'phone' ? [[390, 844]] : [[1440, 900], [1280, 800]]
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await expect(page.getByRole('heading', { name: 'Quick Game' })).toBeVisible()
    const sel = testInfo.project.name === 'phone' ? '.pair-portrait svg' : '.producer-card .pc-portrait'
    const boxes = await page.locator(sel).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))
    expect(boxes.length, `${width}x${height} portraits`).toBe(testInfo.project.name === 'phone' ? 2 : 4)
    for (const h of boxes) expect(h, `${width}x${height}`).toBeGreaterThanOrEqual(120)
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= innerHeight + 1)).toBe(true)
  }
})
