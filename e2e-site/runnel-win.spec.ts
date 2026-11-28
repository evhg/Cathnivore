import { test, expect } from '@playwright/test'

// Plan item 37: on a 390x844 phone the win card shows its headline, its primary button and Cath's whole
// medallion without scrolling; the share card and Bea's postcard swipe sideways below. `?shotwin` (the
// screenshot hook) never writes a result.
test('the win card fits its headline, button and medallion in view, and the shot hook saves nothing', async ({ page }) => {
  await page.goto('/runnel/?nohelp&shotwin')
  // Plan item 68: the win shows a strip under the board; the full card opens from it.
  await page.locator('#strip-card').click({ timeout: 10_000 })
  const dlg = page.locator('#dlg-win')
  await expect(dlg).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(700) // the sheet's slide-in
  const vh = page.viewportSize()!.height
  for (const sel of ['#win-title', '#btn-share', '#win-cath']) {
    const box = (await page.locator(sel).boundingBox())!
    expect(box.y, `${sel} top`).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height, `${sel} bottom`).toBeLessThanOrEqual(vh)
  }
  // The keepsakes are one sideways row, below the buttons.
  const share = (await page.locator('#btn-share').boundingBox())!
  const bea = (await page.locator('#win-bea').boundingBox())!
  expect(bea.y).toBeGreaterThan(share.y)
  expect(await page.locator('#win-keepsakes').evaluate((el) => getComputedStyle(el).overflowX)).toBe('auto')
  expect(await page.evaluate(() => localStorage.getItem('runnel:v1'))).toBeNull()
})

// Plan item 47: no keepsake is cut off at rest. A phone shows one whole page with dots; a wide screen both.
test('the keepsakes are whole: one page at a time with dots on a phone, side by side when there is room', async ({ page }) => {
  await page.goto('/runnel/?nohelp&shotwin')
  await page.locator('#strip-card').click({ timeout: 10_000 })
  await expect(page.locator('#dlg-win')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('#win-card')).toBeVisible()
  await page.waitForTimeout(700)
  const m = await page.evaluate(() => {
    const row = document.querySelector('#win-keepsakes')!.getBoundingClientRect()
    const kids = [...document.querySelectorAll('#win-keepsakes .win-card, #win-keepsakes .bea')].map((e) => e.getBoundingClientRect())
    const whole = kids.map((r) => r.left >= row.left - 1 && r.right <= row.right + 1 && r.right <= innerWidth && r.left >= 0)
    const partly = kids.map((r) => r.right > row.left + 1 && r.left < row.right - 1)
    return { whole, partly, pager: !document.querySelector<HTMLElement>('#win-pager')!.hidden }
  })
  // Every keepsake in view is whole: none half in, half out.
  for (let i = 0; i < m.whole.length; i++) if (m.partly[i]) expect(m.whole[i], `keepsake ${i}`).toBe(true)
  if (m.pager) expect(m.partly.filter(Boolean).length).toBe(1)
  else expect(m.whole.every(Boolean)).toBe(true)
})

// Plan item 68: a real solve plays on the board, then a slim strip comes up from the foot: the board stays sharp and
// at least 80% in view, nothing modal opens, the page doesn't scroll, and the strip's text is 12 px or larger.
test('a solve leaves the board in view under a slim result strip', async ({ page }) => {
  await page.goto('/runnel/?nohelp&shotsolve')
  await page.locator('[data-last]').click()
  const strip = page.locator('#win-strip')
  await expect(strip).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(800)
  // (plan item 679: at D the postcard drops in from above the field: measured once it has landed)
  await page.waitForFunction(() => document.getElementById('win-strip')!.getAnimations().every((a) => a.playState === 'finished'), null, { timeout: 5000 })
  const m = await page.evaluate(() => {
    const bd = document.getElementById('board')!.getBoundingClientRect()
    const st = document.getElementById('win-strip')!.getBoundingClientRect()
    const over = Math.max(0, Math.min(bd.right, st.right) - Math.max(bd.left, st.left)) * Math.max(0, Math.min(bd.bottom, st.bottom) - Math.max(bd.top, st.top))
    const sizes = [...document.querySelectorAll('#win-strip *')].filter((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())).map((e) => parseFloat(getComputedStyle(e).fontSize))
    return {
      visible: 1 - over / (bd.width * bd.height),
      modal: !!document.querySelector('dialog[open]'),
      scroll: document.scrollingElement!.scrollHeight - innerHeight,
      inView: st.top >= 0 && st.bottom <= innerHeight + 1 && st.left >= -1 && st.right <= innerWidth + 1,
      minFont: Math.min(...sizes),
      cath: document.getElementById('strip-cath')!.getBoundingClientRect().height,
      // Plan item 638: at D the board draws whole above the open strip (its bottom row sat under it)
      desk: matchMedia('(min-width: 1100px) and (min-height: 640px)').matches,
      clearBelow: st.top - Math.max(...[...document.querySelectorAll('#board polygon')].map((c) => c.getBoundingClientRect().bottom)),
    }
  })
  if (m.desk) expect(m.clearBelow, 'the board whole above the strip').toBeGreaterThanOrEqual(0)
  // Plan item 615: on a phone Cath stands at half length on the result card, 160 px tall
  if (test.info().project.name.includes('phone')) expect(m.cath).toBeGreaterThanOrEqual(160)
  expect(m.visible).toBeGreaterThanOrEqual(0.8)
  expect(m.modal).toBe(false)
  expect(m.scroll).toBeLessThanOrEqual(1)
  expect(m.inView).toBe(true)
  expect(m.minFont).toBeGreaterThanOrEqual(12)
  // The full card is a tap away, and Next moves on and takes the strip with it.
  await page.locator('#strip-card').click()
  await expect(page.locator('#dlg-win')).toBeVisible()
  await page.locator('#btn-next').click()
  await expect(strip).toBeHidden()
})

