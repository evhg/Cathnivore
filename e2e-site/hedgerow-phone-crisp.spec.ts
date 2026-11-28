import { expect, test } from '@playwright/test'

// Plan item 691: a crisp, readable 3D battle on a phone. The canvas draws at the device's pixel ratio (capped at 2:
// the 1x phone shots were what read soft), the gate's board never stands cut by the frame's edge (an upright
// phone's l27 read 'HOLL' at the canvas foot, under the tray's tab), and a callout rising beside a tower ('Bridge
// up!' over the windmill) steps clear of every tower's screen box.
type Box = { x: number; y: number; w: number; h: number }
type HG = {
  game(): unknown
  place(g: unknown, kind: string, c: number, r: number): { ok: boolean }
  gateSigns(): Array<{ x: number; y: number; cap: number }> | null
  callouts(): { callouts: Array<Box & { text: string }>; towers: Box[] } | null
  testCallout(text: string, i?: number): boolean | null
  canvasRatio(): number | null
}

test('Hedgerow phone 3D: device-ratio canvas, no cut gate board, callouts off the towers', async ({ browser, hasTouch }) => {
  test.skip(!hasTouch, 'the phone frame')
  test.setTimeout(240_000)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 })
  const page = await ctx.newPage()
  await page.goto('/hedgerow/?sandbox=1')
  await page.evaluate(() => {
    const stars = Object.fromEntries(Array.from({ length: 26 }, (_, i) => [String(i + 1), 3]))
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { '27': true }, seen: {}, tips: { all: true } }))
  })
  await page.goto('/hedgerow/?sandbox=1&level=27')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 60_000 })
  await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.canvasRatio()), { timeout: 60_000 }).toBe(2)
  await page.waitForTimeout(3000)

  // No gate board drawn part in, part out of the canvas.
  const canvas = (await page.locator('#canvas').boundingBox())!
  const signs = (await page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.gateSigns())) ?? []
  for (const s of signs) {
    const inside = s.x >= canvas.x && s.x <= canvas.x + canvas.width && s.y >= canvas.y && s.y <= canvas.y + canvas.height - 6
    const near = s.x > canvas.x - 60 && s.x < canvas.x + canvas.width + 60 && s.y > canvas.y - 60 && s.y < canvas.y + canvas.height + 60
    expect(!near || inside, `gate board at ${s.x},${s.y}`).toBe(true)
  }

  // Towers on the plots beside the lane, then a callout from each: it rises clear of every tower box.
  const placed = await page.evaluate(() => {
    const h = (window as unknown as { hedgerow: HG }).hedgerow
    const g = h.game() as { level: { rows: number; cols: number; towers: string[]; path: number[][] } }
    let n = 0
    for (let r = 0; r < g.level.rows && n < 6; r++)
      for (let c = 0; c < g.level.cols && n < 6; c++) {
        const near = g.level.path.some(([pc, pr]) => Math.abs(pc! - c) + Math.abs(pr! - r) === 1)
        if (near && h.place(g, g.level.towers[n % g.level.towers.length]!, c, r).ok) n++
      }
    return n
  })
  expect(placed).toBeGreaterThanOrEqual(3)
  // the towers grow in from their plots: wait until their boxes hold within 3 px (they breathe at rest; swiftshader
  // draws a few frames a second)
  let last: number[][] = []
  await expect
    .poll(async () => {
      const t = (await page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.callouts()))!.towers.map((b) => [b.x, b.y, b.w, b.h])
      const same = t.length === last.length && t.every((b, i) => b.every((v, j) => Math.abs(v - last[i]![j]!) <= 3))
      last = t
      return same
    }, { timeout: 60_000, intervals: [1500] })
    .toBe(true)
  for (let i = 0; i < placed; i++) {
    // Under swiftshader's few frames a second a callout outlives the 1.3 s wait; check the one just raised, not the
    // last tower's still rising.
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.callouts()!.callouts.filter((c) => c.text === 'Bridge up!').length), { timeout: 30_000 })
      .toBe(0)
    await page.evaluate((k) => (window as unknown as { hedgerow: HG }).hedgerow.testCallout('Bridge up!', k), i)
    await page.waitForTimeout(300)
    const shown = (await page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.callouts()))!
    const label = shown.callouts.filter((c) => c.text === 'Bridge up!').at(-1)
    if (!label) continue
    // Item 726: a callout carries a dark outline under its fill, so pale gold reads on gold and white models.
    const stroke = await page.evaluate(() => {
      const el = document.querySelector('.floater')
      return el ? parseFloat(getComputedStyle(el).webkitTextStrokeWidth) : 0
    })
    expect(stroke, 'callout outline px').toBeGreaterThanOrEqual(3)
    const over = shown.towers.filter((t) => label.x < t.x + t.w && label.x + label.w > t.x && label.y < t.y + t.h && label.y + label.h > t.y)
    expect(over, `callout from tower ${i} at ${JSON.stringify(label)}, towers ${JSON.stringify(shown.towers.map((t) => [t.x, t.y, t.w, t.h].map(Math.round)))}`).toEqual([])
    await page.waitForTimeout(1300)
  }
  await ctx.close()
})
