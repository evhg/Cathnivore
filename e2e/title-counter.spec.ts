import { expect, test, type Page } from '@playwright/test'

// Plan item 231: on a phone the menu sits on the counter. Plan item 316: Cath stands half-length at the stall
// beside the board (150 px or taller, her face whole), the board 240 px or wider and still the largest thing on screen; every menu entry is 44 px or taller and on screen with no page scroll;
// no dark panel: under 20% of the light-theme screen is darker than L 0.3 (the old chalkboard was about 30%).
// Plan item 581 (superseding item 453's 'Cath the largest'): at 390x844 the board is the hero, 300 px or wider and
// the largest thing on screen with nothing over it; Cath stands behind it, her face whole above its far edge.
// Plan item 609 (superseding item 581's 'behind'): Cath stands in front of the board, nothing of it over her, the board
// about 10% smaller (280 px or wider; 215 with a save) and held to the right.

async function measure(page: Page) {
  const shot = (await page.screenshot()).toString('base64')
  return page.evaluate(async (shot) => {
    const img = new Image()
    img.src = `data:image/png;base64,${shot}`
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const g = c.getContext('2d')!
    g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, c.width, c.height).data
    const f = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    let dark = 0
    for (let i = 0; i < d.length; i += 4) {
      // OKLab's L for a grey is the cube root of its relative luminance; close enough to call a panel dark.
      const y = 0.2126 * f(d[i]!) + 0.7152 * f(d[i + 1]!) + 0.0722 * f(d[i + 2]!)
      if (Math.cbrt(y) < 0.3) dark++
    }
    const box = (e: Element) => e.getBoundingClientRect()
    const board = box(document.querySelector('.title-board')!)
    const others = ['.title-menu > *', '.title-cath-line', '.title-wordmark', '.ritual-receipt']
      .flatMap((s) => [...document.querySelectorAll(s)])
      .map(box)
      .filter((r) => r.width > 0)
    const entries = [...document.querySelectorAll('.title-menu button')].map(box)
    const cath = box(document.querySelector('.title-cath svg')!)
    const face = box(document.querySelector('.title-cath .cath-features')!)
    return {
      boardW: board.width,
      cathH: cath.height,
      cathW: cath.width,
      faceWhole: face.top >= 0 && face.bottom <= board.top && face.width >= 60,
      cathFront: Number(getComputedStyle(document.querySelector('.title-cath')!).zIndex) > Number(getComputedStyle(document.querySelector('.title-board')!).zIndex),
      boardRight: innerWidth - board.right <= 24,
      lineClear: box(document.querySelector('.title-cath-line')!).bottom <= board.top,
      largest: others.every((r) => r.width * r.height < board.width * board.height),
      entries: entries.map((r) => ({ h: r.height, inside: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth })),
      scroll: document.documentElement.scrollHeight - innerHeight,
      dark: dark / (d.length / 4),
    }
  }, shot)
}

for (const withSave of [false, true]) {
  test(`the phone title's board is the hero, the menu on the counter${withSave ? ' (with a save)' : ''}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone', 'the upright phone')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ colorScheme: 'light' })
    if (withSave) {
      await page.goto('/')
      await page.getByText('Quick Game').click()
      await page.getByRole('button', { name: 'Start' }).click()
      await page.locator('.game .map').first().waitFor() // the Setup's opening board is a .map too (item 513)
    }
    await page.goto('/')
    await page.locator('.title-cath svg').waitFor()
    await page.waitForTimeout(1800) // the title's fade-ins
    if (withSave) await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible()
    const m = await measure(page)
    // with a save the menu takes a row, so the board gives up the room
    expect(m.boardW).toBeGreaterThanOrEqual(withSave ? 215 : 280)
    expect(m.cathFront).toBe(true)
    expect(m.boardRight).toBe(true)
    expect(m.cathH).toBeGreaterThanOrEqual(280)
    expect(m.cathW).toBeGreaterThanOrEqual(190)
    expect(m.faceWhole).toBe(true)
    expect(m.lineClear).toBe(true)
    expect(m.largest).toBe(true)
    expect(m.entries.length).toBeGreaterThanOrEqual(withSave ? 7 : 6)
    for (const e of m.entries) {
      expect(e.h).toBeGreaterThanOrEqual(44)
      expect(e.inside).toBe(true)
    }
    expect(m.scroll).toBeLessThanOrEqual(0)
    expect(m.dark).toBeLessThan(0.2)
  })
}
