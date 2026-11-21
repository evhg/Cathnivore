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
        // Plan item 444: the tally hangs in the top band beside the signboard, and the map takes the column below it
        ledgerInBand: led.bottom <= map.top,
        bandUnderMap: innerHeight - map.bottom,
      }
    })
    expect(m.pageScroll).toBeLessThanOrEqual(1)
    expect(m.railReaches).toBe(true)
    expect(m.ledgerInBand).toBe(true)
    expect(m.bandUnderMap).toBeLessThanOrEqual(120)
    // the last chapter is reachable in the rail, and Back to Title is on screen
    const last = page.locator('.cmp-path .cmp-card').last()
    await last.scrollIntoViewIfNeeded()
    await expect(last).toBeInViewport()
    expect(await page.evaluate(() => document.scrollingElement!.scrollTop)).toBe(0)
    await expect(page.getByRole('button', { name: 'Back to Title' })).toBeInViewport()
    // Plan item 279: locked postcards are their scenes at dusk under a wax seal, the land in colour, no greyscale
    const sealed = await page.locator('.cmp-vignette.is-sealed:not(.is-mini)').evaluateAll((els) =>
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
    // Plan item 444: the tally moved to the top band; the rail runs to the window's foot
    return { gap: innerHeight - 16 - last.bottom }
  })
  expect(m.gap).toBeLessThanOrEqual(72)
  expect(m.gap).toBeGreaterThanOrEqual(-4)
})

// Plan item 444: one composed spread at D: the title a signboard, the chapters won a string of pennants beside it,
// the map 45%+ of the window, no empty band of 300x100 px or more.
test('campaign at 1440x900: one composed spread', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'desktop layout')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('cathnivore:campaign:v1', JSON.stringify({ version: 1, completed: ['fresh-meat'], tutorialDone: true })))
  await page.goto('/')
  await page.getByText('Campaign', { exact: false }).first().click()
  const pennants = page.locator('.cmp-pennants')
  await expect(pennants).toHaveAttribute('aria-label', '1 of 6 chapters won')
  await expect(page.locator('.cmp-pennant.is-won')).toHaveCount(1)
  await page.waitForTimeout(1200)
  const map = (await page.locator('.campaign-screen > .cmp-map').boundingBox())!
  expect((map.width * map.height) / (1440 * 900), 'share of the window the map and its host take').toBeGreaterThanOrEqual(0.45)
  // the variance scan: no 300x100 block of the page is one flat colour
  const shot = await page.screenshot()
  const empty = await page.evaluate(async (b64) => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + b64
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const g = c.getContext('2d')!
    g.drawImage(img, 0, 0)
    const k = img.width / innerWidth
    const flat = (x: number, y: number) => {
      const d = g.getImageData(Math.round(x * k), Math.round(y * k), Math.round(300 * k), Math.round(100 * k)).data
      let lo = 255, hi = 0
      for (let i = 0; i < d.length; i += 16) {
        const l = 0.3 * d[i]! + 0.59 * d[i + 1]! + 0.11 * d[i + 2]!
        lo = Math.min(lo, l)
        hi = Math.max(hi, l)
      }
      return hi - lo < 10
    }
    const hits: number[][] = []
    for (let y = 0; y + 100 <= innerHeight; y += 20) for (let x = 0; x + 300 <= innerWidth; x += 20) if (flat(x, y)) hits.push([x, y])
    return hits
  }, shot.toString('base64'))
  expect(empty, 'flat 300x100 blocks').toEqual([])
})

// Plan item 444: on a phone her bust ended behind the stall's crates on the board's lip. Plan item 610: she narrates
// at half length instead, 140 px or more of her over the map's top edge and the rest tucked behind it (no crates),
// her line to her left with its tail rising to her mouth.
test('campaign on a phone: Cath narrates at half length over the map', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'phone layout')
  await page.goto('/')
  await page.getByText('Campaign', { exact: false }).first().click()
  await expect(page.locator('.cmp-header-cath')).toBeVisible()
  await expect(page.locator('.cmp-header .produce-crates')).toHaveCount(0)
  const map = (await page.locator('.campaign-screen > .cmp-map').boundingBox())!
  const cath = (await page.locator('.cmp-header-cath').boundingBox())!
  const face = (await page.locator('.cmp-header-cath .cath-features').boundingBox())!
  const line = (await page.locator('.cmp-cath-line').boundingBox())!
  expect(map.y - cath.y, 'her figure over the map').toBeGreaterThanOrEqual(140)
  expect(cath.y + cath.height, 'her hem behind the map').toBeGreaterThan(map.y)
  expect(line.x + line.width).toBeLessThanOrEqual(face.x)
  // the tail's tip (the bubble's ::after) within 40 px of her mouth (the face box's lower middle)
  const tip = await page.locator('.cmp-cath-line').evaluate((el) => {
    const r = el.getBoundingClientRect()
    const a = getComputedStyle(el, '::after')
    return { x: r.right - parseFloat(a.right), y: r.top + parseFloat(a.top) }
  })
  expect(Math.hypot(tip.x - (face.x + face.width / 2), tip.y - (face.y + face.height * 0.75))).toBeLessThanOrEqual(40)
})
