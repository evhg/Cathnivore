import { expect, test } from '@playwright/test'

// Plan item 134: the lesson shows the tap. Cath's hand rests on the glowing tile (its fingertip within 20 px of the
// tile's centre) and follows it from step to step; no lesson text block runs past two lines at D; the solved lesson
// hands over to today's daily in under 1.5 s.
const handOff = () => {
  const h = document.getElementById('lesson-hand')
  const t = document.querySelector('.tiles > g.cell.lesson-target')
  const st = document.querySelector('.stage')
  if (!h || !t || !st) return null
  const s = st.getBoundingClientRect(), c = t.getBoundingClientRect()
  const hx = parseFloat(h.style.getPropertyValue('--hx')), hy = parseFloat(h.style.getPropertyValue('--hy'))
  return Math.hypot(s.left + hx - (c.left + c.width / 2), s.top + hy - (c.top + c.height / 2))
}

test('Cath taps the glowing tile with her hand, step by step, and the lesson hands over quickly', async ({ page, hasTouch }) => {
  await page.goto('/runnel/?lesson')
  await expect(page.locator('#lesson-card')).toBeVisible()
  await expect(page.locator('#lesson-hand')).toBeAttached()
  for (let step = 0; step < 3; step++) {
    expect(await page.evaluate(handOff)).toBeLessThanOrEqual(20)
    if (!hasTouch && step === 0) {
      // No lesson text block over two lines at D.
      const lines = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('#lesson-card .lc-legend li span, #lesson-card .lc-note')].map((e) => {
          const cs = getComputedStyle(e)
          const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3
          return Math.round(e.getBoundingClientRect().height / lh)
        }),
      )
      for (const n of lines) expect(n).toBeLessThanOrEqual(2)
    }
    const t0 = Date.now()
    await page.locator('.tiles > g.cell.lesson-target').click()
    if (step < 2) await expect(page.locator('.lc-steps li.done')).toHaveCount(step + 1)
    else {
      await expect(page.locator('#lesson-card')).toBeHidden({ timeout: 3000 })
      expect(Date.now() - t0).toBeLessThan(1500 + 600) // the hand-off (1.2 s) plus the solve's own tap and render
      await expect(page.locator('#lesson-hand')).toHaveCount(0)
    }
  }
})
