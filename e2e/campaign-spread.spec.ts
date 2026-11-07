import { test, expect } from '@playwright/test'

// Plan item 257: on a desktop the campaign holds the whole spread in the window: the map with the campaign's tally
// under it, the chapter rail scrolling on its own (every chapter reachable without the page scrolling), no empty band
// under the map, and each locked chapter's postcard a pencil sketch (outlines and hatching, not a greyed picture).
for (const [width, height] of [[1440, 900], [1280, 800]] as const) {
  test(`campaign at ${width}x${height}: the spread fits the window and the rail scrolls`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'desktop layout')
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await page.evaluate(() => localStorage.setItem('cathnivore:campaign:v1', JSON.stringify({ version: 1, completed: ['fresh-meat'], tutorialDone: true })))
    await page.goto('/')
    await page.getByText('Campaign', { exact: false }).first().click()
    const ledger = page.locator('[data-ledger]')
    await expect(ledger).toBeVisible()
    const m = await page.evaluate(() => {
      const rail = document.querySelector('.cmp-path')!
      const map = document.querySelector('.campaign-screen > .cmp-map')!.getBoundingClientRect()
      const led = document.querySelector('[data-ledger]')!.getBoundingClientRect()
      return {
        pageScroll: document.scrollingElement!.scrollHeight - innerHeight,
        railScrolls: getComputedStyle(rail).overflowY === 'auto' && rail.scrollHeight > rail.clientHeight,
        gapUnderMap: led.top - map.bottom,
        bandUnderLedger: innerHeight - led.bottom,
      }
    })
    expect(m.pageScroll).toBeLessThanOrEqual(1)
    expect(m.railScrolls).toBe(true)
    expect(m.gapUnderMap).toBeLessThanOrEqual(120)
    expect(m.bandUnderLedger).toBeLessThanOrEqual(120)
    // the last chapter is reachable in the rail, and Back to Title is on screen
    const last = page.locator('.cmp-path .cmp-card').last()
    await last.scrollIntoViewIfNeeded()
    await expect(last).toBeInViewport()
    expect(await page.evaluate(() => document.scrollingElement!.scrollTop)).toBe(0)
    await expect(page.getByRole('button', { name: 'Back to Title' })).toBeInViewport()
    // locked postcards: drawn in outline with hatching, no greyscale filter
    const pencil = await page.locator('.cmp-vignette.is-pencil').evaluateAll((els) =>
      els.map((e) => ({ filter: getComputedStyle(e).filter, hatch: getComputedStyle(e.querySelector('.cmp-vig-hill')!).fill })),
    )
    expect(pencil.length).toBe(4)
    for (const p of pencil) {
      expect(p.filter).toBe('none')
      expect(p.hatch).toContain('cmp-pencil-hatch')
    }
  })
}
