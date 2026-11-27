import { test, expect } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 731: on a tall desktop the resting hand shows its painted cards, not a strip of slivers: every card at rest
// is whole in the viewport, 130 px+ tall with its painted window 60 px+, the fan overlapping 12% or less, and the board
// keeps 55%+ of the screen.
test('the resting hand shows its painted cards at 1440x900', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'the desktop table')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await fillSeed(page, '7')
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.table-hand [data-hand-card]').first()).toBeVisible()
  await page.mouse.move(700, 300)
  await page.waitForTimeout(900)
  const m = await page.evaluate(() => {
    const cards = [...document.querySelectorAll<HTMLElement>('.table-hand [data-hand-card]')].map((e) => {
      const r = e.getBoundingClientRect()
      const art = e.querySelector('svg.action-art[data-scene]')?.getBoundingClientRect()
      return { name: e.textContent?.slice(0, 24) ?? '', x: e.offsetLeft, w: e.offsetWidth, h: e.offsetHeight, art: art?.height ?? 0, top: r.top, bottom: r.bottom, left: r.left, right: r.right }
    })
    const map = document.querySelector('svg.map')!.getBoundingClientRect()
    return { cards, board: (map.width * map.height) / (innerWidth * innerHeight), vw: innerWidth, vh: innerHeight, rows: document.querySelector('.table-hand')!.hasAttribute('data-rows') }
  })
  expect(m.rows, 'one row').toBe(false)
  expect(m.cards.length).toBeGreaterThan(3)
  for (const c of m.cards) {
    expect(c.h, `${c.name} height`).toBeGreaterThanOrEqual(130)
    expect(c.art, `${c.name} painted window`).toBeGreaterThanOrEqual(60)
    expect(c.top, `${c.name} inside the top`).toBeGreaterThanOrEqual(0)
    expect(c.bottom, `${c.name} inside the foot`).toBeLessThanOrEqual(m.vh)
    expect(c.left, `${c.name} inside the left`).toBeGreaterThanOrEqual(0)
    expect(c.right, `${c.name} inside the right`).toBeLessThanOrEqual(m.vw)
  }
  const byX = [...m.cards].sort((a, b) => a.x - b.x)
  for (let i = 1; i < byX.length; i++) {
    const a = byX[i - 1]!, b = byX[i]!
    const lap = Math.max(0, a.x + a.w - b.x)
    expect(lap / Math.min(a.w, b.w), `${a.name} / ${b.name} overlap`).toBeLessThanOrEqual(0.12)
  }
  expect(m.board, 'the board share of the screen').toBeGreaterThanOrEqual(0.55)
})
