import { expect, test } from '@playwright/test'

// Plan item 450: during a round the depot's board counts its lane's vehicles still to leave, ticking down as each
// pulls out (it said what was next only between rounds).
type HG = { game(): { phase: string; spawnQueue: unknown[] } | null; sendWave(g: unknown): void }

test('the depot counts down the round as its vehicles leave', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'one size is enough')
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/hedgerow/?sandbox=1')
  await page.evaluate(() => {
    const stars: Record<string, number> = {}
    for (let i = 1; i < 5; i++) stars[String(i)] = 3
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { '5': true }, seen: {}, tips: { all: true } }))
  })
  await page.goto('/hedgerow/?sandbox=1&level=5')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 60_000 })
  await page.waitForTimeout(3000)
  await page.evaluate(() => {
    const hg = (window as unknown as { hedgerow: HG }).hedgerow
    hg.sendWave(hg.game())
  })
  const plate = page.locator('.gate-plate[data-leaving]:not([hidden])').first()
  await expect(plate).toBeVisible({ timeout: 30_000 })
  const left = async () => Number(await plate.getAttribute('data-left'))
  // Read the count and its words in one go: a vehicle can leave between two separate reads.
  const [first, words] = await plate.evaluate((el) => [Number(el.getAttribute('data-left')), el.textContent])
  expect(words).toBe(`${first} to go`)
  await expect.poll(left, { timeout: 60_000 }).toBeLessThan(first)
  const queued = await page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.game()!.spawnQueue.length)
  expect(Math.abs((await left()) - queued)).toBeLessThanOrEqual(1)
})

// Plan item 743: on the phone at level 27 the depot stands half off the frame's left edge; its 'N to go' plate stands
// whole, 12 px or more inside the canvas (at 4 px it read as cut by the edge).
test('the phone l27 depot plate stands 12 px inside the frame', async ({ page, hasTouch }) => {
  test.skip(!hasTouch, 'the phone frame')
  test.setTimeout(180_000)
  await page.goto('/hedgerow/?sandbox=1')
  await page.evaluate(() => {
    const stars: Record<string, number> = {}
    for (let i = 1; i < 27; i++) stars[String(i)] = 3
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { '27': true }, seen: {}, tips: { all: true } }))
  })
  await page.goto('/hedgerow/?sandbox=1&level=27')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 90_000 })
  await page.waitForTimeout(3000)
  await page.evaluate(() => {
    const hg = (window as unknown as { hedgerow: HG }).hedgerow
    hg.sendWave(hg.game())
  })
  const plate = page.locator('.gate-plate[data-leaving]:not([hidden])').first()
  await expect(plate).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(2000)
  const { p, c } = await plate.evaluate((el) => ({ p: el.getBoundingClientRect().toJSON(), c: document.querySelector('canvas')!.getBoundingClientRect().toJSON() }))
  expect(p.x - c.x, 'left').toBeGreaterThanOrEqual(11.5)
  expect(c.x + c.width - (p.x + p.width), 'right').toBeGreaterThanOrEqual(11.5)
})
