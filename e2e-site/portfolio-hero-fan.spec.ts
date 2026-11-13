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

// Plan item 350: Cath stands behind a studio desk (not faded out at the waist): no mask or fade on her figure, the
// desk's top within her lower fifth and wider than her, inside the page; on a phone the next print peeks 60 px+.
test('Cath stands behind a desk, not fading out; the phone strip shows the next print', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(2500)
  const m = await page.evaluate(() => {
    const c = document.querySelector<HTMLElement>('#hero-cath')!
    const cs = getComputedStyle(c)
    const desk = getComputedStyle(c, '::after')
    const r = c.getBoundingClientRect()
    let op = 1
    for (let e: HTMLElement | null = c; e; e = e.parentElement) op *= Number(getComputedStyle(e).opacity)
    const strip = document.querySelector('.show-strip')!.getBoundingClientRect()
    const cards = [...document.querySelectorAll('.show-strip .show-card')].map((e) => e.getBoundingClientRect())
    return {
      mask: cs.maskImage,
      op,
      desk: desk.content !== 'none' && desk.content !== '',
      deskTop: parseFloat(desk.top) / r.height,
      deskWide: parseFloat(desk.width) >= r.width,
      peek: Math.min(strip.right, cards[1]!.right) - cards[1]!.left,
      scroll: document.scrollingElement!.scrollWidth - innerWidth,
    }
  })
  expect(m.mask).toBe('none')
  expect(m.op).toBe(1)
  expect(m.desk).toBe(true)
  expect(m.deskTop).toBeGreaterThanOrEqual(0.8)
  expect(m.deskTop).toBeLessThanOrEqual(0.95)
  expect(m.deskWide).toBe(true)
  expect(m.scroll).toBeLessThanOrEqual(0)
  if ((page.viewportSize()?.width ?? 0) < 1100) expect(m.peek).toBeGreaterThanOrEqual(60)
})
