import { test, expect } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 701: at D the focused or hovered hand card is held up to read: 220 px+ tall, wholly in the viewport, its
// name printed 15 px+ and its pick line 13 px+ as drawn, and the board doesn't move.
test('the desktop hand card held up to read', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop only; the phone keeps its own hand')
  test.setTimeout(90_000)
  for (const [width, height] of [[1440, 900], [1280, 800]] as const) {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await fillSeed(page, '7')
    await page.getByRole('button', { name: 'Start' }).click()
    await page.mouse.move(5, 5)
    const cards = page.locator('.table-hand:not([data-rows]) .action-item:not(.action-family)')
    await expect(cards.first()).toBeVisible()
    await page.waitForTimeout(600)
    const board = () => page.locator('.region-hex > polygon.land-layer:first-child').first().boundingBox()
    const before = (await board())!
    const n = await cards.count()
    for (const i of [0, Math.floor(n / 2), n - 1]) {
      await cards.nth(i).hover()
      await page.waitForTimeout(400)
      const m = await cards.nth(i).evaluate((e) => {
        const r = e.getBoundingClientRect()
        const k = r.height / (e as HTMLElement).offsetHeight
        const size = (sel: string) => { const t = e.querySelector(sel); return t ? parseFloat(getComputedStyle(t).fontSize) * k : 99 }
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, h: r.height, name: size('.action-name'), pick: size('.action-pick') }
      })
      const at = `${width}x${height} card ${i}`
      expect(m.h, `${at}: held height`).toBeGreaterThanOrEqual(220)
      expect(m.left, `${at}: inside left`).toBeGreaterThanOrEqual(0)
      expect(m.top, `${at}: inside top`).toBeGreaterThanOrEqual(0)
      expect(m.right, `${at}: inside right`).toBeLessThanOrEqual(width)
      expect(m.bottom, `${at}: inside bottom`).toBeLessThanOrEqual(height)
      expect(m.name, `${at}: name as drawn`).toBeGreaterThanOrEqual(15)
      expect(m.pick, `${at}: pick line as drawn`).toBeGreaterThanOrEqual(13)
      // the held card is on top where it stands: its centre hits the card, not a figure on the board
      const top = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('.table-hand .action-item') !== null, [(m.left + m.right) / 2, m.top + m.h * 0.3])
      expect(top, `${at}: nothing drawn over the held card`).toBe(true)
      const after = (await board())!
      expect([after.x, after.y, after.width, after.height], `${at}: the board stays`).toEqual([before.x, before.y, before.width, before.height])
    }
    await page.mouse.move(5, 5)
    await expect.poll(() => cards.evaluateAll((els) => Math.max(...els.map((e) => e.getBoundingClientRect().height)))).toBeLessThanOrEqual(140)
  }
})
