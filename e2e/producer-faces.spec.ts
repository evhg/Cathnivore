import { test, expect } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 80: the producers' faces follow the game. In an autoplayed game, the active producer's cameo swaps to
// a worried face (item 154: the seat's portrait on a big desktop) after a Squeeze lands on one of their Stalls, or a delighted one when their ability fires.
test('the active producer reacts to the turn', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/?e2eAutoplay=1')
  await page.getByText('Quick Game').click()
  // A fixed seed: an unseeded autoplay sometimes ran 70 s with no Squeeze or ability landing (2 of 3 runs failed on
  // 2026-11-14); seed 3 brings one in the first rounds (8 of 8 at P and D; seed 7 still missed 1 in 3).
  await fillSeed(page, process.env.FACES_SEED ?? '3')
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator(':is(.producer-cameo, .producer-seat, .table-producer[data-active]) :is(svg.producer-art, svg.fig):visible').first()).toBeVisible()
  const seen = new Set<string>()
  const deadline = Date.now() + 70_000
  const board = new Set<string>()
  while (Date.now() < deadline && !((seen.has('worried') || seen.has('delighted')) && board.size > 0)) {
    const face = await page.locator(':is(.producer-cameo, .producer-seat, .table-producer[data-active]) svg.producer-art:visible').first().getAttribute('data-face', { timeout: 50 }).catch(() => null)
    if (face) seen.add(face)
    // Plan item 374: on a desktop table the active producer stands half length; their face is on the seat.
    const standing = await page.locator('.table-producers-desk .table-producer[data-active]:not([data-unseated])').getAttribute('data-expression', { timeout: 50 }).catch(() => null)
    if (standing) seen.add(standing)
    // The board's miniatures react with them: the art drawn inside a standee swaps its face (since gate 7's 2026-11-26
    // cut, a <use> of the board's one portrait per producer and face).
    const drawn = await page.locator('.producer-mini use').evaluateAll((els) =>
      els.map((e) => document.querySelector(`${e.getAttribute('href')} svg.producer-art`)?.getAttribute('data-face') ?? null),
    )
    for (const f of drawn) if (f && f !== 'neutral') board.add(f)
    await page.waitForTimeout(60)
  }
  expect(seen.has('worried') || seen.has('delighted'), `faces seen: ${[...seen].join(', ')}`).toBe(true)
  expect([...board].every((f) => f === 'worried' || f === 'delighted') && board.size > 0, `board faces: ${[...board].join(', ')}`).toBe(true)
})

// Plan item 80: the Setup draws every producer's face, with the page not scrolling. Item 507 made the opening board
// the D Setup's focal point and each producer card a nameplate (a 58x70 portrait; 120 px before), so the bound is 56.
test('Setup producer portraits are drawn on every card', async ({ page }, testInfo) => {
  // Plan item 513: an upright phone draws the pair once, on the producer chips, and gives the height to the opening
  // board (setup-opening measures that), so this is a D check now.
  test.skip(testInfo.project.name !== 'desktop-chromium', 'D')
  const sizes: Array<[number, number]> = [[1440, 900], [1280, 800]]
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await expect(page.getByRole('heading', { name: 'Quick Game' })).toBeVisible()
    const sel = '.producer-card .pc-portrait'
    const boxes = await page.locator(sel).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))
    expect(boxes.length, `${width}x${height} portraits`).toBe(4)
    for (const h of boxes) expect(h, `${width}x${height}`).toBeGreaterThanOrEqual(56)
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight - innerHeight)).toBeLessThanOrEqual(1)
  }
})
