import { expect, test } from '@playwright/test'

// Plan item 692: at D the 2D side panel serves the field: 26% of the window or less, no text in it under 12 px, every
// packet name whole on its band, and the round's trait stamps clear of its number.
type HG = { game(): unknown }
for (const level of [27, 34]) {
  test(`level ${level} at 1440x900: the panel is 26% or less, its text 12 px or more`, async ({ page }) => {
    test.skip(page.viewportSize()!.width < 1100, 'the desktop panel')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.addInitScript(() => {
      try {
        localStorage.setItem('hedgerow:v1', JSON.stringify({ seenBefore: Object.fromEntries(Array.from({ length: 60 }, (_, i) => [i + 1, true])) }))
      } catch {
        /* storage off */
      }
    })
    await page.goto(`/hedgerow/?sandbox=1&2d&level=${level}`)
    await page.waitForFunction(() => !!(window as unknown as { hedgerow?: HG }).hedgerow?.game(), null, { timeout: 60_000 })
    await page.waitForTimeout(800)
    const m = await page.evaluate(() => {
      const panel = document.querySelector('.play .panel')!.getBoundingClientRect()
      const small: string[] = []
      for (const el of document.querySelectorAll('.play .panel *')) {
        const r = el.getBoundingClientRect()
        if (!r.width || getComputedStyle(el).visibility === 'hidden') continue
        const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())
        if (own && parseFloat(getComputedStyle(el).fontSize) < 12) small.push(el.textContent!.trim().slice(0, 20))
      }
      const cut = [...document.querySelectorAll<HTMLElement>('.tray-name')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent)
      const no = document.querySelector('.panel .ticket-no')?.getBoundingClientRect()
      const tags = [...document.querySelectorAll('.panel .ticket-head > .tag')].map((t) => t.getBoundingClientRect())
      const overNo = !!no && tags.some((t) => t.width > 0 && t.left < no.right && t.right > no.left && t.top < no.bottom && t.bottom > no.top)
      return { share: panel.width / innerWidth, small, cut, overNo }
    })
    expect(m.share).toBeLessThanOrEqual(0.26)
    expect(m.small).toEqual([])
    expect(m.cut).toEqual([])
    expect(m.overNo).toBe(false)
  })
}
