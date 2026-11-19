import { expect, test } from '@playwright/test'

// Plan item 507: at D the Setup's focal point is the opening table you'll play. The opening board takes 30%+ of
// 1440x900 and 25%+ of 1280x800; at rest at most 3 visible text blocks run over 12 words (a producer's rules show on
// hover or focus only); Start is whole on screen within 120 px of the board; nothing scrolls.
for (const [width, height, share] of [[1440, 900, 0.3], [1280, 800, 0.25]] as const) {
  test(`Setup at ${width}x${height}: the opening board is the focal point`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'the desktop table')
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await page.getByText('Quick Game').click()
    const board = page.locator('.opening-preview')
    await expect(board).toBeVisible()
    const b = (await board.boundingBox())!
    expect((b.width * b.height) / (width * height), 'board share').toBeGreaterThanOrEqual(share)
    // The map inside it is drawn large too, not a small board on a big cloth.
    const m = (await board.locator('.map').boundingBox())!
    expect((m.width * m.height) / (width * height), 'map share').toBeGreaterThanOrEqual(share * 0.6)

    const s = (await page.locator('.setup-start').boundingBox())!
    expect(s.x).toBeGreaterThanOrEqual(0)
    expect(s.y).toBeGreaterThanOrEqual(0)
    expect(s.x + s.width).toBeLessThanOrEqual(width)
    expect(s.y + s.height).toBeLessThanOrEqual(height)
    const gapX = Math.max(0, s.x - (b.x + b.width), b.x - (s.x + s.width))
    const gapY = Math.max(0, s.y - (b.y + b.height), b.y - (s.y + s.height))
    expect(Math.hypot(gapX, gapY), 'Start to the board').toBeLessThanOrEqual(120)
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= innerHeight + 1 && document.scrollingElement!.scrollWidth <= innerWidth + 1)).toBe(true)

    // Text blocks over 12 words, visible at rest (the mouse parked off the table).
    await page.mouse.move(width - 2, 2)
    const long = () =>
      page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('main.setup p, main.setup span, main.setup dd, main.setup small, main.setup li')]
          .filter((el) => {
            const r = el.getBoundingClientRect()
            if (r.width < 2 || r.height < 2 || getComputedStyle(el).visibility === 'hidden') return false
            const words = (el.innerText ?? '').split(/\s+/).filter(Boolean).length
            // A block is the outermost element carrying the words: skip one inside a counted ancestor.
            return words > 12 && !(el.parentElement && el.parentElement.closest('p, li, dd') && el.parentElement.closest('p, li, dd') !== el)
          })
          .map((el) => el.className || el.tagName),
      )
    const atRest = await long()
    expect(atRest.length, atRest.join(' | ')).toBeLessThanOrEqual(3)

    // A producer's rules show on hover, as a slip over the board, and leave again.
    const sol = page.locator('.producer-card[data-producer="sol"]')
    await expect(sol.locator('.pc-ability')).toBeHidden()
    await sol.hover()
    await expect(sol.locator('.pc-ability')).toBeVisible()
    await page.mouse.move(width - 2, 2)
    await expect(sol.locator('.pc-ability')).toBeHidden()
  })
}
