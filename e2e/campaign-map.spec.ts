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