// Plan item 68: on an upright phone the daily sits in its farm: the spring house above the board, Bea's garden at its
// foot, both on screen, clear of the progress bar and the hint, with no page scroll.
test('the phone daily shows the spring house and Bea\'s garden around the board', async ({ page }) => {
  const vp = page.viewportSize()!
  test.skip(vp.width > 600 || vp.height < 700, 'an upright phone')
  await page.goto('/runnel/?nohelp')
  await page.waitForTimeout(500)
  const m = await page.evaluate(() => {
    const r = (s: string) => document.querySelector(s)!.getBoundingClientRect()
    const house = r('.spring-house'), garden = r('.bea-garden'), progress = r('.progress'), foot = r('.foot')
    return {
      // (plan item 661: a garden the board reaches keeps to the clear strip beside the tiles, 72 px+)
      house: house.width > 30 && house.top >= 0, garden: garden.width > (document.querySelector('.bea-garden[data-tight]') ? 70 : 100) && garden.bottom <= innerHeight,
      clearOfBar: garden.bottom <= progress.top + 1 && garden.bottom <= foot.top + 1,
      scroll: document.scrollingElement!.scrollHeight - innerHeight,
    }
  })
  expect(m).toEqual({ house: true, garden: true, clearOfBar: true, scroll: 0 })
})

// Plan item 68: at D the rail ends on Bea's garden, and the page still doesn't scroll. Plan item 642: at rest the rail
// is today's page only (the garden behind its 'The month' fold, half the rail's old height); opened by keyboard, the
// garden shows and the page still doesn't scroll.
test('the desktop rail ends on Bea\'s garden with no page scroll', async ({ page }) => {
  const vp = page.viewportSize()!
  test.skip(vp.width < 1100 || vp.height < 900, 'the desktop rail with room for the garden')
  await page.goto('/runnel/?nohelp')
  await expect(page.locator('#rail-figures > div')).toHaveCount(3)
  await expect(page.locator('.rail-garden')).toBeHidden()
  const rest = (await page.locator('#rail').boundingBox())!.height
  await page.locator('#rail-more > summary').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.rail-garden')).toBeVisible()
  expect(rest).toBeLessThanOrEqual((await page.locator('#rail').boundingBox())!.height * 0.75)
  await expect(page.locator('#rail-plots .plot')).toHaveCount(7)
  expect(await page.evaluate(() => document.scrollingElement!.scrollHeight - innerHeight)).toBeLessThanOrEqual(0)
})

// Critique 2026-11-03: the `?shotwin` hook read '0 taps, 41 under par'; it plays as a solve on par.
test('?shotwin shows a solve on par, not zero taps', async ({ page }) => {
  await page.goto('/runnel/?shotwin&nohelp')
  await page.locator('#win-strip').waitFor({ state: 'visible', timeout: 20_000 })
  const text = await page.evaluate(() => `${document.querySelector('#win-strip')!.textContent} ${document.querySelector('#dlg-win')!.textContent}`)
  expect(text).not.toMatch(/\b0 taps\b|under par/)
  // Plan item 620: the shot shows the board as a solve leaves it, every tile watered (it finished a dry board), and
  // Cath says her solve line, not her greeting
  const m = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('.tiles > g.cell')]
    return { cells: cells.length, wet: cells.filter((c) => c.classList.contains('wet')).length, dry: cells.filter((c) => !c.classList.contains('wet') && !c.classList.contains('stone')).length }
  })
  expect(m.cells).toBeGreaterThan(0)
  expect(m.dry).toBe(0)
  await expect(page.locator('#host-line')).toContainText('not a drop spilled')
})

