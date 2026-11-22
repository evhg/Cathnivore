import { expect, test, type Page } from '@playwright/test'

// Plan item 215: an upright phone's 3D field has a closer frame round the lane's busy half (plots 44 px or more,
// vehicles 16 px or more). Plan item 439: it opens on the whole field (every plot in view, Cath 36 px+ tall and
// in view, no tray card cut by the tray's edge), and the Closer button pushes in and comes back. A desktop and ?2d
// keep the whole field with no button.
type Box = { x: number; y: number; w: number; h: number }
type HG = { game(): unknown; fieldVerge(): number | null; plotBoxes(): Box[]; vehicleBoxes(): Box[]; cathBox(): Box | null; sendWave(g: unknown): unknown }

async function open(page: Page, query: string): Promise<void> {
  const level = 21
  const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true, move: true }
  const stars = Object.fromEntries(Array.from({ length: level - 1 }, (_, i) => [String(i + 1), 3]))
  await page.goto(`/hedgerow/?sandbox=1${query}`)
  await page.evaluate(([s, t, l]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { [l]: true }, tips: t })), [stars, tips, level] as const)
  await page.goto(`/hedgerow/?sandbox=1${query}&level=${level}`)
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 90_000 })
}

test('an upright phone opens on the whole field, and Closer pushes in on the lane', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 600, 'upright phone only')
  test.setTimeout(240_000)
  await open(page, '')
  const fit = page.locator('#btn-field-fit')
  await expect(fit).toBeVisible({ timeout: 30_000 })
  await expect(fit).toHaveText(/Closer/i)
  const fb = (await fit.boundingBox())!
  expect(fb.height).toBeGreaterThanOrEqual(44)
  // Plan item 222: clear of the tray's round tab rising into the field's foot.
  const tab = page.locator('#panel .drawer-handle')
  if (await tab.isVisible()) {
    const t = (await tab.boundingBox())!
    expect(fb.x < t.x + t.width && t.x < fb.x + fb.width && fb.y < t.y + t.height && t.y < fb.y + fb.height).toBe(false)
  }
  // Item 439: the whole field (every plot) in view, and Cath on screen at 36 px or more.
  await page.waitForTimeout(2000)
  const whole = await page.evaluate(() => {
    const c = document.getElementById('canvas')!.getBoundingClientRect()
    const h = (window as unknown as { hedgerow: HG }).hedgerow
    const cath = h.cathBox()
    return {
      all: h.plotBoxes().every((b) => b.x >= c.left - 1 && b.y >= c.top - 1 && b.x + b.w <= c.right + 1 && b.y + b.h <= c.bottom + 1),
      verge: h.fieldVerge(),
      cath: cath && { h: cath.h, inside: cath.x >= c.left && cath.y >= c.top && cath.x + cath.w <= c.right && cath.y + cath.h <= c.bottom },
    }
  })
  expect(whole.all).toBe(true)
  // Item 439: the verge beside the field on the rows it spans, 12% of the canvas or less (8.3-11.1% at levels 5-40: the 74 deg view's keystone).
  expect(whole.verge!).toBeLessThanOrEqual(0.12)
  expect(whole.cath?.inside).toBe(true)
  expect(whole.cath!.h).toBeGreaterThanOrEqual(36)
  // Item 439: no tray card shows cut by the tray's edge or under its More arrow.
  const cut = await page.evaluate(() => {
    const tray = document.querySelector('.tray')!
    const tb = tray.getBoundingClientRect()
    const lo = tb.left + (parseFloat(getComputedStyle(tray).paddingLeft) || 0) - 1
    const more = document.querySelector<HTMLElement>('.tray-more')
    const hi = (more && !more.hidden ? more.getBoundingClientRect().left : tb.right) + 1
    return [...tray.children].filter((k) => {
      const b = k.getBoundingClientRect()
      return b.width > 0 && b.right > tb.left && b.left < tb.right && Number(getComputedStyle(k).opacity) > 0.5 && (b.left < lo || b.right > hi)
    }).length
  })
  expect(cut).toBe(0)
  // Closer: plots in view read at 44 px or more.
  await fit.click()
  await expect(fit).toHaveText(/Whole field/i)
  await page.waitForTimeout(2000)
  const inView = await page.evaluate(() => {
    const c = document.getElementById('canvas')!.getBoundingClientRect()
    return (window as unknown as { hedgerow: HG }).hedgerow.plotBoxes().filter((b) => b.x >= c.left && b.y >= c.top && b.x + b.w <= c.right && b.y + b.h <= c.bottom).map((b) => Math.min(b.w, b.h))
  })
  expect(inView.length).toBeGreaterThan(4)
  expect(Math.min(...inView)).toBeGreaterThanOrEqual(44)
  // Vehicles on the lane read at 16 px or more.
  await page.evaluate(() => {
    const h = (window as unknown as { hedgerow: HG }).hedgerow
    h.sendWave(h.game())
  })
  await expect.poll(() => page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.vehicleBoxes().length), { timeout: 120_000 }).toBeGreaterThan(0)
  const veh = await page.evaluate(() => (window as unknown as { hedgerow: HG }).hedgerow.vehicleBoxes().map((b) => Math.max(b.w, b.h)))
  expect(Math.min(...veh)).toBeGreaterThanOrEqual(16)
  await fit.click()
  await expect(fit).toHaveText(/Closer/i)
})

