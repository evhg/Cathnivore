import { expect, test } from '@playwright/test'

// Plan item 710: at D the week's notice hangs inside Cath's stall, under its board: clear of the setup table's frame,
// of her bubble and of her head, its deal three lines or fewer (it was a 128 px column of six lines over the frame).
for (const [width, height] of [
  [1440, 900],
  [1280, 800],
] as const) {
  test(`the week's notice hangs in the stall at ${width}x${height}`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'the desktop setup')
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await page.locator('.market-event[data-flyer]').waitFor()
    await page.waitForTimeout(600)
    const m = await page.evaluate(() => {
      const box = (e: Element) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom } }
      const rule = document.querySelector('.market-event-rule')!
      let top = Infinity
      for (const e of document.querySelectorAll('.setup-cath-stand .cath-art svg :is(path, ellipse, circle)')) {
        const r = e.getBoundingClientRect()
        if (r.width > 0) top = Math.min(top, r.top)
      }
      return {
        notice: box(document.querySelector('.market-event[data-flyer]')!),
        table: box(document.querySelector('.setup-table')!),
        bubble: box(document.querySelector('.setup-cath-says')!),
        cathTop: top,
        ruleLines: (() => {
          const range = document.createRange()
          range.selectNodeContents(rule)
          // a line's fragments (the capital first letter among them) share a baseline band: count bands 8 px+ apart
          const tops = [...range.getClientRects()].filter((r) => r.width > 1 && r.height < 40).map((r) => r.bottom).sort((a, b) => a - b)
          return tops.filter((t, i) => i === 0 || t - tops[i - 1]! > 8).length
        })(),
      }
    })
    const meet = (a: typeof m.notice, b: typeof a) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b
    expect(m.notice.l, 'right of the setup table').toBeGreaterThanOrEqual(m.table.r)
    expect(m.notice.r).toBeLessThanOrEqual(width)
    expect(meet(m.notice, m.bubble), 'notice and her bubble').toBe(false)
    expect(m.notice.b, 'notice above her head').toBeLessThanOrEqual(m.cathTop)
    expect(m.ruleLines, 'the deal in three lines or fewer').toBeLessThanOrEqual(3)
  })
}
