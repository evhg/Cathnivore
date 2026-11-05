import { expect, test, type Page } from '@playwright/test'

// Plan item 72: between rounds the next round queues at the Hollowell gate. On levels 1, 12 and 40 the field draws
// the round's leads and a count plate inside the canvas (the plate never on a lead), Go clears the queue, and
// Cath's notebook is never empty.
type Box = { x: number; y: number; w: number; h: number }
type Hg = { game(): { phase: string; wave: number }; gateQueue(): { leads: Box[]; plates: Box[] } | null; sendWave(g: unknown): unknown }

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

for (const level of [1, 12, 40]) {
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
    for (const p of q.plates) for (const l of q.leads) expect(overlaps(p, l), `plate ${JSON.stringify(p)} on lead ${JSON.stringify(l)}`).toBe(false)
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
