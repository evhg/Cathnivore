import { test, expect } from '@playwright/test'

// Plan item 35: the campaign screen is a map of Marrow. Won chapters free their regions; Cath stands at
// the next chapter; the map never scrolls the page sideways on a phone.
const KEY = 'cathnivore:campaign:v1'

test('a fresh campaign: nothing freed, Cath at chapter 1, no sideways scroll', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Campaign' }).click()
  await expect(page.locator('.cmp-map [data-region]')).toHaveCount(7)
  await expect(page.locator('.cmp-map [data-liberated="true"]')).toHaveCount(0)
  await expect(page.locator('.cmp-map-cath')).toHaveAttribute('data-at', 'fresh-meat')
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
})

test('chapter 1 won: its regions are freed and Cath moves to chapter 2, across a reload', async ({ page }) => {
  await page.addInitScript((k) => localStorage.setItem(k, JSON.stringify({ version: 1, completed: ['fresh-meat'], tutorialDone: true })), KEY)
  await page.goto('/')
  await page.getByRole('button', { name: 'Campaign' }).click()
  await expect(page.locator('.cmp-map [data-region="brindleHills"]')).toHaveAttribute('data-liberated', 'true')
  await expect(page.locator('.cmp-map [data-region="highmoor"]')).toHaveAttribute('data-liberated', 'true')
  await expect(page.locator('.cmp-map [data-region="saltmarsh"]')).toHaveAttribute('data-liberated', 'false')
  await expect(page.locator('.cmp-map-cath')).toHaveAttribute('data-at', 'word-of-mouth')
  await expect(page.getByRole('img', { name: /2 of 7 regions liberated/ })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Campaign' }).click()
  await expect(page.locator('.cmp-map-cath')).toHaveAttribute('data-at', 'word-of-mouth')
})

test('a map pin starts its chapter', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Campaign' }).click()
  await page.locator('.cmp-pin').nth(1).click()
  await expect(page.locator('.scene')).toBeVisible()
})

test('winning chapter 1 presses its seals, and they persist across a reload', async ({ page }) => {
  // Autoplay (HeuristicBot) wins chapter 1 by round 4: the win and the feat, not the swift round-3 seal.
  await page.goto('/?e2eAutoplay=1')
  await page.getByRole('button', { name: 'Campaign' }).click()
  await page.getByRole('button', { name: /^Fresh Meat/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.locator('.end-screen')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.locator('.scene')).toBeVisible()
  const seals = (p: typeof page) => p.locator('.cmp-stop').first().locator('.cmp-seal')
  const read = async () => seals(page).evaluateAll((els) => els.map((e) => `${e.getAttribute('data-seal')}:${e.getAttribute('data-earned')}`))
  await page.goto('/')
  await page.getByRole('button', { name: 'Campaign' }).click()
  expect(await read()).toEqual(['win:true', 'hard:false', 'feat:true'])
  await expect(page.locator('.cmp-map-cath')).toHaveAttribute('data-at', 'word-of-mouth')
  await page.reload()
  await page.getByRole('button', { name: 'Campaign' }).click()
  expect(await read()).toEqual(['win:true', 'hard:false', 'feat:true'])
  // Chapter 1 has no Hard replay (its second seal is the swift win); a later won chapter does.
  await expect(page.locator('.cmp-stop').first().locator('.cmp-hard')).toHaveCount(0)
})

test('a won chapter offers Play on Hard, which starts it on Hard', async ({ page }) => {
  await page.addInitScript((k) => localStorage.setItem(k, JSON.stringify({ version: 1, completed: ['fresh-meat', 'word-of-mouth'], tutorialDone: true, coachedChapters: ['word-of-mouth'] })), KEY)
  await page.goto('/')
  await page.getByRole('button', { name: 'Campaign' }).click()
  await page.locator('.cmp-stop').nth(1).getByRole('button', { name: 'Play on Hard' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  // Hard starts Public Trust at 8 (normal: 10).
  await expect(page.locator('[data-tutorial="trust"] .board-num')).toHaveText('8')
})

async function winChapter1AndReturn(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/?e2eAutoplay=1')
  await page.getByRole('button', { name: 'Campaign' }).click()
  await page.getByRole('button', { name: /^Fresh Meat/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.locator('.end-screen')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.locator('.scene')).toBeVisible()
  // Through the closing scene, back to the campaign.
  for (let i = 0; i < 30 && (await page.locator('.scene').count()) > 0; i++) {
    await page.getByRole('button', { name: /Continue|Next/ }).first().click()
  }
}

test('a first win plays the chapter-complete moment: the region floods, Cath walks on, the next stop slides in', async ({ page }) => {
  await winChapter1AndReturn(page)
  const map = page.locator('.cmp-map')
  // It starts with chapter 1's regions still held and Cath at its pin...
  await expect(map).toHaveAttribute('data-phase', /before|flood/)
  await page.screenshot({ path: `e2e/screenshots/cmpmap/moment-${test.info().project.name}-1.png` })
  await expect(map).toHaveAttribute('data-phase', 'walk', { timeout: 6000 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `e2e/screenshots/cmpmap/moment-${test.info().project.name}-2.png` })
  // ...and ends with them freed and Cath at chapter 2.
  await expect(map).toHaveAttribute('data-phase', 'done', { timeout: 6000 })
  await expect(page.locator('.cmp-map [data-region="brindleHills"]')).toHaveAttribute('data-liberated', 'true')
  await expect(page.locator('.cmp-map-cath')).toHaveAttribute('data-at', 'word-of-mouth')
  await expect(page.locator('.cmp-map-next')).toContainText('Word of Mouth')
  // Not again on the next visit.
  await page.goto('/')
  await page.getByRole('button', { name: 'Campaign' }).click()
  await expect(map).toHaveAttribute('data-phase', 'done')
  await expect(page.locator('.cmp-map-next')).toHaveCount(0)
})

test('under reduced motion the moment fades instead of walking', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await winChapter1AndReturn(page)
  await expect(page.locator('.cmp-map')).toHaveAttribute('data-phase', 'walk', { timeout: 6000 })
  const cath = page.locator('.cmp-map-cath')
  expect(await cath.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s')
  expect(await cath.evaluate((el) => getComputedStyle(el).animationName)).toBe('cmp-fade')
  await expect(page.locator('.cmp-map')).toHaveAttribute('data-phase', 'done', { timeout: 6000 })
})

test('the title\'s Campaign key shows how much of Marrow is freed', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.marrow-badge')).toHaveAttribute('data-free', '0')
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ version: 1, completed: ['fresh-meat', 'word-of-mouth'], tutorialDone: true })), KEY)
  await page.reload()
  await expect(page.locator('.marrow-badge')).toHaveAttribute('data-free', '3')
  await expect(page.getByRole('button', { name: /Campaign.*3 of 7 regions liberated/ })).toBeVisible()
})
