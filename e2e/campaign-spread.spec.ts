import { test, expect } from '@playwright/test'

// Plan item 257: on a desktop the campaign holds the whole spread in the window: the map with the campaign's tally
// under it, the chapter rail scrolling on its own (every chapter reachable without the page scrolling), no empty band
// under the map, and each locked chapter's postcard its scene at dusk under a wax seal (item 279).
for (const [width, height] of [[1440, 900], [1280, 800]] as const) {
  test(`campaign at ${width}x${height}: the spread fits the window and the rail reaches every chapter`, async ({ page }, info) => {
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
        // Plan item 395: every chapter is reached: the rail holds them all, or it scrolls on its own.
        railReaches: rail.scrollHeight <= rail.clientHeight + 1 || getComputedStyle(rail).overflowY === 'auto',
        gapUnderMap: led.top - map.bottom,
        bandUnderLedger: innerHeight - led.bottom,
      }
    })
    expect(m.pageScroll).toBeLessThanOrEqual(1)
    expect(m.railReaches).toBe(true)
    expect(m.gapUnderMap).toBeLessThanOrEqual(120)
    expect(m.bandUnderLedger).toBeLessThanOrEqual(120)
    // the last chapter is reachable in the rail, and Back to Title is on screen
    const last = page.locator('.cmp-path .cmp-card').last()
    await last.scrollIntoViewIfNeeded()
    await expect(last).toBeInViewport()
    expect(await page.evaluate(() => document.scrollingElement!.scrollTop)).toBe(0)
    await expect(page.getByRole('button', { name: 'Back to Title' })).toBeInViewport()
    // Plan item 279: locked postcards are their scenes at dusk under a wax seal, the land in colour, no greyscale
    const sealed = await page.locator('.cmp-vignette.is-sealed').evaluateAll((els) =>
      els.map((e) => ({ filter: getComputedStyle(e).filter, seal: !!e.querySelector('.cmp-vig-seal'), hill: getComputedStyle(e.querySelector('.cmp-vig-hill')!).fill })),
    )
    expect(sealed.length).toBe(4)
    for (const p of sealed) {
      expect(p.filter).toBe('none')
      expect(p.seal).toBe(true)
      expect(p.hill).toMatch(/^rgb/)
    }
  })
}

// Plan item 394: a short rail (a fresh campaign, one card open) spreads its stops down the column: no empty block
// under chapter 6 beside the map's tally.
test('campaign at 1440x900: a short rail reaches the tally strip', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'desktop layout')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByText('Campaign', { exact: false }).first().click()
  await expect(page.locator('[data-ledger]')).toBeVisible()
  const m = await page.evaluate(() => {
    const rail = document.querySelector('.campaign-screen > .cmp-path')!
    const stops = rail.querySelectorAll(':scope > .cmp-stop')
    const last = stops[stops.length - 1]!.getBoundingClientRect()
    const led = document.querySelector('[data-ledger]')!.getBoundingClientRect()
    return { gap: led.bottom - last.bottom }
  })
  expect(m.gap).toBeLessThanOrEqual(72)
  expect(m.gap).toBeGreaterThanOrEqual(-4)
})
