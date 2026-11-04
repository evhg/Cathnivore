import { expect, test } from '@playwright/test'

// Plan item 71: the title table lives. Cath stands large beside it (360 px or more at D, 160 px on a phone) and
// never over the menu; Hollowell's vans drive its roads; under reduced motion nothing on the table moves; the
// board's marks are 12 px or more, or left off; Cath's face follows the menu entry under the pointer or focus.
test('Cath is large beside the table and clear of the menu', async ({ page }, testInfo) => {
  test.skip(!['phone', 'desktop-chromium'].includes(testInfo.project.name), 'P and D')
  await page.goto('/')
  await page.locator('.title-cath svg').waitFor()
  const cath = (await page.locator('.title-cath svg').boundingBox())!
  const menu = (await page.locator('.title-menu').boundingBox())!
  const min = testInfo.project.name === 'phone' ? 160 : 360
  expect(cath.height).toBeGreaterThanOrEqual(min)
  const overlapX = Math.min(cath.x + cath.width, menu.x + menu.width) - Math.max(cath.x, menu.x)
  const overlapY = Math.min(cath.y + cath.height, menu.y + menu.height) - Math.max(cath.y, menu.y)
  expect(overlapX <= 0 || overlapY <= 0).toBe(true)
  // Every visible board label is 12 px or more.
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<SVGTextElement>('.title-board .map text')]
      .filter((t) => t.getClientRects().length && getComputedStyle(t).display !== 'none' && (t.closest('g') as Element | null)?.getClientRects().length)
      .filter((t) => getComputedStyle(t).visibility !== 'hidden' && t.getBoundingClientRect().width > 0)
      .map((t) => ({ t: t.textContent, px: parseFloat(getComputedStyle(t).fontSize) * (t.getScreenCTM()?.a ?? 1) }))
      .filter((x) => x.px < 11.95 && !/^\d$|^\?$/.test(x.t ?? '')),
  )
  expect(small).toEqual([])
})

test('the vans drive the roads, and reduced motion parks them', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'once')
  await page.goto('/')
  await expect(page.locator('.title-movers .title-van')).toHaveCount(2)
  expect(await page.locator('.title-movers animateMotion').count()).toBe(2)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('.title-movers .title-van')).toHaveCount(2)
  expect(await page.locator('.title-movers animateMotion').count()).toBe(0)
  // Nothing on the table runs a CSS animation either.
  const running = await page.evaluate(() => document.getAnimations().filter((a) => {
    const t = (a.effect as KeyframeEffect | null)?.target as Element | null
    return !!t?.closest('.title-table') && a.playState === 'running'
  }).length)
  expect(running).toBe(0)
})

test('Cath\'s face follows the menu', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'a pointer and a keyboard')
  await page.goto('/')
  await expect(page.locator('.title-cath svg.cath-smirk')).toHaveCount(1)
  await page.getByRole('button', { name: /^Campaign/ }).hover()
  await expect(page.locator('.title-cath svg.cath-determined')).toHaveCount(1)
  await page.getByRole('button', { name: /^Quick Game/ }).focus()
  await expect(page.locator('.title-cath svg.cath-delighted')).toHaveCount(1)
})

// Plan item 75: at D Cath stands behind the table's near edge (her box meets the table's), inside the viewport, and
// the composition leaves no blank band over 80 px above or below it.
for (const [width, height] of [[1440, 900], [1280, 800]] as const) {
  test(`Cath stands behind the table at ${width}x${height}, no blank band over 80 px`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the desktop composition')
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await page.locator('.title-table-front').waitFor()
    const m = await page.evaluate(() => {
      const c = document.querySelector('.title-cath svg')!.getBoundingClientRect()
      const t = document.querySelector('.title-table-front')!.getBoundingClientRect()
      const kids = [...document.querySelectorAll('.title-hero > *')].map((e) => e.getBoundingClientRect())
      const top = Math.min(...kids.map((k) => k.top))
      const bottom = Math.max(...kids.map((k) => k.bottom), t.bottom)
      const foot = document.querySelector('.title-footer')!.getBoundingClientRect().top
      return {
        inside: c.left >= 0 && c.top >= 0 && c.right <= innerWidth && c.bottom <= innerHeight,
        meets: c.bottom >= t.top && c.left < t.right && c.right > t.left,
        bandTop: top, bandBottom: foot - bottom,
      }
    })
    expect(m.inside).toBe(true)
    expect(m.meets).toBe(true)
    expect(m.bandTop).toBeLessThanOrEqual(80)
    expect(m.bandBottom).toBeLessThanOrEqual(80)
  })
}

// Plan item 84: on a phone Bea's drawing is pinned inside the cloth's corner, clear of the screen's edge.
test("Bea's drawing sits inside the board on a phone", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'the upright phone')
  await page.goto('/')
  await page.locator('.title-bea').waitFor()
  const m = await page.evaluate(() => {
    const b = document.querySelector('.title-bea')!.getBoundingClientRect()
    const t = document.querySelector('.title-board')!.getBoundingClientRect()
    return { inBoard: b.left >= t.left && b.right <= t.right + 1 && b.top >= t.top - 1, edge: innerWidth - b.right }
  })
  expect(m.inBoard).toBe(true)
  expect(m.edge).toBeGreaterThanOrEqual(12)
})

