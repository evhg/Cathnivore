import { expect, test, type Page } from '@playwright/test'

// Plan item 72: between rounds the next round queues at the Hollowell gate. On levels 1, 12 and 40 the field draws
// the round's leads and a count plate inside the canvas (the plate never on a lead), Go clears the queue, and
// Cath's notebook is never empty.
type Box = { x: number; y: number; w: number; h: number; big?: boolean }
type Hg = { game(): { phase: string; wave: number }; gateQueue(): { leads: Box[]; plates: Box[]; names: Box[] } | null; sendWave(g: unknown): unknown }

async function open(page: Page, level: number): Promise<void> {
  const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true }
  const stars = Object.fromEntries(Array.from({ length: level - 1 }, (_, i) => [String(i + 1), 3]))
  await page.goto('/hedgerow/?sandbox=1&2d')
  await page.evaluate(([s, t, l]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { [l]: true }, tips: t })), [stars, tips, level] as const)
  await page.goto(`/hedgerow/?sandbox=1&2d&level=${level}`)
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: Hg }).hedgerow?.game(), null, { timeout: 60_000 })
}

const queue = (page: Page) => page.evaluate(() => (window as unknown as { hedgerow: Hg }).hedgerow.gateQueue())
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

for (const level of [1, 12, 34, 40]) {
  test(`level ${level}: the next round queues at the gate, inside the field, and Go clears it`, async ({ page }) => {
    test.setTimeout(90_000)
    await open(page, level)
    await expect.poll(async () => (await queue(page))?.leads.length ?? 0).toBeGreaterThan(0)
    const q = (await queue(page))!
    const canvas = (await page.locator('canvas').first().boundingBox())!
    // Plan item 157: where Hollowell's depot stands by the gate its departures board carries the count instead.
    const boards = await page.locator('[data-depot] [data-depot-count]').count()
    expect(q.plates.length + boards).toBeGreaterThan(0)
    for (const b of [...q.leads, ...q.plates]) {
      expect(b.x, JSON.stringify(b)).toBeGreaterThanOrEqual(-1)
      expect(b.y, JSON.stringify(b)).toBeGreaterThanOrEqual(-1)
      expect(b.x + b.w, JSON.stringify(b)).toBeLessThanOrEqual(canvas.width + 1)
      expect(b.y + b.h, JSON.stringify(b)).toBeLessThanOrEqual(canvas.height + 1)
    }
    // Plan item 200: the plate's text is 12 px or more (the pill is 1.5 times its font); at P it was 11 px.
    for (const p of q.plates) expect(p.h, JSON.stringify(p)).toBeGreaterThanOrEqual(18)
    for (const p of q.plates) for (const l of q.leads) expect(overlaps(p, l), `plate ${JSON.stringify(p)} on lead ${JSON.stringify(l)}`).toBe(false)
    // Plan item 256: queued vehicles are drawn 1.4x (40 px or more at D, 28 on a phone), and the first to pull out
    // carries a name plate, inside the field and on no other vehicle or plate. Plan item 266: only on a lane running
    // across (side-on sprites overhung the plots on one running up or down); there item 105's floor, 28 / 20.
    const wide = (page.viewportSize()?.width ?? 0) >= 900
    for (const l of q.leads) expect(l.w, JSON.stringify(l)).toBeGreaterThanOrEqual(l.big ? (wide ? 40 : 28) : wide ? 28 : 20)
    expect(q.names.length).toBeGreaterThan(0)
    for (const n of q.names) {
      expect(n.x).toBeGreaterThanOrEqual(0)
      expect(n.y).toBeGreaterThanOrEqual(0)
      expect(n.x + n.w).toBeLessThanOrEqual(canvas.width)
      expect(n.y + n.h).toBeLessThanOrEqual(canvas.height)
      expect(n.h).toBeGreaterThanOrEqual(18)
      for (const b of [...q.leads, ...q.plates]) expect(overlaps(n, b), `name ${JSON.stringify(n)} on ${JSON.stringify(b)}`).toBe(false)
    }
    await page.evaluate(() => {
      const h = (window as unknown as { hedgerow: Hg }).hedgerow
      h.sendWave(h.game())
    })
    await expect.poll(() => queue(page)).toBeNull()
  })

  test(`level ${level}: Cath's notebook gives advice for the round, before and after Go`, async ({ page }) => {
    test.setTimeout(90_000)
    await open(page, level)
    const advice = page.locator('.field-notebook .nb-advice')
    // On a phone the notebook waits in the drawer: it is built, just not shown until pulled up.
    await expect(advice).toHaveCount(1)
    await expect(advice.locator('.nb-advice-line')).toHaveText(/\w{3,}.*\./)
    await expect(advice.locator('.nb-eyebrow')).toContainText('next')
    if ((page.viewportSize()?.width ?? 0) >= 900) {
      // Plan item 87: at D the notebook shares a tabbed card with Coming up on levels that have it.
      const tab = page.getByRole('tab', { name: 'Notebook' })
      if (await tab.count()) await tab.click()
      await expect(advice).toBeVisible()
    }
    await page.evaluate(() => {
      const h = (window as unknown as { hedgerow: Hg }).hedgerow
      h.sendWave(h.game())
    })
    await page.evaluate(() => (window as unknown as { hedgerow: { refresh(): void } }).hedgerow.refresh())
    await expect(advice.locator('.nb-eyebrow')).toContainText('on the lane')
    await expect(advice.locator('.nb-advice-line')).not.toBeEmpty()
  })
}

// Plan item 259: on level 21's phone field the lane by the gate is lined with plots; the count plate found the lane
// under the gate sign instead of the first plot row.
test('level 21: the count plate keeps off the plots', async ({ page }) => {
  test.setTimeout(90_000)
  await open(page, 21)
  await expect.poll(async () => (await queue(page))?.leads.length ?? 0).toBeGreaterThan(0)
  const q = (await queue(page))!
  const canvas = (await page.locator('canvas').first().boundingBox())!
  const plots = (await page.evaluate(() => (window as unknown as { hedgerow: { plotBoxes(): Box[] } }).hedgerow.plotBoxes()))
    .map((b) => ({ x: b.x - canvas.x + b.w * 0.1, y: b.y - canvas.y + b.h * 0.1, w: b.w * 0.8, h: b.h * 0.8 }))
  const area = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
  for (const p of q.plates) {
    const on = plots.reduce((s, b) => s + area(p, b), 0)
    expect(on, `plate ${JSON.stringify(p)} on plots`).toBeLessThanOrEqual(p.w * p.h * 0.15)
  }
})
