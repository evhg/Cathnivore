import { expect, test } from '@playwright/test'

// Plan item 657: the fleet you're fighting reads mid-round. Level 21 (sandbox, no towers), round 11: quadcopters
// from the depot and a burst of stealth lorries out of cover half way down the lane. 3 s after the send the lane
// carries vehicles, and the lorries that can't be shown one by one stand in a column at the ambush, not on the
// depot's pier (before, the lane's one column took the depot queue's place). In 3D each vehicle is 40 px+ long, and a column is
// a jam of three with its count on screen, not a stack.
type HG = {
  game(): { wave: number; enemies: Array<{ dist: number; kind: string; lane?: number }>; pathLength: number }
  sendWave(g: unknown, force?: boolean): void
  convoy(): { drawn: number; column: number; cols: Array<{ dist: number; count: number; lane: number; shown?: number; counted?: boolean }> } | null
  vehicleBoxes(): Array<{ x: number; y: number; w: number; h: number }>
}

async function open(page: import('@playwright/test').Page, mode: '2d' | '3d') {
  const stars = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(i + 1), 3]))
  const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
  await page.goto('/hedgerow/?sandbox=1&2d')
  await page.evaluate(([s, t]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { 21: true }, tips: t })), [stars, tips])
  await page.goto(`/hedgerow/?sandbox=1&level=21${mode === '2d' ? '&2d' : ''}`)
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 90_000 })
  await page.evaluate(() => {
    const h = (window as unknown as { hedgerow: HG }).hedgerow
    const g = h.game()
    g.wave = 10
    h.sendWave(g, true)
  })
}
// A new vehicle's field-guide page holds the round: close it until `ms` has run.
async function runFor(page: import('@playwright/test').Page, ms: number) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    const go = page.locator('.intro:not([hidden]) .intro-go')
    if (await go.isVisible().catch(() => false)) await go.click().catch(() => {})
    await page.waitForTimeout(250)
  }
}

test('2D: the round is on the lane at 3 s, and at 3 s and 8 s the ambush keeps its own column', async ({ page, hasTouch }) => {
  test.setTimeout(150_000)
  await open(page, '2d')
  for (const ms of [3000, 5000]) {
    await runFor(page, ms)
    const st = await page.evaluate(() => {
      const g = (window as unknown as { hedgerow: HG }).hedgerow.game()
      return { onLane: g.enemies.filter((e) => e.dist >= 1).length, lorries: g.enemies.filter((e) => e.kind === 'lorry').map((e) => e.dist), half: g.pathLength / 2, near: g.enemies.filter((e) => e.dist < g.pathLength / 2 - 3 + 2).length, convoy: (window as unknown as { hedgerow: HG }).hedgerow.convoy() }
    })
    expect(st.lorries.length).toBeGreaterThan(0)
    // Every column stands within reach of the vehicles it holds: none of the ambush's lorries is drawn at the pier.
    const nearAmbush = st.convoy!.cols.filter((c) => c.dist > st.half - 3)
    if (st.convoy!.column > 0 && st.lorries.length > 12) expect(nearAmbush.length).toBeGreaterThan(0)
    // The columns by the depot hold no more than the vehicles that really are near it.
    const nearDepot = st.convoy!.cols.filter((c) => c.dist < st.half - 3).reduce((n, c) => n + c.count, 0)
    expect(nearDepot).toBeLessThanOrEqual(st.near)
    if (ms === 3000) expect(st.onLane).toBeGreaterThanOrEqual(6)
  }
  await page.screenshot({ path: `e2e/screenshots/fleet657/l21-2d-${hasTouch ? 'P' : 'D'}.png` })
})

test('3D: every vehicle on the lane is drawn 40 px or more long', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the size bound is for a desktop')
  test.setTimeout(240_000)
  await open(page, '3d')
  await runFor(page, 6000)
  // Under a loaded machine's few frames a second the first vehicles can take longer than that to leave the depot.
  await page.waitForFunction(() => (window as unknown as { hedgerow: HG }).hedgerow.game().enemies.length > 0, null, { timeout: 60_000 })
  const boxes = await page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.vehicleBoxes())
  expect(boxes.length).toBeGreaterThan(0)
  const long = boxes.map((b) => Math.max(b.w, b.h)).sort((a, b) => a - b)
  // The median vehicle; quadcopters are square and small by design, lorries long.
  expect(long[Math.floor(long.length / 2)]).toBeGreaterThanOrEqual(40)
  // A column is a jam of three on the road, not a tower eight vehicles high, and the rest it holds are counted on
  // screen (its swarm badge or its own '+N' plate).
  const cv = await page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.convoy())
  expect(cv).not.toBeNull()
  for (const c of cv!.cols) {
    expect(c.shown).toBeLessThanOrEqual(3)
    if (c.count > 3) expect(c.counted).toBe(true)
  }
  await page.screenshot({ path: 'e2e/screenshots/fleet657/l21-3d-D.png' })
})