// Bug 2026-11-20: at D a solve's result strip covered Cath's solve line in the valley; the line steps clear of the
// strip (to the rail when no spot beside her is free) and the page still doesn't scroll.
test('at D a solve\'s line is never under the result strip, and the page does not scroll', async ({ page }) => {
  const vp = page.viewportSize()!
  test.skip(vp.width < 1100 || vp.height < 640, 'the desktop valley')
  await page.addInitScript(() => localStorage.setItem('runnel:v1', JSON.stringify({ version: 1, lessonDone: true, seenHelp: true, results: {} })))
  await page.goto('/runnel/?shotsolve')
  await page.locator('[data-last]').waitFor()
  await page.locator('[data-last]').click({ force: true })
  await expect(page.locator('#win-strip')).toBeVisible()
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const s = document.getElementById('win-strip')!.getBoundingClientRect()
          const say = document.getElementById('valley-say')!
          const b = say.getBoundingClientRect()
          const under = !say.hidden && b.width > 0 && b.left < s.right && s.left < b.right && b.top < s.bottom && s.top < b.bottom
          return { under, scroll: Math.max(0, document.scrollingElement!.scrollHeight - innerHeight) }
        }),
      { timeout: 6000 },
    )
    .toEqual({ under: false, scroll: 0 })
})

// Plan item 630: after the finale the result stands clear of Bea's garden, where the solve planted, and today's new
// plant stands in it at hero size (40 px or more); under reduced motion it is there at once (no grow-in to wait for).
test("the solve's result docks clear of Bea's garden and its new plant", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/runnel/?shotwin&nohelp')
  await page.locator('#win-strip').waitFor({ state: 'visible', timeout: 20_000 })
  await page.waitForTimeout(400)
  // (plan item 679: the open result shrinks the stage, and the board re-fits above it a frame or more later under load)
  const measure = () => page.evaluate(() => {
    const g = document.querySelector('.bea-garden')!.getBoundingClientRect()
    const s = document.getElementById('win-strip')!.getBoundingClientRect()
    const p = document.querySelector('.bea-crops .is-today svg')?.getBoundingClientRect()
    const meet = g.width > 0 && s.left < g.right && s.right > g.left && s.top < g.bottom && s.bottom > g.top
    // Plan item 642: at D the result docks in the rail's column, off the board too
    const cells = [...document.querySelectorAll('.tiles > g.cell')].map((c) => c.getBoundingClientRect())
    const onBoard = innerWidth >= 1100 && cells.some((c) => s.left < c.right && s.right > c.left && s.top < c.bottom && s.bottom > c.top)
    return { meet, onBoard, plant: p ? Math.min(p.width, p.height) : 0, garden: g.width }
  })
  await expect.poll(async () => (await measure()).onBoard, { timeout: 5000 }).toBe(false)
  const m = await measure()
  test.skip(m.garden === 0, 'no valley garden at this size')
  expect(m.meet).toBe(false)
  expect(m.onBoard).toBe(false)
  expect(m.plant).toBeGreaterThanOrEqual(40)
})

// Plan item 660: the solve is Bea's moment: she stands beside today's new plant at a readable size (48 px tall at D,
// 28 on a phone; at the valley's grain she was 19 and 11), never over her garden's sign.
test('after a solve Bea stands by the new plant, large enough to read', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/runnel/?shotwin&nohelp')
  await page.locator('#win-strip').waitFor({ state: 'visible', timeout: 20_000 })
  await page.waitForTimeout(400)
  const m = await page.evaluate(() => {
    const r = (q: string) => document.querySelector(q)?.getBoundingClientRect() ?? null
    const bea = r('.bea-runner'), plant = r('.bea-crops .is-today svg'), sign = r('.bea-garden .farm-sign'), g = r('.bea-garden')
    const meet = (a: DOMRect | null, b: DOMRect | null) => !!a && !!b && b.width > 0 && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
    // plan item 697: her drawn figure (hair to boots), not her box with its can and margins
    const parts = [...document.querySelectorAll('.bea-runner :is(.ga-hair, .ga-cardi, .ga-leg)')].map((e) => e.getBoundingClientRect())
    const drawn = parts.length ? Math.max(...parts.map((b) => b.bottom)) - Math.min(...parts.map((b) => b.top)) : 0
    return { garden: g?.width ?? 0, h: bea?.height ?? 0, drawn, gap: bea && plant ? plant.left - bea.right : 999, onSign: meet(bea, sign) }
  })
  test.skip(m.garden === 0, 'no valley garden at this size')
  expect(m.h).toBeGreaterThanOrEqual(innerWidthOf(page) >= 1100 ? 48 : 28)
  // Plan item 697: at D the garden is the payoff: Bea 70 px or more as drawn (item 660's box drew her about 30)
  if (innerWidthOf(page) >= 1100) expect(m.drawn).toBeGreaterThanOrEqual(70)
  expect(m.gap).toBeLessThanOrEqual(24)
  expect(m.onSign).toBe(false)
})
const innerWidthOf = (page: import('@playwright/test').Page) => page.viewportSize()!.width

