import { test, expect } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 312: when the desktop hand lays its cards out in rows, no card lies over another (each takes the width
// that fits its row with a gap) and each price or yield chip stays inside its card.
for (const [w, h] of [[1440, 900], [1280, 800]] as const) {
  test(`the hand's rows keep every card clear of the others at ${w}x${h}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the desktop hand')
    await page.setViewportSize({ width: w, height: h })
    let checked = 0
    for (const seed of ['3', '17', '44', '102', '555']) {
      await page.goto('/')
      await page.getByText('Quick Game').click()
      await fillSeed(page, seed)
      await page.getByRole('button', { name: 'Start' }).click()
      await page.locator('.table-hand .action-item').first().waitFor()
      await page.mouse.move(2, 2)
      await page.waitForTimeout(900)
      const r = await page.evaluate(() => {
        const hand = document.querySelector<HTMLElement>('.table-hand')!
        const boxes = [...hand.querySelectorAll('.action-item')].map((c) => ({ t: c.textContent?.trim().slice(0, 20), ...c.getBoundingClientRect().toJSON() }))
        const over: string[] = []
        boxes.forEach((a, i) =>
          boxes.slice(i + 1).forEach((b) => {
            const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left)
            const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
            if (ox > 1 && oy > 1) over.push(`${a.t} / ${b.t}: ${Math.round(ox)}x${Math.round(oy)}`)
          }),
        )
        // Each card's price or yield chip inside the card.
        const cut = [...hand.querySelectorAll('.action-item')].flatMap((c) => {
          const k = c.querySelector('.action-cost')?.getBoundingClientRect()
          const b = c.getBoundingClientRect()
          return k && (k.right > b.right + 0.5 || k.bottom > b.bottom + 0.5) ? [`${c.textContent?.trim().slice(0, 20)}: chip ${Math.round(k.right - b.right)} px past`] : []
        })
        return { rows: hand.dataset.rows, over, cut }
      })
      if (!r.rows) continue
      checked++
      expect(r.over, `seed ${seed}`).toEqual([])
      expect(r.cut, `seed ${seed}`).toEqual([])
    }
    // These seeds deal a hand in rows at 1280 (at 1440 most hands fit one row); the 1440 check runs when one does.
    if (w === 1280) expect(checked, 'no seed dealt a hand in rows').toBeGreaterThan(0)
  })
}
