import { test, expect } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 393: at D the hand is a fan of full-size cards on the table's edge, not a strip of 125 px tiles: each
// card 150 px wide, or 96 px showing with its name whole; its words 13 px or more; the face-down pile a short
// step from the last card.
for (const seed of ['7', '21', '1234'])
  test(`seed ${seed}: the desktop hand's cards are full size and the pile sits at the fan's end`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'desktop hand')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await fillSeed(page, seed)
    await page.getByRole('button', { name: 'Start' }).click()
    await page.mouse.move(5, 5)
    const cards = page.locator('.table-hand [data-hand-card]')
    await expect(cards.first()).toBeVisible()
    await page.waitForTimeout(600) // the deal (item 291)
    const m = await page.evaluate(() => {
      const els = [...document.querySelectorAll<HTMLElement>('.table-hand [data-hand-card]')]
      const rows = document.querySelector<HTMLElement>('.table-hand')!.dataset.rows !== undefined
      const out = els.map((el, i) => {
        const next = els[i + 1]
        const showing = next && Math.abs(next.offsetTop - el.offsetTop) < 20 ? next.offsetLeft - el.offsetLeft : el.offsetWidth
        const label = el.querySelector<HTMLElement>('.action-label, .action-family-text')
        const small: string[] = []
        for (const e of el.querySelectorAll<HTMLElement>('*')) {
          if (e.closest('svg') || e.childElementCount > 0) continue
          const t = (e.textContent ?? '').trim()
          const cs = getComputedStyle(e)
          if (!/[A-Za-z0-9]/.test(t) || cs.display === 'none' || cs.visibility === 'hidden' || e.offsetWidth < 2) continue
          if (e.closest('.sr-only, .tooltip-trigger')) continue
          if (parseFloat(cs.fontSize) < 12.9) small.push(`${t} ${cs.fontSize}`)
        }
        return { name: (el.textContent ?? '').slice(0, 30), w: el.offsetWidth, showing, cut: label ? label.scrollWidth > label.clientWidth + 1 : false, small }
      })
      const last = els[els.length - 1]!.getBoundingClientRect()
      const pile = document.querySelector('.hand-later')?.getBoundingClientRect()
      return { rows, cards: out, gap: pile ? pile.left - last.right : null }
    })
    if (m.rows) return // a deal too big for one row takes the shelves (item 312)
    for (const c of m.cards) {
      expect(c.w >= 150 || (c.showing >= 96 && !c.cut), `${c.name}: ${c.w} px wide, ${c.showing} showing`).toBe(true)
      expect(c.small, `${c.name}: words under 13 px`).toEqual([])
    }
    if (m.gap !== null) expect(m.gap, 'pile to the last card').toBeLessThanOrEqual(24)
  })
