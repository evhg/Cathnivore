import { expect, test, type Page } from '@playwright/test'

// Plan item 171: on an upright phone Cath's advice docks over the tray beside her 64 px bust instead of a bubble on
// the field: it meets no plot, says who's speaking (role=status), her face follows the line, a tap folds it away
// whole, freeing the tray under it. A desktop keeps the bubble beside her on the field.
type Box = { x: number; y: number; w: number; h: number }
type Hg = { game(): unknown; plotBoxes(): Box[]; sendWave(g: unknown): unknown }

async function open(page: Page, level: number): Promise<void> {
  const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true, move: true }
  const stars = Object.fromEntries(Array.from({ length: level - 1 }, (_, i) => [String(i + 1), 3]))
  await page.goto('/hedgerow/?sandbox=1&2d')
  await page.evaluate(([s, t, l]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { [l]: true }, tips: t })), [stars, tips, level] as const)
  await page.goto(`/hedgerow/?sandbox=1&2d&level=${level}`)
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: Hg }).hedgerow?.game(), null, { timeout: 60_000 })
  await page.evaluate(() => {
    const b = document.getElementById('bubble')
    if (b) b.hidden = true
  })
}

for (const level of [21, 34]) {
  test(`level ${level}: Cath's line docks over the tray on a phone, off every plot`, async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 600, 'upright phone only')
    test.setTimeout(90_000)
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme })
      await open(page, level)
      const dock = page.locator('#cath-dock')
      const line = page.locator('#cath-dock-line')
      await expect(dock).toBeVisible()
      await expect(line).not.toBeEmpty()
      await expect(line).toHaveAttribute('role', 'status')
      await expect(page.locator('#cath-say')).toBeHidden()
      await expect(dock).toHaveAttribute('data-expression', /^(determined|worried|smirk)$/)
      const bust = (await page.locator('#cath-dock-bust').boundingBox())!
      expect(bust.width).toBeGreaterThanOrEqual(64)
      expect(bust.height).toBeGreaterThanOrEqual(64)
      const l = (await line.boundingBox())!
      const plots = await page.evaluate(() => (window as unknown as { hedgerow: Hg }).hedgerow.plotBoxes())
      expect(plots.length).toBeGreaterThan(0)
      const meets = (a: Box, b: { x: number; y: number; width: number; height: number }) => a.x < b.x + b.width - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.h - 1
      for (const p of plots) {
        expect(meets(p, l), `${scheme} line on plot ${JSON.stringify(p)}`).toBe(false)
        expect(meets(p, bust), `${scheme} bust on plot`).toBe(false)
      }
      // Under the field, over the tray.
      const stage = (await page.locator('#stage').boundingBox())!
      expect((await dock.boundingBox())!.y).toBeGreaterThanOrEqual(stage.y + stage.height - 1)
      // Plan item 188: it reaches the panel's top (no strip of tray cards above it), the drawer handle uncovered.
      const panelTop = (await page.locator('#panel').boundingBox())!.y
      expect(Math.abs((await dock.boundingBox())!.y - panelTop)).toBeLessThanOrEqual(1)
      const handle = page.locator('#panel .drawer-handle')
      if (await handle.isVisible()) {
        const h = (await handle.boundingBox())!
        expect(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('.drawer-handle'), { x: h.x + h.width / 2, y: h.y + h.height / 2 })).toBe(true)
      }
      // Go: she goes quiet.
      await page.evaluate(() => {
        const h = (window as unknown as { hedgerow: Hg }).hedgerow
        h.sendWave(h.game())
      })
      await expect(dock).toBeHidden()
      // A tap folds it away whole, and the tray under it takes taps again.
      await open(page, level)
      await expect(line).toBeVisible()
      await line.click()
      await expect(dock).toBeHidden()
      await page.waitForTimeout(600)
      await expect(dock).toBeHidden()
      const card = page.locator('#panel .tray-tower').first()
      const c = (await card.boundingBox())!
      expect(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest("#panel"), { x: c.x + c.width / 2, y: c.y + c.height / 2 })).toBe(true)
    }
  })
}

test('a desktop keeps her bubble on the field', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 600, 'desktop only')
  test.setTimeout(90_000)
  await open(page, 21)
  await expect(page.locator('#cath-say')).toBeVisible()
  await expect(page.locator('#cath-dock')).toBeHidden()
})
