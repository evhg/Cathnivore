import { expect, test } from '@playwright/test'

// Plan item 113 (slice 1): Cath presents the chapters on the Campaign screen (full height since item 248), with a speech bubble at 15 px or more whose line follows the chapter under the pointer or focus.
test('Cath speaks about the chapter under the pointer or focus', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('cathnivore:campaign:v1', JSON.stringify({ version: 1, completed: ['fresh-meat'], tutorialDone: true })),
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Campaign' }).click()
  // The pointer left where Campaign was clicked lands on chapter 1's regions on the D map (onPoint): park it.
  await page.mouse.move(2, 2)
  const fig = page.locator('.cmp-cath')
  await expect(fig).toBeVisible()
  const phone = page.viewportSize()!.width <= 600
  const art = (await page.locator('.cmp-header-cath').boundingBox())!
  // Plan item 325: she narrates at half length (was full height, item 248), whole on the first screen: 240 px or more at
  // D, beside the island in the map's own panel; 120 px or more on a phone, beside her line in the header.
  expect(art.height).toBeGreaterThanOrEqual(phone ? 120 : 240)
  // Plan item 669: a half-length bust at D (item 556's full figure was a 70 px-wide doll) as on a phone.
  await expect(page.locator('.cmp-header-cath svg')).toHaveAttribute('viewBox', '40 20 320 480')
  // Each chapter has its own pose (CHAPTER_POSE): the figure names one of them.
  await expect(fig).toHaveAttribute('data-pose', /^(point|wave|can|thinking|crossed|flag)$/)
  const vp = page.viewportSize()!
  expect(art.x).toBeGreaterThanOrEqual(0)
  expect(art.y).toBeGreaterThanOrEqual(0)
  expect(art.x + art.width).toBeLessThanOrEqual(vp.width)
  expect(art.y + art.height).toBeLessThanOrEqual(vp.height)
  expect(await page.locator('.cmp-header-cath').evaluate((e) => getComputedStyle(e).maskImage)).toBe('none')
  if (!phone) {
    await expect(fig).toHaveAttribute('data-host', 'map')
    const map = (await page.locator('.cmp-map').boundingBox())!
    expect(art.x).toBeGreaterThanOrEqual(map.x)
    // Plan item 669: her bust's shoulders run on into the margin before the chapter rail, never onto it
    const rail = (await page.locator('.chapter-list').boundingBox())!
    // (plan item 689: measured on her drawn body, not the figure's box with its empty margins)
    const body = (await page.locator('.cmp-map-host .cmp-header-cath svg .cath-body').boundingBox())!
    expect(body.x + body.width).toBeLessThanOrEqual(rail.x)
    expect(art.y + art.height).toBeLessThanOrEqual(map.y + map.height)
  }
  const size = await page.locator('.cmp-cath-line').evaluate((e) => parseFloat(getComputedStyle(e).fontSize))
  expect(size).toBeGreaterThanOrEqual(15)
  // The next chapter to play by default; another chapter's line when it takes focus.
  await expect(fig).toHaveAttribute('data-chapter', 'word-of-mouth')
  const before = await page.locator('.cmp-cath-line').textContent()
  await page.locator('.cmp-card').nth(2).focus()
  await expect(fig).toHaveAttribute('data-chapter', 'growing-season')
  await expect(page.locator('.cmp-cath-line')).not.toHaveText(before!)
  // Its home regions light on the map.
  await expect(page.locator('.cmp-map [data-lit="true"]')).not.toHaveCount(0)
})

// Plan item 113 (slice 3): each chapter card carries a drawn vignette of its regions' landmarks, 120x80 or
// more, at full ink; a locked chapter's is its scene at dusk under a wax seal (item 279).
test('each chapter card has a landmark vignette, locked ones sealed', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('cathnivore:campaign:v1', JSON.stringify({ version: 1, completed: ['fresh-meat'], tutorialDone: true })),
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Campaign' }).click()
  const cards = page.locator('.cmp-card')
  await expect(cards.nth(5)).toBeVisible()
  const n = await cards.count()
  expect(n).toBeGreaterThanOrEqual(6)
  // Plan item 373: on a wide desktop only the open chapter is a whole card; the others fold to tabs without art.
  const wide = await page.evaluate(() => innerWidth >= 1100 && innerHeight >= 640)
  for (let i = 0; i < n; i++) {
    const card = cards.nth(i)
    const vig = card.locator('.cmp-vignette')
    const folded = wide && !(await card.evaluate((e) => !!e.closest('.cmp-stop-next')))
    // Plan item 395: on a desktop taller than 860 px a folded locked chapter is a postcard with its sealed print.
    const postcard = folded && (await page.evaluate(() => innerHeight >= 861)) && (await card.evaluate((e) => e.classList.contains('chapter-locked')))
    if (folded && !postcard) {
      await expect(vig).toBeHidden()
      continue
    }
    // Plan item 386: the phone's one-card sheet draws it at 108 x 72, so the open chapter's Play key fits at 375x667.
    await card.scrollIntoViewIfNeeded()
    const box = (await vig.boundingBox())!
    const phone = page.viewportSize()!.width <= 600
    expect(box.width).toBeGreaterThanOrEqual(phone || postcard ? 104 : 120)
    expect(box.height).toBeGreaterThanOrEqual(phone || postcard ? 70 : 80)
    expect(await vig.locator('.cmp-vig-mark').count()).toBeGreaterThanOrEqual(2)
    const locked = await card.evaluate((e) => e.classList.contains('chapter-locked'))
    await expect(vig).toHaveClass(locked ? /is-sealed/ : /^cmp-vignette( is-won)?$/)
    // The vignette sits inside its card and clear of the card's words.
    const cb = (await card.boundingBox())!
    expect(box.x + box.width).toBeLessThanOrEqual(cb.x + cb.width + 0.5)
    const goal = (await card.locator('.chapter-goal').boundingBox())!
    const overlaps = goal.x < box.x + box.width && box.x < goal.x + goal.width && goal.y < box.y + box.height && box.y < goal.y + goal.height
    expect(overlaps).toBe(false)
  }
  // Chapter 1 is drawn from the regions it frees: the barn and the sheepfold.
  await expect(cards.first().locator('.cmp-vignette')).toHaveAttribute('data-regions', 'brindleHills highmoor')
})

