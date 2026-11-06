import { expect, test } from '@playwright/test'

// Plan item 113 (slice 1): Cath presents the chapters on the Campaign screen: half-length, 160 px tall at D and
// 110 on a phone (a round cameo there since item 200), with a speech bubble at 15 px or more whose line follows the chapter under the pointer or focus.
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
  expect(art.height).toBeGreaterThanOrEqual(phone ? 110 : 160)
  // Plan item 200: on a phone she's a whole cameo (no fade into the paper), inside the viewport.
  if (phone) {
    expect(await page.locator('.cmp-header-cath').evaluate((e) => getComputedStyle(e).maskImage)).toBe('none')
    expect(art.x + art.width).toBeLessThanOrEqual(page.viewportSize()!.width)
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
// more, at full ink; a locked chapter's is in pencil.
test('each chapter card has a landmark vignette, locked ones in pencil', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('cathnivore:campaign:v1', JSON.stringify({ version: 1, completed: ['fresh-meat'], tutorialDone: true })),
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Campaign' }).click()
  const cards = page.locator('.cmp-card')
  await expect(cards.nth(5)).toBeVisible()
  const n = await cards.count()
  expect(n).toBeGreaterThanOrEqual(6)
  for (let i = 0; i < n; i++) {
    const card = cards.nth(i)
    const vig = card.locator('.cmp-vignette')
    const box = (await vig.boundingBox())!
    expect(box.width).toBeGreaterThanOrEqual(120)
    expect(box.height).toBeGreaterThanOrEqual(80)
    expect(await vig.locator('.cmp-vig-mark').count()).toBeGreaterThanOrEqual(2)
    const locked = await card.evaluate((e) => e.classList.contains('chapter-locked'))
    await expect(vig).toHaveClass(locked ? /is-pencil/ : /^cmp-vignette( is-won)?$/)
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
