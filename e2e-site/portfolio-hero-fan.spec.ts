import { test, expect } from '@playwright/test'

// Plan item 303: at D the hero is a fan of all four games, each frame 60%+ in view (not under a later frame or Cath)
// and labelled with its name.
test('the desktop hero shows all four games, each mostly in view and labelled', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1100, 'the desktop fan')
  await page.goto('/')
  await page.waitForTimeout(2500)
  const seen = await page.evaluate(() => {
    const cards = [...document.querySelectorAll<HTMLElement>('.hero-show .show-card')]
    const cath = document.querySelector('#hero-cath')!.getBoundingClientRect()
    const rects = cards.map((c) => c.getBoundingClientRect())
    const inside = (r: DOMRect, x: number, y: number) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
    return cards.map((c, i) => {
      const r = rects[i]!
      let shown = 0
      let all = 0
      for (let gx = 0.1; gx < 1; gx += 0.1) {
        for (let gy = 0.1; gy < 1; gy += 0.1) {
          const x = r.left + r.width * gx
          const y = r.top + r.height * gy
          all++
          if (!rects.slice(i + 1).some((o) => inside(o, x, y)) && !inside(cath, x, y)) shown++
        }
      }
      return { label: c.querySelector('.show-label')?.textContent ?? '', shown: shown / all, labelShown: getComputedStyle(c.querySelector('.show-label')!).display !== 'none' }
    })
  })
  expect(seen.map((s) => s.label)).toEqual(['Cathnivore', 'Runnel', 'NIGHT SHIFT', 'Hedgerow'])
  for (const s of seen) {
    expect(s.shown, s.label).toBeGreaterThanOrEqual(0.6)
    expect(s.labelShown).toBe(true)
  }
})