// Plan item 679: at D a daily's result is a postcard on the field under the solved board, not a rail card: whole inside
// 1440x900 and 1280x800, today's crop 80 px or more, its buttons 44 px tall, nothing clipped, clear of Cath, Bea's
// garden and the board's tiles; the rail keeps its almanac. On a phone it stays the strip.
for (const vp of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }]) {
  test(`at ${vp.width}x${vp.height} the solve lands as a postcard on the field`, async ({ page }) => {
    test.skip(page.viewportSize()!.width < 1100, 'the desktop valley')
    await page.setViewportSize(vp)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/runnel/?shotwin&nohelp')
    const card = page.locator('#win-strip[data-postcard]')
    await card.waitFor({ state: 'visible', timeout: 20_000 })
    // (polled: the card settles after it lands, its plant and fonts in, and the stage re-fits the board above it; on a
    // loaded CI runner that took longer than a fixed 600 ms wait, and the board was measured mid re-fit)
    const measure = () => page.evaluate(() => {
      const r = (q: string) => document.querySelector(q)!.getBoundingClientRect()
      const meet = (a: DOMRect, b: DOMRect) => b.width > 0 && a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1
      const s = r('#win-strip')
      const el = document.getElementById('win-strip')!
      const cells = [...document.querySelectorAll('.tiles > g.cell')].map((c) => c.getBoundingClientRect())
      return {
        inside: s.left >= 0 && s.top >= 0 && s.right <= innerWidth && s.bottom <= innerHeight,
        clipped: el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1,
        crop: Math.min(r('#strip-plant svg').width, r('#strip-plant svg').height),
        buttons: Math.min(...[...el.querySelectorAll('.strip-actions .btn:not([hidden])')].map((b) => b.getBoundingClientRect().height)),
        cath: meet(s, r('#valley-cath')),
        garden: meet(s, r('.bea-garden')),
        tiles: cells.some((c) => meet(s, c as DOMRect)),
        inRail: s.left < r('#rail').right,
        scroll: document.scrollingElement!.scrollHeight - innerHeight,
      }
    })
    await expect.poll(async () => { const x = await measure(); return { ...x, crop: 0, buttons: 0 } }, { timeout: 8000 }).toEqual({ inside: true, clipped: false, crop: 0, buttons: 0, cath: false, garden: false, tiles: false, inRail: false, scroll: 0 })
    const m = await measure()
    expect(m.crop).toBeGreaterThanOrEqual(80)
    expect(m.buttons).toBeGreaterThanOrEqual(44)
  })
}

// Plan item 748: the strip's quiet keys ('Your card', 'Play practice') stand off the strip by a rim of 3:1 or more
// (non-text contrast), day and night; their beige fill alone was under it.
for (const scheme of ['light', 'dark'] as const) {
  test(`the strip's quiet keys have a 3:1 edge (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/runnel/?shotwin&nohelp')
    await expect(page.locator('#strip-card')).toBeVisible({ timeout: 10_000 })
    const ratio = await page.evaluate(() => {
      const rgb = (s: string) => (s.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number)
      const lum = ([r = 0, g = 0, b = 0]: number[]) => {
        const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
      }
      const strip = lum(rgb(getComputedStyle(document.querySelector('.win-strip')!).backgroundColor))
      return [...document.querySelectorAll<HTMLElement>('.strip-actions .btn-quiet:not([hidden])')].map((b) => {
        // (no rim: the key's own fill is its edge)
        const cs = getComputedStyle(b)
        const rim = lum(rgb(cs.boxShadow === 'none' ? cs.backgroundColor : cs.boxShadow))
        return (Math.max(rim, strip) + 0.05) / (Math.min(rim, strip) + 0.05)
      })
    })
    expect(ratio.length).toBeGreaterThan(0)
    for (const r of ratio) expect(r).toBeGreaterThanOrEqual(3)
  })
}