// Plan item 248: at 1280x800 and 375x667 the map and Cath stand whole on the first screen (only the chapter list
// scrolls on), with no sideways scroll.
for (const [w, h] of [[1280, 800], [375, 667]] as const) {
  test(`map and Cath whole on the first screen at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h })
    await page.addInitScript(() =>
      localStorage.setItem('cathnivore:campaign:v1', JSON.stringify({ version: 1, completed: ['fresh-meat'], tutorialDone: true })),
    )
    await page.goto('/')
    await page.getByRole('button', { name: 'Campaign' }).click()
    await expect(page.locator('.cmp-map')).toBeVisible()
    for (const sel of ['.cmp-map', '.cmp-header-cath', '.cmp-cath-line']) {
      const b = (await page.locator(sel).boundingBox())!
      expect(b.y, sel).toBeGreaterThanOrEqual(0)
      expect(b.y + b.height, sel).toBeLessThanOrEqual(h)
      expect(b.x + b.width, sel).toBeLessThanOrEqual(w)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
  })
}

// Plan item 556 (669: a half-length bust now): at D Cath stands clear of the crates (at most 10% of her box covered), locked chapters
// are sealed letters with a 14 px teaser at 4.5:1, and the bunting dyes one flag per chapter won.
test('desktop campaign: Cath in front, chapters as sealed letters, bunting follows progress', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1100, 'desktop layout')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript(() =>
    localStorage.setItem('cathnivore:campaign:v1', JSON.stringify({ version: 1, completed: ['fresh-meat', 'word-of-mouth'], tutorialDone: true })),
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Campaign' }).click()
  await page.mouse.move(2, 2)
  await expect(page.locator('.cmp-map-host .cmp-header-cath svg')).toHaveAttribute('data-framing', 'half')
  const cath = (await page.locator('.cmp-map-host .cmp-header-cath').boundingBox())!
  const crates = (await page.locator('.cmp-map-host .produce-crates').boundingBox())!
  const ox = Math.max(0, Math.min(cath.x + cath.width, crates.x + crates.width) - Math.max(cath.x, crates.x))
  const oy = Math.max(0, Math.min(cath.y + cath.height, crates.y + crates.height) - Math.max(cath.y, crates.y))
  // The crates stand behind her (lower z), so only what they would hide in front counts; behind or beside, they hide nothing.
  const inFront = await page.evaluate(() => {
    const z = (sel: string) => Number(getComputedStyle(document.querySelector(sel)!).zIndex) || 0
    return z('.cmp-map-host .produce-crates') > z('.cmp-map-host .cmp-header-cath')
  })
  expect(inFront ? (ox * oy) / (cath.width * cath.height) : 0).toBeLessThanOrEqual(0.1)
  expect(cath.y + cath.height).toBeLessThanOrEqual(900)
  // The locked letters' teasers.
  const goals = page.locator('.cmp-stop-locked:not(.cmp-stop-next) .chapter-goal')
  expect(await goals.count()).toBeGreaterThan(0)
  for (const g of await goals.all()) {
    const { size, ratio } = await g.evaluate((el) => {
      // color-mix() computes to color(srgb r g b) in 0-1, a plain colour to rgb() in 0-255
      const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map((v) => (c.startsWith('color(') ? Number(v) * 255 : Number(v)))
      const lum = (c: number[]) => {
        const [r, gg, b] = c.map((v) => {
          const s = v / 255
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
        })
        return 0.2126 * r! + 0.7152 * gg! + 0.0722 * b!
      }
      // the letter's paper under the teaser: sample the card's own base colour (its last background layer)
      const card = el.closest('.cmp-card')!
      const bg = getComputedStyle(card).backgroundColor
      const a = lum(rgb(getComputedStyle(el).color))
      const b = lum(rgb(bg))
      return { size: parseFloat(getComputedStyle(el).fontSize), ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) }
    })
    expect(size).toBeGreaterThanOrEqual(14)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  }
  // Two chapters won: two dyed flags, the slate says so.
  await expect(page.locator('.cmp-pennant[data-won="true"]')).toHaveCount(2)
  await expect(page.locator('.cmp-pennant[data-won="false"]')).toHaveCount(4)
  await expect(page.locator('[data-ledger-chapters] dd')).toHaveText(/2\s*of 6/)
})
