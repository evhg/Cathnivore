import { expect, test } from '@playwright/test'

// Plan item 78: in 3D the camera is fitted to the field, so the field's projected box (at the fitted view, before
// any zoom or pan) fills at least 65% of the canvas on a phone and on a desktop.
type HG = { game(): unknown; fieldShare(): number | null }
for (const level of [13, 21]) {
  test(`the 3D field fills its frame (level ${level})`, async ({ page }) => {
    await page.goto('/hedgerow/?sandbox=1')
    await page.evaluate((l) => {
      const stars: Record<string, number> = {}
      for (let i = 1; i < l; i++) stars[String(i)] = 3
      localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { [String(l)]: true }, seen: {}, tips: { all: true } }))
    }, level)
    await page.goto(`/hedgerow/?sandbox=1&level=${level}`)
    await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 60_000 })
    const share = await expect
      .poll(() => page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.fieldShare()), { timeout: 60_000 })
      .not.toBeNull()
      .then(() => page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.fieldShare()))
    expect(share!).toBeGreaterThanOrEqual(0.65)
  })
}

// Plan item 98: the gate sign's town name read about 9 px at D and edge on from a phone's high camera. The board
// faces the camera and its letters stand 8.5 px or more (about 12 px type) at P and D.
type HGS = HG & { gateSigns(): Array<{ x: number; y: number; cap: number }> | null }
test('the 3D gate sign reads at 12 px type or more (level 21)', async ({ page }) => {
  await page.goto('/hedgerow/?sandbox=1')
  await page.evaluate(() => {
    const stars: Record<string, number> = {}
    for (let i = 1; i < 21; i++) stars[String(i)] = 3
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { '21': true }, seen: {}, tips: { all: true } }))
  })
  await page.goto('/hedgerow/?sandbox=1&level=21')
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HGS }).hedgerow?.game(), null, { timeout: 60_000 })
  await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow: HGS }).hedgerow.gateSigns()?.length || document.querySelectorAll('.gate-plate-town').length), { timeout: 60_000 }).toBeGreaterThan(0)
  await page.waitForTimeout(1500)
  const signs = (await page.evaluate(() => (window as unknown as { hedgerow: HGS }).hedgerow.gateSigns()))!
  const vp = page.viewportSize()!
  const seen = signs.filter((s) => s.x >= 0 && s.x <= vp.width && s.y >= 0 && s.y <= vp.height)
  for (const s of seen) expect(s.cap).toBeGreaterThanOrEqual(8.4)
  // Plan item 103: on a phone level 21's gate stands on the field, so its board steps down (it covered the next
  // column's plots) and the queue's plate names the town instead.
  if (vp.width < 600) {
    expect(seen.length).toBe(0)
    await expect(page.locator('.gate-plate-town').first()).toHaveText('HOLLOWELL')
  } else expect(seen.length).toBeGreaterThan(0)
})

// Plan item 102: she cheers a cleared round and raises a worried hand when a vehicle gets through. Her reaction
// starts on the frame the event lands (it eases in over 0.15 s); swiftshader runs at a few fps, so the wait here
// is frames, not the 250 ms a real GPU shows.
test('the 3D Cath cheers a cleared round, worries at a leak and stoops to plant', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'one size is enough')
  test.setTimeout(180_000)
  await page.goto('/hedgerow/?sandbox=1')
  await page.evaluate(() => {
    const stars = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), 3]))
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { 13: true }, seen: {}, tips: { all: true } }))
  })
  await page.goto('/hedgerow/?sandbox=1&level=13')
  type R3 = { heroMood: string; cath?: unknown }
  type HG3 = { game(): { events: unknown[] } | null }
  await page.waitForFunction(() => !!(window as unknown as { hedgerow3d?: R3 }).hedgerow3d?.cath, null, { timeout: 120_000 })
  const mood = () => page.evaluate(() => (window as unknown as { hedgerow3d: R3 }).hedgerow3d.heroMood)
  await page.evaluate(() => (window as unknown as { hedgerow: HG3 }).hedgerow.game()!.events.push({ type: 'cleared', wave: 1, reward: 0 }))
  await expect.poll(mood, { timeout: 15_000, intervals: [100] }).toBe('cheer')
  await expect.poll(mood, { timeout: 20_000 }).toBe('rest')
  await page.evaluate(() => (window as unknown as { hedgerow: HG3 }).hedgerow.game()!.events.push({ type: 'leak', x: 1, y: 1, lost: 1 }))
  await expect.poll(mood, { timeout: 15_000, intervals: [100] }).toBe('worried')
  await expect.poll(mood, { timeout: 20_000 }).toBe('rest')
  // A tower going in: she stoops to plant it.
  await page.evaluate(() => {
    const hg = (window as unknown as { hedgerow: { game(): { level: { cols: number; rows: number } }; place(g: unknown, k: string, c: number, r: number): { ok: boolean } } }).hedgerow
    const g = hg.game()
    for (let r = 0; r < g.level.rows; r++) for (let c = 0; c < g.level.cols; c++) if (hg.place(g, 'hedgerow', c, r).ok) return
  })
  await expect.poll(mood, { timeout: 15_000, intervals: [100] }).toBe('plant')
})

// Plan item 102: her face is big enough to read at the field's own framing: 24 px tall or more at D, 14 on a phone.
for (const level of [13, 21]) {
  test(`the 3D Cath's face reads at the field's framing (level ${level})`, async ({ page, hasTouch }) => {
    test.setTimeout(150_000)
    await page.goto('/hedgerow/?sandbox=1')
    await page.evaluate((l) => {
      const stars: Record<string, number> = {}
      for (let i = 1; i < l; i++) stars[String(i)] = 3
      localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars, seenBefore: { [String(l)]: true }, seen: {}, tips: { all: true } }))
    }, level)
    await page.goto(`/hedgerow/?sandbox=1&level=${level}`)
    type FB = { faceBox(): { w: number; h: number } | null }
    await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow?: FB }).hedgerow?.faceBox() ?? null), { timeout: 120_000 }).not.toBeNull()
    await page.waitForTimeout(3000)
    const box = await page.evaluate(() => (window as unknown as { hedgerow: FB }).hedgerow.faceBox()!)
    expect(box.h).toBeGreaterThanOrEqual(hasTouch ? 14 : 24)
  })
}
