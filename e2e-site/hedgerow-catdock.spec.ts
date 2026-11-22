import { expect, test, type Page } from '@playwright/test'

// Plan item 171: on an upright phone Cath's advice docks at the tray beside her bust instead of a bubble on the field
// (plan item 611: her line now rises over the field's foot, the tray free under it, taps passing through it), was a bubble on
// the field: it meets no plot, says who's speaking (role=status), her face follows the line, a tap (or 6 s) folds it
// to her portrait on the panel's corner, freeing the tray under it (item 392), and a tap on the portrait reopens it. A desktop keeps the bubble beside her on the field.
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
      // Plan item 611: open, her portrait keeps the folded tab's place (48 px) beside the tray's packets
      expect(bust.width).toBeGreaterThanOrEqual(44)
      expect(bust.height).toBeGreaterThanOrEqual(44)
      const l = (await line.boundingBox())!
      const plots = await page.evaluate(() => (window as unknown as { hedgerow: Hg }).hedgerow.plotBoxes())
      expect(plots.length).toBeGreaterThan(0)
      const meets = (a: Box, b: { x: number; y: number; width: number; height: number }) => a.x < b.x + b.width - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.h - 1
      // Plan item 637 (was item 611's bubble over the field's foot, which hid the lower path): her line is a toast on
      // the dock beside her portrait, off the field and every plot, and the packets under it still take taps
      const field = (await page.locator('#canvas').boundingBox())!
      expect(l.y, `${scheme} line on the field`).toBeGreaterThanOrEqual(field.y + field.height - 0.5)
      for (const p of plots) expect(meets(p, l), `${scheme} line on plot`).toBe(false)
      expect(l.x).toBeGreaterThanOrEqual(bust.x + bust.width - 1)
      expect(await line.evaluate((e) => getComputedStyle(e).pointerEvents)).toBe('none')
      for (const p of plots) expect(meets(p, bust), `${scheme} bust on plot`).toBe(false)
      // Under the field, over the tray.
      const stage = (await page.locator('#stage').boundingBox())!
      expect((await dock.boundingBox())!.y).toBeGreaterThanOrEqual(stage.y + stage.height - 1)
      // Plan item 188: it reaches the panel's top (no strip of tray cards above it), the drawer handle uncovered.
      const panelTop = (await page.locator('#panel').boundingBox())!.y
      expect(Math.abs((await dock.boundingBox())!.y - panelTop)).toBeLessThanOrEqual(3)
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
      // Plan item 392: a tap folds it to her portrait, a tab on the panel's corner: off every plot and every tower
      // packet, the tray under it taking taps again; a tap on the portrait opens her line again.
      await open(page, level)
      await expect(line).toBeVisible()
      await page.locator('#cath-dock-bust').click()
      await expect(dock).toHaveAttribute('data-folded', '')
      await expect(line).toBeHidden()
      await page.waitForTimeout(600)
      await expect(line).toBeHidden()
      const tab = (await page.locator('#cath-dock-bust').boundingBox())!
      expect(tab.width).toBeGreaterThanOrEqual(44)
      // Off the field canvas (item 392's accept: her tip never meets it).
      const canvas = (await page.locator('#canvas').boundingBox())!
      expect(tab.y, `${scheme} folded portrait on the field`).toBeGreaterThanOrEqual(canvas.y + canvas.height - 0.5)
      const plots2 = await page.evaluate(() => (window as unknown as { hedgerow: Hg }).hedgerow.plotBoxes())
      for (const p of plots2) expect(meets(p, tab), `${scheme} folded portrait on plot ${JSON.stringify(p)}`).toBe(false)
      const packs = await page.locator('#panel .tray-tower').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).filter((r) => r.width).map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.height })))
      for (const p of packs) expect(meets(p, tab), `${scheme} folded portrait over a packet`).toBe(false)
      const card = page.locator('#panel .tray-tower').first()
      const c = (await card.boundingBox())!
      expect(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest("#panel"), { x: c.x + c.width / 2, y: c.y + c.height / 2 })).toBe(true)
      await page.locator('#cath-dock-bust').click()
      await expect(line).toBeVisible()
      await expect(dock).not.toHaveAttribute('data-folded', '')
    }
  })
}

test("plan item 392: open on a phone, her line folds to her portrait by itself after 6 s", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 600, 'upright phone only')
  test.setTimeout(60_000)
  await open(page, 21)
  const line = page.locator('#cath-dock-line')
  await expect(line).toBeVisible()
  await page.waitForTimeout(3000)
  await expect(line).toBeVisible()
  await expect(page.locator('#cath-dock')).toHaveAttribute('data-folded', '', { timeout: 6000 })
  await expect(page.locator('#cath-dock-bust')).toBeVisible()
})

test('a desktop has her line on the panel plate, not the field or the dock', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 600, 'desktop only')
  test.setTimeout(90_000)
  await open(page, 21)
  await expect(page.locator('#cath-plate')).toBeVisible()
  await expect(page.locator('#cath-say')).toBeHidden()
  await expect(page.locator('#cath-dock')).toBeHidden()
})