// Plan item 86: at D the title is one market scene: the menu board stands on the table (their boxes meet), the
// table spans the frame edge to edge, the logotype sits across the top centre, and Tab reaches every entry.
for (const [width, height] of [[1440, 900], [1280, 800]] as const) {
  test(`the menu board stands on the table at ${width}x${height}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the desktop composition')
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await page.locator('.title-table-front').waitFor()
    const m = await page.evaluate(() => {
      const menu = document.querySelector('.title-menu')!.getBoundingClientRect()
      const t = document.querySelector('.title-table-front')!.getBoundingClientRect()
      const mark = document.querySelector('.title-wordmark')!.getBoundingClientRect()
      return {
        meets: menu.bottom >= t.top && menu.top < t.top && menu.left < t.right && menu.right > t.left,
        edgeToEdge: t.left <= 0 && t.right >= innerWidth - 1,
        markCentre: Math.abs((mark.left + mark.right) / 2 - innerWidth / 2),
      }
    })
    expect(m.meets).toBe(true)
    expect(m.edgeToEdge).toBe(true)
    expect(m.markCentre).toBeLessThanOrEqual(24)
    const names: string[] = []
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab')
      names.push(await page.evaluate(() => (document.activeElement?.textContent ?? '').trim()))
    }
    for (const want of [/^Campaign/, /^Quick Game/, /^Daily/, /How to Play/, /Settings/, /Credits/]) expect(names.some((n) => want.test(n)), String(want)).toBe(true)
  })
}

// Plan item 86: the scene fills the frame: no 300x200 window at D is clear of every part of it.
for (const [width, height] of [[1440, 900], [1280, 800]] as const) {
  test(`the title scene leaves no empty 300x200 band at ${width}x${height}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the desktop composition')
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await page.locator('.title-table-front').waitFor()
    const empty = await page.evaluate(() => {
      const parts = ['.title-kicker', '.title-wordmark', '.title-tagline', '.title-bunting', '.title-menu', '.title-cath svg', '.title-cath-line', '.title-board', '.title-table-front', '.title-prop']
        .flatMap((s) => [...document.querySelectorAll(s)])
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0)
      const hits = (x: number, y: number) => parts.some((r) => r.left < x + 300 && r.right > x && r.top < y + 200 && r.bottom > y)
      for (let y = 0; y + 200 <= innerHeight; y += 10) for (let x = 0; x + 300 <= innerWidth; x += 10) if (!hits(x, y)) return { x, y }
      return null
    })
    expect(empty).toBeNull()
  })
}

// Plan item 93: the phone title is a staged market scene. Cath stands behind the table, 200 px or more (180 on a
// 375x667 phone), clear of the menu and the logotype; the chalk menu stands on the tabletop, its foot within 4 px
// of the table's front (the footer); her line is two lines at most; nothing scrolls.
for (const [width, height, min] of [[390, 844, 200], [375, 667, 180]] as const) {
  test(`the phone title is a market scene at ${width}x${height}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone', 'the phone composition')
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await page.locator('.title-cath svg').waitFor()
    // the menu and words rise in over 1.2 s
    await page.waitForTimeout(1400)
    const m = await page.evaluate(() => {
      const box = (q: string) => document.querySelector(q)!.getBoundingClientRect()
      const cath = box('.title-cath svg')
      const menu = box('.title-menu')
      const mark = box('.title-wordmark')
      const foot = box('.title-footer')
      const line = document.querySelector('.title-cath-line')!
      const cs = getComputedStyle(line)
      const lines = Math.round((line.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / parseFloat(cs.lineHeight))
      const hit = (a: DOMRect, b: DOMRect) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
      return {
        cath: cath.height,
        clearMenu: !hit(cath, menu),
        clearMark: !hit(cath, mark),
        foot: Math.abs(menu.bottom - foot.top),
        lines,
        scroll: document.documentElement.scrollHeight - innerHeight,
        footInside: foot.bottom <= innerHeight + 1,
      }
    })
    expect(m.cath).toBeGreaterThanOrEqual(min)
    expect(m.clearMenu).toBe(true)
    expect(m.clearMark).toBe(true)
    expect(m.foot).toBeLessThanOrEqual(4)
    expect(m.lines).toBeLessThanOrEqual(2)
    expect(m.scroll).toBeLessThanOrEqual(0)
    expect(m.footInside).toBe(true)
  })
}

// Plan item 98: the vans drive under the region name plates (one sat on Kingsmarket's plate in early frames):
// they are drawn in the board's own svg, before every name sign.
test('the vans drive under the name plates', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'plates show at D')
  await page.goto('/')
  await expect(page.locator('.title-movers .title-van')).toHaveCount(2)
  const m = await page.evaluate(() => {
    const movers = document.querySelector('.title-movers')!
    const signs = [...document.querySelectorAll('.title-board .region-sign')]
    return {
      inMap: movers.closest('svg.map') !== null,
      signs: signs.length,
      under: signs.every((s) => !!(movers.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING)),
    }
  })
  expect(m).toEqual({ inMap: true, signs: 7, under: true })
})
