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

// Plan item 350 (desk) replaced by plan item 404: Cath stands full length, no desk: at D her boots on a lit floor
// pool with her contact shadow under her; no mask or fade on her figure; on a phone the next print peeks 30 px+.
test('Cath stands full length on a lit floor, not fading out; the phone strip shows the next print', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(2500)
  const m = await page.evaluate(() => {
    const c = document.querySelector<HTMLElement>('#hero-cath')!
    const cs = getComputedStyle(c)
    const floor = getComputedStyle(c, '::after')
    const light = getComputedStyle(c, '::before')
    const r = c.getBoundingClientRect()
    let op = 1
    for (let e: HTMLElement | null = c; e; e = e.parentElement) op *= Number(getComputedStyle(e).opacity)
    const strip = document.querySelector('.show-strip')!.getBoundingClientRect()
    const cards = [...document.querySelectorAll('.show-strip .show-card')].map((e) => e.getBoundingClientRect())
    const boots = c.querySelector('.cath-ground')?.getBoundingClientRect()
    const floorTop = r.top + parseFloat(floor.top)
    return {
      mask: cs.maskImage,
      op,
      full: !!boots && boots.height > 0,
      floor: floor.display !== 'none' && floor.backgroundImage.includes('radial'),
      shadow: light.display !== 'none' && light.backgroundImage.includes('radial'),
      floorUnderBoots: !!boots && floorTop <= boots.bottom && floorTop + parseFloat(floor.height) >= boots.bottom,
      floorWide: parseFloat(floor.width) >= r.width,
      peek: Math.min(strip.right, cards[1]!.right) - cards[1]!.left,
      scroll: document.scrollingElement!.scrollWidth - innerWidth,
      bottom: r.bottom,
    }
  })
  expect(m.mask).toBe('none')
  expect(m.op).toBe(1)
  expect(m.full).toBe(true)
  expect(m.scroll).toBeLessThanOrEqual(0)
  if ((page.viewportSize()?.width ?? 0) >= 1100) {
    expect(m.floor).toBe(true)
    expect(m.shadow).toBe(true)
    expect(m.floorUnderBoots).toBe(true)
    expect(m.floorWide).toBe(true)
    expect(m.bottom).toBeLessThanOrEqual(900)
  }
  // Plan item 445: a phone (720 px or less) shows the four prints as a 2x2 mosaic instead, its first row wholly above
  // the fold; a tablet keeps the swiped strip with the next print peeking.
  const vw = page.viewportSize()?.width ?? 0
  if (vw < 1100 && vw > 720) expect(m.peek).toBeGreaterThanOrEqual(30)
  if (vw <= 720) {
    const vh = page.viewportSize()!.height
    const cards = await page.locator('.show-strip .show-card').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect))
    expect(cards.filter((r) => r.bottom <= vh).length, JSON.stringify(cards)).toBeGreaterThanOrEqual(2)
    for (const r of cards) expect(r.left >= -1 && r.right <= vw + 1, JSON.stringify(r)).toBe(true)
  }
})