test('?2d keeps the whole field with no button', async ({ page }) => {
  test.setTimeout(180_000)
  await open(page, '&2d')
  await page.waitForTimeout(1500)
  await expect(page.locator('#btn-field-fit')).toBeHidden()
})

// Plan item 651: a desktop's 3D field frames the whole lane while a round runs (the depot dolly at a send runs on the
// wall clock: at a few fps it held the close depot view for 20 s), and its Closer key pushes in and follows the lead
// vehicle, then comes back.
type HGF = Omit<HG, 'game'> & { cellPx3d(c: number, r: number): { x: number; y: number } | null; game(): { level: { path: number[][]; path2?: number[][] }; enemies: unknown[] } }
type R3F = { followView(): { on: boolean; x: number; z: number } }
test('a desktop frames the whole lane through a round, and Closer follows the lead vehicle', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 900, 'desktop only')
  test.setTimeout(240_000)
  await open(page, '')
  const fit = page.locator('#btn-field-fit')
  await expect(fit).toBeVisible({ timeout: 30_000 })
  await expect(fit).toHaveText(/Closer/i)
  await page.waitForTimeout(3000)
  await page.evaluate(() => {
    const h = (window as unknown as { hedgerow: HGF }).hedgerow
    h.sendWave(h.game())
  })
  await page.waitForTimeout(5000)
  const seen = await page.evaluate(() => {
    const h = (window as unknown as { hedgerow: HGF }).hedgerow
    const c = document.getElementById('canvas')!.getBoundingClientRect()
    const g = h.game()
    const cells = [...g.level.path, ...(g.level.path2 ?? [])]
    const out = cells.map(([x, y]) => h.cellPx3d(x!, y!)).filter((p) => !p || p.x < 0 || p.y < 0 || p.x > c.width || p.y > c.height).length
    const cath = h.cathBox()
    return { out, cath: !!cath && cath.x >= c.left && cath.y >= c.top && cath.x + cath.w <= c.right && cath.y + cath.h <= c.bottom }
  })
  expect(seen.out).toBe(0)
  expect(seen.cath).toBe(true)
  await fit.click()
  await expect(fit).toHaveText(/Whole field/i)
  const follow = () => page.evaluate(() => (window as unknown as { hedgerow3d: R3F }).hedgerow3d.followView())
  expect((await follow()).on).toBe(true)
  const a = await follow()
  // The view drifts with the lead vehicle as it goes down the lane (headless game time crawls, so the test moves it
  // 60% of the way along).
  await page.evaluate(() => {
    const g = (window as unknown as { hedgerow: { game(): { level: { path: number[][] }; enemies: Array<{ dist: number; lane?: number }> } } }).hedgerow.game()
    const lead = g.enemies.find((e) => e.lane !== 1)
    let len = 0
    for (let i = 1; i < g.level.path.length; i++) len += Math.abs(g.level.path[i]![0]! - g.level.path[i - 1]![0]!) + Math.abs(g.level.path[i]![1]! - g.level.path[i - 1]![1]!)
    if (lead) lead.dist = Math.round(len * 0.6)
  })
  await expect.poll(async () => { const b = await follow(); return Math.hypot(b.x - a.x, b.z - a.z) }, { timeout: 30_000 }).toBeGreaterThan(0.5)
  await fit.click()
  await expect(fit).toHaveText(/Closer/i)
  expect((await follow()).on).toBe(false)
})
