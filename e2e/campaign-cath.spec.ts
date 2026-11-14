import { expect, test } from '@playwright/test'

// Plan item 113 (slice 1): Cath presents the chapters on the Campaign screen (full height since item 248), with a speech bubble at 15 px or more whose line follows the chapter under the pointer or focus.
test('Cath speaks about the chapter under the pointer or focus', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('cathnivore:campaign:v1', JSON.stringify({ version: 1, completed: ['fresh-meat'], tutorialDone: true })),
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Campaign' }).click()
  const fig = page.locator('.cmp-cath')
  await expect(fig).toBeVisible()
  const phone = page.viewportSize()!.width <= 600
  const art = (await page.locator('.cmp-header-cath').boundingBox())!
  // Plan item 325: she narrates at half length (was full height, item 248), whole on the first screen: 240 px or more at
  // D, beside the island in the map's own panel; 120 px or more on a phone, beside her line in the header.
  expect(art.height).toBeGreaterThanOrEqual(phone ? 120 : 240)
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
    expect(art.x + art.width).toBeLessThanOrEqual(map.x + map.width)
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
    if (wide && !(await card.evaluate((e) => !!e.closest('.cmp-stop-next')))) {
      await expect(vig).toBeHidden()
      continue
    }
    const box = (await vig.boundingBox())!
    expect(box.width).toBeGreaterThanOrEqual(120)
    expect(box.height).toBeGreaterThanOrEqual(80)
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
